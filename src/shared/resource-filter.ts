import { z } from 'zod'
export const resourceFilterSchema = z
  .object({
    kind: z.enum(['all', 'queue', 'stream', 'exchange', 'topic']),
    messages: z.enum(['all', 'empty', 'nonempty']),
  })
  .strict()
export type ResourceFilter = z.infer<typeof resourceFilterSchema>
