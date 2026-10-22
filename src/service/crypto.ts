import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto'
const AAD=Buffer.from('QueueCumber encrypted record v1')
export function seal(key:Buffer,value:Buffer):Buffer {
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(AAD)
 const data=Buffer.concat([cipher.update(value),cipher.final()])
 return Buffer.concat([Buffer.from([1]),iv,cipher.getAuthTag(),data])
}
export function open(key:Buffer,value:Buffer):Buffer {
 if(value.length<29 || value[0]!==1) throw new Error('Invalid encrypted record')
 const cipher=createDecipheriv('aes-256-gcm',key,value.subarray(1,13));cipher.setAAD(AAD);cipher.setAuthTag(value.subarray(13,29))
 return Buffer.concat([cipher.update(value.subarray(29)),cipher.final()])
}
