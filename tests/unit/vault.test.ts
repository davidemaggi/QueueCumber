import { it, expect } from 'vitest'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { Vault } from '../../src/main/vault'
import { seal, open } from '../../src/service/crypto'
import { validateConnection } from '../../src/shared/connection'
it('encrypts whole profiles, refuses unavailable protection and detects tampering', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-vault-'))
  const osKey = randomBytes(32)
  const protector = {
    protect: async (s: string) => seal(osKey, Buffer.from(s)),
    unprotect: async (b: Buffer) => open(osKey, b).toString(),
  }
  try {
    const vault = new Vault(dir, protector)
    await vault.initialize()
    const summary = await vault.save({
      name: 'Private staging',
      protocolUrl: 'amqp://cucumber:secret@localhost:25672/%2F',
      managementUrl: 'http://localhost:25673',
      allowInsecure: true,
    })
    expect(summary).not.toHaveProperty('protocolUrl')
    expect((await vault.get(summary.id)).protocolUrl).toContain('secret')
    const bytes = await readFile(join(dir, 'profiles.bin'))
    expect(bytes.includes('Private staging')).toBe(false)
    expect(bytes.includes('secret')).toBe(false)
    const reopened = new Vault(dir, protector)
    await reopened.initialize()
    expect((await reopened.get(summary.id)).name).toBe('Private staging')
    bytes[bytes.length - 1] ^= 1
    await writeFile(join(dir, 'profiles.bin'), bytes)
    await expect(new Vault(dir, protector).initialize()).rejects.toThrow()
    await expect(
      new Vault(join(dir, 'unavailable'), {
        protect: async () => {
          throw Error('Unavailable')
        },
        unprotect: async () => '',
      }).initialize(),
    ).rejects.toThrow()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
it('requires explicit insecure transport consent and rejects malformed endpoints', () => {
  const input = {
    name: 'Local',
    protocolUrl: 'amqp://localhost',
    managementUrl: 'http://localhost:15672',
    allowInsecure: false,
  }
  expect(() => validateConnection(input)).toThrow()
  expect(() =>
    validateConnection({ ...input, allowInsecure: true }),
  ).not.toThrow()
  expect(() =>
    validateConnection({
      ...input,
      protocolUrl: 'file:///private/data',
      allowInsecure: true,
    }),
  ).toThrow()
  expect(() =>
    validateConnection({
      ...input,
      managementUrl: 'http://user:password@localhost',
      allowInsecure: true,
    }),
  ).toThrow()
})
it('retains both profiles when saves overlap', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-parallel-vault-')),
    key = randomBytes(32)
  const protector = {
    protect: async (s: string) => seal(key, Buffer.from(s)),
    unprotect: async (b: Buffer) => open(key, b).toString(),
  }
  try {
    const vault = new Vault(dir, protector)
    await vault.initialize()
    await Promise.all(
      ['One', 'Two'].map((name) =>
        vault.save({
          name,
          protocolUrl: 'amqp://localhost',
          managementUrl: 'http://localhost',
          allowInsecure: true,
        }),
      ),
    )
    expect(
      vault
        .list()
        .map((p) => p.name)
        .sort(),
    ).toEqual(['One', 'Two'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
it('imports conflict batches atomically without losing concurrent unrelated saves', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-import-')),
    key = randomBytes(32)
  const protector = {
    protect: async (s: string) => seal(key, Buffer.from(s)),
    unprotect: async (b: Buffer) => open(key, b).toString(),
  }
  try {
    const vault = new Vault(dir, protector)
    await vault.initialize()
    const first = await vault.save({
      name: 'Existing',
      protocolUrl: 'amqps://one.example',
      managementUrl: 'https://one.example',
      allowInsecure: false,
    })
    const original = await vault.get(first.id),
      before = await readFile(join(dir, 'profiles.bin'))
    await expect(
      vault.importProfiles(
        [original, { ...original, id: 'not-a-uuid' }],
        'replace',
      ),
    ).rejects.toThrow()
    expect((await readFile(join(dir, 'profiles.bin'))).equals(before)).toBe(
      true,
    )
    await Promise.all([
      vault.importProfiles([{ ...original, name: 'Replacement' }], 'replace'),
      vault.save({
        name: 'Unrelated',
        protocolUrl: 'amqps://two.example',
        managementUrl: 'https://two.example',
        allowInsecure: false,
      }),
    ])
    expect(vault.list().map((p) => p.name)).toEqual([
      'Replacement',
      'Unrelated',
    ])
    await vault.importProfiles([original], 'skip')
    expect(vault.list()).toHaveLength(2)
    await vault.importProfiles([original], 'copy')
    expect(vault.list()).toHaveLength(3)
    expect(new Set(vault.list().map((p) => p.id)).size).toBe(3)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
