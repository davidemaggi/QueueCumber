import { it, expect } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { CaptureStorage } from '../../src/service/storage'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
it('bounds encrypted storage under mixed synthetic payload saturation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-load-'))
  const settings = {
    ...DEFAULT_SETTINGS,
    cacheBytes: 1048576,
    diskBytes: 2097152,
    maxPayloadBytes: 262144,
    previewBytes: 65536,
  }
  const store = new CaptureStorage(dir, randomBytes(32), settings),
    before = process.memoryUsage().rss,
    start = performance.now()
  try {
    for (let i = 0; i < 500; i++) {
      const sizes = [64, 4096, 65536, 262144]
      store.append('load', {
        payload: randomBytes(sizes[i % 4]),
        headers: { n: i },
        routingKey: 'synthetic.event',
        exchange: 'synthetic',
      })
    }
    expect(store.stats().cacheBytes).toBeLessThanOrEqual(1048576)
    expect(store.stats().diskBytes).toBeLessThanOrEqual(2097152)
    expect(store.stats().evicted).toBeGreaterThan(0)
    store.applyRetention({ ...settings, diskBytes: 1048576 })
    expect(store.readPage('load', null, 10).records.length).toBeGreaterThan(0)
    expect(store.stats().diskBytes).toBeLessThanOrEqual(1048576)
    console.log(
      JSON.stringify({
        kind: 'synthetic-storage',
        messages: 500,
        elapsedMs: Math.round(performance.now() - start),
        rssDeltaBytes: process.memoryUsage().rss - before,
        ...store.stats(),
      }),
    )
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
