import { test, expect, _electron as electron } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
test('uses separate connection fields and captures seeded demo stream data', async () => {
  await promisify(execFile)(
    process.execPath,
    ['scripts/demo.mjs', '--seed-only'],
    { timeout: 30000 },
  )
  const dir = await mkdtemp(join(tmpdir(), 'qc-demo-ui-')),
    env = { ...process.env },
    qa = join(tmpdir(), 'queuecumber-qa')
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
    await page
      .getByRole('button', { name: 'Add connection', exact: true })
      .first()
      .click()
    await page
      .getByLabel('Connection name', { exact: true })
      .fill('RabbitMQ demo')
    await page
      .getByLabel('AMQP endpoint', { exact: true })
      .fill('amqp://127.0.0.1:25672')
    await page
      .getByLabel('Management URL', { exact: true })
      .fill('http://127.0.0.1:25673')
    await page.getByLabel('Allow unencrypted transport').check()
    await mkdir(qa, { recursive: true })
    await page.screenshot({ path: join(qa, 'guided-endpoints-light.png') })
    await page.getByRole('button', { name: 'Next: credentials' }).click()
    await expect(page.getByLabel('Username', { exact: true })).toBeFocused()
    await page.getByLabel('Username', { exact: true }).fill('cucumber')
    await page.getByLabel('Password', { exact: true }).fill('local-test-only')
    await page.screenshot({ path: join(qa, 'guided-credentials-light.png') })
    await page
      .getByRole('button', { name: 'Save connection', exact: true })
      .click()
    await expect(
      page.getByText('Select a queue, stream or topic on the left.', {
        exact: false,
      }),
    ).toBeVisible()
    await page.getByPlaceholder('Search broker resources').fill('demo.events')
    await page
      .getByRole('button', { name: 'stream demo.events', exact: true })
      .click()
    await page.getByLabel('Start reading').selectOption('first')
    await page
      .getByRole('button', { name: 'Start capture', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber.getState().then((s) => s.sessions[0]?.captured),
        ),
      )
      .toBeGreaterThanOrEqual(5)
    await page.locator('.message-row').first().click()
    await expect(page.locator('.message-detail pre')).toContainText(
      '"demo": true',
    )
    await page.screenshot({ path: join(qa, 'demo-stream-light.png') })
    await page
      .getByRole('button', { name: 'Stop capture', exact: true })
      .click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByLabel('Theme').selectOption('dark')
    await page.getByLabel('Language').selectOption('it')
    await page.getByRole('button', { name: 'Ispeziona', exact: true }).click()
    await page
      .getByRole('button', { name: 'Modifica connessione', exact: true })
      .click()
    await expect(page.getByLabel('Endpoint AMQP', { exact: true })).toHaveValue(
      '',
    )
    await page.screenshot({ path: join(qa, 'guided-endpoints-dark-it.png') })
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1000, 800),
    )
    await page.screenshot({ path: join(qa, 'guided-endpoints-narrow-it.png') })
  } finally {
    await app.close()
    await rm(dir, { recursive: true, force: true })
  }
})
