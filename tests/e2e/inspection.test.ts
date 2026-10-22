import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import amqp from 'amqplib'
import { randomUUID } from 'node:crypto'
import { profile } from '../fixtures/broker'
test('saves a session-only connection, captures a real message and changes theme/locale', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-ui-')),
    env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const broker = await amqp.connect(profile.protocolUrl),
    channel = await broker.createChannel(),
    name = 'qc-test-' + randomUUID()
  await channel.assertExchange(name, 'topic', { durable: false })
  await channel.assertQueue(name, { durable: false })
  await channel.bindQueue(name, name, 'order.*')
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${dir}`],
    env: { ...env, QUEUECUMBER_TEST: '1' },
  })
  try {
    const page = await app.firstWindow()
    await page
      .getByRole('button', { name: 'Add connection', exact: true })
      .first()
      .click()
    await page.getByLabel('Connection name').fill('Local test')
    await page.getByLabel('AMQP URL').fill(profile.protocolUrl)
    await page.getByLabel('Management URL').fill(profile.managementUrl)
    await page.getByLabel('Allow unencrypted transport').check()
    await page
      .getByRole('button', { name: 'Save connection', exact: true })
      .click()
    await page.getByRole('button', { name: 'Local test', exact: true }).click()
    await page.getByPlaceholder('Search broker resources').fill(name)
    await page
      .getByRole('button', { name: 'queue ' + name, exact: true })
      .click()
    await page
      .getByRole('checkbox', { name: 'Capture supported routes only' })
      .check()
    await page
      .getByRole('button', { name: 'Start capture', exact: true })
      .click()
    await expect(page.locator('.session-state')).toHaveText('capturing')
    channel.publish(
      name,
      'order.created',
      Buffer.from('{"event":"created","safe":"<script>alert(1)</script>"}'),
      { contentType: 'application/json', headers: { region: 'eu' } },
    )
    await page
      .getByRole('button', { name: /order.created/ })
      .first()
      .click()
    await expect(page.locator('pre')).toContainText('"event": "created"')
    await expect(page.locator('pre')).toContainText('<script>alert(1)</script>')
    for (let i = 0; i < 50; i++)
      channel.publish(
        name,
        'order.created',
        Buffer.from(JSON.stringify({ event: 'created', sequence: i })),
        { contentType: 'application/json' },
      )
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber.getState().then((s) => s.sessions[0].captured),
        ),
      )
      .toBe(51)
    await expect(page.locator('.message-row').first()).toContainText(
      'order.created',
    )
    const qaDir = join(tmpdir(), 'queuecumber-qa')
    await mkdir(qaDir, { recursive: true })
    await page.screenshot({ path: join(qaDir, 'inspection-light.png') })
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByLabel('Theme').selectOption('dark')
    await page.getByRole('button', { name: 'Inspect', exact: true }).click()
    await page.screenshot({ path: join(qaDir, 'inspection-dark.png') })
    await page.locator('.message-scroll').evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await expect(page.locator('.message-row').last()).toContainText(
      'order.created',
    )
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1000, 800),
    )
    await page.screenshot({ path: join(qaDir, 'inspection-narrow.png') })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1440, 900),
    )
    await page
      .getByRole('button', { name: 'Stop capture', exact: true })
      .click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByLabel('Theme').selectOption('light')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.screenshot({ path: join(qaDir, 'settings-light.png') })
    await page.getByLabel('RAM cache (MiB)', { exact: true }).fill('0')
    await page.getByRole('button', { name: 'Save limits', exact: true }).click()
    await expect(
      page.getByText('Check positive values, units and budget relationships.'),
    ).toBeVisible()
    await page.getByLabel('RAM cache (MiB)', { exact: true }).fill('32')
    await page.getByRole('button', { name: 'Save limits', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Apply and stop captures' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Apply and stop captures' }).click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber.getState().then((s) => s.settings.cacheBytes),
        ),
      )
      .toBe(33554432)
    await page.getByLabel('Language').selectOption('it')
    await expect(
      page.getByRole('heading', { name: 'Impostazioni' }),
    ).toBeVisible()
  } finally {
    await app.close()
    await channel.deleteQueue(name)
    await channel.deleteExchange(name)
    await broker.close()
    await rm(dir, { recursive: true, force: true })
  }
})
