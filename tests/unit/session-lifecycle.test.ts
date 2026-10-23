import { it, expect, vi } from 'vitest'
import type { SessionSummary } from '../../src/service/sessions'
import type { KafkaSelection } from '../../src/shared/kafka'
vi.mock('../../src/service/kafka-capture', () => ({
  KafkaCapture: class {
    constructor(
      private profile: unknown,
      private summary: SessionSummary,
      private selected: KafkaSelection,
    ) {}
    async start() {
      this.summary.state = 'capturing'
      this.summary.kafkaPositions ??= this.selected.map((p) => ({
        partition: p.partition,
        first: '0',
        end: '10',
        leader: 1,
        start: p.from === 'first' ? '0' : p.from === 'next' ? '10' : p.from,
        next: p.from === 'first' ? '0' : p.from === 'next' ? '10' : p.from,
      }))
    }
    async stop() {}
  },
}))
import { SessionManager } from '../../src/service/sessions'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
const profile = {
  id: 'profile',
  provider: 'kafka' as const,
  name: 'Synthetic',
  brokers: ['localhost:9093'],
  tls: true,
  allowInsecure: false,
}
const resource = { name: 'events', kind: 'topic' as const, vhost: '' }
const selection = [{ partition: 1, from: '2' }]
function summary(id: string): SessionSummary {
  return {
    id,
    connectionId: profile.id,
    resource,
    provider: 'kafka',
    state: 'stopped',
    captured: 5,
    omitted: 0,
    gaps: 0,
    startedAt: 1,
    bindings: [],
    potentialOverflow: false,
    kafkaPositions: [
      { partition: 1, first: '0', end: '10', leader: 1, start: '2', next: '7' },
    ],
  }
}
function manager(rows: SessionSummary[]) {
  return new SessionManager(
    {
      append: () => ({ id: 1, omitted: false }),
      loadSessions: () => structuredClone(rows),
      saveSessions: () => {},
    },
    () => DEFAULT_SETTINGS,
  )
}
it('keeps one active subscription when legacy duplicate histories are restarted', async () => {
  const sessions = manager([summary('a'), summary('b')])
  try {
    await sessions.startCapture(profile, resource, {
      allowPartial: false,
      captureId: 'a',
      kafkaPartitions: selection,
    })
    const next = await sessions.startCapture(profile, resource, {
      allowPartial: false,
      captureId: 'b',
      kafkaPartitions: selection,
    })
    expect(next.id).toBe('a')
    expect(sessions.list().filter((s) => s.state === 'capturing')).toHaveLength(
      1,
    )
  } finally {
    await sessions.close()
  }
})
it('honors an edited partition selection on the first restart of a 1.0.0 capture', async () => {
  const sessions = manager([summary('legacy')])
  try {
    const next = await sessions.startCapture(profile, resource, {
      allowPartial: false,
      kafkaPartitions: [{ partition: 0, from: '4' }],
    })
    expect(next.kafkaPositions?.map((p) => [p.partition, p.next])).toEqual([
      [0, '4'],
    ])
  } finally {
    await sessions.close()
  }
})
it('leaves a stopped capture restartable when changed limits are invalid', async () => {
  const sessions = manager([summary('a')])
  try {
    await expect(
      sessions.startCapture(profile, resource, {
        allowPartial: false,
        kafkaPartitions: selection,
        limits: { cacheBytes: -1 },
      }),
    ).rejects.toThrow()
    expect(sessions.list()[0].state).toBe('stopped')
    const next = await sessions.startCapture(profile, resource, {
      allowPartial: false,
      kafkaPartitions: selection,
    })
    expect(next.state).toBe('capturing')
    expect(next.kafkaPositions?.[0].next).toBe('7')
  } finally {
    await sessions.close()
  }
})
