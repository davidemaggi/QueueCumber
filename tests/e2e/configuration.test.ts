import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
test('exports encrypted connections, previews conflicts and imports copies through native dialogs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-config-ui-')),
    path = join(dir, 'connections.qcc'),
    env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${join(dir, 'data')}`],
    env: { ...env, QUEUECUMBER_TEST: '1' },
  })
  try {
    const page = await app.firstWindow()
    await expect
      .poll(() => page.evaluate(() => window.queuecumber.getStatus()))
      .toEqual({ service: 'ready' })
    await page.evaluate(() =>
      window.queuecumber.saveConnection({
        name: 'Synthetic connection',
        protocolUrl: 'amqps://user:secret@example.invalid',
        managementUrl: 'https://example.invalid',
        allowInsecure: false,
      }),
    )
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file })
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      })
    }, path)
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const password = page.getByLabel('Configuration password')
    await password.fill('synthetic password')
    await page.getByLabel('Include credentials').check()
    await page
      .getByRole('button', {
        name: 'Export encrypted configuration',
        exact: true,
      })
      .click()
    await expect(
      page.getByText('Configuration transfer completed.', { exact: true }),
    ).toBeVisible()
    expect((await readFile(path)).includes('secret')).toBe(false)
    await expect(password).toHaveValue('')
    await password.fill('synthetic password')
    await page
      .getByRole('button', {
        name: 'Import encrypted configuration',
        exact: true,
      })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Review incoming connections' }),
    ).toBeVisible()
    await expect(page.getByText(/Conflicts with/)).toBeVisible()
    const qa = join(tmpdir(), 'queuecumber-qa')
    await mkdir(qa, { recursive: true })
    await page
      .getByRole('heading', { name: 'Review incoming connections' })
      .scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(qa, 'configuration-preview-light.png') })
    await page.getByLabel('Theme').selectOption('dark')
    await page
      .getByRole('heading', { name: 'Review incoming connections' })
      .scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(qa, 'configuration-preview-dark.png') })
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1000, 800),
    )
    await page.getByLabel('Language').selectOption('it')
    await page
      .getByRole('button', { name: 'Importa connessioni', exact: true })
      .scrollIntoViewIfNeeded()
    await page.screenshot({
      path: join(qa, 'configuration-preview-narrow-it.png'),
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.getByLabel('Lingua').selectOption('en')
    await page
      .getByRole('button', { name: 'Import connections', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber.getState().then((s) => s.profiles.length),
        ),
      )
      .toBe(2)
    await page.getByRole('button', { name: 'Inspect', exact: true }).click()
    await page
      .getByRole('button', {
        name: 'Synthetic connection (imported 1)',
        exact: true,
      })
      .click()
    await page
      .getByRole('button', { name: 'Edit connection', exact: true })
      .click()
    await page.getByLabel('Connection setup').selectOption('url')
    await expect(page.getByLabel('AMQP URL', { exact: true })).toHaveValue(
      'amqps://user:secret@example.invalid',
    )
    await page
      .getByLabel('Connection name', { exact: true })
      .fill('Updated imported connection')
    await page
      .getByLabel('AMQP URL', { exact: true })
      .fill('amqps://replacement:new-secret@example.invalid')
    await page
      .getByLabel('Management URL', { exact: true })
      .fill('https://example.invalid')
    await page
      .getByRole('button', { name: 'Save connection', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber
            .getState()
            .then((s) => s.profiles.map((p) => p.name)),
        ),
      )
      .toContain('Updated imported connection')
    expect(
      await page.evaluate(() =>
        window.queuecumber.getState().then((s) => s.profiles.length),
      ),
    ).toBe(2)
  } finally {
    await app.close()
    await rm(dir, { recursive: true, force: true })
  }
})
