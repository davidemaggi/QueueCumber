import { it, expect } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { CaptureStorage } from '../../src/service/storage'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
it('adopts the legacy database without losing encrypted records', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qc-migrate-')),
    key = randomBytes(32)
  try {
    const storage = new CaptureStorage(dir, key, DEFAULT_SETTINGS)
    const { id } = storage.append('legacy', {
      payload: Buffer.from('legacy bytes'),
      headers: {},
      routingKey: 'rk',
      exchange: 'ex',
    })
    storage.close()
    const db = new DatabaseSync(join(dir, 'captures.db'))
    db.exec('PRAGMA user_version=0')
    db.close()
    const reopened = new CaptureStorage(dir, key, DEFAULT_SETTINGS)
    expect(reopened.get(id).payload.toString()).toBe('legacy bytes')
    reopened.close()
    const upgraded = new DatabaseSync(join(dir, 'captures.db'))
    expect(upgraded.prepare('PRAGMA user_version').get()?.user_version).toBe(1)
    upgraded.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
it('refuses a future database before changing its contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qc-future-')),
    path = join(dir, 'captures.db')
  try {
    const db = new DatabaseSync(path)
    db.exec(
      "PRAGMA user_version=99; CREATE TABLE future(value TEXT); INSERT INTO future VALUES ('keep')",
    )
    db.close()
    const bytes = readFileSync(path)
    expect(
      () => new CaptureStorage(dir, randomBytes(32), DEFAULT_SETTINGS),
    ).toThrow('Unsupported capture database version')
    expect(readFileSync(path)).toEqual(bytes)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
