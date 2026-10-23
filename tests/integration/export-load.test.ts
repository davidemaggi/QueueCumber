import { it, expect } from 'vitest'
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { CaptureStorage } from '../../src/service/storage'
import { ExportManager } from '../../src/service/exports'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
import type { SessionSummary } from '../../src/service/sessions'

it('streams a 64 MiB retained capture through every dump format with a finite record working set', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-export-load-'))
  const settings = {
    ...DEFAULT_SETTINGS,
    cacheBytes: 16 * 1024 ** 2,
    maxPayloadBytes: 1024 ** 2,
  }
  const store = new CaptureStorage(join(dir, 'data'), randomBytes(32), settings)
  const count = 1024,
    payloadBytes = 65536
  const session = {
    id: 'load',
    connectionId: 'synthetic',
    resource: { kind: 'stream', name: 'synthetic', vhost: '/' },
    state: 'stopped',
    captured: count,
    omitted: 0,
    gaps: 0,
    startedAt: 0,
    bindings: [],
    potentialOverflow: false,
  } as SessionSummary
  try {
    for (let i = 0; i < count; i++)
      store.append(session.id, {
        payload: randomBytes(payloadBytes),
        headers: { sequence: i },
        routingKey: '',
        exchange: '',
        offset: i,
      })
    const results = []
    for (const format of ['jsonl', 'folder', 'zip'] as const) {
      const path = join(dir, 'dump.' + format),
        before = process.memoryUsage().rss,
        started = performance.now()
      let peak = before
      const timer = setInterval(() => {
        peak = Math.max(peak, process.memoryUsage().rss)
      }, 5)
      const manager = new ExportManager(store)
      try {
        manager.start(session, path, format)
        await manager.wait()
        expect(manager.status()?.state).toBe('complete')
        expect(manager.status()?.recordsWritten).toBe(count)
        expect(manager.status()?.missingRecords).toBe(0)
        expect(manager.status()?.peakRecordBytes).toBe(payloadBytes)
        expect(store.stats().cacheBytes).toBeLessThanOrEqual(
          settings.cacheBytes,
        )
        results.push({
          format,
          elapsedMs: Math.round(performance.now() - started),
          baselineRss: before,
          peakSampledRss: peak,
          maxRssKiB: process.resourceUsage().maxRSS,
          outputBytes: format === 'folder' ? null : (await stat(path)).size,
          ...manager.status(),
        })
      } finally {
        clearInterval(timer)
      }
      await rm(path, { recursive: true, force: true })
    }
    await writeFile(
      join(tmpdir(), 'queuecumber-export-metrics.json'),
      JSON.stringify({ count, payloadBytes, results }, null, 2),
    )
    console.log(
      JSON.stringify({
        kind: 'synthetic-export',
        count,
        payloadBytes,
        results,
      }),
    )
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
}, 60000)
