import { describe, it, expect } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, validateSettings, resolveSessionSettings, settingsEffects } from '../../src/shared/limits'
import { SettingsRepository } from '../../src/service/settings'
describe('capture settings boundary', () => {
 it('offers finite byte-based defaults and rejects invalid values', () => {
  expect(DEFAULT_SETTINGS.cacheBytes).toBe(67108864)
  expect(DEFAULT_SETTINGS.diskBytes).toBe(2147483648)
  for (const value of [0,-1,Infinity,NaN,1.5,Number.MAX_SAFE_INTEGER]) {
   expect(() => validateSettings({...DEFAULT_SETTINGS,cacheBytes:value})).toThrow()
  }
  expect(() => validateSettings({...DEFAULT_SETTINGS,previewBytes:33554432})).toThrow()
  expect(() => validateSettings({...DEFAULT_SETTINGS,admittedMessagesPerSecond:0})).toThrow()
 })
 it('prevents a session escaping global budgets or its rate cap', () => {
  expect(() => resolveSessionSettings(DEFAULT_SETTINGS,{diskBytes:4294967296})).toThrow()
  expect(() => resolveSessionSettings({...DEFAULT_SETTINGS,admittedMessagesPerSecond:10},{admittedMessagesPerSecond:null})).toThrow()
  expect(resolveSessionSettings(DEFAULT_SETTINGS,{cacheBytes:33554432}).cacheBytes).toBe(33554432)
  expect(settingsEffects(DEFAULT_SETTINGS,{...DEFAULT_SETTINGS,diskBytes:1073741824})).toContain('retention')
 })
 it('persists atomically and surfaces corrupt persisted settings', async () => {
  const dir=await mkdtemp(join(tmpdir(),'qc-settings-'))
  try {
   const repo=new SettingsRepository(dir)
   expect((await repo.read()).settings.cacheBytes).toBe(67108864)
   await repo.save({...DEFAULT_SETTINGS,cacheBytes:33554432})
   expect((await repo.read()).settings.cacheBytes).toBe(33554432)
   await expect(repo.save({...DEFAULT_SETTINGS,diskBytes:-1})).rejects.toThrow()
   expect(JSON.parse(await readFile(join(dir,'settings.json'),'utf8')).cacheBytes).toBe(33554432)
   await writeFile(join(dir,'settings.json'),'broken')
   expect((await repo.read()).warning).toBeTruthy()
  } finally { await rm(dir,{recursive:true,force:true}) }
 })
})
