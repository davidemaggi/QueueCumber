import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import amqp from 'amqplib'
import { randomUUID } from 'node:crypto'
import { RabbitMQ } from '../../src/service/providers/rabbitmq'
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
      .getByRole('option', { name: /order.created/ })
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
    await page.evaluate(async () => {
      const s = await window.queuecumber.getState()
      await window.queuecumber.saveDesktopPreferences({
        ...s.desktop.preferences,
        closeToTray: true,
      })
    })
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].close(),
    )
    channel.publish(
      name,
      'order.created',
      Buffer.from('{"event":"background"}'),
      { contentType: 'application/json' },
    )
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber.getState().then((s) => s.sessions[0].captured),
        ),
      )
      .toBe(52)
    expect((await channel.checkQueue(name)).consumerCount).toBe(0)
    await app.evaluate(({ app }) => app.emit('activate', {}, false))
    await expect(page.locator('.message-row').first()).toContainText(
      'order.created',
    )
    await expect
      .poll(() => page.locator('.message-row').count())
      .toBeGreaterThan(10)
    const messageList = page.getByRole('listbox', {
      name: 'Messages',
      exact: true,
    })
    await messageList.focus()
    await messageList.press('End')
    await expect(
      messageList.getByRole('option', { selected: true }),
    ).toHaveAttribute('aria-posinset', '30')
    await expect(page.locator('.message-detail pre')).toBeVisible()
    await messageList.press('Home')
    await expect(
      messageList.getByRole('option', { selected: true }),
    ).toHaveAttribute('aria-posinset', '1')
    await expect(page.locator('.message-detail pre')).toContainText(
      'background',
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
    await page.locator('.message-detail').scrollIntoViewIfNeeded()
    await expect(page.locator('.message-detail pre')).toBeVisible()
    await page.screenshot({ path: join(qaDir, 'inspection-narrow.png') })
    await page
      .getByRole('button', { name: 'Stop capture', exact: true })
      .scrollIntoViewIfNeeded()
    await expect(
      page.getByRole('button', { name: 'Stop capture', exact: true }),
    ).toBeInViewport()
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
    await page.evaluate(async (resourceName) => {
      const state = await window.queuecumber.getState()
      await window.queuecumber.startCapture(
        state.profiles[0].id,
        { name: resourceName, vhost: '/', kind: 'queue' },
        { allowPartial: true },
      )
    }, name)
  } finally {
    await app.close()
    const management = new RabbitMQ(profile)
    await expect
      .poll(async () => {
        const consumers = await management.request('consumers/%2F')
        return consumers.filter((c: any) =>
          c.queue.name.startsWith('queuecumber.'),
        ).length
      })
      .toBe(0)
    await channel.deleteQueue(name)
    await channel.deleteExchange(name)
    await broker.close()
    await rm(dir, { recursive: true, force: true })
  }
})
