import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, chmodSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { serialize, deserialize } from 'node:v8'
import { seal, open } from './crypto'
import {
  validateSettings,
  resolveSessionSettings,
  type CaptureSettings,
} from '../shared/limits'
export type IncomingRecord = {
  payload: Buffer
  headers: Record<string, unknown>
  routingKey: string
  exchange: string
  contentType?: string
}
export type StoredRecord = IncomingRecord & {
  timestamp: number
  originalBytes: number
  omission?: string
  sessionId: string
}
export type MessageSummary = {
  id: number
  timestamp: number
  bytes: number
  routingKey: string
  exchange: string
  preview: string
  omission?: string
}
export class CaptureStorage {
  private sessionLimits = new Map<string, CaptureSettings>()
  private cacheOwners = new Map<number, string>()
  private cacheUsage = new Map<string, number>()
  setSessionLimits(id: string, settings: CaptureSettings) {
    this.sessionLimits.set(id, resolveSessionSettings(this.settings, settings))
  }
  private clearCache() {
    this.cache.clear()
    this.cacheOwners.clear()
    this.cacheUsage.clear()
    this.cacheSize = 0
  }
  private removeCached(id: number) {
    const b = this.cache.get(id)
    if (!b) return
    const owner = this.cacheOwners.get(id)!
    this.cacheUsage.set(owner, (this.cacheUsage.get(owner) ?? 0) - b.length)
    this.cacheSize -= b.length
    this.cache.delete(id)
    this.cacheOwners.delete(id)
  }
  private db: DatabaseSync
  private cache = new Map<number, Buffer>()
  private cacheSize = 0
  private evicted = 0
  private path: string
  private settings: CaptureSettings
  constructor(
    dir: string,
    private key: Buffer,
    settings: CaptureSettings,
  ) {
    this.key = Buffer.from(key)
    this.settings = validateSettings(settings)
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    this.path = join(dir, 'captures.db')
    this.db = new DatabaseSync(this.path)
    chmodSync(this.path, 0o600)
    this.db.exec(
      `PRAGMA auto_vacuum=FULL; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS captures (id INTEGER PRIMARY KEY AUTOINCREMENT, session TEXT NOT NULL, time INTEGER NOT NULL, data BLOB NOT NULL); CREATE INDEX IF NOT EXISTS session_page ON captures(session,id);
CREATE INDEX IF NOT EXISTS capture_age ON captures(time);
CREATE TABLE IF NOT EXISTS capture_usage(session TEXT PRIMARY KEY, bytes INTEGER NOT NULL);
INSERT OR IGNORE INTO capture_usage SELECT session,SUM(length(data)) FROM captures GROUP BY session;
CREATE TABLE IF NOT EXISTS capture_total(singleton INTEGER PRIMARY KEY, bytes INTEGER NOT NULL);
INSERT OR IGNORE INTO capture_total SELECT 1,COALESCE(SUM(length(data)),0) FROM captures;
CREATE TRIGGER IF NOT EXISTS capture_insert AFTER INSERT ON captures BEGIN
 INSERT INTO capture_usage(session,bytes) VALUES(new.session,length(new.data)) ON CONFLICT(session) DO UPDATE SET bytes=bytes+length(new.data);
 UPDATE capture_total SET bytes=bytes+length(new.data) WHERE singleton=1;
END;
CREATE TRIGGER IF NOT EXISTS capture_delete AFTER DELETE ON captures BEGIN
 UPDATE capture_usage SET bytes=bytes-length(old.data) WHERE session=old.session;
 DELETE FROM capture_usage WHERE session=old.session AND bytes=0;
 UPDATE capture_total SET bytes=bytes-length(old.data) WHERE singleton=1;
END;`,
    )
    this.applyRetention(settings)
  }
  private cached(id: number, bytes: Buffer, sessionId: string) {
    const local = this.sessionLimits.get(sessionId) ?? this.settings
    if (bytes.length > Math.min(this.settings.cacheBytes, local.cacheBytes))
      return
    this.removeCached(id)
    while (
      (this.cacheSize + bytes.length > this.settings.cacheBytes ||
        (this.cacheUsage.get(sessionId) ?? 0) + bytes.length >
          local.cacheBytes) &&
      this.cache.size
    ) {
      const old = this.cache.keys().next().value!
      this.removeCached(old)
    }
    this.cache.set(id, bytes)
    this.cacheOwners.set(id, sessionId)
    this.cacheUsage.set(
      sessionId,
      (this.cacheUsage.get(sessionId) ?? 0) + bytes.length,
    )
    this.cacheSize += bytes.length
  }
  append(
    sessionId: string,
    input: IncomingRecord,
  ): { id: number; omitted: boolean } {
    const local = this.sessionLimits.get(sessionId) ?? this.settings
    let omission =
      input.payload.length > local.maxPayloadBytes ? 'payload-limit' : undefined
    if (serialize(input.headers).length > 65536) omission = 'metadata-limit'
    const record: StoredRecord = {
      ...input,
      sessionId,
      timestamp: Date.now(),
      originalBytes: input.payload.length,
      ...(omission ? { payload: Buffer.alloc(0), headers: {}, omission } : {}),
    }
    const bytes = serialize(record),
      encrypted = seal(this.key, bytes)
    this.pruneSession(sessionId, encrypted.length)
    this.prune(encrypted.length)
    const result = this.db
      .prepare('INSERT INTO captures(session,time,data) VALUES(?,?,?)')
      .run(sessionId, record.timestamp, encrypted)
    const id = Number(result.lastInsertRowid)
    this.cached(id, bytes, sessionId)
    if (this.stats().diskBytes > this.settings.diskBytes)
      throw Error('Capture disk budget exceeded')
    return { id, omitted: !!omission }
  }
  get(id: number): StoredRecord {
    const row = this.db
      .prepare('SELECT session,data FROM captures WHERE id=?')
      .get(id) as { session: string; data: Uint8Array } | undefined
    if (!row) throw Error('Message is no longer retained')
    const bytes = this.cache.get(id) ?? open(this.key, Buffer.from(row.data))
    const record = deserialize(bytes) as StoredRecord
    if (record.sessionId !== row.session)
      throw Error('Capture integrity check failed')
    this.cached(id, bytes, record.sessionId)
    return record
  }
  readPage(
    sessionId: string,
    cursor: number | null,
    limit: number,
  ): { records: MessageSummary[]; nextCursor: number | null } {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 50 ||
      (cursor !== null && (!Number.isSafeInteger(cursor) || cursor < 1))
    )
      throw Error('Invalid page')
    this.pruneSession(sessionId, 0)
    this.prune(0)
    const rows = this.db
      .prepare(
        'SELECT id FROM captures WHERE session=? AND id<? ORDER BY id DESC LIMIT ?',
      )
      .all(sessionId, cursor ?? Number.MAX_SAFE_INTEGER, limit + 1) as {
      id: number
    }[]
    const selected = rows.slice(0, limit)
    return {
      records: selected.map(({ id }) => {
        const m = this.get(id)
        return {
          id,
          timestamp: m.timestamp,
          bytes: m.originalBytes,
          routingKey: m.routingKey.slice(0, 255),
          exchange: m.exchange.slice(0, 255),
          preview: m.payload.subarray(0, 160).toString('utf8'),
          omission: m.omission,
        }
      }),
      nextCursor: rows.length > limit ? selected.at(-1)!.id : null,
    }
  }
  private pruneSession(sessionId: string, incoming: number) {
    const local = this.sessionLimits.get(sessionId)
    if (!local) return
    this.db
      .prepare('DELETE FROM captures WHERE session=? AND time<?')
      .run(sessionId, Date.now() - local.retentionMs)
    let total = Number(
      (
        this.db
          .prepare('SELECT bytes AS n FROM capture_usage WHERE session=?')
          .get(sessionId) as { n: number } | undefined
      )?.n ?? 0,
    )
    while (total + incoming > local.diskBytes * 0.6) {
      const row = this.db
        .prepare(
          'SELECT id,length(data) AS size FROM captures WHERE session=? ORDER BY id LIMIT 1',
        )
        .get(sessionId) as { id: number; size: number } | undefined
      if (!row) throw Error('Session disk budget exceeded')
      this.db.prepare('DELETE FROM captures WHERE id=?').run(row.id)
      total -= row.size
      this.evicted++
      this.removeCached(row.id)
    }
  }
  private prune(incoming: number) {
    const old = this.db
      .prepare('DELETE FROM captures WHERE time<?')
      .run(Date.now() - this.settings.retentionMs)
    this.evicted += Number(old.changes)
    let total = Number(
      (
        this.db
          .prepare('SELECT bytes AS n FROM capture_total WHERE singleton=1')
          .get() as { n: number }
      ).n,
    )
    const budget = Math.floor(this.settings.diskBytes * 0.6)
    while (total + incoming > budget) {
      const row = this.db
        .prepare(
          'SELECT id,length(data) AS size FROM captures ORDER BY id LIMIT 1',
        )
        .get() as { id: number; size: number } | undefined
      if (!row) throw Error('Message exceeds disk budget')
      this.db.prepare('DELETE FROM captures WHERE id=?').run(row.id)
      total -= row.size
      this.evicted++
    }
    if (
      old.changes ||
      this.cacheSize > this.settings.cacheBytes ||
      total + incoming > budget / 2
    ) {
      this.clearCache()
    }
  }
  applyRetention(settings: CaptureSettings) {
    this.settings = validateSettings(settings)
    this.prune(0)
    this.clearCache()
    return this.stats()
  }
  stats() {
    let diskBytes = 0
    for (const path of [this.path, this.path + '-journal']) {
      try {
        diskBytes += statSync(path).size
      } catch {
        /* No active rollback journal. */
      }
    }
    return { cacheBytes: this.cacheSize, diskBytes, evicted: this.evicted }
  }
  close() {
    this.clearCache()
    this.db.close()
    this.key.fill(0)
  }
}
