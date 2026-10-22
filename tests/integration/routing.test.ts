import { it, expect, vi } from 'vitest'
import amqp from 'amqplib'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { profile } from '../fixtures/broker'
import { RabbitMQ } from '../../src/service/providers/rabbitmq'
import { SessionManager } from '../../src/service/sessions'
import { CaptureStorage } from '../../src/service/storage'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
for (const type of ['direct', 'topic', 'fanout', 'headers'])
  it(`mirrors ${type} bindings without consuming original deliveries`, async () => {
    const connection = await amqp.connect(profile.protocolUrl),
      channel = await connection.createChannel()
    const name = 'qc-test-' + randomUUID(),
      dir = await mkdtemp(join(tmpdir(), 'qc-route-'))
    const store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS),
      sessions = new SessionManager(store, () => DEFAULT_SETTINGS)
    try {
      await channel.assertExchange(name, type, { durable: false })
      await channel.assertQueue(name, { durable: false })
      const pattern = type === 'topic' ? 'order.*' : 'order.created',
        args = type === 'headers' ? { 'x-match': 'all', region: 'eu' } : {}
      await channel.bindQueue(name, name, pattern, args)
      const session = await sessions.startCapture(
        profile,
        { name, vhost: '/', kind: 'queue' },
        { allowPartial: true },
      )
      expect(session.state).toBe('capturing')
      channel.publish(name, 'order.created', Buffer.from('real-message'), {
        headers: { region: 'eu' },
      })
      await expect.poll(() => sessions.list()[0].captured).toBe(1)
      expect((await channel.checkQueue(name)).messageCount).toBe(1)
      expect((await channel.checkQueue(name)).consumerCount).toBe(0)
      expect(
        store
          .get(store.readPage(session.id, null, 10).records[0].id)
          .payload.toString(),
      ).toBe('real-message')
      await sessions.stopCapture(session.id)
      expect(sessions.list()[0].state).toBe('stopped')
      expect((await channel.checkQueue(name)).messageCount).toBe(1)
    } finally {
      await sessions.close()
      store.close()
      await channel.deleteQueue(name)
      await channel.deleteExchange(name)
      await connection.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
it('refuses default-only routes and marks storage failure without touching originals', async () => {
  const connection = await amqp.connect(profile.protocolUrl),
    channel = await connection.createChannel(),
    name = 'qc-test-' + randomUUID()
  await channel.assertExchange(name, 'direct', { durable: false })
  await channel.assertQueue(name, { durable: false })
  const sessions = new SessionManager(
    {
      append: () => {
        throw Error('disk full')
      },
    },
    () => DEFAULT_SETTINGS,
  )
  try {
    await expect(
      sessions.startCapture(
        profile,
        { name, vhost: '/', kind: 'queue' },
        { allowPartial: true },
      ),
    ).rejects.toThrow()
    await channel.bindQueue(name, name, 'route')
    const session = await sessions.startCapture(
      profile,
      { name, vhost: '/', kind: 'queue' },
      { allowPartial: true },
    )
    channel.publish(name, 'route', Buffer.from('test'))
    await expect
      .poll(() => sessions.list().find((s) => s.id === session.id)?.state)
      .toBe('failed')
    expect((await channel.checkQueue(name)).messageCount).toBe(1)
  } finally {
    await sessions.close()
    await channel.deleteQueue(name)
    await channel.deleteExchange(name)
    await connection.close()
  }
})

it('cleans up its observation queue when a later binding fails during setup', async () => {
  const c = await amqp.connect(profile.protocolUrl),
    ch = await c.createChannel()
  const name = 'qc-test-' + randomUUID()
  await ch.assertExchange(name, 'direct', { durable: false })
  await ch.assertQueue(name, { durable: false })
  await ch.bindQueue(name, name, 'first')
  const original = RabbitMQ.prototype.bindings
  const spy = vi
    .spyOn(RabbitMQ.prototype, 'bindings')
    .mockImplementation(async function (this: RabbitMQ, queue: string) {
      return [
        ...(await original.call(this, queue)),
        {
          source: name + '-missing',
          destination: name,
          routing_key: 'second',
          arguments: {},
          type: 'direct',
          supported: true,
        },
      ]
    })
  const sessions = new SessionManager(
    { append: () => ({ id: 1, omitted: false }) },
    () => DEFAULT_SETTINGS,
  )
  try {
    await expect(
      sessions.startCapture(
        profile,
        { name, vhost: '/', kind: 'queue' },
        { allowPartial: true },
      ),
    ).rejects.toThrow()
    const id = sessions.list()[0].id
    const broker = new RabbitMQ(profile)
    await expect
      .poll(async () => {
        const queues = await broker.request('queues/%2F')
        return queues.filter((q: any) => q.name.startsWith('queuecumber.' + id))
          .length
      })
      .toBe(0)
    expect((await ch.checkQueue(name)).consumerCount).toBe(0)
  } finally {
    spy.mockRestore()
    await sessions.close()
    await ch.deleteQueue(name)
    await ch.deleteExchange(name)
    await c.close()
  }
})
