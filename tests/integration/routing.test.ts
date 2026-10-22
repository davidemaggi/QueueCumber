import {it,expect} from 'vitest'
import amqp from 'amqplib'
import {randomUUID,randomBytes} from 'node:crypto'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {profile} from '../fixtures/broker'
import {SessionManager} from '../../src/service/sessions'
import {CaptureStorage} from '../../src/service/storage'
import {DEFAULT_SETTINGS} from '../../src/shared/limits'
for(const type of ['direct','topic','fanout','headers'])it(`mirrors ${type} bindings without consuming original deliveries`,async()=>{
 const connection=await amqp.connect(profile.protocolUrl),channel=await connection.createChannel()
 const name='qc-test-'+randomUUID(),dir=await mkdtemp(join(tmpdir(),'qc-route-'))
 const store=new CaptureStorage(dir,randomBytes(32),DEFAULT_SETTINGS),sessions=new SessionManager(store,()=>DEFAULT_SETTINGS)
 try {
  await channel.assertExchange(name,type,{durable:false});await channel.assertQueue(name,{durable:false})
  const pattern=type==='topic'?'order.*':'order.created',args=type==='headers'?{'x-match':'all',region:'eu'}:{}
  await channel.bindQueue(name,name,pattern,args)
  const session=await sessions.startCapture(profile,{name,vhost:'/',kind:'queue'},{allowPartial:true})
  expect(session.state).toBe('capturing')
  channel.publish(name,'order.created',Buffer.from('real-message'),{headers:{region:'eu'}})
  await expect.poll(()=>sessions.list()[0].captured).toBe(1)
  expect((await channel.checkQueue(name)).messageCount).toBe(1)
  expect((await channel.checkQueue(name)).consumerCount).toBe(0)
  expect(store.get(store.readPage(session.id,null,10).records[0].id).payload.toString()).toBe('real-message')
  await sessions.stopCapture(session.id)
  expect(sessions.list()[0].state).toBe('stopped')
  expect((await channel.checkQueue(name)).messageCount).toBe(1)
 } finally {await sessions.close();store.close();await channel.deleteQueue(name);await channel.deleteExchange(name);await connection.close();await rm(dir,{recursive:true,force:true})}
})
it('refuses default-only routes and marks storage failure without touching originals',async()=>{
 const connection=await amqp.connect(profile.protocolUrl),channel=await connection.createChannel(),name='qc-test-'+randomUUID()
 await channel.assertExchange(name,'direct',{durable:false});await channel.assertQueue(name,{durable:false})
 const sessions=new SessionManager({append:()=>{throw Error('disk full')}},()=>DEFAULT_SETTINGS)
 try {
  await expect(sessions.startCapture(profile,{name,vhost:'/',kind:'queue'},{allowPartial:true})).rejects.toThrow()
  await channel.bindQueue(name,name,'route')
  const session=await sessions.startCapture(profile,{name,vhost:'/',kind:'queue'},{allowPartial:true})
  channel.publish(name,'route',Buffer.from('test'))
  await expect.poll(()=>sessions.list().find(s=>s.id===session.id)?.state).toBe('failed')
  expect((await channel.checkQueue(name)).messageCount).toBe(1)
 }finally{await sessions.close();await channel.deleteQueue(name);await channel.deleteExchange(name);await connection.close()}
})
