import { it, expect } from 'vitest'
import amqp from 'amqplib'
import { randomUUID } from 'node:crypto'
import { RabbitMQ } from '../../src/service/providers/rabbitmq'
import { profile } from '../fixtures/broker'
it('browses later queue pages after the exchange collection is exhausted', async () => {
  const c = await amqp.connect(profile.protocolUrl),
    ch = await c.createChannel(),
    prefix = 'qc-pages-' + randomUUID(),
    queues = Array.from(
      { length: 101 },
      (_, i) => `${prefix}.${String(i).padStart(3, '0')}`,
    )
  try {
    await ch.assertExchange(prefix, 'direct', { durable: false })
    for (const queue of queues) await ch.assertQueue(queue, { durable: false })
    const broker = new RabbitMQ(profile),
      first = await broker.listResources(prefix, 1)
    expect(first.hasMore).toBe(true)
    const second = await broker.listResources(prefix, 2)
    expect(second.resources.filter((r) => r.kind === 'queue')).toHaveLength(1)
    expect(second.resources.filter((r) => r.kind === 'exchange')).toHaveLength(
      0,
    )
    expect(second.hasMore).toBe(false)
  } finally {
    for (const queue of queues) await ch.deleteQueue(queue)
    await ch.deleteExchange(prefix)
    await c.close()
  }
})
