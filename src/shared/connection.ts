import {z} from 'zod'
export const connectionSchema=z.object({id:z.string().uuid().optional(),name:z.string().trim().min(1).max(100),protocolUrl:z.string().max(8192),managementUrl:z.string().max(8192),allowInsecure:z.boolean(),caPem:z.string().max(1024*1024).optional()}).strict().superRefine((p,ctx)=>{
 try {
  const protocol=new URL(p.protocolUrl),management=new URL(p.managementUrl)
  if(!['amqp:','amqps:'].includes(protocol.protocol)||!['http:','https:'].includes(management.protocol)||!protocol.hostname||!management.hostname||management.username||management.password||management.search||management.hash||protocol.hash) throw Error()
  if(!p.allowInsecure&&(protocol.protocol!=='amqps:'||management.protocol!=='https:')) throw Error()
 } catch {ctx.addIssue({code:'custom',message:'Invalid endpoints or insecure transport without consent'})}
})
export type ConnectionInput=z.infer<typeof connectionSchema>
export type ConnectionProfile=ConnectionInput & {id:string}
export type ConnectionSummary={id:string;name:string;provider:'rabbitmq'}
export function validateConnection(input:unknown):ConnectionInput{return connectionSchema.parse(input)}
