import { it, expect } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { CaptureStorage } from '../../src/service/storage'
import { ExportManager } from '../../src/service/exports'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
import type { SessionSummary } from '../../src/service/sessions'
it('does not pin records and reports messages removed after the snapshot', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-export-retention-')),
    store = new CaptureStorage(
      join(dir, 'data'),
      randomBytes(32),
      DEFAULT_SETTINGS,
    )
  try {
    store.append('s', {
      payload: Buffer.from('first'),
      headers: {},
      routingKey: '',
      exchange: '',
    })
    store.append('s', {
      payload: Buffer.from('second'),
      headers: {},
      routingKey: '',
      exchange: '',
    })
    const manager = new ExportManager(store),
      path = join(dir, 'capture.jsonl')
    manager.start(
      {
        id: 's',
        resource: { name: 'q', vhost: '/', kind: 'queue' },
        state: 'stopped',
        bindings: [],
        captured: 2,
        omitted: 0,
        gaps: 0,
        startedAt: 0,
        potentialOverflow: true,
        connectionId: 'p',
      } as SessionSummary,
      path,
      'jsonl',
    )
    store.deleteSession('s')
    await manager.wait()
    expect(manager.status()?.state).toBe('complete')
    const footer = JSON.parse(
      (await readFile(path, 'utf8')).trim().split('\n').at(-1)!,
    )
    expect(footer.missingRecords).toBe(2)
    expect(store.stats().cacheBytes).toBe(0)
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
