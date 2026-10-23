import { it, expect } from 'vitest'
import { RabbitMQ } from '../../src/service/providers/rabbitmq'
import { profile } from '../fixtures/broker'
it('tests endpoints independently and discovers broker-native resources', async () => {
  const broker = new RabbitMQ(profile)
  expect(await broker.test()).toEqual({
    protocol: { ok: true },
    management: { ok: true },
  })
  const page = await broker.listResources('', 1)
  expect(
    page.resources.some((r) => r.kind === 'exchange' && r.name === 'amq.topic'),
  ).toBe(true)
  const denied = new RabbitMQ({
    ...profile,
    managementUrl: 'http://127.0.0.1:1',
  })
  const result = await denied.test()
  expect(result.protocol.ok).toBe(true)
  expect(result.management.ok).toBe(false)
  expect(JSON.stringify(result)).not.toContain('local-test-only')
})
it('reports management permission denial independently from permitted AMQP login', async () => {
  const name = 'qc-permission-' + crypto.randomUUID(),
    headers = {
      Authorization:
        'Basic ' + Buffer.from('cucumber:local-test-only').toString('base64'),
      'Content-Type': 'application/json',
    }
  const userUrl = profile.managementUrl + '/api/users/' + name
  expect(
    (
      await fetch(userUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ password: 'synthetic-password', tags: [] }),
      })
    ).ok,
  ).toBe(true)
  try {
    expect(
      (
        await fetch(profile.managementUrl + '/api/permissions/%2F/' + name, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ configure: '', write: '', read: '.*' }),
        })
      ).ok,
    ).toBe(true)
    const broker = new RabbitMQ({
      ...profile,
      protocolUrl: `amqp://${name}:synthetic-password@127.0.0.1:25672/%2F`,
    })
    expect(await broker.test()).toEqual({
      protocol: { ok: true },
      management: { ok: false, code: 'ACCESS_REFUSED' },
    })
  } finally {
    await fetch(userUrl, { method: 'DELETE', headers })
  }
})
