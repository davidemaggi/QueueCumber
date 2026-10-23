export const PROVIDER_CAPABILITIES = {
  rabbitmq: {
    label: 'RabbitMQ',
    resourceKinds: ['queue', 'stream', 'exchange'],
    bindings: true,
    partitions: false,
  },
  kafka: {
    label: 'Kafka',
    resourceKinds: ['topic'],
    bindings: false,
    partitions: true,
  },
} as const
