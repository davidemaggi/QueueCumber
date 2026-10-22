import { it, expect } from 'vitest'
import { Admin, Producer } from '@platformatic/kafka'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CaptureStorage } from '../../src/service/storage'
import { SessionManager } from '../../src/service/sessions'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
import { kafkaOptions, kafkaProfile } from '../fixtures/kafka'
it('keeps Kafka capture cache/disk finite while evicting a 32 MiB workload', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-kafka-load-')),
    settings = {
      ...DEFAULT_SETTINGS,
      cacheBytes: 1024 ** 2,
      diskBytes: 8 * 1024 ** 2,
      maxPayloadBytes: 512 * 1024,
    },
    store = new CaptureStorage(dir, randomBytes(32), settings),
    sessions = new SessionManager(store, () => settings),
    admin = new Admin(kafkaOptions),
    producer = new Producer({ ...kafkaOptions, idempotent: true }),
    topic = 'qc-load-' + randomUUID()
  let peak = process.memoryUsage().rss
  const baseline = peak,
    start = performance.now(),
    timer = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage().rss)
    }, 5)
  try {
    await admin.createTopics({ topics: [topic], partitions: 1, replicas: 1 })
    await sessions.startCapture(
      kafkaProfile,
      { name: topic, kind: 'topic', vhost: '' },
      {
        allowPartial: false,
        kafkaPartitions: [{ partition: 0, from: 'next' }],
      },
    )
    for (let i = 0; i < 64; i++)
      await producer.send({
        messages: [0, 1].map((n) => ({
          topic,
          partition: 0,
          value: Buffer.alloc(256 * 1024, (i + n) % 256),
        })),
      })
    await expect
      .poll(() => sessions.list()[0].captured, { timeout: 15000 })
      .toBe(128)
    expect(store.stats().cacheBytes).toBeLessThanOrEqual(settings.cacheBytes)
    expect(store.stats().diskBytes).toBeLessThanOrEqual(settings.diskBytes)
    expect(store.stats().evicted).toBeGreaterThan(0)
    expect(sessions.list()[0].kafkaPositions?.[0].next).toBe('128')
    const metrics = {
      kind: 'synthetic-kafka',
      messages: 128,
      payloadBytes: 256 * 1024,
      elapsedMs: Math.round(performance.now() - start),
      baselineRss: baseline,
      peakSampledRss: peak,
      maxRssKiB: process.resourceUsage().maxRSS,
      ...store.stats(),
    }
    await writeFile(
      join(tmpdir(), 'queuecumber-kafka-metrics.json'),
      JSON.stringify(metrics, null, 2),
    )
    console.log(JSON.stringify(metrics))
  } finally {
    clearInterval(timer)
    await sessions.close()
    store.close()
    await admin.deleteTopics({ topics: [topic] })
    await Promise.all([admin.close(), producer.close()])
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)
