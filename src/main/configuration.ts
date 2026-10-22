import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scrypt,
} from 'node:crypto'
import { z } from 'zod'
import { connectionSchema, type ConnectionProfile } from '../shared/connection'
export const MAX_CONFIGURATION_BYTES = 8 * 1024 ** 2
const magic = Buffer.from('QCBRCFG\0')
const envelope = z
  .object({
    schemaVersion: z.literal(1),
    createdAt: z.string().datetime(),
    includeSecrets: z.boolean(),
    profiles: z
      .array(connectionSchema.safeExtend({ id: z.string().uuid() }))
      .max(100),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.profiles.map((p) => p.id)).size === value.profiles.length,
    'Duplicate connection IDs',
  )
function checkPassword(password: string) {
  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    Buffer.byteLength(password) > 1024
  )
    throw Error(
      'Use a password of at least 12 characters (maximum 1024 UTF-8 bytes)',
    )
}
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  checkPassword(password)
  const input = Buffer.from(password)
  try {
    return await new Promise((resolve, reject) =>
      scrypt(
        input,
        salt,
        32,
        { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 ** 2 },
        (error, key) => (error ? reject(error) : resolve(key)),
      ),
    )
  } finally {
    input.fill(0)
  }
}
export function portableProfiles(
  profiles: ConnectionProfile[],
  includeSecrets: boolean,
): ConnectionProfile[] {
  return profiles.map((p) => {
    if (includeSecrets) return { ...p }
    const url = new URL(p.protocolUrl)
    url.username = ''
    url.password = ''
    url.search = ''
    const { caPem: _ca, ...rest } = p
    return { ...rest, protocolUrl: url.toString() }
  })
}
export async function encryptConfiguration(
  profiles: ConnectionProfile[],
  password: string,
  includeSecrets: boolean,
): Promise<Buffer> {
  checkPassword(password)
  const payload = Buffer.from(
    JSON.stringify(
      envelope.parse({
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        includeSecrets,
        profiles: portableProfiles(profiles, includeSecrets),
      }),
    ),
  )
  if (payload.length > MAX_CONFIGURATION_BYTES - 53)
    throw Error('Configuration too large')
  const salt = randomBytes(16),
    iv = randomBytes(12),
    header = Buffer.concat([magic, Buffer.from([1]), salt, iv]),
    key = await derive(password, salt)
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(header)
    const bytes = Buffer.concat([cipher.update(payload), cipher.final()])
    return Buffer.concat([header, cipher.getAuthTag(), bytes])
  } finally {
    key.fill(0)
    payload.fill(0)
  }
}
export async function decryptConfiguration(bytes: Buffer, password: string) {
  if (
    bytes.length < 53 ||
    bytes.length > MAX_CONFIGURATION_BYTES ||
    !bytes.subarray(0, 8).equals(magic) ||
    bytes[8] !== 1
  )
    throw Error('Unsupported configuration')
  const key = await derive(password, bytes.subarray(9, 25))
  let plaintext: Buffer | undefined
  try {
    const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(25, 37))
    cipher.setAAD(bytes.subarray(0, 37))
    cipher.setAuthTag(bytes.subarray(37, 53))
    plaintext = Buffer.concat([
      cipher.update(bytes.subarray(53)),
      cipher.final(),
    ])
    return envelope.parse(JSON.parse(plaintext.toString('utf8')))
  } catch {
    throw Error(
      'Cannot unlock configuration: check password and file integrity',
    )
  } finally {
    key.fill(0)
    plaintext?.fill(0)
  }
}
