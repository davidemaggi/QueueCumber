import { it, expect } from 'vitest'
import amqp from 'amqplib'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SessionManager } from '../../src/service/sessions'
import { CaptureStorage } from '../../src/service/storage'
import { RabbitMQ } from '../../src/service/providers/rabbitmq'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
import { profile } from '../fixtures/broker'
for (const start of ['first', 'next', 2] as const)
  it(`reads a stream from ${start} without deleting its log`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qc-stream-')),
      store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS),
      sessions = new SessionManager(store, () => DEFAULT_SETTINGS),
      c = await amqp.connect(profile.protocolUrl),
      ch = await c.createConfirmChannel(),
      name = 'qc-stream-' + randomUUID()
    try {
      await ch.assertQueue(name, {
        durable: true,
        arguments: { 'x-queue-type': 'stream' },
      })
      for (let i = 0; i < 4; i++)
        ch.sendToQueue(name, Buffer.from(String(i)), { persistent: true })
      await ch.waitForConfirms()
      const capture = await sessions.startCapture(
        profile,
        { name, vhost: '/', kind: 'stream' },
        { allowPartial: false, streamStart: start },
      )
      if (start === 'next') {
        expect(sessions.list()[0].captured).toBe(0)
        ch.sendToQueue(name, Buffer.from('live'), { persistent: true })
        await ch.waitForConfirms()
      }
      const count = start === 'first' ? 4 : start === 'next' ? 1 : 2
      await expect
        .poll(() => sessions.list()[0].captured, { timeout: 10000 })
        .toBe(count)
      const rows = store.readPage(capture.id, null, 10).records
      const values = rows
        .map((r) => store.get(r.id).payload.toString())
        .reverse()
      expect(values).toEqual(
        start === 'first'
          ? ['0', '1', '2', '3']
          : start === 'next'
            ? ['live']
            : ['2', '3'],
      )
      expect(sessions.list()[0].lastOffset).toBeDefined()
      await sessions.stopCapture(capture.id)
      const reader = await c.createChannel()
      await reader.prefetch(10)
      const replay: string[] = []
      await reader.consume(
        name,
        (msg) => {
          if (msg) {
            replay.push(msg.content.toString())
            reader.ack(msg)
          }
        },
        { noAck: false, arguments: { 'x-stream-offset': 'first' } },
      )
      await expect.poll(() => replay.length).toBe(start === 'next' ? 5 : 4)
      await reader.close()
    } finally {
      await sessions.close()
      store.close()
      await ch.deleteQueue(name)
      await c.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
it('rejects a forged stream resource pointing at an application queue', async () => {
  const c = await amqp.connect(profile.protocolUrl),
    ch = await c.createChannel(),
    name = 'qc-type-' + randomUUID(),
    sessions = new SessionManager(
      { append: () => ({ id: 1, omitted: false }) },
      () => DEFAULT_SETTINGS,
    )
  try {
    await ch.assertQueue(name, { durable: false })
    ch.sendToQueue(name, Buffer.from('original'))
    await expect
      .poll(async () => (await ch.checkQueue(name)).messageCount)
      .toBe(1)
    await expect(
      sessions.startCapture(
        profile,
        { name, vhost: '/', kind: 'stream' },
        { allowPartial: false, streamStart: 'first' },
      ),
    ).rejects.toThrow()
    expect((await ch.checkQueue(name)).messageCount).toBe(1)
    expect((await ch.checkQueue(name)).consumerCount).toBe(0)
  } finally {
    await sessions.close()
    await ch.deleteQueue(name)
    await c.close()
  }
})
it('resumes after the last processed stream offset on connection loss and fails closed on deletion', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-resume-')),
    store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS),
    sessions = new SessionManager(store, () => DEFAULT_SETTINGS),
    c = await amqp.connect(profile.protocolUrl),
    ch = await c.createConfirmChannel(),
    name = 'qc-resume-' + randomUUID(),
    broker = new RabbitMQ(profile)
  let deleted = false
  try {
    await ch.assertQueue(name, {
      durable: true,
      arguments: { 'x-queue-type': 'stream' },
    })
    for (let i = 0; i < 2; i++)
      ch.sendToQueue(name, Buffer.from(String(i)), { persistent: true })
    await ch.waitForConfirms()
    const session = await sessions.startCapture(
      profile,
      { name, vhost: '/', kind: 'stream' },
      { allowPartial: false, streamStart: 'first' },
    )
    await expect.poll(() => sessions.list()[0].captured).toBe(2)
    let connection = ''
    await expect
      .poll(
        async () => {
          const consumers = await broker.request('consumers/%2F')
          connection =
            consumers.find((consumer: any) => consumer.queue.name === name)
              ?.channel_details.connection_name ?? ''
          return !!connection
        },
        { timeout: 8000 },
      )
      .toBe(true)
    const response = await fetch(
      profile.managementUrl +
        '/api/connections/' +
        encodeURIComponent(connection),
      {
        method: 'DELETE',
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from('cucumber:local-test-only').toString('base64'),
        },
      },
    )
    expect(response.ok).toBe(true)
    for (let i = 2; i < 5; i++)
      ch.sendToQueue(name, Buffer.from(String(i)), { persistent: true })
    await ch.waitForConfirms()
    await expect
      .poll(() => sessions.list()[0].captured, { timeout: 10000 })
      .toBe(5)
    expect(sessions.list()[0].gaps).toBeGreaterThan(0)
    const offsets = store
      .readPage(session.id, null, 10)
      .records.map((row) => store.get(row.id).offset)
    expect(new Set(offsets).size).toBe(5)
    await ch.deleteQueue(name)
    deleted = true
    await expect
      .poll(() => sessions.list()[0].state, { timeout: 10000 })
      .toBe('failed')
  } finally {
    await sessions.close()
    store.close()
    if (!deleted) await ch.deleteQueue(name)
    await c.close()
    await rm(dir, { recursive: true, force: true })
  }
})
it('keeps a future requested offset visibly unverified until a delivery confirms it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-clamp-')),
    store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS),
    sessions = new SessionManager(store, () => DEFAULT_SETTINGS),
    c = await amqp.connect(profile.protocolUrl),
    ch = await c.createConfirmChannel(),
    name = 'qc-clamp-' + randomUUID()
  try {
    await ch.assertQueue(name, {
      durable: true,
      arguments: { 'x-queue-type': 'stream' },
    })
    ch.sendToQueue(name, Buffer.from('first'), { persistent: true })
    await ch.waitForConfirms()
    await sessions.startCapture(
      profile,
      { name, vhost: '/', kind: 'stream' },
      { allowPartial: false, streamStart: 999999 },
    )
    ch.sendToQueue(name, Buffer.from('next'), { persistent: true })
    await ch.waitForConfirms()
    expect(sessions.list()[0].offsetNotice).toBe('OFFSET_UNVERIFIED')
    expect(sessions.list()[0].captured).toBe(0)
  } finally {
    await sessions.close()
    store.close()
    await ch.deleteQueue(name)
    await c.close()
    await rm(dir, { recursive: true, force: true })
  }
})
it('reports clamping when broker retention has removed the requested stream prefix', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-retained-stream-')),
    store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS),
    sessions = new SessionManager(store, () => DEFAULT_SETTINGS),
    c = await amqp.connect(profile.protocolUrl),
    ch = await c.createConfirmChannel(),
    name = 'qc-retained-' + randomUUID()
  try {
    await ch.assertQueue(name, {
      durable: true,
      arguments: {
        'x-queue-type': 'stream',
        'x-stream-max-segment-size-bytes': 10000,
        'x-max-length-bytes': 20000,
      },
    })
    for (let i = 0; i < 120; i++) {
      ch.sendToQueue(name, Buffer.alloc(2048, i), { persistent: true })
      // Separate confirmed writes force multiple log chunks/segments. One
      // coalesced batch can exceed the segment target without rolling it.
      if (i % 5 === 4) await ch.waitForConfirms()
    }
    await ch.waitForConfirms()
    await expect
      .poll(
        async () => {
          const reader = await c.createChannel()
          await reader.prefetch(1)
          try {
            const offset = await new Promise<number>((resolve, reject) => {
              reader.on('error', reject)
              void reader
                .consume(
                  name,
                  (msg) => {
                    if (msg) {
                      resolve(msg.properties.headers!['x-stream-offset'])
                      reader.ack(msg)
                    }
                  },
                  { noAck: false, arguments: { 'x-stream-offset': 'first' } },
                )
                .catch(reject)
            })
            return offset
          } finally {
            await reader.close()
          }
        },
        { timeout: 10000, interval: 100 },
      )
      .toBeGreaterThan(0)
    await sessions.startCapture(
      profile,
      { name, vhost: '/', kind: 'stream' },
      { allowPartial: false, streamStart: 0 },
    )
    await expect
      .poll(() => sessions.list()[0].offsetNotice, { timeout: 10000 })
      .toBe('OFFSET_CLAMPED')
    expect(sessions.list()[0].lastOffset).toBeGreaterThan(0)
  } finally {
    await sessions.close()
    store.close()
    await ch.deleteQueue(name)
    await c.close()
    await rm(dir, { recursive: true, force: true })
  }
}, 20000)
