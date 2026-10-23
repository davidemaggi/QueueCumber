import { it, expect } from 'vitest'
import { createDemo } from '../../scripts/demo.mjs'
import { SessionManager } from '../../src/service/sessions'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
import { profile } from '../fixtures/broker'
import { kafkaProfile } from '../fixtures/kafka'
it('seeds reusable demo queues/stream/topic and captures future routed and replayable synthetic messages', async () => {
  const demo = await createDemo(),
    records = []
  let second
  const sessions = new SessionManager(
    {
      append: (id, record) => {
        records.push({ id, ...record })
        return { id: records.length, omitted: false }
      },
    },
    () => DEFAULT_SETTINGS,
  )
  try {
    const queue = await sessions.startCapture(
      profile,
      { name: 'demo.orders', vhost: '/', kind: 'queue' },
      { allowPartial: true },
    )
    expect(sessions.list().find((s) => s.id === queue.id).captured).toBe(0)
    const kafka = await sessions.startCapture(
      kafkaProfile,
      { name: 'demo.events', vhost: '', kind: 'topic' },
      {
        allowPartial: false,
        kafkaPartitions: [
          { partition: 0, from: 'first' },
          { partition: 1, from: 'first' },
        ],
      },
    )
    const stream = await sessions.startCapture(
      profile,
      { name: 'demo.events', vhost: '/', kind: 'stream' },
      { allowPartial: false, streamStart: 'first' },
    )
    await demo.tick()
    for (const capture of [queue, kafka, stream])
      await expect
        .poll(
          () => sessions.list().find((s) => s.id === capture.id)?.captured,
          { timeout: 15000 },
        )
        .toBeGreaterThan(0)
    expect(
      records.some((r) => JSON.parse(r.payload.toString()).demo === true),
    ).toBe(true)
    expect(records.some((r) => r.kafka)).toBe(true)
    second = await createDemo()
    await second.tick()
  } finally {
    await sessions.close()
    await second?.close()
    await demo.close()
  }
}, 30000)
