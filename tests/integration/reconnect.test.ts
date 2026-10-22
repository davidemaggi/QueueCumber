import { it, expect } from 'vitest'
import amqp from 'amqplib'
import { randomUUID } from 'node:crypto'
import { SessionManager } from '../../src/service/sessions'
import { RabbitMQ } from '../../src/service/providers/rabbitmq'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
import { profile } from '../fixtures/broker'
it('recreates lost observation queues, reports a gap and honors stop', async () => {
  const c = await amqp.connect(profile.protocolUrl),
    ch = await c.createChannel(),
    name = 'qc-test-' + randomUUID()
  await ch.assertExchange(name, 'direct', { durable: false })
  await ch.assertQueue(name, { durable: false })
  await ch.bindQueue(name, name, 'event')
  const sessions = new SessionManager(
    { append: () => ({ id: 1, omitted: false }) },
    () => DEFAULT_SETTINGS,
  )
  try {
    const session = await sessions.startCapture(
      profile,
      { name, vhost: '/', kind: 'queue' },
      { allowPartial: true },
    )
    const broker = new RabbitMQ(profile)
    let connectionName = ''
    await expect
      .poll(
        async () => {
          const consumers = await broker.request('consumers/%2F')
          connectionName =
            consumers.find((x: any) =>
              x.queue.name.startsWith('queuecumber.' + session.id),
            )?.channel_details.connection_name ?? ''
          return connectionName.length > 0
        },
        { timeout: 8000, interval: 100 },
      )
      .toBe(true)
    const result = await fetch(
      profile.managementUrl +
        '/api/connections/' +
        encodeURIComponent(connectionName),
      {
        method: 'DELETE',
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from('cucumber:local-test-only').toString('base64'),
        },
      },
    )
    expect(result.ok).toBe(true)
    await expect.poll(() => sessions.list()[0].gaps).toBeGreaterThan(0)
    await expect
      .poll(() => sessions.list()[0].state, { timeout: 8000 })
      .toBe('capturing')
    await sessions.stopCapture(session.id)
    expect(sessions.list()[0].state).toBe('stopped')
    const consumers = await broker.request('consumers/%2F')
    expect(
      consumers.filter((x: any) =>
        x.queue.name.startsWith('queuecumber.' + session.id),
      ),
    ).toHaveLength(0)
  } finally {
    await sessions.close()
    await ch.deleteQueue(name)
    await ch.deleteExchange(name)
    await c.close()
  }
})
