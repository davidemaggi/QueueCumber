import { mkdir, readFile, writeFile, rename, stat, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import { seal, open } from '../service/crypto'
import {
  validateConnection,
  type ConnectionProfile,
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
    return this.profiles.map(({ id, name }) => ({
      id,
      name,
      provider: 'rabbitmq',
    }))
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
  private async saveRecord(input: unknown): Promise<ConnectionSummary> {
    const p = validateConnection(input),
      profile = { ...p, id: p.id ?? randomUUID() }
    const next = [...this.profiles.filter((p) => p.id !== profile.id), profile]
    if (next.length > 100) throw Error('Connection limit reached')
    const temp = join(this.dir, `profiles.${randomUUID()}.tmp`)
    try {
      await writeFile(
        temp,
        seal(this.getKey(), Buffer.from(JSON.stringify(next))),
        { mode: 0o600 },
      )
      await rename(temp, join(this.dir, 'profiles.bin'))
      this.profiles = next
    } finally {
      await rm(temp, { force: true })
    }
    return { id: profile.id, name: profile.name, provider: 'rabbitmq' }
  }
}
