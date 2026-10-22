import { mkdir, readFile, writeFile, rename, stat, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import type { ImportMode } from '../shared/transfer'
import { seal, open } from '../service/crypto'
import {
  validateConnection,
  type ConnectionProfile,
  summarizeConnection,
  type ConnectionSummary,
} from '../shared/connection'
export interface KeyProtector {
  protect(value: string): Promise<Buffer>
  unprotect(value: Buffer): Promise<string>
}
export class Vault {
  private writeChain: Promise<unknown> = Promise.resolve()
  private key?: Buffer
  private profiles: ConnectionProfile[] = []
  constructor(
    private dir: string,
    private protector: KeyProtector,
  ) {}
  async initialize(): Promise<void> {
    await mkdir(this.dir, { recursive: true, mode: 0o700 })
    const keyPath = join(this.dir, 'vault.key')
    try {
      this.key = Buffer.from(
        await this.protector.unprotect(await readFile(keyPath)),
        'base64',
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw Error('Secure storage unavailable', { cause: error })
      this.key = randomBytes(32)
      await writeFile(
        keyPath,
        await this.protector.protect(this.key.toString('base64')),
        { mode: 0o600, flag: 'wx' },
      )
    }
    if (this.key.length !== 32) throw Error('Invalid vault key')
    try {
      if ((await stat(join(this.dir, 'profiles.bin'))).size > 16 * 1024 * 1024)
        throw Error('Vault too large')
      const records = JSON.parse(
        open(
          this.key,
          await readFile(join(this.dir, 'profiles.bin')),
        ).toString(),
      )
      if (!Array.isArray(records) || records.length > 100)
        throw Error('Invalid vault')
      this.profiles = records.map(
        (p) => validateConnection(p) as ConnectionProfile,
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw Error('Cannot unlock connection records', { cause: error })
    }
  }
  getKey(): Buffer {
    if (!this.key) throw Error('Vault locked')
    return Buffer.from(this.key)
  }
  list(): ConnectionSummary[] {
    return this.profiles.map(summarizeConnection)
  }
  async get(id: string): Promise<ConnectionProfile> {
    const p = this.profiles.find((p) => p.id === id)
    if (!p) throw Error('Connection not found')
    return { ...p }
  }
  save(input: unknown): Promise<ConnectionSummary> {
    const result = this.writeChain.then(() => this.saveRecord(input))
    this.writeChain = result.catch(() => {})
    return result
  }
  all(): ConnectionProfile[] {
    return this.profiles.map((p) => ({ ...p }))
  }
  importProfiles(
    inputs: ConnectionProfile[],
    mode: ImportMode,
    expectedFingerprint?: string,
  ): Promise<ConnectionSummary[]> {
    const result = this.writeChain.then(async () => {
      if (
        expectedFingerprint &&
        expectedFingerprint !== profilesFingerprint(this.profiles)
      )
        throw Error('Connections changed; preview the import again')
      const next = mergeProfiles(this.profiles, inputs, mode)
      await this.writeProfiles(next)
      return this.list()
    })
    this.writeChain = result.catch(() => {})
    return result
  }
  private async saveRecord(input: unknown): Promise<ConnectionSummary> {
    const p = validateConnection(input),
      profile = { ...p, id: p.id ?? randomUUID() }
    const next = [...this.profiles.filter((p) => p.id !== profile.id), profile]
    if (next.length > 100) throw Error('Connection limit reached')
    await this.writeProfiles(next)
    return summarizeConnection(profile)
  }
  private async writeProfiles(next: ConnectionProfile[]) {
    const data = Buffer.from(JSON.stringify(next))
    if (data.length > 16 * 1024 ** 2) throw Error('Vault too large')
    const temp = join(this.dir, `profiles.${randomUUID()}.tmp`)
    try {
      await writeFile(temp, seal(this.getKey(), data), { mode: 0o600 })
      await rename(temp, join(this.dir, 'profiles.bin'))
      this.profiles = next
    } finally {
      await rm(temp, { force: true })
    }
    data.fill(0)
  }
}

export function mergeProfiles(
  existing: ConnectionProfile[],
  inputs: ConnectionProfile[],
  mode: ImportMode,
): ConnectionProfile[] {
  if (!['copy', 'skip', 'replace'].includes(mode) || inputs.length > 100)
    throw Error('Invalid import')
  const incoming = inputs.map((p) => {
    const value = validateConnection(p)
    if (!value.id) throw Error('Missing connection ID')
    return value as ConnectionProfile
  })
  if (new Set(incoming.map((p) => p.id)).size !== incoming.length)
    throw Error('Duplicate connection IDs')
  const next = existing.map((p) => ({ ...p }))
  for (const source of incoming) {
    const index = next.findIndex(
      (p) => p.id === source.id || p.name === source.name,
    )
    if (index >= 0 && mode === 'skip') continue
    if (mode === 'replace' && index >= 0) {
      next[index] = { ...source, id: next[index].id }
      continue
    }
    const p = { ...source, id: mode === 'copy' ? randomUUID() : source.id }
    if (mode === 'copy') {
      let attempt = 0
      while (next.some((other) => other.name === p.name))
        p.name = source.name.slice(0, 75) + ` (imported ${++attempt})`
    }
    next.push(p)
  }
  if (next.length > 100) throw Error('Connection limit reached')
  return next
}

export function profilesFingerprint(profiles: ConnectionProfile[]): string {
  return createHash('sha256').update(JSON.stringify(profiles)).digest('hex')
}
