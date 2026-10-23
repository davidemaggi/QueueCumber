import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('background close preserves a reopenable app and explicit Quit exits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-background-'))
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${dir}`],
    env: { ...env, QUEUECUMBER_TEST: '1' },
  })
  try {
    const page = await app.firstWindow()
    await expect
      .poll(() => page.evaluate(() => window.queuecumber.getStatus()))
      .toEqual({ service: 'ready' })
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const option = page.getByLabel('Keep running when the window closes', {
      exact: true,
    })
    await expect(option).not.toBeChecked()
    await option.click()
    await expect(option).toBeChecked()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber
            .getState()
            .then((s) => s.desktop.preferences.closeToTray),
        ),
      )
      .toBe(true)
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].close(),
    )
    const desktop = await page.evaluate(() =>
      window.queuecumber.getState().then((s) => s.desktop),
    )
    const route = await app.evaluate(({ BrowserWindow }) => ({
      visible: BrowserWindow.getAllWindows()[0].isVisible(),
      minimized: BrowserWindow.getAllWindows()[0].isMinimized(),
    }))
    if (desktop.platform === 'linux' || !desktop.trayAvailable)
      expect(route.visible || route.minimized).toBe(true)
    else expect(route.visible).toBe(false)
    await app.evaluate(({ app }) => app.emit('activate', {}, false))
    await expect
      .poll(() =>
        app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isVisible(),
        ),
      )
      .toBe(true)
    await page.getByLabel('Language').selectOption('it')
    await expect(
      page.getByRole('heading', { name: 'Acquisizione in background' }),
    ).toBeVisible()
    const qa = join(tmpdir(), 'queuecumber-qa')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(qa, { recursive: true })
    await page.getByLabel('Tema').selectOption('light')
    await page.screenshot({ path: join(qa, 'background-settings-light.png') })
    await page.getByLabel('Tema').selectOption('dark')
    await page.screenshot({ path: join(qa, 'background-settings-dark.png') })
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1000, 800),
    )
    await page.screenshot({ path: join(qa, 'background-settings-narrow.png') })
    expect(
      JSON.parse(await readFile(join(dir, 'desktop.json'), 'utf8')).locale,
    ).toBe('it')
    const closed = app.waitForEvent('close')
    await app.evaluate(({ app }) => app.quit())
    await closed
  } finally {
    await app.close().catch(() => {})
    await rm(dir, { recursive: true, force: true })
  }
})

test('closing the window without background opt-in exits the application', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-close-'))
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${dir}`],
    env: { ...env, QUEUECUMBER_TEST: '1' },
  })
  try {
    const page = await app.firstWindow()
    await expect
      .poll(() => page.evaluate(() => window.queuecumber.getStatus()))
      .toEqual({ service: 'ready' })
    const closed = app.waitForEvent('close')
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].close(),
    )
    await closed
  } finally {
    await app.close().catch(() => {})
    await rm(dir, { recursive: true, force: true })
  }
})
