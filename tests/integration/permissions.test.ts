import { it, expect } from 'vitest'
import amqp from 'amqplib'
import { randomUUID } from 'node:crypto'
import { RabbitMQ } from '../../src/service/providers/rabbitmq'
import { SessionManager } from '../../src/service/sessions'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
import { profile } from '../fixtures/broker'
it('captures with restricted observation permissions while application queue changes and publishing are denied', async () => {
  const name = 'qc-permission-' + randomUUID(),
    userUrl = profile.managementUrl + '/api/users/' + name,
    headers = {
      Authorization:
        'Basic ' + Buffer.from('cucumber:local-test-only').toString('base64'),
      'Content-Type': 'application/json',
    },
    admin = await amqp.connect(profile.protocolUrl),
    channel = await admin.createConfirmChannel(),
    sessions = new SessionManager(
      { append: () => ({ id: 1, omitted: false }) },
      () => DEFAULT_SETTINGS,
    )
  let inspector: Awaited<ReturnType<typeof amqp.connect>> | undefined
  try {
    await channel.assertExchange(name, 'fanout', { durable: false })
    await channel.assertQueue(name, { durable: false })
    await channel.bindQueue(name, name, '')
    expect(
      (
        await fetch(userUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            password: 'synthetic-password',
            tags: ['management'],
          }),
        })
      ).ok,
    ).toBe(true)
    expect(
      (
        await fetch(profile.managementUrl + '/api/permissions/%2F/' + name, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            configure: '^queuecumber[.].*$',
            write: '^queuecumber[.].*$',
            read: `^(queuecumber[.].*|${name})$`,
          }),
        })
      ).ok,
    ).toBe(true)
    const restricted = {
      ...profile,
      protocolUrl: `amqp://${name}:synthetic-password@127.0.0.1:25672/%2F`,
    }
    expect(await new RabbitMQ(restricted).test()).toEqual({
      protocol: { ok: true },
      management: { ok: true },
    })
    expect(
      (await new RabbitMQ(restricted).listResources(name, 1)).resources.some(
        (r) => r.name === name,
      ),
    ).toBe(true)
    const capture = await sessions.startCapture(
      restricted,
      { name, vhost: '/', kind: 'queue' },
      { allowPartial: true },
    )
    channel.publish(name, '', Buffer.from('restricted observation'))
    await channel.waitForConfirms()
    await expect.poll(() => sessions.list()[0].captured).toBe(1)
    expect((await channel.checkQueue(name)).consumerCount).toBe(0)
    inspector = await amqp.connect(restricted.protocolUrl)
    inspector.on('error', () => {})
    const denied = await inspector.createChannel()
    denied.on('error', () => {})
    await expect(denied.assertQueue(name, { durable: false })).rejects.toThrow(
      /ACCESS_REFUSED/,
    )
    const publishing = await inspector.createConfirmChannel()
    publishing.on('error', () => {})
    publishing.publish(name, '', Buffer.from('must be denied'))
    await expect(publishing.waitForConfirms()).rejects.toThrow()
    await sessions.stopCapture(capture.id)
  } finally {
    await sessions.close()
    await inspector?.close().catch(() => {})
    await channel.deleteQueue(name)
    await channel.deleteExchange(name)
    await admin.close()
    await fetch(userUrl, { method: 'DELETE', headers })
  }
}, 30000)
