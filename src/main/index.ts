import { app, BrowserWindow, utilityProcess, safeStorage } from 'electron'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { randomBytes, randomUUID } from 'node:crypto'
import { Vault } from './vault'
import { registerOperations } from './ipc'
import {
  validateConnection,
  type ConnectionProfile,
} from '../shared/connection'
let window: BrowserWindow | undefined
app.whenReady().then(async () => {
  const service = utilityProcess.fork(join(__dirname, 'service.js'), [], {
    serviceName: 'QueueCumber capture',
  })
  let exited = false,
    requestId = 0
  const pending = new Map<
    number,
    {
      resolve: (v: any) => void
      reject: (e: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  service.on('message', (message) => {
    const p = pending.get(message.id)
    if (!p) return
    clearTimeout(p.timer)
    pending.delete(message.id)
    if (message.ok) p.resolve(message.value)
    else p.reject(Error(message.error))
  })
  service.once('exit', () => {
    exited = true
    for (const p of pending.values()) {
      clearTimeout(p.timer)
      p.reject(Error('Service stopped'))
    }
    pending.clear()
  })
  const rpc = (operation: string, ...args: any[]): Promise<any> =>
    new Promise((resolve, reject) => {
      if (exited || pending.size >= 16) {
        reject(Error('Service unavailable'))
        return
      }
      const id = ++requestId,
        timer = setTimeout(() => {
          pending.delete(id)
          reject(Error('Service timed out'))
        }, 15000)
      pending.set(id, { resolve, reject, timer })
      service.postMessage({ id, operation, args })
    })
  let vault: Vault | undefined,
    temporary: string | undefined,
    storageMode: 'secure' | 'session' = 'session'
  const ephemeralProfiles = new Map<string, ConnectionProfile>()
  const ready = (async () => {
    const available =
      process.env.QUEUECUMBER_TEST !== '1' &&
      (await safeStorage.isAsyncEncryptionAvailable())
    const backend =
      process.platform === 'linux'
        ? safeStorage.getSelectedStorageBackend()
        : ''
    if (available && backend !== 'basic_text' && backend !== 'unknown') {
      vault = new Vault(app.getPath('userData'), {
        protect: (s) => safeStorage.encryptStringAsync(s),
        unprotect: async (b) =>
          (await safeStorage.decryptStringAsync(b)).result,
      })
      await vault.initialize()
      storageMode = 'secure'
      await rpc('initialize', {
        dir: app.getPath('userData'),
        key: vault.getKey(),
      })
    } else {
      temporary = await mkdtemp(join(tmpdir(), 'queuecumber-session-'))
      await rpc('initialize', { dir: temporary, key: randomBytes(32) })
    }
  })()
  ready.catch(() => {})
  const getProfile = async (id: string) => {
    if (vault) return vault.get(id)
    const p = ephemeralProfiles.get(id)
    if (!p) throw Error('Connection not found')
    return p
  }
  window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 860,
    minHeight: 600,
    title: 'QueueCumber',
    backgroundColor: '#171717',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  const withReady =
    (f: (...args: any[]) => unknown) =>
    async (...args: any[]) => {
      await ready
      return f(...args)
    }
  registerOperations(window, {
    getStatus: async () => {
      try {
        await ready
        return { service: exited ? 'failed' : 'ready' }
      } catch {
        return { service: 'failed' }
      }
    },
    getState: withReady(async () => ({
      ...(await rpc('state')),
      profiles: vault
        ? vault.list()
        : [...ephemeralProfiles.values()].map(({ id, name }) => ({
            id,
            name,
            provider: 'rabbitmq',
          })),
      storageMode,
    })),
    saveConnection: withReady(async (input) => {
      if (vault) return vault.save(input)
      const p = validateConnection(input)
      const id = p.id ?? randomUUID()
      if (ephemeralProfiles.size >= 100 && !ephemeralProfiles.has(id))
        throw Error('Connection limit')
      ephemeralProfiles.set(id, { ...p, id })
      return { id, name: p.name, provider: 'rabbitmq' }
    }),
    testConnection: withReady(async (id) => rpc('test', await getProfile(id))),
    listResources: withReady(async (id, query, page) =>
      rpc('resources', await getProfile(id), query, page),
    ),
    getBindings: withReady(async (id, resource) =>
      rpc('bindings', await getProfile(id), resource),
    ),
    startCapture: withReady(async (id, resource, options) =>
      rpc('start', await getProfile(id), resource, options),
    ),
    stopCapture: withReady((id) => rpc('stop', id)),
    readMessages: withReady((id, cursor) => rpc('page', id, cursor)),
    readMessage: withReady((id) => rpc('message', id)),
    readPayloadChunk: withReady((id, offset) => rpc('chunk', id, offset)),
    previewSettings: withReady((input) => rpc('previewSettings', input)),
    saveSettings: withReady((input, confirmed) =>
      rpc('settings', input, confirmed),
    ),
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL)
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await window.loadFile(join(__dirname, '../renderer/index.html'))
  let quitting = false
  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    void rpc('shutdown')
      .catch(() => {})
      .finally(async () => {
        service.kill()
        if (temporary) await rm(temporary, { recursive: true, force: true })
        app.quit()
      })
  })
})
app.on('window-all-closed', () => app.quit())
