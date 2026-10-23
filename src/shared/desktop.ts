import { z } from 'zod'
export const desktopPreferencesSchema = z
  .object({
    schemaVersion: z.literal(1),
    closeToTray: z.boolean(),
    locale: z.enum(['en', 'it']),
  })
  .strict()
export type DesktopPreferences = z.infer<typeof desktopPreferencesSchema>
export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = Object.freeze({
  schemaVersion: 1,
  closeToTray: false,
  locale: 'en',
})
