import { it, expect, vi } from 'vitest'
import type { SessionSummary } from '../../src/service/sessions'
import { KafkaCapture } from '../../src/service/kafka-capture'
const fake = vi.hoisted(() => ({
  fetch: vi.fn(),
  close: vi.fn(async () => {}),
  ranges: vi.fn(),
}))
vi.mock('../../src/service/providers/kafka', () => ({
  kafkaClient: () => fake,
  kafkaPartitions: fake.ranges,
  kafkaFailure: (e: unknown) =>
    (e as { code?: string }).code ?? 'CONNECTION_FAILED',
}))
const profile = {
  id: 'synthetic',
  provider: 'kafka' as const,
  name: 'test',
  brokers: ['localhost:1'],
  tls: false,
  allowInsecure: true,
}
function summary(): SessionSummary {
  return {
    id: 's',
    connectionId: 'p',
    resource: { name: 'topic', kind: 'topic', vhost: '' },
    state: 'connecting',
    captured: 0,
    omitted: 0,
    gaps: 0,
    startedAt: 0,
    bindings: [],
    potentialOverflow: false,
  }
}
it('advances across compacted tails using the batch boundary, preserving keys and tombstones', async () => {
  fake.ranges.mockResolvedValue({
    id: 'topic-id',
    partitions: [{ partition: 0, leader: 1, first: '0', end: '10' }],
  })
  const batch = {
    firstOffset: 0n,
    lastOffsetDelta: 9,
    firstTimestamp: 100n,
    attributes: 0,
    records: [
      {
        offsetDelta: 5,
        timestampDelta: 2n,
        key: Buffer.from([255]),
        value: null,
        headers: [
          [Buffer.from('same'), Buffer.from('one')],
          [Buffer.from('same'), null],
        ],
      },
    ],
  }
  fake.fetch
    .mockReset()
    .mockResolvedValueOnce({
      responses: [
        {
          topicId: 'topic-id',
          partitions: [{ partitionIndex: 0, records: [batch] }],
        },
      ],
    })
    .mockResolvedValue({ responses: [] })
  const s = summary(),
    records: unknown[] = [],
    capture = new KafkaCapture(
      profile,
      s,
      [{ partition: 0, from: 'first' }],
      (r) => records.push(r),
      () => {},
    )
  try {
    await capture.start()
    await expect.poll(() => s.kafkaPositions?.[0].next).toBe('10')
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      payload: Buffer.alloc(0),
      headers: {
        key: Buffer.from([255]),
        kafkaHeaders: [
          { key: Buffer.from('same'), value: Buffer.from('one') },
          { key: Buffer.from('same'), value: null },
        ],
      },
      kafka: { offset: '5', timestamp: '102', tombstone: true },
    })
  } finally {
    await capture.stop()
  }
})
it('stops on storage failure and never advances the failed record locally', async () => {
  fake.ranges.mockResolvedValue({
    id: 'topic-id',
    partitions: [{ partition: 0, leader: 1, first: '0', end: '1' }],
  })
  fake.fetch.mockReset().mockResolvedValue({
    responses: [
      {
        topicId: 'topic-id',
        partitions: [
          {
            partitionIndex: 0,
            records: [
              {
                firstOffset: 0n,
                lastOffsetDelta: 0,
                firstTimestamp: 0n,
                attributes: 0,
                records: [
                  {
                    offsetDelta: 0,
                    timestampDelta: 0n,
                    key: null,
                    value: Buffer.from('data'),
                    headers: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  })
  const s = summary(),
    capture = new KafkaCapture(
      profile,
      s,
      [{ partition: 0, from: 'first' }],
      () => {
        throw Object.assign(Error('synthetic disk full'), {
          code: 'STORAGE_OR_LIMIT_FAILURE',
        })
      },
      () => {},
    )
  try {
    await capture.start()
    await expect.poll(() => s.state).toBe('failed')
    expect(s.kafkaPositions?.[0].next).toBe('0')
  } finally {
    await capture.stop()
  }
})
for (const change of ['identity', 'truncation'] as const)
  it(`fails closed on topic ${change} changes`, async () => {
    fake.ranges
      .mockReset()
      .mockResolvedValueOnce({
        id: 'original',
        partitions: [{ partition: 0, leader: 1, first: '0', end: '10' }],
      })
      .mockResolvedValue({
        id: change === 'identity' ? 'replacement' : 'original',
        partitions: [
          {
            partition: 0,
            leader: 1,
            first: '0',
            end: change === 'truncation' ? '5' : '10',
          },
        ],
      })
    fake.fetch.mockReset().mockResolvedValue({ responses: [] })
    const s = summary(),
      capture = new KafkaCapture(
        profile,
        s,
        [{ partition: 0, from: 'next' }],
        () => {},
        () => {},
      )
    try {
      await capture.start()
      await expect.poll(() => s.state).toBe('failed')
      expect(s.error).toBe('TOPIC_CHANGED')
      if (change === 'truncation')
        expect(s.kafkaPositions?.[0].notice).toBe('LOG_TRUNCATED')
    } finally {
      await capture.stop()
    }
  })
it('keeps offsets beyond Number.MAX_SAFE_INTEGER exact across persistence input', async () => {
  const base = 9007199254740993n
  fake.ranges.mockReset().mockResolvedValue({
    id: 'original',
    partitions: [
      {
        partition: 0,
        leader: 1,
        first: String(base),
        end: String(base + 1n),
      },
    ],
  })
  fake.fetch
    .mockReset()
    .mockResolvedValueOnce({
      responses: [
        {
          topicId: 'original',
          partitions: [
            {
              partitionIndex: 0,
              records: [
                {
                  firstOffset: base,
                  lastOffsetDelta: 0,
                  firstTimestamp: 0n,
                  attributes: 0,
                  records: [
                    {
                      offsetDelta: 0,
                      timestampDelta: 0n,
                      key: null,
                      value: Buffer.alloc(0),
                      headers: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    .mockResolvedValue({ responses: [] })
  const s = summary(),
    append = vi.fn(),
    capture = new KafkaCapture(
      profile,
      s,
      [{ partition: 0, from: 'first' }],
      append,
      () => {},
    )
  try {
    await capture.start()
    await expect.poll(() => s.kafkaPositions?.[0].next).toBe(String(base + 1n))
    expect(append.mock.calls[0][0].kafka.offset).toBe(String(base))
  } finally {
    await capture.stop()
  }
})
it('uses broker append time for LogAppendTime batches instead of producer timestamp deltas', async () => {
  fake.ranges.mockReset().mockResolvedValue({
    id: 'append-time',
    partitions: [{ partition: 0, leader: 1, first: '0', end: '1' }],
  })
  fake.fetch
    .mockReset()
    .mockResolvedValueOnce({
      responses: [
        {
          topicId: 'append-time',
          partitions: [
            {
              partitionIndex: 0,
              records: [
                {
                  firstOffset: 0n,
                  lastOffsetDelta: 0,
                  firstTimestamp: 100n,
                  maxTimestamp: 500n,
                  attributes: 8,
                  records: [
                    {
                      offsetDelta: 0,
                      timestampDelta: 2n,
                      key: null,
                      value: Buffer.from('data'),
                      headers: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    })
    .mockResolvedValue({ responses: [] })
  const s = summary(),
    append = vi.fn(),
    capture = new KafkaCapture(
      profile,
      s,
      [{ partition: 0, from: 'first' }],
      append,
      () => {},
    )
  try {
    await capture.start()
    await expect.poll(() => append.mock.calls.length).toBe(1)
    expect(append.mock.calls[0][0].kafka.timestamp).toBe('500')
  } finally {
    await capture.stop()
  }
})
