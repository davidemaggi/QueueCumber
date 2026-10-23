import { Admin, Consumer, findErrorBy } from '@platformatic/kafka'
import type { KafkaConnectionProfile } from '../../shared/connection'
import type { KafkaPartition } from '../../shared/kafka'
import type { Provider, ResourcePage } from './provider'
import { PROVIDER_CAPABILITIES } from '../../shared/providers'
export function kafkaFailure(error: unknown): string {
  const e = error as Error
  if (
    [
      'NOT_FOUND',
      'RESOURCE_LIMIT',
      'TOPIC_CHANGED',
      'STORAGE_OR_LIMIT_FAILURE',
    ].includes((error as { code: string }).code)
  )
    return (error as { code: string }).code
  for (const code of [29, 30, 31, 58])
    if (findErrorBy(e, 'apiCode', code)) return 'ACCESS_REFUSED'
  if (findErrorBy(e, 'code', 'PLT_KFK_AUTHENTICATION')) return 'ACCESS_REFUSED'
  for (const code of [3, 100])
    if (findErrorBy(e, 'apiCode', code)) return 'NOT_FOUND'
  for (const code of [
    'CERT_HAS_EXPIRED',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'CERT_NOT_YET_VALID',
  ])
    if (findErrorBy(e, 'code', code)) return 'TLS_FAILED'
  const userError = findErrorBy(e, 'code', 'PLT_KFK_USER')
  if (userError)
    return userError.message.startsWith('Unknown topic ')
      ? 'NOT_FOUND'
      : 'UNSUPPORTED_ROUTE'
  for (const code of [
    'PLT_KFK_UNSUPPORTED_API',
    'PLT_KFK_UNSUPPORTED_COMPRESSION',
    'PLT_KFK_UNSUPPORTED_FORMAT',
    'PLT_KFK_UNSUPPORTED',
  ])
    if (findErrorBy(e, 'code', code)) return 'UNSUPPORTED_ROUTE'
  return 'CONNECTION_FAILED'
}
export function kafkaClientOptions(profile: KafkaConnectionProfile) {
  return {
    clientId: 'queuecumber',
    bootstrapBrokers: profile.brokers,
    autocreateTopics: false,
    retries: 0,
    connectTimeout: 5000,
    requestTimeout: 5000,
    maxInflights: 1,
    handleBackPressure: true,
    metadataMaxAge: 2000,
    ...(profile.tls
      ? {
          tls: {
            rejectUnauthorized: true,
            ...(profile.caPem ? { ca: profile.caPem } : {}),
          },
        }
      : {}),
    ...(profile.sasl ? { sasl: profile.sasl } : {}),
  }
}
export function kafkaClient(profile: KafkaConnectionProfile): Consumer {
  // No consume/join/commit calls: the required groupId is never sent to a broker.
  return new Consumer({
    ...kafkaClientOptions(profile),
    groupId: 'queuecumber-unused',
    autocommit: false,
  })
}
export async function kafkaPartitions(client: Consumer, topic: string) {
  const metadata = await client.metadata({
    topics: [topic],
    forceUpdate: true,
    autocreateTopics: false,
  })
  const entry = metadata.topics.get(topic)
  if (!entry)
    throw Object.assign(Error('Topic unavailable'), { code: 'NOT_FOUND' })
  if (entry.partitionsCount > 10000)
    throw Object.assign(Error('Partition discovery limit'), {
      code: 'RESOURCE_LIMIT',
    })
  const opts = { topics: [topic], isolationLevel: 0 }
  const first = (await client.listOffsets({ ...opts, timestamp: -2n })).get(
      topic,
    )!,
    end = (await client.listOffsets({ ...opts, timestamp: -1n })).get(topic)!
  return {
    id: entry.id,
    partitions: entry.partitions.map((p, partition) => ({
      partition,
      first: String(first[partition]),
      end: String(end[partition]),
      leader: p.leader,
    })),
    metadata: entry,
  }
}
export class KafkaProvider implements Provider {
  readonly capabilities = PROVIDER_CAPABILITIES.kafka
  constructor(readonly profile: KafkaConnectionProfile) {}
  async test() {
    const c = kafkaClient(this.profile)
    try {
      await c.metadata({ autocreateTopics: false })
      return { protocol: { ok: true }, management: { ok: true } }
    } catch (error) {
      const code = kafkaFailure(error)
      return { protocol: { ok: false, code }, management: { ok: false, code } }
    } finally {
      await c.close(true).catch(() => {})
    }
  }
  async listResources(query: string, page: number): Promise<ResourcePage> {
    const c = new Admin(kafkaClientOptions(this.profile))
    try {
      const all = await c.listTopics({ includeInternals: false })
      if (all.length > 10000) throw Error('Topic discovery limit')
      const topics = all
        .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
        .sort()
      const names = topics.slice((page - 1) * 100, page * 100)
      const m = names.length
        ? await c.metadata({ topics: names, autocreateTopics: false })
        : null
      return {
        resources: names.map((name) => ({
          name,
          kind: 'topic',
          vhost: '',
          type: 'Kafka',
          partitions: m?.topics.get(name)?.partitionsCount,
        })),
        page,
        hasMore: topics.length > page * 100,
      }
    } finally {
      await c.close().catch(() => {})
    }
  }

  async partitions(topic: string): Promise<KafkaPartition[]> {
    const c = kafkaClient(this.profile)
    try {
      return (await kafkaPartitions(c, topic)).partitions
    } finally {
      await c.close(true).catch(() => {})
    }
  }
  async bindings(): Promise<never> {
    throw Error('Kafka topics have partitions, not routing bindings')
  }
}
