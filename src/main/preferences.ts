import { mkdir, readFile, writeFile, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  DEFAULT_DESKTOP_PREFERENCES,
  desktopPreferencesSchema,
} from '../shared/desktop'
export class DesktopPreferencesRepository {
  private writes: Promise<unknown> = Promise.resolve()
  constructor(private dir: string) {}
  async read() {
    try {
      const path = join(this.dir, 'desktop.json')
      if ((await stat(path)).size > 4096) throw Error('Preferences too large')
      return {
        preferences: desktopPreferencesSchema.parse(
          JSON.parse(await readFile(path, 'utf8')),
        ),
        warning: false,
      }
    } catch (error) {
      return {
        preferences: { ...DEFAULT_DESKTOP_PREFERENCES },
        warning: (error as NodeJS.ErrnoException).code !== 'ENOENT',
      }
    }
  }
  save(input: unknown): Promise<void> {
    const preferences = desktopPreferencesSchema.parse(input)
    const result = this.writes.then(async () => {
      await mkdir(this.dir, { recursive: true, mode: 0o700 })
      const temporary = join(this.dir, `desktop.${randomUUID()}.tmp`)
      try {
        await writeFile(temporary, JSON.stringify(preferences), {
          mode: 0o600,
          flag: 'wx',
        })
        await rename(temporary, join(this.dir, 'desktop.json'))
      } finally {
        await rm(temporary, { force: true })
      }
    })
    this.writes = result.catch(() => {})
    return result
  }
}
