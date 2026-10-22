import { KafkaCapture } from './kafka-capture'
import {
  kafkaSelectionSchema,
  type KafkaSelection,
  type KafkaPosition,
} from '../shared/kafka'
import { randomUUID } from 'node:crypto'
import type { ChannelModel, ConsumeMessage } from 'amqplib'
import type { ConnectionProfile } from '../shared/connection'
import { resolveSessionSettings, type CaptureSettings } from '../shared/limits'
import { RabbitMQ, failureCode } from './providers/rabbitmq'
import type { ResourceRef, Binding } from './providers/provider'
import type { CaptureStorage } from './storage'
export type SessionSummary = {
  provider?: 'rabbitmq' | 'kafka'
  kafkaPositions?: KafkaPosition[]
  kafkaTopologyChanged?: boolean
  id: string
  connectionId: string
  resource: ResourceRef
  state: 'connecting' | 'capturing' | 'reconnecting' | 'stopped' | 'failed'
  captured: number
  omitted: number
  gaps: number
  startedAt: number
  bindings: Binding[]
  error?: string
  bindingChanged?: boolean
  retained?: { count: number; first: number | null; last: number | null }
  streamStart?: 'first' | 'next' | number
  lastOffset?: number
  offsetNotice?: 'OFFSET_CLAMPED' | 'OFFSET_DISCONTINUITY' | 'OFFSET_UNVERIFIED'
  potentialOverflow: boolean
}
export type CaptureOptions = {
  kafkaPartitions?: KafkaSelection
  allowPartial: boolean
  streamStart?: 'first' | 'next' | number
  limits?: Partial<CaptureSettings>
}
type Session = {
  summary: SessionSummary
  profile?: ConnectionProfile
  options: CaptureOptions
  generation: number
  kafka?: KafkaCapture
  connection?: ChannelModel
  timer?: ReturnType<typeof setTimeout>
  attempt: number
  rateStart: number
  rateCount: number
}
export class SessionManager {
  private sessions = new Map<string, Session>()
  constructor(
    private store: Pick<CaptureStorage, 'append'> &
      Partial<
        Pick<
          CaptureStorage,
          | 'setSessionLimits'
          | 'saveSessions'
          | 'loadSessions'
          | 'deleteSession'
          | 'retainedRange'
        >
      >,
    private settings: () => CaptureSettings,
  ) {
    for (const summary of this.store.loadSessions?.() ?? []) {
      const interrupted = !['stopped', 'failed'].includes(summary.state)
      const range = this.store.retainedRange?.(summary.id)
      this.sessions.set(summary.id, {
        summary: {
          ...summary,
          state: 'stopped',
          gaps: summary.gaps + (interrupted ? 1 : 0),
          error: interrupted ? 'INTERRUPTED_RESTART' : summary.error,
          captured: Math.max(
            summary.captured,
            (range?.count ?? 0) - summary.omitted,
          ),
        },
        options: { allowPartial: false },
        generation: 0,
        attempt: 0,
        rateStart: Date.now(),
        rateCount: 0,
      })
    }
  }
  private persist() {
    this.store.saveSessions?.(this.list())
  }
  list(): SessionSummary[] {
    return [...this.sessions.values()].map((s) =>
      structuredClone({
        ...s.summary,
        retained: this.store.retainedRange?.(s.summary.id),
      }),
    )
  }
  async startCapture(
    profile: ConnectionProfile,
    resource: ResourceRef,
    options: CaptureOptions,
  ): Promise<SessionSummary> {
    const isKafka = profile.provider === 'kafka'
    if (isKafka) {
      if (resource.kind !== 'topic' || resource.vhost !== '')
        throw Error('Choose a Kafka topic')
      kafkaSelectionSchema.parse(options.kafkaPartitions)
    }
    if (!isKafka && !['queue', 'stream'].includes(resource.kind))
      throw Error('Choose a queue or stream')
    if (
      resource.kind === 'stream' &&
      !(
        options.streamStart === 'first' ||
        options.streamStart === 'next' ||
        (typeof options.streamStart === 'number' &&
          Number.isSafeInteger(options.streamStart) &&
          options.streamStart >= 0)
      )
    )
      throw Error('Choose a valid stream start position')
    if (
      [...this.sessions.values()].filter(
        (s) => !['stopped', 'failed'].includes(s.summary.state),
      ).length >= 4
    )
      throw Error('Capture session limit reached')
    if (this.sessions.size >= 100) {
      const oldest = [...this.sessions.values()].find((s) =>
        ['stopped', 'failed'].includes(s.summary.state),
      )
      if (oldest) {
        this.store.deleteSession?.(oldest.summary.id)
        this.sessions.delete(oldest.summary.id)
      }
    }
    const s: Session = {
      summary: {
        provider: profile.provider ?? 'rabbitmq',
        id: randomUUID(),
        connectionId: profile.id,
        resource,
        state: 'connecting',
        captured: 0,
        omitted: 0,
        gaps: 0,
        startedAt: Date.now(),
        bindings: [],
        streamStart:
          resource.kind === 'stream' ? options.streamStart : undefined,
        offsetNotice:
          resource.kind === 'stream' && typeof options.streamStart === 'number'
            ? 'OFFSET_UNVERIFIED'
            : undefined,
        potentialOverflow: !isKafka && resource.kind !== 'stream',
      },
      profile,
      options,
      generation: 0,
      attempt: 0,
      rateStart: Date.now(),
      rateCount: 0,
    }
    this.store.setSessionLimits?.(
      s.summary.id,
      resolveSessionSettings(this.settings(), options.limits ?? {}),
    )
    this.sessions.set(s.summary.id, s)
    try {
      if (profile.provider === 'kafka') {
        s.kafka = new KafkaCapture(
          profile,
          s.summary,
          options.kafkaPartitions!,
          (record) => {
            try {
              this.admit(s, record)
            } catch {
              throw Object.assign(Error('Storage failure'), {
                code: 'STORAGE_OR_LIMIT_FAILURE',
              })
            }
          },
          () => this.persist(),
        )
        await s.kafka.start()
      } else await this.connect(s)
      return structuredClone({
        ...s.summary,
        retained: this.store.retainedRange?.(s.summary.id),
      })
    } catch (error) {
      if (s.summary.state === 'stopped') return structuredClone(s.summary)
      s.summary.state = 'failed'
      s.summary.error = failureCode(error)
      throw Error(
        'Cannot start capture: check route coverage, permissions and connection',
        { cause: error },
      )
    }
  }
  private admit(s: Session, record: import('./storage').IncomingRecord) {
    const current = resolveSessionSettings(
      this.settings(),
      s.options.limits ?? {},
    )
    if (Date.now() - s.rateStart >= 1000) {
      s.rateStart = Date.now()
      s.rateCount = 0
    }
    if (
      current.admittedMessagesPerSecond !== null &&
      s.rateCount >= current.admittedMessagesPerSecond
    ) {
      s.summary.omitted++
      return
    }
    s.rateCount++
    const result = this.store.append(s.summary.id, record)
    if (result.omitted) s.summary.omitted++
    else s.summary.captured++
  }
  private async connect(s: Session): Promise<void> {
    const generation = ++s.generation
    if (!s.profile) throw Error('Restored sessions require a new capture')
    if (s.profile.provider === 'kafka') throw Error('Wrong capture driver')
    const broker = new RabbitMQ(s.profile)
    const isStream = s.summary.resource.kind === 'stream'
    const definition = await broker.request(
      `queues/${encodeURIComponent(broker.vhost)}/${encodeURIComponent(s.summary.resource.name)}`,
    )
    if (
      s.summary.resource.vhost !== broker.vhost ||
      isStream !== (definition.type === 'stream')
    )
      throw Object.assign(Error('Resource type changed'), {
        code: 'UNSUPPORTED_ROUTE',
      })
    const snapshot = isStream
      ? []
      : await broker.bindings(s.summary.resource.name)
    if (!isStream) {
      if (Buffer.byteLength(JSON.stringify(snapshot)) > 65536)
        throw Object.assign(Error('Binding snapshot too large'), {
          code: 'UNSUPPORTED_ROUTE',
        })
      if (
        !snapshot.some((b) => b.supported) ||
        (snapshot.some((b) => !b.supported) && !s.options.allowPartial)
      )
        throw Object.assign(Error('Unsupported bindings'), {
          code: 'UNSUPPORTED_ROUTE',
        })
      if (
        s.summary.bindings.length &&
        JSON.stringify(snapshot) !== JSON.stringify(s.summary.bindings)
      )
        s.summary.bindingChanged = true
      if (generation !== s.generation) return
    }
    s.summary.bindings = snapshot
    if (generation !== s.generation) return
    this.persist()
    const connection = await broker.connect()
    if (generation !== s.generation) {
      await connection.close()
      return
    }
    s.connection = connection
    connection.once('close', () => {
      if (generation === s.generation) this.reconnect(s)
    })
    try {
      const channel = await connection.createChannel()
      channel.on('error', () => {})
      await channel.prefetch(1)
      const limits = resolveSessionSettings(
        this.settings(),
        s.options.limits ?? {},
      )
      let queue = s.summary.resource.name
      if (!isStream) {
        const own = await channel.assertQueue(
          `queuecumber.${s.summary.id}.${randomUUID()}`,
          {
            exclusive: true,
            autoDelete: true,
            durable: false,
            arguments: {
              'x-max-length-bytes': Math.min(
                limits.diskBytes,
                64 * 1024 * 1024,
              ),
              'x-overflow': 'drop-head',
              'x-expires': 300000,
            },
          },
        )
        for (const binding of snapshot.filter((b) => b.supported))
          await channel.bindQueue(
            own.queue,
            binding.source,
            binding.routing_key,
            binding.arguments,
          )
        queue = own.queue
      }
      if (generation !== s.generation) {
        await connection.close()
        return
      }
      const receive = (message: ConsumeMessage | null) => {
        if (!message) {
          if (generation === s.generation) this.reconnect(s)
          return
        }
        if (generation !== s.generation) return
        try {
          let offset: number | undefined
          if (isStream) {
            offset = message.properties.headers?.['x-stream-offset']
            if (
              typeof offset !== 'number' ||
              !Number.isSafeInteger(offset) ||
              offset < 0
            )
              throw Error('Unsupported stream offset')
            if (
              s.summary.lastOffset !== undefined &&
              offset <= s.summary.lastOffset
            ) {
              channel.ack(message)
              return
            }
            if (
              s.summary.lastOffset === undefined &&
              s.summary.offsetNotice === 'OFFSET_UNVERIFIED'
            )
              s.summary.offsetNotice = undefined
            const requested =
              s.summary.lastOffset === undefined
                ? s.options.streamStart
                : s.summary.lastOffset + 1
            if (typeof requested === 'number' && offset !== requested) {
              const alreadyReported =
                s.summary.lastOffset === undefined &&
                s.summary.offsetNotice === 'OFFSET_CLAMPED'
              s.summary.offsetNotice =
                s.summary.lastOffset === undefined
                  ? 'OFFSET_CLAMPED'
                  : 'OFFSET_DISCONTINUITY'
              if (!alreadyReported) s.summary.gaps++
            }
          }
          this.admit(s, {
            payload: message.content,
            headers: {
              ...message.properties,
              headers: message.properties.headers,
            },
            routingKey: message.fields.routingKey,
            exchange: message.fields.exchange,
            contentType: message.properties.contentType,
            offset,
          })
          if (offset !== undefined) s.summary.lastOffset = offset
          channel.ack(message)
        } catch {
          s.summary.state = 'failed'
          s.summary.error = 'STORAGE_OR_LIMIT_FAILURE'
          s.generation++
          void connection.close().catch(() => {})
        }
      }
      let readyToRead = !isStream,
        pending: ConsumeMessage | null = null
      let start =
        s.summary.lastOffset === undefined
          ? s.options.streamStart
          : s.summary.lastOffset + 1
      if (isStream && typeof start === 'number' && !Number.isSafeInteger(start))
        throw Object.assign(Error('Unsupported offset'), {
          code: 'UNSUPPORTED_ROUTE',
        })
      if (isStream && typeof start === 'number') {
        const first = await firstRetainedOffset(connection, queue)
        if (first !== undefined && start < first) {
          start = first
          s.summary.offsetNotice = 'OFFSET_CLAMPED'
          s.summary.gaps++
        }
        if (generation !== s.generation) {
          await connection.close().catch(() => {})
          return
        }
      }
      await channel.consume(
        queue,
        (message) => {
          if (isStream && !readyToRead && message) {
            pending = message
            return
          }
          receive(message)
        },
        {
          noAck: false,
          ...(isStream ? { arguments: { 'x-stream-offset': start } } : {}),
        },
      )
      if (isStream) {
        const current = await broker.request(
          `queues/${encodeURIComponent(broker.vhost)}/${encodeURIComponent(queue)}`,
        )
        if (current.type !== 'stream')
          throw Object.assign(Error('Resource type changed'), {
            code: 'UNSUPPORTED_ROUTE',
          })
        readyToRead = true
        if (pending) {
          receive(pending)
          pending = null
        }
      }

      if (generation !== s.generation) {
        await connection.close().catch(() => {})
        return
      }
      s.summary.startedAt = Date.now()
      s.summary.state = 'capturing'
      s.summary.error = undefined
      s.attempt = 0
      this.persist()
    } catch (error) {
      s.generation++
      s.connection = undefined
      await connection.close().catch(() => {})
      throw error
    }
  }
  private reconnect(s: Session) {
    if (s.summary.state === 'stopped' || s.summary.state === 'failed') return
    s.generation++
    s.summary.gaps++
    s.summary.state = 'reconnecting'
    s.summary.error = 'CAPTURE_GAP'
    const previous = s.connection
    s.connection = undefined
    void previous?.close().catch(() => {})
    s.timer = setTimeout(
      () => {
        s.timer = undefined
        void this.connect(s).catch((error) => {
          if (s.summary.state === 'stopped') return
          const code = failureCode(error)
          if (
            ['ACCESS_REFUSED', 'UNSUPPORTED_ROUTE', 'NOT_FOUND'].includes(
              code,
            ) ||
            [403, 404, 406].includes((error as { code: number }).code)
          ) {
            s.summary.state = 'failed'
            s.summary.error = code
            return
          }
          this.reconnect(s)
        })
      },
      Math.min(30000, 500 * 2 ** Math.min(s.attempt++, 6)) +
        Math.random() * 250,
    )
  }
  async stopCapture(id: string): Promise<void> {
    const s = this.sessions.get(id)
    if (!s) throw Error('Session not found')
    s.generation++
    if (s.timer) clearTimeout(s.timer)
    s.timer = undefined
    s.summary.state = 'stopped'
    await s.kafka?.stop()
    await s.connection?.close().catch(() => {})
    s.connection = undefined
    this.persist()
  }
  async deleteCapture(id: string): Promise<void> {
    if (!this.sessions.has(id)) throw Error('Session not found')
    await this.stopCapture(id)
    this.store.deleteSession?.(id)
    this.sessions.delete(id)
    this.persist()
  }
  async close(): Promise<void> {
    await Promise.all(
      [...this.sessions.keys()].map((id) => this.stopCapture(id)),
    )
  }
}

async function firstRetainedOffset(
  connection: ChannelModel,
  queue: string,
): Promise<number | undefined> {
  const channel = await connection.createChannel()
  channel.on('error', () => {})
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await channel.prefetch(1)
    let finish!: (value: number | undefined) => void
    const value = new Promise<number | undefined>((resolve) => {
      finish = resolve
      timer = setTimeout(() => resolve(undefined), 1000)
    })
    channel.once('close', () => finish(undefined))
    await channel.consume(
      queue,
      (message) => {
        const offset = message?.properties.headers?.['x-stream-offset']
        finish(
          typeof offset === 'number' &&
            Number.isSafeInteger(offset) &&
            offset >= 0
            ? offset
            : undefined,
        )
      },
      { noAck: false, arguments: { 'x-stream-offset': 'first' } },
    )
    return await value
  } finally {
    if (timer) clearTimeout(timer)
    await channel.close().catch(() => {})
  }
}
