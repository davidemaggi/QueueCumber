import { it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
  encryptConfiguration,
  decryptConfiguration,
  portableProfiles,
} from '../../src/main/configuration'
const profile = {
  id: randomUUID(),
  name: 'Private staging',
  protocolUrl: 'amqps://user:secret@broker.example/%2F?token=private',
  managementUrl: 'https://broker.example',
  allowInsecure: false,
  caPem: 'private-ca',
}
const password = 'synthetic long password'
it('encrypts the complete versioned configuration and preserves secrets only when requested', async () => {
  const profiles = portableProfiles([profile], false)
  expect(
    profiles[0].provider === 'kafka' ? '' : profiles[0].protocolUrl,
  ).not.toContain('secret')
  expect(
    profiles[0].provider === 'kafka' ? '' : profiles[0].protocolUrl,
  ).not.toContain('token')
  expect(profiles[0].caPem).toBeUndefined()
  const bytes = await encryptConfiguration([profile], password, true)
  expect(bytes.includes('Private staging')).toBe(false)
  expect(bytes.includes('secret')).toBe(false)
  expect((await decryptConfiguration(bytes, password)).profiles).toEqual([
    profile,
  ])
  expect(
    (await encryptConfiguration([profile], password, true)).equals(bytes),
  ).toBe(false)
})
it('rejects wrong passwords, tampering, unsupported versions, oversize and invalid plaintext without returning secrets', async () => {
  const bytes = await encryptConfiguration([profile], password, false)
  await expect(
    decryptConfiguration(bytes, 'wrong password here'),
  ).rejects.toThrow('Cannot unlock configuration')
  const tampered = Buffer.from(bytes)
  tampered[tampered.length - 1] ^= 1
  await expect(decryptConfiguration(tampered, password)).rejects.toThrow(
    'Cannot unlock configuration',
  )
  const version = Buffer.from(bytes)
  version[8] = 99
  await expect(decryptConfiguration(version, password)).rejects.toThrow(
    'Unsupported configuration',
  )
  await expect(
    decryptConfiguration(Buffer.alloc(9 * 1024 ** 2), password),
  ).rejects.toThrow()
  await expect(encryptConfiguration([profile], 'short', true)).rejects.toThrow()
  await expect(
    encryptConfiguration(
      [{ ...profile, protocolUrl: 'javascript:bad' }],
      password,
      true,
    ),
  ).rejects.toThrow()
})
it('keeps explicitly tagged RabbitMQ-only exports readable by the strict 0.2 v1 wire schema', async () => {
  const { z } = await import('zod')
  const legacy = z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      protocolUrl: z.string(),
      managementUrl: z.string(),
      allowInsecure: z.boolean(),
      caPem: z.string().optional(),
    })
    .strict()
  for (const secrets of [false, true]) {
    const bytes = await encryptConfiguration(
      [{ ...profile, provider: 'rabbitmq' }],
      password,
      secrets,
    )
    expect(bytes[8]).toBe(1)
    const data = await decryptConfiguration(bytes, password)
    expect(() => legacy.parse(data.profiles[0])).not.toThrow()
  }
})
