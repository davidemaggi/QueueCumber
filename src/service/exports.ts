import { ExportJournal } from './export-journal'
import { randomUUID, createHash } from 'node:crypto'
import {
  open,
  mkdtemp,
  rm,
  rename,
  mkdir,
  rmdir,
  writeFile,
} from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { once } from 'node:events'
import { setImmediate as yieldNow } from 'node:timers/promises'
import { ZipFile } from 'yazl'
import type { CaptureStorage, StoredRecord } from './storage'
import type { SessionSummary } from './sessions'
import type { ExportFormat, ExportStatus } from '../shared/export'
const ZIP_RECORD_LIMIT = 10000
export function encodeValue(value: unknown, depth = 0): unknown {
  if (depth > 64) throw Error('Header nesting limit')
  if (value instanceof Uint8Array)
    return { type: 'bytes', base64: Buffer.from(value).toString('base64') }
  if (typeof value === 'bigint')
    return { type: 'bigint', value: value.toString() }
  if (value === undefined) return { type: 'undefined' }
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) || Object.is(value, -0))
  )
    return {
      type: 'number',
      value: Object.is(value, -0) ? '-0' : String(value),
    }
  if (value instanceof Date)
    return { type: 'date', value: String(value.getTime()) }
  if (Array.isArray(value))
    return { type: 'array', value: value.map((v) => encodeValue(v, depth + 1)) }
  if (value && typeof value === 'object')
    return {
      type: 'object',
      value: Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, encodeValue(v, depth + 1)]),
      ),
    }
  return value
}
function metadata(id: number, record: StoredRecord) {
  const { payload, headers, ...rest } = record
  return {
    type: 'message',
    schemaVersion: 1,
    id,
    ...rest,
    headers: Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k, encodeValue(v)]),
    ),
    payloadSha256: createHash('sha256').update(payload).digest('hex'),
  }
}
export class ExportManager {
  private job?: ExportStatus
  private work?: Promise<void>
  private controller?: AbortController
  constructor(
    private store: Pick<CaptureStorage, 'exportSnapshot' | 'nextExportRecord'>,
    private journal?: ExportJournal,
  ) {}
  recovery: 'none' | 'cleaned' | 'manual' = 'none'
  async recover() {
    this.recovery = (await this.journal?.recover()) ?? 'none'
  }
  destroy() {
    this.journal?.destroy()
  }
  status() {
    return this.job ? { ...this.job } : undefined
  }
  start(session: SessionSummary, destination: string, format: ExportFormat) {
    if (this.work) throw Error('An export is already running')
    if (this.recovery === 'manual')
      throw Error('Resolve interrupted export cleanup before exporting')
    if (!['jsonl', 'folder', 'zip'].includes(format))
      throw Error('Invalid export format')
    const snapshot = this.store.exportSnapshot(session.id)
    if (format === 'zip' && snapshot.count > ZIP_RECORD_LIMIT)
      throw Error('ZIP supports at most 10000 messages; choose JSONL or folder')
    const job: ExportStatus = {
      id: randomUUID(),
      sessionId: session.id,
      format,
      state: 'running',
      recordsWritten: 0,
      expectedRecords: snapshot.count,
      missingRecords: 0,
      bytesWritten: 0,
      peakRecordBytes: 0,
    }
    this.job = job
    this.controller = new AbortController()
    this.work = this.run(
      structuredClone(session),
      snapshot,
      destination,
      job,
      this.controller.signal,
    ).finally(() => {
      this.work = undefined
      this.controller = undefined
    })
    return { ...job }
  }
  cancel(id?: string) {
    if (id && this.job?.id !== id) throw Error('Export not found')
    if (this.controller && this.job?.state === 'running') {
      this.job.state = 'cancelling'
      this.controller.abort()
    }
  }
  async wait() {
    await this.work
  }
  private async run(
    session: SessionSummary,
    snapshot: ReturnType<CaptureStorage['exportSnapshot']>,
    destination: string,
    job: ExportStatus,
    signal: AbortSignal,
  ) {
    let zipOutput: Readable | undefined
    let temporary: string | undefined,
      handle: Awaited<ReturnType<typeof open>> | undefined,
      zip: ZipFile | undefined,
      zipDone: Promise<void> | undefined
    const check = () => {
      if (signal.aborted) throw Error('Export cancelled')
    }
    try {
      check()
      if (job.format === 'folder')
        temporary = await mkdtemp(
          join(dirname(destination), '.queuecumber-export-'),
        )
      else
        temporary = join(
          dirname(destination),
          `.queuecumber-export-${randomUUID()}.part`,
        )
      await this.journal?.begin(temporary, destination)
      const base = {
        type: 'manifest',
        schemaVersion: 1,
        createdAt: new Date().toISOString(),
        session,
        snapshot,
        retentionPolicy: 'not-pinned; records may expire during export',
        plaintext: true,
      }
      if (job.format === 'jsonl') handle = await open(temporary, 'wx', 0o600)
      if (job.format === 'zip') {
        zip = new ZipFile()
        zipOutput = zip.outputStream as Readable
        zip.on('error', (error) => zipOutput!.destroy(error))
        zipDone = pipeline(
          zipOutput!,
          createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
          { signal },
        )
        void zipDone.catch(() => {})
      }
      const write = async (data: string | Buffer) => {
        check()
        await handle!.writeFile(data)
        job.bytesWritten += Buffer.byteLength(data)
      }
      const add = async (name: string, data: Buffer) => {
        check()
        if (job.format === 'folder')
          await writeFile(join(temporary!, name), data, {
            mode: 0o600,
            flag: 'wx',
            signal,
          })
        else {
          const source = Readable.from(
            (function* () {
              for (let offset = 0; offset < data.length; offset += 65536)
                yield data.subarray(offset, offset + 65536)
            })(),
          )
          const abort = () => source.destroy(Error('Export cancelled'))
          signal.addEventListener('abort', abort, { once: true })
          try {
            zip!.addReadStream(source, name, { compress: true, mode: 0o100600 })
            await Promise.race([
              once(source, 'end'),
              zipDone!.then(() => {
                throw Error('Archive ended early')
              }),
            ])
          } finally {
            signal.removeEventListener('abort', abort)
          }
        }
        job.bytesWritten += data.length
      }
      if (handle) await write(JSON.stringify(base) + '\n')
      let after = 0
      while (true) {
        check()
        const next = this.store.nextExportRecord(
          session.id,
          after,
          snapshot.lastId,
        )
        if (!next) break
        after = next.id
        job.peakRecordBytes = Math.max(
          job.peakRecordBytes,
          next.record.payload.length,
        )
        const info = metadata(next.id, next.record),
          payload = next.record.payload
        if (handle) {
          await write(JSON.stringify(info).slice(0, -1) + ',"payloadBase64":"')
          // 48 KiB chunks keep base64 boundaries and IPC-independent export buffers bounded.
          for (let offset = 0; offset < payload.length; offset += 49152)
            await write(
              payload.subarray(offset, offset + 49152).toString('base64'),
            )
          await write('"}\n')
        } else {
          await add(`message-${next.id}.bin`, payload)
          await add(
            `message-${next.id}.json`,
            Buffer.from(JSON.stringify(info)),
          )
        }
        job.recordsWritten++
        await yieldNow()
      }
      job.missingRecords = Math.max(0, job.expectedRecords - job.recordsWritten)
      const complete = {
        ...base,
        type: 'complete',
        completedAt: new Date().toISOString(),
        recordsWritten: job.recordsWritten,
        missingRecords: job.missingRecords,
      }
      if (handle) {
        await write(JSON.stringify(complete) + '\n')
        await handle.sync()
        await handle.close()
        handle = undefined
      } else
        await add(
          'manifest.json',
          Buffer.from(JSON.stringify(complete, null, 2)),
        )
      if (zip) {
        zip.end({ forceZip64Format: true, comment: '' })
        await zipDone
      }
      check()
      if (job.format === 'folder') {
        // A generated final directory must not overwrite another export.
        const reservation = await mkdir(destination, { mode: 0o700 })
          .then(() => true)
          .catch((error) => {
            throw error
          })
        if (reservation) {
          await rmdir(destination)
          await rename(temporary, destination)
        }
      } else await rename(temporary, destination)
      temporary = undefined
      job.state = 'complete'
    } catch {
      job.state = signal.aborted ? 'cancelled' : 'failed'
      job.error = signal.aborted ? undefined : 'EXPORT_FAILED'
    } finally {
      await handle?.close().catch(() => {})
      zipOutput?.destroy()
      await zipDone?.catch(() => {})
      let cleaned = true
      if (temporary) {
        try {
          await rm(temporary, { recursive: true, force: true })
        } catch {
          cleaned = false
          job.state = 'failed'
          job.error = 'EXPORT_CLEANUP_FAILED'
          this.recovery = 'manual'
        }
      }
      if (cleaned) {
        try {
          await this.journal?.clear()
        } catch {
          this.recovery = 'manual'
        }
      }
    }
  }
}
