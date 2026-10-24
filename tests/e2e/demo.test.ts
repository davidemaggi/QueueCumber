import { test, expect, _electron as electron } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import amqplib from 'amqplib'
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
    await page.getByLabel('AMQP host', { exact: true }).fill('127.0.0.1')
    await page.getByLabel('Management host', { exact: true }).fill('127.0.0.1')
    await page.getByLabel('AMQP port', { exact: true }).fill('25672')
    await page.getByLabel('Management port', { exact: true }).fill('25673')
    await page.getByLabel('Use TLS for AMQP', { exact: true }).uncheck()
    await page.getByLabel('Use TLS for Management', { exact: true }).uncheck()
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
    const captureId = await page.evaluate(() =>
      window.queuecumber.getState().then((s) => s.sessions[0].id),
    )
    await page
      .getByRole('button', { name: 'Start capture', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber
            .getState()
            .then((s) => s.sessions.map((s) => s.id)),
        ),
      )
      .toEqual([captureId])
    await page.getByLabel('Message order').selectOption('asc')
    await expect(page.locator('.message-row').first()).toBeVisible()
    await page
      .getByRole('button', { name: 'Stop capture', exact: true })
      .click()
    await page.getByRole('separator', { name: 'Resize resources pane' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '300',
    )
    await page.getByLabel('Resource type').selectOption('routingKeys')
    await page.getByPlaceholder('Search broker resources').fill('')
    const keys = page.getByRole('group', { name: 'Routing keys' })
    await expect(
      keys.getByRole('checkbox', { name: 'demo.orders', exact: true }),
    ).toHaveCount(0)
    await keys.getByRole('checkbox', { name: 'orders.*', exact: true }).check()
    await keys.getByRole('checkbox', { name: '#', exact: true }).check()
    await expect(page.locator('.capture-title h1')).toHaveText('#, orders.*')
    await page.screenshot({ path: join(qa, 'routing-keys-light.png') })
    await page
      .getByRole('button', { name: 'Start capture', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Stop capture', exact: true }),
    ).toBeVisible()
    const amqp = await amqplib.connect(
        'amqp://cucumber:local-test-only@127.0.0.1:25672/%2F',
      ),
      channel = await amqp.createConfirmChannel()
    channel.publish('demo.routes', 'orders.created', Buffer.from('{"k":1}'))
    await channel.waitForConfirms()
    await amqp.close()
    await expect(page.locator('.message-row').first()).toBeVisible()
    await page.screenshot({ path: join(qa, 'routing-keys-capture-light.png') })
    await page
      .getByRole('button', { name: 'Stop capture', exact: true })
      .click()
    await page.getByLabel('Resource type').selectOption('queue')
    await page.getByPlaceholder('Search broker resources').fill('demo.orders')
    await page
      .getByRole('button', { name: 'queue demo.orders', exact: true })
      .click()
    await expect(
      page.getByRole('checkbox', {
        name: 'Include route demo.routes orders.*',
      }),
    ).toBeChecked()
    await page
      .getByRole('checkbox', { name: 'Include route demo.routes orders.*' })
      .uncheck()
    await expect(
      page.getByRole('button', { name: 'Start capture', exact: true }),
    ).toBeDisabled()
    await page.getByText('Add a routing key manually', { exact: true }).click()
    await page
      .locator('.manual-routes')
      .getByLabel('Exchange', { exact: true })
      .fill('demo.routes')
    await page
      .locator('.manual-routes')
      .getByLabel('Routing pattern', { exact: true })
      .fill('orders.created')
    await page.getByRole('button', { name: 'Add route', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Start capture', exact: true }),
    ).toBeEnabled()
    await page.screenshot({ path: join(qa, 'selected-routes-light.png') })
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByLabel('Theme').selectOption('dark')
    await page.getByLabel('Language').selectOption('it')
    await page.getByRole('button', { name: 'Ispeziona', exact: true }).click()
    await page
      .getByRole('button', { name: 'Modifica connessione', exact: true })
      .click()
    await expect(page.getByLabel('Host AMQP', { exact: true })).toHaveValue(
      '127.0.0.1',
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
