import {it,expect} from 'vitest'
import {RabbitMQ} from '../../src/service/providers/rabbitmq'
import {profile} from '../fixtures/broker'
it('tests endpoints independently and discovers broker-native resources',async()=>{
 const broker=new RabbitMQ(profile)
 expect(await broker.test()).toEqual({protocol:{ok:true},management:{ok:true}})
 const page=await broker.listResources('',1)
 expect(page.resources.some(r=>r.kind==='exchange'&&r.name==='amq.topic')).toBe(true)
 const denied=new RabbitMQ({...profile,managementUrl:'http://127.0.0.1:1'})
 const result=await denied.test();expect(result.protocol.ok).toBe(true);expect(result.management.ok).toBe(false)
 expect(JSON.stringify(result)).not.toContain('local-test-only')
})
