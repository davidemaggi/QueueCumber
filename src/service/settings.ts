import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { DEFAULT_SETTINGS, validateSettings, type CaptureSettings } from '../shared/limits'
export class SettingsRepository {
 constructor(private dir:string) {}
 async read():Promise<{settings:CaptureSettings;warning?:string}> {
  try {return {settings:validateSettings(JSON.parse(await readFile(join(this.dir,'settings.json'),'utf8')))}}
  catch(error) { if((error as NodeJS.ErrnoException).code==='ENOENT') return {settings:{...DEFAULT_SETTINGS}}
   return {settings:{...DEFAULT_SETTINGS},warning:'Stored settings are invalid. Review and save settings before capturing.'}
  }
 }
 async save(input:unknown):Promise<void> {
  const settings=validateSettings(input)
  await mkdir(this.dir,{recursive:true,mode:0o700})
  const temporary=join(this.dir,`settings.${randomUUID()}.tmp`)
  try {await writeFile(temporary,JSON.stringify(settings),{mode:0o600});await rename(temporary,join(this.dir,'settings.json'))}
  finally {await rm(temporary,{force:true})}
 }
}
