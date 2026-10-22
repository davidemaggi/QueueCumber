import {DatabaseSync} from 'node:sqlite'
import {mkdirSync,chmodSync,statSync} from 'node:fs'
import {join} from 'node:path'
import {serialize,deserialize} from 'node:v8'
import {seal,open} from './crypto'
import {validateSettings,type CaptureSettings} from '../shared/limits'
export type IncomingRecord={payload:Buffer;headers:Record<string,unknown>;routingKey:string;exchange:string;contentType?:string}
export type StoredRecord=IncomingRecord & {timestamp:number;originalBytes:number;omission?:string;sessionId:string}
export type MessageSummary={id:number;timestamp:number;bytes:number;routingKey:string;exchange:string;preview:string;omission?:string}
export class CaptureStorage {
 private db:DatabaseSync
 private cache=new Map<number,Buffer>()
 private cacheSize=0
 private evicted=0
 private path:string
 private settings:CaptureSettings
 constructor(dir:string,private key:Buffer,settings:CaptureSettings){
  this.key=Buffer.from(key);this.settings=validateSettings(settings);mkdirSync(dir,{recursive:true,mode:0o700});this.path=join(dir,'captures.db')
  this.db=new DatabaseSync(this.path);chmodSync(this.path,0o600)
  this.db.exec('PRAGMA auto_vacuum=FULL; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS captures (id INTEGER PRIMARY KEY AUTOINCREMENT, session TEXT NOT NULL, time INTEGER NOT NULL, data BLOB NOT NULL); CREATE INDEX IF NOT EXISTS session_page ON captures(session,id);')
  this.applyRetention(settings)
 }
 private cached(id:number,bytes:Buffer){
  if(bytes.length>this.settings.cacheBytes)return
  const prior=this.cache.get(id);if(prior){this.cacheSize-=prior.length;this.cache.delete(id)}
  while(this.cacheSize+bytes.length>this.settings.cacheBytes && this.cache.size){const [old,b]=this.cache.entries().next().value!;this.cache.delete(old);this.cacheSize-=b.length}
  this.cache.set(id,bytes);this.cacheSize+=bytes.length
 }
 append(sessionId:string,input:IncomingRecord):{id:number;omitted:boolean}{
  let omission=input.payload.length>this.settings.maxPayloadBytes?'payload-limit':undefined
  if(serialize(input.headers).length>65536)omission='metadata-limit'
  const record:StoredRecord={...input,sessionId,timestamp:Date.now(),originalBytes:input.payload.length,...(omission?{payload:Buffer.alloc(0),headers:{},omission}:{})}
  const bytes=serialize(record),encrypted=seal(this.key,bytes)
  this.prune(encrypted.length)
  const result=this.db.prepare('INSERT INTO captures(session,time,data) VALUES(?,?,?)').run(sessionId,record.timestamp,encrypted)
  const id=Number(result.lastInsertRowid);this.cached(id,bytes)
  if(this.stats().diskBytes>this.settings.diskBytes)throw Error('Capture disk budget exceeded')
  return {id,omitted:!!omission}
 }
 get(id:number):StoredRecord {
  const row=this.db.prepare('SELECT session,data FROM captures WHERE id=?').get(id) as {session:string;data:Uint8Array}|undefined
  if(!row)throw Error('Message is no longer retained')
  const bytes=this.cache.get(id)??open(this.key,Buffer.from(row.data))
  const record=deserialize(bytes) as StoredRecord
  if(record.sessionId!==row.session)throw Error('Capture integrity check failed')
  this.cached(id,bytes);return record
 }
 readPage(sessionId:string,cursor:number|null,limit:number):{records:MessageSummary[];nextCursor:number|null}{
  if(!Number.isSafeInteger(limit)||limit<1||limit>50||cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<1))throw Error('Invalid page')
  this.prune(0)
  const rows=this.db.prepare('SELECT id FROM captures WHERE session=? AND id<? ORDER BY id DESC LIMIT ?').all(sessionId,cursor??Number.MAX_SAFE_INTEGER,limit+1) as {id:number}[]
  const selected=rows.slice(0,limit)
  return {records:selected.map(({id})=>{const m=this.get(id);return {id,timestamp:m.timestamp,bytes:m.originalBytes,routingKey:m.routingKey.slice(0,255),exchange:m.exchange.slice(0,255),preview:m.payload.subarray(0,160).toString('utf8'),omission:m.omission}}),nextCursor:rows.length>limit?selected.at(-1)!.id:null}
 }
 private prune(incoming:number){
  const old=this.db.prepare('DELETE FROM captures WHERE time<?').run(Date.now()-this.settings.retentionMs);this.evicted+=Number(old.changes)
  let total=Number((this.db.prepare('SELECT COALESCE(SUM(length(data)),0) AS n FROM captures').get() as {n:number}).n)
  const budget=Math.floor(this.settings.diskBytes*0.6)
  while(total+incoming>budget){const row=this.db.prepare('SELECT id,length(data) AS size FROM captures ORDER BY id LIMIT 1').get() as {id:number;size:number}|undefined;if(!row)throw Error('Message exceeds disk budget');this.db.prepare('DELETE FROM captures WHERE id=?').run(row.id);total-=row.size;this.evicted++}
  if(old.changes||this.cacheSize>this.settings.cacheBytes||total+incoming>budget/2){this.cache.clear();this.cacheSize=0}
 }
 applyRetention(settings:CaptureSettings){this.settings=validateSettings(settings);this.prune(0);this.cache.clear();this.cacheSize=0;return this.stats()}
 stats(){let diskBytes=0;for(const path of [this.path,this.path+'-journal']){try{diskBytes+=statSync(path).size}catch{ /* No active rollback journal. */ }}return {cacheBytes:this.cacheSize,diskBytes,evicted:this.evicted}}
 close(){this.cache.clear();this.cacheSize=0;this.db.close();this.key.fill(0)}
}
