import { test, expect, _electron as electron } from '@playwright/test'
import { mkdtemp, rm, readFile, readdir, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import amqp from 'amqplib'
import { profile } from '../fixtures/broker'
test('positions a stream, exports all formats and deletes only the local capture', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-stream-ui-')),
    env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const c = await amqp.connect(profile.protocolUrl),
    ch = await c.createConfirmChannel(),
    name = 'qc-stream-ui-' + randomUUID()
  await ch.assertQueue(name, {
    durable: true,
    arguments: { 'x-queue-type': 'stream' },
  })
  for (let i = 0; i < 4; i++)
    ch.sendToQueue(name, Buffer.from(JSON.stringify({ sequence: i })), {
      persistent: true,
    })
  await ch.waitForConfirms()
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${join(dir, 'data')}`],
    env: { ...env, QUEUECUMBER_TEST: '1' },
  })
  try {
    const page = await app.firstWindow()
    await expect
      .poll(() => page.evaluate(() => window.queuecumber.getStatus()))
      .toEqual({ service: 'ready' })
    await page.evaluate((input) => window.queuecumber.saveConnection(input), {
      ...profile,
      id: undefined,
      name: 'Stream broker',
    })
    await page
      .getByRole('button', { name: 'Stream broker', exact: true })
      .click()
    await page.getByPlaceholder('Search broker resources').fill(name)
    await page
      .getByRole('button', { name: 'stream ' + name, exact: true })
      .click()
    await page.getByLabel('Start reading').selectOption('first')
    await page
      .getByRole('button', { name: 'Start capture', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber.getState().then((s) => s.sessions[0].captured),
        ),
      )
      .toBe(4)
    await page.locator('.message-row').first().click()
    await expect(page.locator('.message-detail')).toContainText('Stream offset')
    for (const format of ['jsonl', 'zip', 'folder'] as const) {
      const path = join(dir, 'capture.' + format)
      await app.evaluate(
        ({ dialog }, paths) => {
          dialog.showSaveDialog = async () => ({
            canceled: false,
            filePath: paths.file,
          })
          dialog.showOpenDialog = async () => ({
            canceled: false,
            filePaths: [paths.dir],
          })
        },
        { file: path, dir },
      )
      await page.getByLabel('Dump format', { exact: true }).selectOption(format)
      await page
        .getByRole('button', { name: 'Export retained messages', exact: true })
        .click()
      await expect
        .poll(() =>
          page.evaluate(() =>
            window.queuecumber
              .getState()
              .then((s) => s.exportJob?.format + ':' + s.exportJob?.state),
          ),
        )
        .toBe(format + ':complete')
      if (format === 'jsonl') {
        const lines = (await readFile(path, 'utf8'))
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        expect(lines.filter((line) => line.type === 'message')).toHaveLength(4)
        expect(lines[1].offset).toBe(0)
      } else if (format === 'zip')
        expect((await readFile(path)).subarray(0, 2).toString()).toBe('PK')
      else {
        const folder = (await readdir(dir)).find((name) =>
          name.startsWith('QueueCumber-'),
        )!
        expect(
          JSON.parse(await readFile(join(dir, folder, 'manifest.json'), 'utf8'))
            .recordsWritten,
        ).toBe(4)
      }
    }
    const qa = join(tmpdir(), 'queuecumber-qa')
    await mkdir(qa, { recursive: true })
    await page.screenshot({ path: join(qa, 'stream-export-light.png') })
    await page
      .getByRole('button', { name: 'Delete retained capture', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Delete capture', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber.getState().then((s) => s.sessions.length),
        ),
      )
      .toBe(0)
    await ch.checkQueue(name)
    await page.getByLabel('Start reading').selectOption('offset')
    await page.getByLabel('Stream offset', { exact: true }).fill('2')
    await page
      .getByRole('button', { name: 'Start capture', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber
            .getState()
            .then((s) => s.sessions.at(-1)?.captured),
        ),
      )
      .toBe(2)
    await page
      .getByRole('button', { name: 'Stop capture', exact: true })
      .click()
    await page.getByLabel('Start reading').selectOption('next')
    await page
      .getByRole('button', { name: 'Start capture', exact: true })
      .click()
    await expect(page.locator('.session-state')).toHaveText('capturing')
    ch.sendToQueue(name, Buffer.from('{"live":true}'), { persistent: true })
    await ch.waitForConfirms()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.queuecumber
            .getState()
            .then((s) => s.sessions.at(-1)?.captured),
        ),
      )
      .toBe(3)
  } finally {
    await app.close()
    await ch.deleteQueue(name)
    await c.close()
    await rm(dir, { recursive: true, force: true })
  }
})
