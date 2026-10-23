// Developer-only synthetic fixtures. Never bundled into the app or pointed at arbitrary brokers.
import amqp from 'amqplib'
import { Buffer } from 'node:buffer'
import { Admin, Producer } from '@platformatic/kafka'
import { spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import console from 'node:console'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const kafka = {
  clientId: 'queuecumber-local-demo',
  bootstrapBrokers: ['localhost:29092'],
  autocreateTopics: false,
  retries: 0,
  connectTimeout: 5000,
  requestTimeout: 5000,
}
export async function createDemo() {
  const admin = new Admin(kafka),
    producer = new Producer({ ...kafka, idempotent: true })
  let connection,
    channel,
    closed = false,
    sequence = 0
  const close = async () => {
    if (closed) return
    closed = true
    await Promise.allSettled([
      connection?.close(),
      admin.close(),
      producer.close(),
    ])
  }
  try {
    connection = await amqp.connect(
      'amqp://cucumber:local-test-only@127.0.0.1:25672/%2F?heartbeat=10',
      { timeout: 5000 },
    )
    connection.on('error', () => {})
    channel = await connection.createConfirmChannel()
    channel.on('error', () => {})
    await channel.assertExchange('demo.routes', 'topic', { durable: false })
    for (const [name, key] of [
      ['demo.orders', 'orders.*'],
      ['demo.audit', '#'],
    ]) {
      await channel.assertQueue(name, {
        durable: false,
        arguments: { 'x-max-length': 1000, 'x-overflow': 'drop-head' },
      })
      await channel.bindQueue(name, 'demo.routes', key)
    }
    await channel.assertQueue('demo.events', {
      durable: true,
      arguments: {
        'x-queue-type': 'stream',
        'x-max-length-bytes': 16 * 1024 ** 2,
        'x-stream-max-segment-size-bytes': 1024 ** 2,
        'x-max-age': '1h',
      },
    })
    if (
      !(await admin.listTopics({ includeInternals: false })).includes(
        'demo.events',
      )
    )
      await admin.createTopics({
        topics: ['demo.events'],
        partitions: 2,
        replicas: 1,
        configs: [
          { name: 'retention.ms', value: '3600000' },
          { name: 'retention.bytes', value: String(16 * 1024 ** 2) },
        ],
      })
    const tick = async () => {
      if (closed) throw Error('Demo publisher is closed')
      const n = sequence++,
        event = n % 2 ? 'orders.updated' : 'orders.created',
        payload = Buffer.from(
          JSON.stringify({
            demo: true,
            event,
            sequence: n,
            createdAt: new Date().toISOString(),
            order: {
              id: `CUC-${(n % 5) + 1}`,
              items: [{ product: 'cucumber', quantity: (n % 3) + 1 }],
              status: n % 2 ? 'packed' : 'received',
            },
          }),
        )
      const properties = {
        contentType: 'application/json',
        persistent: true,
        headers: { demo: true, sequence: n, source: 'local-fixture' },
      }
      channel.publish('demo.routes', event, payload, properties)
      channel.sendToQueue('demo.events', payload, properties)
      await channel.waitForConfirms()
      await producer.send({
        messages: [
          {
            topic: 'demo.events',
            partition: n % 2,
            key: Buffer.from(`CUC-${(n % 5) + 1}`),
            value: payload,
            headers: new Map([
              [Buffer.from('demo'), Buffer.from('true')],
              [Buffer.from('event'), Buffer.from(event)],
            ]),
          },
        ],
      })
    }
    for (let i = 0; i < 5; i++) await tick()
    return { tick, close }
  } catch (error) {
    await close()
    throw error
  }
}
async function main() {
  if (process.argv.slice(2).some((arg) => arg !== '--seed-only'))
    throw Error(
      'Only --seed-only is supported; demo targets are fixed localhost fixtures',
    )
  const compose = spawnSync(
    'docker',
    [
      'compose',
      '-p',
      'queuecumber-test',
      '-f',
      'compose.test.yml',
      'up',
      '-d',
      '--wait',
    ],
    { cwd: root, stdio: 'inherit' },
  )
  if (compose.status !== 0)
    throw Error('Could not start local brokers. Check Docker is running.')
  const stop = new globalThis.AbortController(),
    onStop = () => stop.abort()
  process.once('SIGINT', onStop)
  process.once('SIGTERM', onStop)
  let demo
  try {
    demo = await createDemo()
    console.log(
      'Demo ready: RabbitMQ demo.orders / demo.audit / demo.events; Kafka demo.events (2 partitions).',
    )
    if (process.argv.includes('--seed-only')) return
    console.log(
      'Publishing synthetic JSON once per second. Ctrl+C stops traffic; pnpm demo:stop stops the local brokers.',
    )
    while (!stop.signal.aborted) {
      await delay(1000, undefined, { signal: stop.signal })
      if (!stop.signal.aborted) await demo.tick()
    }
  } catch (error) {
    if (!stop.signal.aborted) throw error
  } finally {
    await demo?.close()
    process.removeListener('SIGINT', onStop)
    process.removeListener('SIGTERM', onStop)
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error('Local demo failed:', error.message)
    process.exitCode = 1
  })
