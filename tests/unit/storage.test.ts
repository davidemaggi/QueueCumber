import {DatabaseSync} from 'node:sqlite'
import {it,expect} from 'vitest'
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomBytes} from 'node:crypto'
import {CaptureStorage} from '../../src/service/storage'
import {DEFAULT_SETTINGS} from '../../src/shared/limits'
it('stores encrypted raw bytes, bounds cache and evicts retained history',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qc-store-'));const key=randomBytes(32)
 const settings={...DEFAULT_SETTINGS,cacheBytes:4096,diskBytes:131072,maxPayloadBytes:1024,previewBytes:128}
 const store=new CaptureStorage(dir,key,settings)
 try {
  store.append('a',{payload:Buffer.from('private-message'),headers:{private:'secret-header'},routingKey:'private.route',exchange:'private.exchange'})
  const rows=store.readPage('a',null,20)
  expect(rows.records).toHaveLength(1)
  expect(store.get(rows.records[0].id).payload.toString()).toBe('private-message')
  for(let i=0;i<200;i++)store.append('a',{payload:randomBytes(1024),headers:{i},routingKey:'key',exchange:'events'})
  expect(store.stats().cacheBytes).toBeLessThanOrEqual(4096)
  expect(store.stats().evicted).toBeGreaterThan(0)
  expect(store.stats().diskBytes).toBeLessThanOrEqual(131072)
  const result=store.append('a',{payload:Buffer.alloc(2048),headers:{},routingKey:'key',exchange:'events'})
  expect(result.omitted).toBe(true)
  expect(store.readPage('a',null,20).records[0].omission).toBe('payload-limit')
  for(const file of await readdir(dir)) {
   const bytes=await readFile(join(dir,file));expect(bytes.includes('private-message')).toBe(false);expect(bytes.includes('secret-header')).toBe(false)
  }
 } finally {store.close();await rm(dir,{recursive:true,force:true})}
})
it('persists across restart and refuses tampered encrypted content',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qc-recovery-')),key=randomBytes(32)
 let store=new CaptureStorage(dir,key,DEFAULT_SETTINGS)
 store.append('session',{payload:Buffer.from([0,255,128]),headers:{binary:Buffer.from([1,2])},routingKey:'r',exchange:'e'})
 store.close();store=new CaptureStorage(dir,key,DEFAULT_SETTINGS)
 try {const record=store.get(store.readPage('session',null,1).records[0].id);expect([...record.payload]).toEqual([0,255,128]);expect(Buffer.isBuffer(record.headers.binary)).toBe(true)}
 finally{store.close();const db=new DatabaseSync(join(dir,'captures.db'));db.prepare('UPDATE captures SET data=?').run(Buffer.from('tampered'));db.close();const changed=new CaptureStorage(dir,key,DEFAULT_SETTINGS);expect(()=>changed.readPage('session',null,1)).toThrow();changed.close();await rm(dir,{recursive:true,force:true})}
})
it('enforces retention age and fails writes after storage closes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qc-age-')),key=randomBytes(32)
 const store=new CaptureStorage(dir,key,DEFAULT_SETTINGS)
 try {
  store.append('age',{payload:Buffer.from('old'),headers:{},routingKey:'r',exchange:'e'})
  const db=new DatabaseSync(join(dir,'captures.db'));db.exec('UPDATE captures SET time=0');db.close()
  store.applyRetention(DEFAULT_SETTINGS)
  expect(store.readPage('age',null,10).records).toHaveLength(0)
  store.close()
  expect(()=>store.append('age',{payload:Buffer.from('new'),headers:{},routingKey:'r',exchange:'e'})).toThrow()
 }finally{await rm(dir,{recursive:true,force:true})}
})
