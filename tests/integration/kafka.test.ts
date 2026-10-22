import { it, expect } from 'vitest'
import { Admin, Producer } from '@platformatic/kafka'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { KafkaProvider } from '../../src/service/providers/kafka'
import { SessionManager } from '../../src/service/sessions'
import { CaptureStorage } from '../../src/service/storage'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
import { kafkaOptions, kafkaProfile } from '../fixtures/kafka'
it('discovers Kafka topics/partitions and captures independent local positions without creating or committing groups', async () => {
  const admin = new Admin(kafkaOptions),
    producer = new Producer({ ...kafkaOptions, idempotent: true }),
    topic = 'qc-' + randomUUID()
  const dir = await mkdtemp(join(tmpdir(), 'qc-kafka-')),
    store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS),
    sessions = new SessionManager(store, () => DEFAULT_SETTINGS)
  try {
    await admin.createTopics({ topics: [topic], partitions: 2, replicas: 1 })
    const groupsBefore = [...(await admin.listGroups()).keys()].sort()
    const provider = new KafkaProvider(kafkaProfile)
    expect((await provider.test()).protocol.ok).toBe(true)
    await expect
      .poll(
        async () => (await provider.listResources(topic, 1)).resources[0]?.kind,
      )
      .toBe('topic')
    expect(await provider.partitions(topic)).toHaveLength(2)
    await producer.send({
      messages: [0, 1, 2].flatMap((n) =>
        [0, 1].map((partition) => ({
          topic,
          partition,
          key: Buffer.from([0, 255]),
          value: Buffer.from(`${partition}:${n}`),
          headers: new Map([[Buffer.from('binary'), Buffer.from([0, 255])]]),
        })),
      ),
    })
    const capture = await sessions.startCapture(
      kafkaProfile,
      { name: topic, vhost: '', kind: 'topic' },
      {
        allowPartial: false,
        kafkaPartitions: [
          { partition: 0, from: 'first' },
          { partition: 1, from: '1' },
        ],
      },
    )
    await expect
      .poll(() => sessions.list()[0].captured, { timeout: 10000 })
      .toBe(5)
    const records = store
      .readPage(capture.id, null, 20)
      .records.map((r) => store.get(r.id))
    expect(
      records.map((r) => `${r.kafka?.partition}:${r.kafka?.offset}`).sort(),
    ).toEqual(['0:0', '0:1', '0:2', '1:1', '1:2'])
    expect(records[0].headers.key).toEqual(Buffer.from([0, 255]))
    await sessions.stopCapture(capture.id)
    expect([...(await admin.listGroups()).keys()].sort()).toEqual(groupsBefore)
  } finally {
    await sessions.close()
    store.close()
    await admin.deleteTopics({ topics: [topic] })
    await Promise.all([admin.close(), producer.close()])
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)

it('validates verified TLS, SASL PLAIN and both SCRAM mechanisms against the real broker', async () => {
  const caPem = await readFile('tests/fixtures/tls/localhost-cert.pem', 'utf8')
  const secure = {
    ...kafkaProfile,
    tls: true,
    allowInsecure: false,
    caPem,
    brokers: ['localhost:29093'],
  }
  expect((await new KafkaProvider(secure).test()).protocol.ok).toBe(true)
  expect(
    (await new KafkaProvider({ ...secure, caPem: undefined }).test()).protocol
      .ok,
  ).toBe(false)
  for (const mechanism of [
    'PLAIN',
    'SCRAM-SHA-256',
    'SCRAM-SHA-512',
  ] as const) {
    const profile = {
      ...secure,
      brokers: ['localhost:29094'],
      sasl: { mechanism, username: 'cucumber', password: 'local-test-only' },
    }
    expect((await new KafkaProvider(profile).test()).protocol.ok).toBe(true)
    expect(
      (
        await new KafkaProvider({
          ...profile,
          sasl: { ...profile.sasl, password: 'incorrect-synthetic' },
        }).test()
      ).protocol,
    ).toEqual({ ok: false, code: 'ACCESS_REFUSED' })
  }
}, 30000)

it('reports removed prefixes, future clamping and partition changes without silently expanding the selection', async () => {
  const admin = new Admin(kafkaOptions),
    producer = new Producer({ ...kafkaOptions, idempotent: true }),
    topic = 'qc-retention-' + randomUUID()
  const dir = await mkdtemp(join(tmpdir(), 'qc-kafka-retention-')),
    store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS),
    sessions = new SessionManager(store, () => DEFAULT_SETTINGS)
  try {
    await admin.createTopics({ topics: [topic], partitions: 1, replicas: 1 })
    await producer.send({
      messages: [0, 1, 2, 3, 4].map((n) => ({
        topic,
        partition: 0,
        value: Buffer.from(String(n)),
      })),
    })
    await admin.deleteRecords({
      topics: [{ name: topic, partitions: [{ partition: 0, offset: 2n }] }],
    })
    const capture = await sessions.startCapture(
      kafkaProfile,
      { name: topic, vhost: '', kind: 'topic' },
      { allowPartial: false, kafkaPartitions: [{ partition: 0, from: '0' }] },
    )
    await expect.poll(() => sessions.list()[0].captured).toBe(3)
    expect(sessions.list()[0].kafkaPositions?.[0].notice).toBe(
      'RETENTION_CLAMPED',
    )
    await admin.createPartitions({ topics: [{ name: topic, count: 2 }] })
    await expect
      .poll(() => sessions.list()[0].kafkaTopologyChanged, { timeout: 10000 })
      .toBe(true)
    expect(sessions.list()[0].kafkaPositions).toHaveLength(1)
    await sessions.stopCapture(capture.id)
    const next = await sessions.startCapture(
      kafkaProfile,
      { name: topic, vhost: '', kind: 'topic' },
      {
        allowPartial: false,
        kafkaPartitions: [{ partition: 0, from: '9223372036854775807' }],
      },
    )
    expect(next.kafkaPositions?.[0].notice).toBe('OFFSET_AHEAD')
    expect(next.kafkaPositions?.[0].next).toBe('5')
    await sessions.stopCapture(next.id)
  } finally {
    await sessions.close()
    store.close()
    await admin.deleteTopics({ topics: [topic] })
    await Promise.all([admin.close(), producer.close()])
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)

it('resumes after a real socket loss, keeps offsets unique, and fails when the topic is deleted', async () => {
  const { vi } = await import('vitest'),
    kafkaModule = await import('../../src/service/providers/kafka')
  const original = kafkaModule.kafkaClient,
    clients: ReturnType<typeof original>[] = []
  const spy = vi.spyOn(kafkaModule, 'kafkaClient').mockImplementation((p) => {
    const c = original(p)
    clients.push(c)
    return c
  })
  const admin = new Admin(kafkaOptions),
    producer = new Producer({ ...kafkaOptions, idempotent: true }),
    topic = 'qc-resume-' + randomUUID()
  const dir = await mkdtemp(join(tmpdir(), 'qc-kafka-resume-')),
    store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS),
    sessions = new SessionManager(store, () => DEFAULT_SETTINGS)
  let deleted = false
  try {
    await admin.createTopics({ topics: [topic], partitions: 1, replicas: 1 })
    const capture = await sessions.startCapture(
      kafkaProfile,
      { name: topic, vhost: '', kind: 'topic' },
      {
        allowPartial: false,
        kafkaPartitions: [{ partition: 0, from: 'next' }],
      },
    )
    await producer.send({
      messages: [{ topic, partition: 0, value: Buffer.from('before') }],
    })
    await expect.poll(() => sessions.list()[0].captured).toBe(1)
    for (const [, connection] of clients[0].connections)
      connection.socket.destroy()
    await producer.send({
      messages: [{ topic, partition: 0, value: Buffer.from('after') }],
    })
    await expect
      .poll(() => sessions.list()[0].captured, { timeout: 10000 })
      .toBe(2)
    expect(
      new Set(
        store
          .readPage(capture.id, null, 10)
          .records.map((r) => store.get(r.id).kafka?.offset),
      ).size,
    ).toBe(2)
    await admin.deleteTopics({ topics: [topic] })
    deleted = true
    await expect
      .poll(() => sessions.list()[0].state, { timeout: 10000 })
      .toBe('failed')
  } finally {
    spy.mockRestore()
    await sessions.close()
    store.close()
    if (!deleted) await admin.deleteTopics({ topics: [topic] })
    await Promise.all([admin.close(), producer.close()])
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)

it('cancels an in-flight initial Kafka connection without reviving its session', async () => {
  const sessions = new SessionManager(
    { append: () => ({ id: 1, omitted: false }) },
    () => DEFAULT_SETTINGS,
  )
  const result = sessions
    .startCapture(
      kafkaProfile,
      { kind: 'topic', name: 'qc-not-created', vhost: '' },
      {
        allowPartial: false,
        kafkaPartitions: [{ partition: 0, from: 'next' }],
      },
    )
    .then(
      (s) => s,
      () => undefined,
    )
  const id = sessions.list()[0].id
  await sessions.stopCapture(id)
  await result
  expect(sessions.list()[0].state).toBe('stopped')
  await sessions.close()
})

it('preserves compressed binary records, repeated headers and tombstones through capture and export', async () => {
  const { ExportManager } = await import('../../src/service/exports')
  const admin = new Admin(kafkaOptions),
    producer = new Producer<Buffer, Buffer | null>({
      ...kafkaOptions,
      idempotent: true,
    }),
    topic = 'qc-bytes-' + randomUUID()
  const dir = await mkdtemp(join(tmpdir(), 'qc-kafka-bytes-')),
    store = new CaptureStorage(
      join(dir, 'data'),
      randomBytes(32),
      DEFAULT_SETTINGS,
    ),
    sessions = new SessionManager(store, () => DEFAULT_SETTINGS)
  const timestamp = BigInt(Date.now() - 1000),
    payload = Buffer.from([0, 255, 128, 1])
  try {
    await admin.createTopics({ topics: [topic], partitions: 1, replicas: 1 })
    await producer.send({
      compression: 'gzip',
      messages: [
        {
          topic,
          partition: 0,
          timestamp,
          key: Buffer.from([255]),
          value: payload,
          headers: new Map([
            [Buffer.from('same'), Buffer.from([1])],
            [Buffer.from('same'), Buffer.from([2])],
          ]),
        },
        { topic, partition: 0, key: Buffer.from('deleted'), value: null },
        { topic, partition: 0, value: Buffer.alloc(0) },
      ],
    })
    const capture = await sessions.startCapture(
      kafkaProfile,
      { name: topic, vhost: '', kind: 'topic' },
      {
        allowPartial: false,
        kafkaPartitions: [{ partition: 0, from: 'first' }],
      },
    )
    await expect.poll(() => sessions.list()[0].captured).toBe(3)
    const records = store
      .readPage(capture.id, null, 10)
      .records.map((r) => store.get(r.id))
      .reverse()
    expect(records[0].payload.equals(payload)).toBe(true)
    expect(records[0].kafka?.timestamp).toBe(String(timestamp))
    expect(records[0].headers.kafkaHeaders).toEqual([
      { key: Buffer.from('same'), value: Buffer.from([1]) },
      { key: Buffer.from('same'), value: Buffer.from([2]) },
    ])
    expect(records[1].kafka?.tombstone).toBe(true)
    expect(records[2].kafka?.tombstone).toBe(false)
    await sessions.stopCapture(capture.id)
    const exporter = new ExportManager(store),
      path = join(dir, 'capture.jsonl')
    exporter.start(sessions.list()[0], path, 'jsonl')
    await exporter.wait()
    expect(exporter.status()?.state).toBe('complete')
    const lines = (await readFile(path, 'utf8'))
      .trim()
      .split('\n')
      .map((s) => JSON.parse(s))
    expect(lines[1].payloadBase64).toBe(payload.toString('base64'))
    expect(lines[1].headers.kafkaHeaders.value).toHaveLength(2)
    expect(lines[2].kafka.tombstone).toBe(true)
  } finally {
    await sessions.close()
    store.close()
    await admin.deleteTopics({ topics: [topic] })
    await Promise.all([admin.close(), producer.close()])
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)

it('fetches records over verified TLS and all supported SASL mechanisms without groups', async () => {
  const admin = new Admin(kafkaOptions),
    producer = new Producer({ ...kafkaOptions, idempotent: true }),
    topic = 'qc-secure-' + randomUUID(),
    sessions = new SessionManager(
      { append: () => ({ id: 1, omitted: false }) },
      () => DEFAULT_SETTINGS,
    )
  try {
    await admin.createTopics({ topics: [topic], partitions: 1, replicas: 1 })
    await producer.send({
      messages: [
        { topic, partition: 0, value: Buffer.from('synthetic secure record') },
      ],
    })
    const caPem = await readFile(
      'tests/fixtures/tls/localhost-cert.pem',
      'utf8',
    )
    const base = { ...kafkaProfile, tls: true, allowInsecure: false, caPem }
    const profiles = [
      { ...base, brokers: ['localhost:29093'] },
      ...(['PLAIN', 'SCRAM-SHA-256', 'SCRAM-SHA-512'] as const).map(
        (mechanism) => ({
          ...base,
          brokers: ['localhost:29094'],
          sasl: {
            mechanism,
            username: 'cucumber',
            password: 'local-test-only',
          },
        }),
      ),
    ]
    for (const profile of profiles) {
      const capture = await sessions.startCapture(
        profile,
        { name: topic, vhost: '', kind: 'topic' },
        {
          allowPartial: false,
          kafkaPartitions: [{ partition: 0, from: 'first' }],
        },
      )
      await expect
        .poll(() => sessions.list().find((s) => s.id === capture.id)?.captured)
        .toBe(1)
      await sessions.stopCapture(capture.id)
    }
  } finally {
    await sessions.close()
    await admin.deleteTopics({ topics: [topic] })
    await Promise.all([admin.close(), producer.close()])
  }
}, 30000)

it('preserves broker append timestamps for LogAppendTime topics', async () => {
  const admin = new Admin(kafkaOptions),
    producer = new Producer({ ...kafkaOptions, idempotent: true }),
    topic = 'qc-append-time-' + randomUUID()
  let timestamp: string | undefined
  const sessions = new SessionManager(
    {
      append: (_sessionId, record) => {
        timestamp = record.kafka?.timestamp
        return { id: 1, omitted: false }
      },
    },
    () => DEFAULT_SETTINGS,
  )
  try {
    await admin.createTopics({
      topics: [topic],
      partitions: 1,
      replicas: 1,
      configs: [{ name: 'message.timestamp.type', value: 'LogAppendTime' }],
    })
    const before = Date.now(),
      producerTimestamp = before - 60000
    await producer.send({
      messages: [
        {
          topic,
          partition: 0,
          value: Buffer.from('append time'),
          timestamp: BigInt(producerTimestamp),
        },
      ],
    })
    const after = Date.now()
    const capture = await sessions.startCapture(
      kafkaProfile,
      { name: topic, vhost: '', kind: 'topic' },
      {
        allowPartial: false,
        kafkaPartitions: [{ partition: 0, from: 'first' }],
      },
    )
    await expect
      .poll(() => sessions.list().find((s) => s.id === capture.id)?.captured)
      .toBe(1)
    expect(Number(timestamp)).toBeGreaterThanOrEqual(before)
    expect(Number(timestamp)).toBeLessThanOrEqual(after)
    expect(timestamp).not.toBe(String(producerTimestamp))
  } finally {
    await sessions.close()
    await admin.deleteTopics({ topics: [topic] })
    await Promise.all([admin.close(), producer.close()])
  }
}, 30000)
