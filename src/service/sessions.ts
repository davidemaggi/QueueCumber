import { randomUUID } from 'node:crypto'
import type { ChannelModel } from 'amqplib'
import type { ConnectionProfile } from '../shared/connection'
import { resolveSessionSettings, type CaptureSettings } from '../shared/limits'
import { RabbitMQ, failureCode } from './providers/rabbitmq'
import type { ResourceRef, Binding } from './providers/provider'
import type { CaptureStorage } from './storage'
export type SessionSummary = {
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
  potentialOverflow: boolean
}
export type CaptureOptions = {
  allowPartial: boolean
  limits?: Partial<CaptureSettings>
}
type Session = {
  summary: SessionSummary
  profile?: ConnectionProfile
  options: CaptureOptions
  generation: number
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
    if (resource.kind !== 'queue')
      throw Error('Only queue route capture is available in this milestone')
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
        id: randomUUID(),
        connectionId: profile.id,
        resource,
        state: 'connecting',
        captured: 0,
        omitted: 0,
        gaps: 0,
        startedAt: Date.now(),
        bindings: [],
        potentialOverflow: true,
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
      await this.connect(s)
      return structuredClone({
        ...s.summary,
        retained: this.store.retainedRange?.(s.summary.id),
      })
    } catch (error) {
      s.summary.state = 'failed'
      s.summary.error = failureCode(error)
      throw Error(
        'Cannot start capture: check route coverage, permissions and connection',
        { cause: error },
      )
    }
  }
  private async connect(s: Session): Promise<void> {
    const generation = ++s.generation
    if (!s.profile) throw Error('Restored sessions require a new capture')
    const broker = new RabbitMQ(s.profile)
    const snapshot = await broker.bindings(s.summary.resource.name)
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
    s.summary.bindings = snapshot
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
      const own = await channel.assertQueue(
        `queuecumber.${s.summary.id}.${randomUUID()}`,
        {
          exclusive: true,
          autoDelete: true,
          durable: false,
          arguments: {
            'x-max-length-bytes': Math.min(limits.diskBytes, 64 * 1024 * 1024),
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
      if (generation !== s.generation) {
        await connection.close()
        return
      }
      await channel.consume(
        own.queue,
        (message) => {
          if (!message) {
            if (generation === s.generation) this.reconnect(s)
            return
          }
          if (generation !== s.generation) return
          try {
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
              channel.ack(message)
              return
            }
            s.rateCount++
            const result = this.store.append(s.summary.id, {
              payload: message.content,
              headers: {
                ...message.properties,
                headers: message.properties.headers,
              },
              routingKey: message.fields.routingKey,
              exchange: message.fields.exchange,
              contentType: message.properties.contentType,
            })
            if (result.omitted) s.summary.omitted++
            else s.summary.captured++
            channel.ack(message)
          } catch {
            s.summary.state = 'failed'
            s.summary.error = 'STORAGE_OR_LIMIT_FAILURE'
            s.generation++
            void connection.close().catch(() => {})
          }
        },
        { noAck: false },
      )
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
            ['ACCESS_REFUSED', 'UNSUPPORTED_ROUTE'].includes(code) ||
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
    await s.connection?.close().catch(() => {})
    s.connection = undefined
    this.persist()
  }
  async close(): Promise<void> {
    await Promise.all(
      [...this.sessions.keys()].map((id) => this.stopCapture(id)),
    )
  }
}
