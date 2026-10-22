import { it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { validateConnection } from '../../src/shared/connection'
import {
  encryptConfiguration,
  decryptConfiguration,
  portableProfiles,
} from '../../src/main/configuration'
const kafka = {
  id: randomUUID(),
  provider: 'kafka' as const,
  name: 'Synthetic Kafka',
  brokers: ['broker.invalid:9093'],
  tls: true,
  allowInsecure: false,
  sasl: {
    mechanism: 'SCRAM-SHA-512' as const,
    username: 'synthetic',
    password: 'private',
  },
  caPem: 'synthetic-ca',
}
it('validates Kafka transport/auth and excludes secrets in complete encrypted transfers', async () => {
  expect(validateConnection(kafka)).toEqual(kafka)
  expect(() => validateConnection({ ...kafka, tls: false })).toThrow()
  expect(() =>
    validateConnection({ ...kafka, brokers: ['user:secret@host:9092'] }),
  ).toThrow()
  expect(() =>
    validateConnection({ ...kafka, sasl: { ...kafka.sasl, mechanism: 'AWS' } }),
  ).toThrow()
  const stripped = portableProfiles([kafka], false)[0]
  expect(stripped).not.toHaveProperty('sasl')
  expect(stripped).not.toHaveProperty('caPem')
  const bytes = await encryptConfiguration([kafka], 'synthetic password', true)
  expect(bytes[8]).toBe(2)
  expect(bytes.includes('private')).toBe(false)
  expect(
    (await decryptConfiguration(bytes, 'synthetic password')).profiles,
  ).toEqual([kafka])
})
