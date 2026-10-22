import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
test('sandboxed desktop exposes only the narrow ready bridge', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'queuecumber-e2e-'))
 const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
 const app = await electron.launch({ args: ['.', `--user-data-dir=${dir}`], env: { ...env, QUEUECUMBER_TEST: '1' } })
 try {
  const page = await app.firstWindow()
  await expect.poll(() => page.evaluate(() => (window as any).queuecumber?.getStatus())).toEqual({service:'ready'})
  expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined')
  expect(await page.evaluate(() => typeof (window as any).queuecumber.invoke)).toBe('undefined')
  const preferences = await app.evaluate(({ BrowserWindow }) => (BrowserWindow.getAllWindows()[0].webContents as any).getLastWebPreferences())
  expect(preferences.sandbox).toBe(true)
  expect(preferences.contextIsolation).toBe(true)
  expect(preferences.nodeIntegration).toBe(false)
 } finally { await app.close(); await rm(dir,{recursive:true,force:true}) }
})
