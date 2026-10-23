import { Consumer, IS_CONTROL, IS_TRANSACTIONAL } from '@platformatic/kafka'
import {
  setTimeout as delay,
  setImmediate as yieldNow,
} from 'node:timers/promises'
import type { KafkaConnectionProfile } from '../shared/connection'
import { kafkaSelectionSchema, type KafkaSelection } from '../shared/kafka'
import type { SessionSummary } from './sessions'
import type { IncomingRecord } from './storage'
import { kafkaClient, kafkaFailure, kafkaPartitions } from './providers/kafka'

export class KafkaCapture {
  private client?: Consumer
  private abort = new AbortController()
  private work?: Promise<void>
  private topicId?: string
  private partitionCount?: number
  constructor(
    private profile: KafkaConnectionProfile,
    private summary: SessionSummary,
    private selected: KafkaSelection,
    private append: (record: IncomingRecord) => void,
    private changed: () => void,
  ) {
    this.selected = kafkaSelectionSchema.parse(selected)
  }
  async start() {
    this.client = kafkaClient(this.profile)
    try {
      await this.updateRanges()
      this.check()
      this.summary.state = 'capturing'
      this.changed()
      this.work = this.loop().catch(async () => {
        this.summary.state = 'failed'
        this.summary.error = 'STORAGE_OR_LIMIT_FAILURE'
        await this.client?.close(true).catch(() => {})
        try {
          this.changed()
        } catch {
          /* Storage remains unavailable; retain the visible failure. */
        }
      })
    } catch (error) {
      await this.client.close(true).catch(() => {})
      throw error
    }
  }
  private check() {
    if (this.abort.signal.aborted) throw Error('Capture stopped')
  }
  private async updateRanges() {
    this.check()
    const { id, partitions } = await kafkaPartitions(
      this.client!,
      this.summary.resource.name,
    )
    this.check()
    if (this.topicId && this.topicId !== id)
      throw Object.assign(Error('Topic was recreated'), {
        code: 'TOPIC_CHANGED',
      })
    this.topicId = id
    if (
      this.partitionCount !== undefined &&
      this.partitionCount !== partitions.length
    )
      this.summary.kafkaTopologyChanged = true
    this.partitionCount = partitions.length
    if (!this.summary.kafkaPositions)
      this.summary.kafkaPositions = this.selected.map((p) => {
        const range = partitions.find((r) => r.partition === p.partition)
        if (!range)
          throw Object.assign(Error('Partition unavailable'), {
            code: 'NOT_FOUND',
          })
        const next =
          p.from === 'first'
            ? range.first
            : p.from === 'next'
              ? range.end
              : p.from
        return { ...range, start: next, next }
      })
    for (const position of this.summary.kafkaPositions) {
      const range = partitions.find((p) => p.partition === position.partition)
      if (!range)
        throw Object.assign(Error('Partition unavailable'), {
          code: 'NOT_FOUND',
        })
      if (BigInt(range.end) < BigInt(position.end)) {
        position.notice = 'LOG_TRUNCATED'
        throw Object.assign(Error('Log truncated'), { code: 'TOPIC_CHANGED' })
      }
      if (BigInt(position.next) < BigInt(range.first)) {
        position.next = range.first
        position.notice = 'RETENTION_CLAMPED'
        this.summary.gaps++
      } else if (BigInt(position.next) > BigInt(range.end)) {
        position.next = range.end
        position.notice = 'OFFSET_AHEAD'
        this.summary.gaps++
      }
      Object.assign(position, range)
    }
    return { id, partitions }
  }
  private async loop() {
    let attempt = 0
    while (!this.abort.signal.aborted) {
      try {
        const { id, partitions } = await this.updateRanges()
        this.check()
        this.summary.state = 'capturing'
        this.summary.error = undefined
        for (const position of this.summary.kafkaPositions!) {
          this.check()
          const range = partitions.find(
            (p) => p.partition === position.partition,
          )!
          const response = await this.client!.fetch({
            node: range.leader,
            topics: [
              {
                topicId: id,
                partitions: [
                  {
                    partition: position.partition,
                    fetchOffset: BigInt(position.next),
                    currentLeaderEpoch: -1,
                    lastFetchedEpoch: -1,
                    partitionMaxBytes: 1024 ** 2,
                  },
                ],
              },
            ],
            maxBytes: 1024 ** 2,
            minBytes: 1,
            maxWaitTime: 100,
            isolationLevel: 0,
          })
          this.check()
          const data = response.responses
            .find((t) => t.topicId === id)
            ?.partitions.find((p) => p.partitionIndex === position.partition)
          if (!data) continue // Incremental fetch sessions can omit unchanged empty partitions.
          for (const batch of data.records ?? []) {
            if (batch.attributes & IS_CONTROL) {
              const next =
                batch.firstOffset + BigInt(batch.lastOffsetDelta) + 1n
              if (next > BigInt(position.next)) position.next = String(next)
              continue
            }
            for (const record of batch.records) {
              this.check()
              const offset = batch.firstOffset + BigInt(record.offsetDelta)
              if (offset < BigInt(position.next)) continue
              this.append({
                payload: record.value ?? Buffer.alloc(0),
                headers: {
                  key: record.key,
                  kafkaHeaders: record.headers.map(([key, value]) => ({
                    key,
                    value,
                  })),
                },
                exchange: '',
                routingKey: this.summary.resource.name,
                kafka: {
                  topic: this.summary.resource.name,
                  partition: position.partition,
                  offset: String(offset),
                  timestamp: String(
                    // Kafka LogAppendTime stores the broker timestamp in maxTimestamp.
                    (batch.attributes & 8) !== 0
                      ? batch.maxTimestamp
                      : batch.firstTimestamp + record.timestampDelta,
                  ),
                  tombstone: record.value === null,
                  transactional: !!(batch.attributes & IS_TRANSACTIONAL),
                },
              })
              position.next = String(offset + 1n)
              // Yield without fetching another batch; cancel/status/export remain responsive.
              await yieldNow()
            }
            this.check()
            const batchEnd =
              batch.firstOffset + BigInt(batch.lastOffsetDelta) + 1n
            if (batchEnd > BigInt(position.next))
              position.next = String(batchEnd)
          }
        }
        attempt = 0
        this.changed()
        await delay(50, undefined, { signal: this.abort.signal })
      } catch (error) {
        if (this.abort.signal.aborted) return
        const code = kafkaFailure(error)
        if (
          [
            'ACCESS_REFUSED',
            'TLS_FAILED',
            'NOT_FOUND',
            'RESOURCE_LIMIT',
            'UNSUPPORTED_ROUTE',
            'TOPIC_CHANGED',
            'STORAGE_OR_LIMIT_FAILURE',
          ].includes(code)
        ) {
          this.summary.state = 'failed'
          this.summary.error = code
          this.summary.gaps++
          this.changed()
          await this.client?.close(true).catch(() => {})
          return
        }
        this.summary.state = 'reconnecting'
        this.summary.error = 'CAPTURE_GAP'
        this.summary.gaps++
        this.changed()
        await this.client?.close(true).catch(() => {})
        try {
          await delay(
            Math.min(30000, 500 * 2 ** Math.min(attempt++, 6)) +
              Math.random() * 250,
            undefined,
            { signal: this.abort.signal },
          )
        } catch {
          return
        }
        if (this.abort.signal.aborted) return
        this.client = kafkaClient(this.profile)
      }
    }
  }
  async stop() {
    this.abort.abort()
    await this.client?.close(true).catch(() => {})
    await this.work
  }
}
