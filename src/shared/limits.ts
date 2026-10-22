import { z } from 'zod'
const positive = (max: number) => z.number().int().min(1).max(max)
export const settingsSchema = z.object({
 schemaVersion:z.literal(1), cacheBytes:positive(2**31), diskBytes:positive(2**40), retentionMs:positive(10*365*86400000), maxPayloadBytes:positive(64*1024*1024), previewBytes:positive(1024*1024), admittedMessagesPerSecond:positive(1000000).nullable()
}).strict().refine(s => s.previewBytes<=s.maxPayloadBytes && s.maxPayloadBytes<=s.cacheBytes && s.maxPayloadBytes*2<=s.diskBytes,'Inconsistent resource budgets')
export type CaptureSettings = z.infer<typeof settingsSchema>
export const DEFAULT_SETTINGS: CaptureSettings = Object.freeze({schemaVersion:1,cacheBytes:64*1024*1024,diskBytes:2*1024**3,retentionMs:7*86400000,maxPayloadBytes:16*1024*1024,previewBytes:256*1024,admittedMessagesPerSecond:null})
export function validateSettings(input:unknown):CaptureSettings { return settingsSchema.parse(input) }
export function resolveSessionSettings(global:CaptureSettings, overrides:Partial<CaptureSettings>):CaptureSettings {
 const resolved=validateSettings({...global,...overrides})
 for(const key of ['cacheBytes','diskBytes','retentionMs','maxPayloadBytes','previewBytes'] as const) if(resolved[key]>global[key]) throw new Error('Session exceeds global budget')
 if(global.admittedMessagesPerSecond!==null && (resolved.admittedMessagesPerSecond===null || resolved.admittedMessagesPerSecond>global.admittedMessagesPerSecond)) throw new Error('Session exceeds global rate')
 return resolved
}
export function settingsEffects(before:CaptureSettings, after:CaptureSettings):string[] {
 const effects:string[]=[]
 if(after.diskBytes<before.diskBytes || after.retentionMs<before.retentionMs) effects.push('retention')
 if(after.cacheBytes<before.cacheBytes) effects.push('cache')
 if(after.maxPayloadBytes!==before.maxPayloadBytes) effects.push('subscription')
 return effects
}
