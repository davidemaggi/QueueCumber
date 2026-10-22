import { KafkaProvider } from '../../src/service/providers/kafka'
import { kafkaProfile } from '../fixtures/kafka'
import { test, expect, _electron as electron } from '@playwright/test'
import { Admin, Producer } from '@platformatic/kafka'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { kafkaOptions } from '../fixtures/kafka'
test('creates a Kafka connection, chooses partition positions, inspects and exports across themes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-kafka-ui-')),
    env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const admin = new Admin(kafkaOptions),
    producer = new Producer({ ...kafkaOptions, idempotent: true }),
    topic = 'qc-ui-' + randomUUID()
  await admin.createTopics({ topics: [topic], partitions: 2, replicas: 1 })
  await producer.send({
    messages: [0, 1, 2].flatMap((n) =>
      [0, 1].map((partition) => ({
        topic,
        partition,
        value: Buffer.from(JSON.stringify({ partition, n })),
      })),
    ),
  })
  expect(
    (await new KafkaProvider(kafkaProfile).partitions(topic)).map((p) => p.end),
  ).toEqual(['3', '3'])
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${join(dir, 'data')}`],
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
    await page.getByLabel('Messaging system').selectOption('kafka')
    await page
      .getByLabel('Connection name', { exact: true })
      .fill('Kafka synthetic')
    await page.getByLabel('Bootstrap brokers').fill('localhost:29092')
    await page.getByLabel('Use verified TLS').uncheck()
    await page.getByLabel('Allow unencrypted transport').check()
    await page
      .getByRole('button', { name: 'Save connection', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Kafka synthetic', exact: true })
      .click()
    await page.getByPlaceholder('Search broker resources').fill(topic)
    await page
      .getByRole('button', { name: 'topic ' + topic, exact: true })
      .click()
    await expect(page.getByLabel('Partition 0', { exact: true })).toBeChecked()
    await page
      .getByLabel('Start reading 0', { exact: true })
      .selectOption('first')
    await page
      .getByLabel('Start reading 1', { exact: true })
      .selectOption('offset')
    await page.getByLabel('Kafka offset 1', { exact: true }).fill('1')
    await page
      .getByRole('button', { name: 'Start capture', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber.getState().then((s) => s.sessions[0].captured),
        ),
      )
      .toBe(5)
    await page.locator('.message-row').first().click()
    await expect(page.locator('.message-detail')).toContainText('Kafka offset')
    const qa = join(tmpdir(), 'queuecumber-qa')
    await mkdir(qa, { recursive: true })
    await expect(page.locator('.capture-stats')).toContainText('5 captured')
    await page.screenshot({ path: join(qa, 'kafka-light.png') })
    const file = join(dir, 'capture.jsonl')
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file })
    }, file)
    await page
      .getByRole('button', { name: 'Export retained messages', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber.getState().then((s) => s.exportJob?.state),
        ),
      )
      .toBe('complete')
    const messages = (await readFile(file, 'utf8'))
      .trim()
      .split('\n')
      .map((s) => JSON.parse(s))
      .filter((m) => m.type === 'message')
    expect(messages).toHaveLength(5)
    expect(messages[0].kafka.offset).toBe('0')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByLabel('Theme').selectOption('dark')
    await page.getByRole('button', { name: 'Inspect', exact: true }).click()
    await page.screenshot({ path: join(qa, 'kafka-dark.png') })
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1000, 800),
    )
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByLabel('Language').selectOption('it')
    await page.getByRole('button', { name: 'Ispeziona', exact: true }).click()
    await page.screenshot({ path: join(qa, 'kafka-narrow-it.png') })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page
      .getByRole('button', { name: 'Ferma acquisizione', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber.getState().then((s) => s.sessions[0].state),
        ),
      )
      .toBe('stopped')
  } finally {
    await app.close()
    await admin.deleteTopics({ topics: [topic] })
    await Promise.all([admin.close(), producer.close()])
    await rm(dir, { recursive: true, force: true })
  }
})
