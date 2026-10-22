import { open, writeFile, rename, rm } from 'node:fs/promises'
import { join, dirname, basename, isAbsolute, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { seal, open as decrypt } from './crypto'
const entrySchema = z
  .object({
    schemaVersion: z.literal(1),
    temporary: z.string().max(8192),
    destination: z.string().max(8192),
  })
  .strict()
export class ExportJournal {
  private path: string
  private key: Buffer
  constructor(dir: string, key: Buffer) {
    this.path = join(dir, 'export.pending')
    this.key = Buffer.from(key)
  }
  async begin(temporary: string, destination: string) {
    const entry = this.validate({
      schemaVersion: 1,
      temporary: resolve(temporary),
      destination: resolve(destination),
    })
    const staging = this.path + '.' + randomUUID() + '.tmp'
    try {
      await writeFile(
        staging,
        seal(this.key, Buffer.from(JSON.stringify(entry))),
        { mode: 0o600, flag: 'wx' },
      )
      await rename(staging, this.path)
    } finally {
      await rm(staging, { force: true })
    }
  }
  private validate(value: unknown) {
    const entry = entrySchema.parse(value)
    if (
      !isAbsolute(entry.temporary) ||
      !isAbsolute(entry.destination) ||
      dirname(entry.temporary) !== dirname(entry.destination) ||
      !/^\.queuecumber-export-[a-zA-Z0-9-]+(?:\.part)?$/.test(
        basename(entry.temporary),
      )
    )
      throw Error('Invalid export journal')
    return entry
  }
  async recover(): Promise<'none' | 'cleaned' | 'manual'> {
    let handle: Awaited<ReturnType<typeof open>> | undefined
    try {
      handle = await open(this.path, 'r')
      const buffer = Buffer.alloc(16385)
      let length = 0
      while (length < buffer.length) {
        const result = await handle.read(
          buffer,
          length,
          buffer.length - length,
          null,
        )
        if (!result.bytesRead) break
        length += result.bytesRead
      }
      if (length > 16384) throw Error('Export journal too large')
      const entry = this.validate(
        JSON.parse(
          decrypt(this.key, buffer.subarray(0, length)).toString('utf8'),
        ),
      )
      await handle.close()
      handle = undefined
      await rm(entry.temporary, { recursive: true, force: true })
      await this.clear()
      return 'cleaned'
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT' && !handle
        ? 'none'
        : 'manual'
    } finally {
      await handle?.close()
    }
  }
  async clear() {
    await rm(this.path, { force: true })
  }
  destroy() {
    this.key.fill(0)
  }
}
