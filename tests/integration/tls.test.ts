import { it, expect } from 'vitest'
import https from 'node:https'
import { readFileSync } from 'node:fs'
import { RabbitMQ } from '../../src/service/providers/rabbitmq'
import { profile } from '../fixtures/broker'
it('rejects an untrusted management certificate and accepts an explicitly supplied CA', async () => {
  const cert = readFileSync('tests/fixtures/tls/localhost-cert.pem'),
    key = readFileSync('tests/fixtures/tls/localhost-private.pem')
  const server = https.createServer({ cert, key }, (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  try {
    const input = { ...profile, managementUrl: `https://127.0.0.1:${port}` }
    expect((await new RabbitMQ(input).test()).management.ok).toBe(false)
    expect(
      (await new RabbitMQ({ ...input, caPem: cert.toString() }).test())
        .management.ok,
    ).toBe(true)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
