import type { KafkaConnectionProfile } from '../../src/shared/connection'
export const kafkaProfile: KafkaConnectionProfile = {
  id: 'synthetic-kafka',
  provider: 'kafka',
  name: 'Kafka test',
  brokers: ['localhost:29092'],
  tls: false,
  allowInsecure: true,
}
export const kafkaOptions = {
  clientId: 'qc-test',
  bootstrapBrokers: kafkaProfile.brokers,
  autocreateTopics: false,
  retries: 0,
}
