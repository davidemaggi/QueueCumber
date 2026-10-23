import { z } from 'zod'
export const rabbitConnectionSchema = z
  .object({
    provider: z.literal('rabbitmq').optional(),
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100),
    protocolUrl: z.string().max(8192),
    managementUrl: z.string().max(8192),
    allowInsecure: z.boolean(),
    caPem: z
      .string()
      .max(1024 * 1024)
      .optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    try {
      const protocol = new URL(p.protocolUrl),
        management = new URL(p.managementUrl)
      if (
        !['amqp:', 'amqps:'].includes(protocol.protocol) ||
        !['http:', 'https:'].includes(management.protocol) ||
        !protocol.hostname ||
        !management.hostname ||
        management.username ||
        management.password ||
        management.search ||
        management.hash ||
        protocol.hash
      )
        throw Error()
      if (
        !p.allowInsecure &&
        (protocol.protocol !== 'amqps:' || management.protocol !== 'https:')
      )
        throw Error()
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid endpoints or insecure transport without consent',
      })
    }
  })
const brokerAddress = z
  .string()
  .min(1)
  .max(300)
  .refine((value) => {
    try {
      const u = new URL(`tcp://${value}`)
      return (
        !!u.hostname &&
        !!u.port &&
        Number(u.port) > 0 &&
        Number(u.port) <= 65535 &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash &&
        !u.pathname
      )
    } catch {
      return false
    }
  }, 'Use host:port without credentials or paths')
export const kafkaConnectionSchema = z
  .object({
    provider: z.literal('kafka'),
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100),
    brokers: z.array(brokerAddress).min(1).max(20),
    tls: z.boolean(),
    allowInsecure: z.boolean(),
    caPem: z
      .string()
      .max(1024 * 1024)
      .optional(),
    sasl: z
      .object({
        mechanism: z.enum(['PLAIN', 'SCRAM-SHA-256', 'SCRAM-SHA-512']),
        username: z.string().min(1).max(4096),
        password: z.string().min(1).max(8192),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (p) => p.tls || p.allowInsecure,
    'Plain transport requires explicit consent',
  )
export const connectionSchema = z.union([
  rabbitConnectionSchema,
  kafkaConnectionSchema,
])
export type RabbitConnectionInput = z.infer<typeof rabbitConnectionSchema>
export type KafkaConnectionInput = z.infer<typeof kafkaConnectionSchema>
export type KafkaConnectionProfile = KafkaConnectionInput & { id: string }
export type RabbitConnectionProfile = RabbitConnectionInput & { id: string }
export type ConnectionInput = z.infer<typeof connectionSchema>
export type ConnectionProfile = ConnectionInput & { id: string }
export type ConnectionSummary = {
  id: string
  name: string
  provider: 'rabbitmq' | 'kafka'
}
export function validateConnection(input: unknown): ConnectionInput {
  return connectionSchema.parse(input)
}
export function summarizeConnection(p: ConnectionProfile): ConnectionSummary {
  return { id: p.id, name: p.name, provider: p.provider ?? 'rabbitmq' }
}
