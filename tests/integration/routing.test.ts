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

it('reuses capture history and selected/manual routes across stops and process restoration', async () => {
  const { bindingKey } = await import('../../src/shared/routes')
  const connection = await amqp.connect(profile.protocolUrl),
    channel = await connection.createChannel()
  const name = 'qc-feedback-' + randomUUID(),
    dir = await mkdtemp(join(tmpdir(), 'qc-feedback-'))
  const store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS)
  let sessions = new SessionManager(store, () => DEFAULT_SETTINGS)
  try {
    await channel.assertExchange(name, 'direct', { durable: false })
    await channel.assertQueue(name, { durable: false })
    await channel.bindQueue(name, name, 'wanted')
    await channel.bindQueue(name, name, 'excluded')
    const broker = new RabbitMQ(profile),
      bindings = await broker.bindings(name)
    const options = {
      allowPartial: false,
      bindingKeys: bindings
        .filter((b) => b.routing_key === 'wanted')
        .map(bindingKey),
      manualRoutes: [{ source: name, routingKey: 'manual' }],
    }
    const resource = { name, vhost: '/', kind: 'queue' as const }
    const first = await sessions.startCapture(profile, resource, options)
    expect((await sessions.startCapture(profile, resource, options)).id).toBe(
      first.id,
    )
    channel.publish(name, 'wanted', Buffer.from('first'))
    channel.publish(name, 'excluded', Buffer.from('excluded'))
    channel.publish(name, 'manual', Buffer.from('manual'))
    await expect.poll(() => sessions.list()[0].captured).toBe(2)
    await sessions.stopCapture(first.id)
    const resumed = await sessions.startCapture(profile, resource, {
      ...options,
      captureId: first.id,
    })
    expect(resumed.id).toBe(first.id)
    expect(sessions.list()).toHaveLength(1)
    channel.publish(name, 'wanted', Buffer.from('resumed'))
    await expect.poll(() => sessions.list()[0].captured).toBe(3)
    await sessions.close()
    sessions = new SessionManager(store, () => DEFAULT_SETTINGS)
    const restored = await sessions.startCapture(profile, resource, {
      ...options,
      captureId: first.id,
    })
    expect(restored.id).toBe(first.id)
    expect(restored.gaps).toBeGreaterThanOrEqual(2)
    expect(
      store
        .readPage(first.id, null, 10)
        .records.map((r) => r.preview)
        .sort(),
    ).toEqual(['first', 'manual', 'resumed'])
    expect((await channel.checkQueue(name)).messageCount).toBe(3)
    expect((await channel.checkQueue(name)).consumerCount).toBe(0)
    expect(
      (await broker.routingBindings())
        .filter((b) => b.source === name)
        .map((b) => b.routing_key)
        .sort(),
    ).toEqual(['excluded', 'wanted'])
    await sessions.stopCapture(first.id)
    await expect(
      sessions.startCapture(profile, resource, {
        ...options,
        manualRoutes: [{ source: 'amq.fanout', routingKey: 'x' }],
      }),
    ).rejects.toThrow()
  } finally {
    await sessions.close()
    store.close()
    await channel.deleteQueue(name)
    await channel.deleteExchange(name)
    await connection.close()
    await rm(dir, { recursive: true, force: true })
  }
})
it('captures selected routing keys from direct and topic exchanges only', async () => {
  const connection = await amqp.connect(profile.protocolUrl),
    channel = await connection.createChannel()
  const base = 'qc-test-' + randomUUID(),
    created = base + '.created',
    cancelled = base + '.cancelled',
    dir = await mkdtemp(join(tmpdir(), 'qc-keys-'))
  const store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS),
    sessions = new SessionManager(store, () => DEFAULT_SETTINGS)
  const exchanges = {
      direct: base + '.d',
      topic: base + '.t',
      fanout: base + '.f',
    },
    queues = [base + '.a', base + '.b', base + '.c', base + '.x']
  try {
    for (const [type, name] of Object.entries(exchanges))
      await channel.assertExchange(name, type, { durable: false })
    for (const q of queues) await channel.assertQueue(q, { durable: false })
    await channel.bindQueue(queues[0], exchanges.direct, created)
    await channel.bindQueue(queues[1], exchanges.topic, created)
    await channel.bindQueue(queues[2], exchanges.fanout, created)
    await channel.bindQueue(queues[3], exchanges.direct, cancelled)
    await expect(
      sessions.startCapture(
        profile,
        { name: '', vhost: '/', kind: 'routes' },
        { allowPartial: true, routingKeys: [base + '.missing'] },
      ),
    ).rejects.toThrow()
    const session = await sessions.startCapture(
      profile,
      { name: 'ignored', vhost: '/', kind: 'routes' },
      { allowPartial: true, routingKeys: [created] },
    )
    expect(session.state).toBe('capturing')
    expect(session.resource.name).toBe(created)
    expect(
      session.bindings.map((b) => `${b.type}:${b.supported}`).sort(),
    ).toEqual(['direct:true', 'fanout:false', 'topic:true'])
    channel.publish(exchanges.direct, created, Buffer.from('one'))
    channel.publish(exchanges.topic, created, Buffer.from('two'))
    channel.publish(exchanges.direct, cancelled, Buffer.from('other-key'))
    channel.publish(exchanges.fanout, created, Buffer.from('fanout'))
    await expect.poll(() => sessions.list().at(-1)!.captured).toBe(2)
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(sessions.list().at(-1)!.captured).toBe(2)
    expect(
      store
        .readPage(session.id, null, 10)
        .records.map((r) => store.get(r.id).payload.toString())
        .sort(),
    ).toEqual(['one', 'two'])
    for (const q of queues) {
      const info = await channel.checkQueue(q)
      expect(info.messageCount).toBe(1)
      expect(info.consumerCount).toBe(0)
    }
    await sessions.stopCapture(session.id)
  } finally {
    await sessions.close()
    store.close()
    for (const q of queues) await channel.deleteQueue(q)
    for (const name of Object.values(exchanges))
      await channel.deleteExchange(name)
    await connection.close()
    await rm(dir, { recursive: true, force: true })
  }
})
