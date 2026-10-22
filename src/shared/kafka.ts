import { z } from 'zod'
export const kafkaOffsetSchema = z
  .string()
  .max(19)
  .regex(/^(0|[1-9][0-9]*)$/)
  .refine(
    (v) =>
      /^(0|[1-9][0-9]{0,18})$/.test(v) && BigInt(v) <= 9223372036854775807n,
  )
export const kafkaSelectionSchema = z
  .array(
    z
      .object({
        partition: z.number().int().min(0).max(2147483647),
        from: z.union([
          z.literal('first'),
          z.literal('next'),
          kafkaOffsetSchema,
        ]),
      })
      .strict(),
  )
  .min(1)
  .max(128)
  .refine(
    (p) => new Set(p.map((v) => v.partition)).size === p.length,
    'Duplicate partitions',
  )
export type KafkaSelection = z.infer<typeof kafkaSelectionSchema>
export type KafkaPartition = {
  partition: number
  first: string
  end: string
  leader: number
}
export type KafkaPosition = KafkaPartition & {
  start: string
  next: string
  notice?: 'RETENTION_CLAMPED' | 'OFFSET_AHEAD' | 'LOG_TRUNCATED'
}
export type KafkaProvenance = {
  topic: string
  partition: number
  offset: string
  timestamp: string
  tombstone: boolean
  transactional: boolean
}
