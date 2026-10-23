import { open, writeFile, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  encryptConfiguration,
  decryptConfiguration,
  MAX_CONFIGURATION_BYTES,
} from './configuration'
import { profilesFingerprint } from './vault'
import type { ConnectionProfile } from '../shared/connection'
import type { ImportMode, ImportPreview } from '../shared/transfer'
type Options = {
  save: () => Promise<string | undefined>
  open: () => Promise<string | undefined>
  profiles: () => ConnectionProfile[]
  apply: (
    profiles: ConnectionProfile[],
    mode: ImportMode,
    fingerprint: string,
  ) => Promise<void>
  storageMode: () => 'secure' | 'session'
}
export class ConfigurationFiles {
  private busy = false
  private staged?: {
    token: string
    profiles: ConnectionProfile[]
    fingerprint: string
    expires: number
  }
  private timer?: ReturnType<typeof setTimeout>
  constructor(private options: Options) {}
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy) throw Error('Configuration operation already running')
    this.busy = true
    try {
      return await operation()
    } finally {
      this.busy = false
    }
  }
  clear() {
    this.staged = undefined
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
  }
  async export(password: string, includeSecrets: boolean): Promise<boolean> {
    return this.exclusive(async () => {
      const destination = await this.options.save()
      if (!destination) return false
      const bytes = await encryptConfiguration(
        this.options.profiles(),
        password,
        includeSecrets,
      )
      const temporary = join(
        dirname(destination),
        `.queuecumber-${randomUUID()}.tmp`,
      )
      try {
        await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' })
        await rename(temporary, destination)
        return true
      } finally {
        bytes.fill(0)
        await rm(temporary, { force: true })
      }
    })
  }
  async preview(password: string): Promise<ImportPreview | null> {
    return this.exclusive(async () => {
      this.clear()
      const path = await this.options.open()
      if (!path) return null
      const handle = await open(path, 'r')
      let bytes: Buffer
      try {
        const stat = await handle.stat()
        if (!stat.isFile() || stat.size > MAX_CONFIGURATION_BYTES)
          throw Error('Configuration too large')
        const buffer = Buffer.alloc(
          Math.min(MAX_CONFIGURATION_BYTES + 1, stat.size + 1),
        )
        let length = 0
        while (length < buffer.length) {
          const read = await handle.read(
            buffer,
            length,
            buffer.length - length,
            null,
          )
          if (!read.bytesRead) break
          length += read.bytesRead
        }
        if (length !== stat.size)
          throw Error('Configuration changed while reading')
        bytes = buffer.subarray(0, length)
      } finally {
        await handle.close()
      }
      let data
      try {
        data = await decryptConfiguration(bytes, password)
      } finally {
        bytes.fill(0)
      }
      const existing = this.options.profiles(),
        token = randomUUID()
      this.staged = {
        token,
        profiles: data.profiles,
        fingerprint: profilesFingerprint(existing),
        expires: Date.now() + 300000,
      }
      this.timer = setTimeout(() => this.clear(), 300000)
      this.timer.unref()
      const incomingNames = new Set<string>()
      return {
        token,
        includeSecrets: data.includeSecrets,
        storageMode: this.options.storageMode(),
        profiles: data.profiles.map((p) => {
          const conflict = existing.find(
            (other) => other.id === p.id || other.name === p.name,
          )
          const incomingConflict = incomingNames.has(p.name)
          incomingNames.add(p.name)
          return {
            name: p.name,
            conflict: !!conflict || incomingConflict,
            existingName:
              conflict?.name ?? (incomingConflict ? p.name : undefined),
          }
        }),
      }
    })
  }
  async apply(token: string, mode: ImportMode): Promise<void> {
    return this.exclusive(async () => {
      const staged = this.staged
      if (!staged || staged.token !== token || staged.expires < Date.now())
        throw Error('Import preview expired')
      this.clear()
      await this.options.apply(staged.profiles, mode, staged.fingerprint)
    })
  }
}
