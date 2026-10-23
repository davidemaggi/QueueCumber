import type { ConnectionProfile } from '../../src/shared/connection'
import { it, expect } from 'vitest'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { ConfigurationFiles } from '../../src/main/configuration-files'
import { mergeProfiles, profilesFingerprint } from '../../src/main/vault'
it('stages only summaries, detects stale previews and imports a batch once', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-transfer-')),
    path = join(dir, 'config.qcc')
  let profiles: ConnectionProfile[] = [
    {
      id: randomUUID(),
      name: 'Synthetic private',
      protocolUrl: 'amqps://user:secret@private.example',
      managementUrl: 'https://private.example',
      allowInsecure: false,
    },
  ]
  const files = new ConfigurationFiles({
    save: async () => path,
    open: async () => path,
    profiles: () => profiles,
    storageMode: () => 'session',
    apply: async (incoming, mode, fingerprint) => {
      if (fingerprint !== profilesFingerprint(profiles)) throw Error('Changed')
      profiles = mergeProfiles(profiles, incoming, mode)
    },
  })
  try {
    expect(await files.export('synthetic password', true)).toBe(true)
    const before = await readFile(path)
    expect(before.includes('secret')).toBe(false)
    await expect(files.preview('incorrect password')).rejects.toThrow()
    expect(profiles).toHaveLength(1)
    const preview = (await files.preview('synthetic password'))!
    expect(preview.profiles[0].conflict).toBe(true)
    expect(JSON.stringify(preview)).not.toContain('private.example')
    profiles = [
      ...profiles,
      { ...profiles[0], id: randomUUID(), name: 'Changed concurrently' },
    ]
    await expect(files.apply(preview.token, 'replace')).rejects.toThrow(
      'Changed',
    )
    const second = (await files.preview('synthetic password'))!
    await files.apply(second.token, 'copy')
    expect(profiles).toHaveLength(3)
    await expect(files.apply(second.token, 'copy')).rejects.toThrow()
    await writeFile(path, 'existing destination')
    await expect(files.export('short', true)).rejects.toThrow()
    expect(await readFile(path, 'utf8')).toBe('existing destination')
  } finally {
    files.clear()
    await rm(dir, { recursive: true, force: true })
  }
})
it('previews conflicts between incoming profiles before copy, skip or replace', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-incoming-conflict-'))
  const path = join(dir, 'incoming.qcc')
  const incoming: ConnectionProfile[] = [1, 2].map((n) => ({
    id: randomUUID(),
    name: 'Same name',
    protocolUrl: `amqps://user${n}:synthetic@broker.invalid`,
    managementUrl: 'https://broker.invalid',
    allowInsecure: false,
  }))
  let profiles = incoming
  const files = new ConfigurationFiles({
    save: async () => path,
    open: async () => path,
    profiles: () => profiles,
    storageMode: () => 'session',
    apply: async (values, mode) => {
      profiles = mergeProfiles(profiles, values, mode)
    },
  })
  try {
    await files.export('synthetic password', true)
    for (const mode of ['copy', 'skip', 'replace'] as const) {
      profiles = []
      const preview = (await files.preview('synthetic password'))!
      expect(preview.profiles[0].conflict).toBe(false)
      expect(preview.profiles[1]).toEqual({
        name: 'Same name',
        conflict: true,
        existingName: 'Same name',
      })
      await files.apply(preview.token, mode)
      expect(profiles).toHaveLength(mode === 'copy' ? 2 : 1)
      if (mode === 'copy')
        expect(new Set(profiles.map((p) => p.name)).size).toBe(2)
      else
        expect(profiles[0]).toMatchObject({
          protocolUrl: (
            incoming[
              mode === 'skip' ? 0 : 1
            ] as import('../../src/shared/connection').RabbitConnectionProfile
          ).protocolUrl,
        })
    }
  } finally {
    files.clear()
    await rm(dir, { recursive: true, force: true })
  }
})
