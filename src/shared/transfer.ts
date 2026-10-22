import { z } from 'zod'
export const importModeSchema = z.enum(['copy', 'skip', 'replace'])
export type ImportMode = z.infer<typeof importModeSchema>
export const passwordSchema = z
  .string()
  .min(12)
  .max(1024)
  .refine((p) => new TextEncoder().encode(p).length <= 1024)
export type ImportPreview = {
  token: string
  includeSecrets: boolean
  profiles: { name: string; conflict: boolean; existingName?: string }[]
  storageMode: 'secure' | 'session'
}
