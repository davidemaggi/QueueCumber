import {it,expect} from 'vitest'
import {RabbitMQ} from '../../src/service/providers/rabbitmq'
export const profile={id:'integration',name:'Test broker',protocolUrl:'amqp://cucumber:local-test-only@127.0.0.1:25672/%2F',managementUrl:'http://127.0.0.1:25673',allowInsecure:true}
it('tests endpoints independently and discovers broker-native resources',async()=>{
 const broker=new RabbitMQ(profile)
 expect(await broker.test()).toEqual({protocol:{ok:true},management:{ok:true}})
 const page=await broker.listResources('',1)
 expect(page.resources.some(r=>r.kind==='exchange'&&r.name==='amq.topic')).toBe(true)
 const denied=new RabbitMQ({...profile,managementUrl:'http://127.0.0.1:1'})
 const result=await denied.test();expect(result.protocol.ok).toBe(true);expect(result.management.ok).toBe(false)
 expect(JSON.stringify(result)).not.toContain('local-test-only')
})
