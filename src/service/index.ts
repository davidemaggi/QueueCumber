import { CaptureStorage } from './storage'
import { SettingsRepository } from './settings'
import { SessionManager } from './sessions'
import { RabbitMQ, failureCode } from './providers/rabbitmq'
import {
  DEFAULT_SETTINGS,
  settingsEffects,
  validateSettings,
} from '../shared/limits'
let settings = { ...DEFAULT_SETTINGS },
  warning: string | undefined,
  historyWarning: string | undefined,
  store: CaptureStorage,
  sessions: SessionManager,
  repository: SettingsRepository
const parent = process.parentPort
let inFlight = 0
parent.on('message', async ({ data }) => {
  const { id, operation, args } = data
  if (inFlight >= 16) {
    parent.postMessage({ id, ok: false, error: 'SERVICE_BUSY' })
    return
  }
  inFlight++
  try {
    let value: unknown
    if (operation === 'initialize') {
      const { dir, key } = args[0]
      repository = new SettingsRepository(dir)
      const saved = await repository.read()
      settings = saved.settings
      warning = saved.warning
      store = new CaptureStorage(dir, Buffer.from(key), settings)
      sessions = new SessionManager(store, () => settings)
      value = true
    } else {
      if (!store) throw Error('Service not initialized')
      switch (operation) {
        case 'state':
          try {
            store.saveSessions(sessions.list())
            historyWarning = undefined
          } catch {
            historyWarning = 'HISTORY_STORAGE_FAILED'
            await sessions.close().catch(() => {})
          }
          value = {
            settings,
            warning: warning ?? historyWarning,
            sessions: sessions.list(),
            stats: store.stats(),
          }
          break
        case 'test':
          value = await new RabbitMQ(args[0]).test()
          break
        case 'resources':
          value = await new RabbitMQ(args[0]).listResources(args[1], args[2])
          break
        case 'bindings':
          value = await new RabbitMQ(args[0]).bindings(args[1].name)
          break
        case 'start':
          if (warning || historyWarning)
            throw Error('Review settings and storage')
          value = await sessions.startCapture(args[0], args[1], args[2])
          break
        case 'stop':
          value = await sessions.stopCapture(args[0])
          break
        case 'page':
          value = store.readPage(args[0], args[1], 30)
          break
        case 'chunk': {
          const chunk = store.readChunk(args[0], args[1])
          value = { ...chunk, payload: chunk.payload.toString('base64') }
          break
        }
        case 'message': {
          const record = store.get(args[0]),
            previewLimit = Math.min(settings.previewBytes, 65536)
          const headers = JSON.parse(JSON.stringify(record.headers))
          value = {
            id: args[0],
            payload: record.payload
              .subarray(0, previewLimit)
              .toString('base64'),
            headers,
            bytes: record.originalBytes,
            previewLimit,
            truncated: record.payload.length > previewLimit,
            contentType: record.contentType,
            omission: record.omission,
            routingKey: record.routingKey,
            exchange: record.exchange,
            timestamp: record.timestamp,
          }
          break
        }
        case 'previewSettings':
          value = {
            effects: settingsEffects(settings, validateSettings(args[0])),
            active: sessions
              .list()
              .filter((s) => !['stopped', 'failed'].includes(s.state)).length,
          }
          break
        case 'settings': {
          const next = validateSettings(args[0]),
            effects = settingsEffects(settings, next),
            active = sessions
              .list()
              .some((s) => !['stopped', 'failed'].includes(s.state))
          if ((effects.length || active) && !args[1])
            throw Error('CONFIRM_SETTINGS_EFFECTS')
          await repository.save(next)
          await sessions.close().catch(() => {})
          store.applyRetention(next)
          settings = next
          warning = undefined
          historyWarning = undefined
          break
        }
        case 'shutdown':
          await sessions.close()
          store.close()
          value = true
          break
        default:
          throw Error('Unknown operation')
      }
    }
    parent.postMessage({ id, ok: true, value })
  } catch (error) {
    parent.postMessage({
      id,
      ok: false,
      error:
        (error as Error).message === 'CONFIRM_SETTINGS_EFFECTS'
          ? 'CONFIRM_SETTINGS_EFFECTS'
          : failureCode(error),
    })
  } finally {
    inFlight--
  }
})
