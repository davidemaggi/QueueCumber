import { it, expect, vi } from 'vitest'
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { fromBuffer } from 'yauzl'
import { CaptureStorage } from '../../src/service/storage'
import { ExportManager } from '../../src/service/exports'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
import type { SessionSummary } from '../../src/service/sessions'
vi.mock('node:fs/promises', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs/promises')>()
  return { ...fs, open: vi.fn(fs.open) }
})

const session: SessionSummary = {
  id: 'session',
  connectionId: 'profile',
  resource: { kind: 'queue', vhost: '/', name: '../../untrusted' },
  state: 'stopped',
  captured: 2,
  omitted: 0,
  gaps: 1,
  startedAt: 1,
  bindings: [],
  potentialOverflow: true,
}
async function zipContents(buffer: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) =>
    fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error)
      const files = new Map<string, Buffer>()
      zip.on('error', reject)
      zip.on('end', () => resolve(files))
      zip.on('entry', (entry) =>
        zip.openReadStream(entry, (error, stream) => {
          if (error) return reject(error)
          const chunks: Buffer[] = []
          stream!.on('data', (chunk) => chunks.push(chunk))
          stream!.on('error', reject)
          stream!.on('end', () => {
            files.set(entry.fileName, Buffer.concat(chunks))
            zip.readEntry()
          })
        }),
      )
      zip.readEntry()
    }),
  )
}
for (const format of ['jsonl', 'folder', 'zip'] as const)
  it(`exports ${format} as lossless bytes with safe generated names and provenance`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qc-export-')),
      store = new CaptureStorage(
        join(dir, 'store'),
        randomBytes(32),
        DEFAULT_SETTINGS,
      ),
      destination = join(
        dir,
        'dump' + (format === 'folder' ? '' : '.' + format),
      )
    try {
      const payload = Buffer.from([0, 255, 1, 128])
      store.append(session.id, {
        payload,
        headers: { binary: Buffer.from([3, 2, 1]), integer: 42n },
        routingKey: '../../route',
        exchange: 'private',
      })
      store.append(session.id, {
        payload: Buffer.from('text'),
        headers: {},
        routingKey: 'route',
        exchange: 'private',
      })
      const manager = new ExportManager(store)
      manager.start(session, destination, format)
      await manager.wait()
      expect(manager.status()?.state).toBe('complete')
      if (format === 'jsonl') {
        const lines = (await readFile(destination, 'utf8'))
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
        expect(lines[1].payloadBase64).toBe(payload.toString('base64'))
        expect(lines.at(-1).recordsWritten).toBe(2)
      } else {
        const files =
          format === 'zip'
            ? await zipContents(await readFile(destination))
            : new Map(
                await Promise.all(
                  (await readdir(destination)).map(
                    async (name) =>
                      [name, await readFile(join(destination, name))] as const,
                  ),
                ),
              )
        expect(files.get('message-1.bin')!.equals(payload)).toBe(true)
        const metadata = JSON.parse(files.get('message-1.json')!.toString())
        expect(metadata.headers.binary).toEqual({
          type: 'bytes',
          base64: 'AwIB',
        })
        expect(metadata.headers.integer).toEqual({
          type: 'bigint',
          value: '42',
        })
        expect([...files.keys()].some((name) => name.includes('..'))).toBe(
          false,
        )
        const manifest = JSON.parse(files.get('manifest.json')!.toString())
        expect(manifest.recordsWritten).toBe(2)
        expect(manifest.session.gaps).toBe(1)
      }
    } finally {
      store.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
it('cancels cleanly and leaves an existing destination untouched on failure', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-cancel-')),
    store = new CaptureStorage(
      join(dir, 'store'),
      randomBytes(32),
      DEFAULT_SETTINGS,
    ),
    destination = join(dir, 'dump.jsonl')
  try {
    for (let i = 0; i < 100; i++)
      store.append(session.id, {
        payload: Buffer.alloc(10000),
        headers: {},
        routingKey: '',
        exchange: '',
      })
    const manager = new ExportManager(store)
    await writeFile(destination, 'existing')
    manager.start(session, destination, 'jsonl')
    manager.cancel()
    await manager.wait()
    expect(manager.status()?.state).toBe('cancelled')
    expect(await readFile(destination, 'utf8')).toBe('existing')
    expect(
      (await readdir(dir)).filter((name) => name.startsWith('.queuecumber-')),
    ).toHaveLength(0)
    manager.start(session, join(dir, 'missing', 'dump.jsonl'), 'jsonl')
    await manager.wait()
    expect(manager.status()?.state).toBe('failed')
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
it('preserves the destination and cleans staging after an ENOSPC write failure', async () => {
  const fs = await import('node:fs/promises'),
    { vi } = await import('vitest')
  const dir = await mkdtemp(join(tmpdir(), 'qc-diskfull-')),
    store = new CaptureStorage(
      join(dir, 'data'),
      randomBytes(32),
      DEFAULT_SETTINGS,
    ),
    path = join(dir, 'dump.jsonl')
  try {
    store.append(session.id, {
      payload: Buffer.from('synthetic'),
      headers: {},
      routingKey: '',
      exchange: '',
    })
    await writeFile(path, 'existing')
    const failing = vi
      .mocked(fs.open)
      .mockImplementationOnce(async (...args) => {
        const actual =
          await vi.importActual<typeof import('node:fs/promises')>(
            'node:fs/promises',
          )
        const handle = await actual.open(...args)
        const write = handle.writeFile.bind(handle)
        let writes = 0
        vi.spyOn(handle, 'writeFile').mockImplementation(async (...data) => {
          if (++writes === 3)
            throw Object.assign(Error('synthetic disk full'), {
              code: 'ENOSPC',
            })
          return write(...data)
        })
        return handle
      })
    try {
      const manager = new ExportManager(store)
      manager.start(session, path, 'jsonl')
      await manager.wait()
      expect(manager.status()?.state).toBe('failed')
      expect(await readFile(path, 'utf8')).toBe('existing')
      expect(
        (await readdir(dir)).filter((name) => name.startsWith('.queuecumber-')),
      ).toHaveLength(0)
    } finally {
      failing.mockRestore()
    }
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
for (const format of ['jsonl', 'folder', 'zip'] as const)
  it(`cancels ${format} after writing records and rejects overlapping jobs`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qc-mid-cancel-'))
    const store = new CaptureStorage(
      join(dir, 'data'),
      randomBytes(32),
      DEFAULT_SETTINGS,
    )
    try {
      for (let i = 0; i < 8; i++)
        store.append(session.id, {
          payload: randomBytes(128 * 1024),
          headers: {},
          routingKey: '',
          exchange: '',
        })
      let reads = 0
      const manager = new ExportManager({
        exportSnapshot: store.exportSnapshot.bind(store),
        nextExportRecord: (...args) => {
          if (++reads === 3) manager.cancel()
          return store.nextExportRecord(...args)
        },
      })
      const destination = join(dir, 'dump')
      if (format !== 'folder') await writeFile(destination, 'existing')
      manager.start(session, destination, format)
      expect(() => manager.start(session, destination, format)).toThrow(
        'already running',
      )
      await manager.wait()
      expect(manager.status()?.recordsWritten).toBe(2)
      expect(manager.status()?.state).toBe('cancelled')
      if (format !== 'folder')
        expect(await readFile(destination, 'utf8')).toBe('existing')
      expect(
        (await readdir(dir)).filter((name) => name.startsWith('.queuecumber-')),
      ).toHaveLength(0)
    } finally {
      store.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
