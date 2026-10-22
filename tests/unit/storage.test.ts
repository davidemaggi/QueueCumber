import { DatabaseSync } from 'node:sqlite'
import { it, expect } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { CaptureStorage } from '../../src/service/storage'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
it('stores encrypted raw bytes, bounds cache and evicts retained history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-store-'))
  const key = randomBytes(32)
  const settings = {
    ...DEFAULT_SETTINGS,
    cacheBytes: 4096,
    diskBytes: 262144,
    maxPayloadBytes: 1024,
    previewBytes: 128,
  }
  const store = new CaptureStorage(dir, key, settings)
  try {
    store.append('a', {
      payload: Buffer.from('private-message'),
      headers: { private: 'secret-header' },
      routingKey: 'private.route',
      exchange: 'private.exchange',
    })
    const rows = store.readPage('a', null, 20)
    expect(rows.records).toHaveLength(1)
    expect(store.get(rows.records[0].id).payload.toString()).toBe(
      'private-message',
    )
    for (let i = 0; i < 200; i++)
      store.append('a', {
        payload: randomBytes(1024),
        headers: { i },
        routingKey: 'key',
        exchange: 'events',
      })
    expect(store.stats().cacheBytes).toBeLessThanOrEqual(4096)
    expect(store.stats().evicted).toBeGreaterThan(0)
    expect(store.stats().diskBytes).toBeLessThanOrEqual(262144)
    const result = store.append('a', {
      payload: Buffer.alloc(2048),
      headers: {},
      routingKey: 'key',
      exchange: 'events',
    })
    expect(result.omitted).toBe(true)
    expect(store.readPage('a', null, 20).records[0].omission).toBe(
      'payload-limit',
    )
    for (const file of await readdir(dir)) {
      const bytes = await readFile(join(dir, file))
      expect(bytes.includes('private-message')).toBe(false)
      expect(bytes.includes('secret-header')).toBe(false)
    }
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
it('persists across restart and refuses tampered encrypted content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-recovery-')),
    key = randomBytes(32)
  let store = new CaptureStorage(dir, key, DEFAULT_SETTINGS)
  store.append('session', {
    payload: Buffer.from([0, 255, 128]),
    headers: { binary: Buffer.from([1, 2]) },
    routingKey: 'r',
    exchange: 'e',
  })
  store.close()
  store = new CaptureStorage(dir, key, DEFAULT_SETTINGS)
  try {
    const record = store.get(store.readPage('session', null, 1).records[0].id)
    expect([...record.payload]).toEqual([0, 255, 128])
    expect(Buffer.isBuffer(record.headers.binary)).toBe(true)
  } finally {
    store.close()
    const db = new DatabaseSync(join(dir, 'captures.db'))
    db.prepare('UPDATE captures SET data=?').run(Buffer.from('tampered'))
    db.close()
    const changed = new CaptureStorage(dir, key, DEFAULT_SETTINGS)
    expect(() => changed.readPage('session', null, 1)).toThrow()
    changed.close()
    await rm(dir, { recursive: true, force: true })
  }
})
it('enforces retention age and fails writes after storage closes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-age-')),
    key = randomBytes(32)
  const store = new CaptureStorage(dir, key, DEFAULT_SETTINGS)
  try {
    store.append('age', {
      payload: Buffer.from('old'),
      headers: {},
      routingKey: 'r',
      exchange: 'e',
    })
    const db = new DatabaseSync(join(dir, 'captures.db'))
    db.exec('UPDATE captures SET time=0')
    db.close()
    store.applyRetention(DEFAULT_SETTINGS)
    expect(store.readPage('age', null, 10).records).toHaveLength(0)
    store.close()
    expect(() =>
      store.append('age', {
        payload: Buffer.from('new'),
        headers: {},
        routingKey: 'r',
        exchange: 'e',
      }),
    ).toThrow()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
it('enforces a narrower session disk and cache budget without evicting another session', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-session-budget-'))
  const settings = {
    ...DEFAULT_SETTINGS,
    cacheBytes: 65536,
    diskBytes: 2097152,
    maxPayloadBytes: 4096,
    previewBytes: 128,
  }
  const store = new CaptureStorage(dir, randomBytes(32), settings)
  try {
    store.setSessionLimits('small', {
      ...settings,
      cacheBytes: 8192,
      diskBytes: 262144,
    })
    store.append('other', {
      payload: Buffer.from('keep'),
      headers: {},
      routingKey: 'other',
      exchange: 'e',
    })
    for (let i = 0; i < 100; i++)
      store.append('small', {
        payload: randomBytes(4096),
        headers: {},
        routingKey: 'small',
        exchange: 'e',
      })
    expect(store.readPage('small', null, 50).records.length).toBeLessThan(45)
    expect(store.readPage('other', null, 10).records).toHaveLength(1)
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
it('counts expiry through session-specific retention and clears its cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-scoped-age-'))
  const store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS)
  try {
    store.setSessionLimits('short', DEFAULT_SETTINGS)
    store.append('short', {
      payload: Buffer.from('expired'),
      headers: {},
      routingKey: 'r',
      exchange: 'e',
    })
    const db = new DatabaseSync(join(dir, 'captures.db'))
    db.exec('UPDATE captures SET time=0')
    db.close()
    expect(store.readPage('short', null, 10).records).toHaveLength(0)
    expect(store.stats().evicted).toBe(1)
    expect(store.stats().cacheBytes).toBe(0)
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
it('restores encrypted session catalog as stopped without reconnecting', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-catalog-')),
    key = randomBytes(32)
  let store = new CaptureStorage(dir, key, DEFAULT_SETTINGS)
  const summary = {
    id: 'restored',
    connectionId: 'profile',
    resource: { name: 'private.orders', vhost: '/', kind: 'queue' as const },
    state: 'capturing' as const,
    captured: 1,
    omitted: 0,
    gaps: 0,
    startedAt: Date.now(),
    bindings: [],
    potentialOverflow: true,
  }
  try {
    store.append('restored', {
      payload: Buffer.from('retained'),
      headers: {},
      routingKey: 'private.route',
      exchange: 'private.exchange',
    })
    store.saveSessions([summary])
    store.close()
    store = new CaptureStorage(dir, key, DEFAULT_SETTINGS)
    const { SessionManager } = await import('../../src/service/sessions')
    const manager = new SessionManager(store, () => DEFAULT_SETTINGS)
    expect(manager.list()).toHaveLength(1)
    expect(manager.list()[0].state).toBe('stopped')
    expect(manager.list()[0].gaps).toBe(1)
    expect(
      store
        .get(store.readPage(manager.list()[0].id, null, 1).records[0].id)
        .payload.toString(),
    ).toBe('retained')
    for (const file of await readdir(dir))
      expect((await readFile(join(dir, file))).includes('private.orders')).toBe(
        false,
      )
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
it('pages every retained raw byte including binary beyond the preview', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-raw-')),
    store = new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS),
    payload = randomBytes(200000)
  try {
    const { id } = store.append('raw', {
      payload,
      headers: {},
      routingKey: 'binary',
      exchange: 'e',
    })
    const chunks: Buffer[] = []
    let offset: number | null = 0
    do {
      const chunk = store.readChunk(id, offset!)
      expect(chunk.payload.length).toBeLessThanOrEqual(65536)
      chunks.push(chunk.payload)
      offset = chunk.nextOffset
    } while (offset !== null)
    expect(Buffer.concat(chunks).equals(payload)).toBe(true)
    expect(() => store.readChunk(id, -1)).toThrow()
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
