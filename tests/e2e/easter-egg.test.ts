import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { version } from '../../package.json'
const CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]
test('seven version clicks and the Konami code earn a scolding', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'queuecumber-e2e-'))
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${dir}`],
    env: { ...env, QUEUECUMBER_TEST: '1' },
  })
  const qa = join(tmpdir(), 'queuecumber-qa')
  await mkdir(qa, { recursive: true })
  try {
    const page = await app.firstWindow()
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(860, 600),
    )
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => localStorage.setItem('qc.theme', t), theme)
      await page.reload()
      const badge = page.getByRole('button', { name: new RegExp(version) })
      for (let i = 0; i < 7; i++) await badge.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: join(qa, `egg-pad-${theme}.png`) })
      await page.getByRole('button', { name: 'Up' }).click()
      for (const key of CODE.slice(1)) await page.keyboard.press(key)
      const apology = page.getByRole('button', { name: 'Sorry, back to work' })
      await expect(apology).toBeFocused()
      await page.waitForTimeout(600)
      await page.screenshot({ path: join(qa, `egg-busted-${theme}.png`) })
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
      await apology.click()
      await expect(dialog).toBeHidden()
      await expect(page.locator('canvas.egg-confetti')).toHaveCount(0)
    }
  } finally {
    await app.close()
    await rm(dir, { recursive: true, force: true })
  }
})
