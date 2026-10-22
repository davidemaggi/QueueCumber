import { it, expect } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { CaptureStorage } from '../../src/service/storage'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
it('bounds encrypted storage under mixed synthetic payload saturation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-load-'))
  const settings = {
    ...DEFAULT_SETTINGS,
    cacheBytes: 1048576,
    diskBytes: 2097152,
    maxPayloadBytes: 262144,
    previewBytes: 65536,
  }
  const store = new CaptureStorage(dir, randomBytes(32), settings),
    before = process.memoryUsage().rss,
    start = performance.now()
  try {
    for (let i = 0; i < 500; i++) {
      const sizes = [64, 4096, 65536, 262144]
      store.append('load', {
        payload: randomBytes(sizes[i % 4]),
        headers: { n: i },
        routingKey: 'synthetic.event',
        exchange: 'synthetic',
      })
    }
    expect(store.stats().cacheBytes).toBeLessThanOrEqual(1048576)
    expect(store.stats().diskBytes).toBeLessThanOrEqual(2097152)
    expect(store.stats().evicted).toBeGreaterThan(0)
    store.applyRetention({ ...settings, diskBytes: 1048576 })
    expect(store.readPage('load', null, 10).records.length).toBeGreaterThan(0)
    expect(store.stats().diskBytes).toBeLessThanOrEqual(1048576)
    console.log(
      JSON.stringify({
        kind: 'synthetic-storage',
        messages: 500,
        elapsedMs: Math.round(performance.now() - start),
        rssDeltaBytes: process.memoryUsage().rss - before,
        ...store.stats(),
      }),
    )
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
it('measures real AMQP admission with two simultaneous sessions and oversized deliveries', async () => {
  const { default: amqp } = await import('amqplib')
  const { randomUUID } = await import('node:crypto')
  const { SessionManager } = await import('../../src/service/sessions')
  const { profile } = await import('../fixtures/broker')
  const dir = await mkdtemp(join(tmpdir(), 'qc-amqp-load-'))
  const settings = {
    ...DEFAULT_SETTINGS,
    cacheBytes: 32 * 1024 ** 2,
    diskBytes: 128 * 1024 ** 2,
  }
  const store = new CaptureStorage(dir, randomBytes(32), settings)
  const sessions = new SessionManager(store, () => settings)
  const c = await amqp.connect(profile.protocolUrl),
    ch = await c.createConfirmChannel()
  const name = 'qc-test-' + randomUUID()
  let peakRss = process.memoryUsage().rss
  const baseline = peakRss,
    started = performance.now()
  const sample = () => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss)
  }
  const timer = setInterval(sample, 5)
  try {
    await ch.assertExchange(name, 'fanout', { durable: false })
    for (const suffix of ['a', 'b']) {
      await ch.assertQueue(name + suffix, {
        durable: false,
        arguments: { 'x-max-length': 1 },
      })
      await ch.bindQueue(name + suffix, name, '')
      await sessions.startCapture(
        profile,
        { name: name + suffix, vhost: '/', kind: 'queue' },
        { allowPartial: true },
      )
    }
    const sizes = [64, 1024 ** 2, 16 * 1024 ** 2, 20 * 1024 ** 2]
    for (let i = 0; i < 12; i++) {
      const payload = Buffer.alloc(sizes[i % 4], i)
      ch.publish(name, '', payload)
      await ch.waitForConfirms()
      await expect
        .poll(
          () => sessions.list().every((s) => s.captured + s.omitted === i + 1),
          { timeout: 15000, interval: 10 },
        )
        .toBe(true)
      sample()
    }
    expect(
      sessions.list().every((s) => s.captured === 9 && s.omitted === 3),
    ).toBe(true)
    expect(store.stats().cacheBytes).toBeLessThanOrEqual(settings.cacheBytes)
    expect(store.stats().diskBytes).toBeLessThanOrEqual(settings.diskBytes)
    expect(sessions.list().every((s) => s.retained!.count > 0)).toBe(true)
    const metrics = {
      kind: 'synthetic-amqp',
      sessions: 2,
      published: 12,
      deliveries: 24,
      payloadSizes: sizes,
      elapsedMs: Math.round(performance.now() - started),
      baselineRss: baseline,
      peakSampledRss: peakRss,
      maxRssKiB: process.resourceUsage().maxRSS,
      ...store.stats(),
    }
    await writeFile(
      join(tmpdir(), 'queuecumber-amqp-metrics.json'),
      JSON.stringify(metrics, null, 2),
    )
    console.log(JSON.stringify(metrics))
  } finally {
    clearInterval(timer)
    await sessions.close()
    store.close()
    for (const suffix of ['a', 'b']) await ch.deleteQueue(name + suffix)
    await ch.deleteExchange(name)
    await c.close()
    await rm(dir, { recursive: true, force: true })
  }
}, 60000)
