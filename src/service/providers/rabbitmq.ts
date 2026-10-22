import amqp from 'amqplib'
import http from 'node:http'
import https from 'node:https'
import type {ConnectionProfile} from '../../shared/connection'
import type {Provider,ResourcePage,Binding,EndpointStatus} from './provider'
export function failureCode(error:unknown):string {
 const code=(error as {code?:unknown})?.code
 return typeof code==='string'&&/^[A-Z_0-9]{1,40}$/.test(code)?code:'CONNECTION_FAILED'
}
export class RabbitMQ implements Provider {
 readonly vhost:string
 constructor(readonly profile:ConnectionProfile){const u=new URL(profile.protocolUrl);this.vhost=u.pathname?decodeURIComponent(u.pathname.slice(1))||'/':'/'}
 async connect(){const connection=await amqp.connect(this.profile.protocolUrl,{timeout:5000,ca:this.profile.caPem||undefined,rejectUnauthorized:true});connection.on('error',()=>{});return connection}
 async request(path:string):Promise<any>{
  const url=new URL(this.profile.managementUrl.replace(/\/$/,'')+'/api/'+path)
  const protocol=new URL(this.profile.protocolUrl)
  return new Promise((resolve,reject)=>{
   const req=(url.protocol==='https:'?https:http).get(url,{auth:`${decodeURIComponent(protocol.username||'guest')}:${decodeURIComponent(protocol.password||'guest')}`,ca:this.profile.caPem||undefined,rejectUnauthorized:true,timeout:5000},res=>{
    if(res.statusCode!==200){res.resume();const e=Object.assign(new Error('Management access failed'),{code:res.statusCode===401||res.statusCode===403?'ACCESS_REFUSED':'MANAGEMENT_FAILED'});reject(e);return}
    const chunks:Buffer[]=[];let length=0
    res.on('data',chunk=>{length+=chunk.length;if(length>4*1024*1024){res.destroy();reject(Error('Management response too large'))}else chunks.push(chunk)})
    res.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString()))}catch{reject(Error('Invalid management response'))}})
    res.on('error',reject)
   });req.on('timeout',()=>req.destroy(Object.assign(Error('Timed out'),{code:'ETIMEDOUT'})));req.on('error',reject)
  })
 }
 async test():Promise<{protocol:EndpointStatus;management:EndpointStatus}>{
  const check=async(f:()=>Promise<unknown>):Promise<EndpointStatus>=>{try{await f();return {ok:true}}catch(e){return {ok:false,code:failureCode(e)}}}
  const [protocol,management]=await Promise.all([check(async()=>{const c=await this.connect();await c.close()}),check(()=>this.request('overview'))])
  return {protocol,management}
 }
 async listResources(query:string,page:number):Promise<ResourcePage>{
  const params=new URLSearchParams({page:String(page),page_size:'100',name:query,use_regex:'false',pagination:'true'})
  const vhost=encodeURIComponent(this.vhost)
  const [queues,exchanges]=await Promise.all([this.request(`queues/${vhost}?${params}`),this.request(`exchanges/${vhost}?${params}`)])
  const resources=[...queues.items.map((q:any)=>({name:q.name,vhost:this.vhost,kind:q.type==='stream'?'stream':'queue',type:q.type,messages:q.messages??0})),...exchanges.items.map((e:any)=>({name:e.name,vhost:this.vhost,kind:'exchange',type:e.type}))]
  return {resources,page,hasMore:page<Math.max(queues.page_count,exchanges.page_count)}
 }
 async bindings(queue:string):Promise<Binding[]>{
  const bindings=await this.request(`queues/${encodeURIComponent(this.vhost)}/${encodeURIComponent(queue)}/bindings`)
  const types=new Map<string,string>()
  const sources=[...new Set<string>(bindings.map((b:any)=>b.source))]
  if(sources.length>100)throw Error('Too many source exchanges')
  for(const source of sources) {if(!source){types.set(source,'default');continue}const e=await this.request(`exchanges/${encodeURIComponent(this.vhost)}/${encodeURIComponent(source)}`);types.set(source,e.type)}
  return bindings.map((b:any)=>({...b,type:types.get(b.source)??'unknown',supported:!!b.source&&['direct','topic','fanout','headers'].includes(types.get(b.source)??'')}))
 }
}
