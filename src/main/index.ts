import { translator } from '../renderer/i18n'
import {
  app,
  BrowserWindow,
  utilityProcess,
  safeStorage,
  Tray,
  Menu,
  nativeImage,
  dialog,
} from 'electron'
import trayIconPath from '../../resources/tray.png?asset'
import { DesktopPreferencesRepository } from './preferences'
import { DesktopController } from './desktop'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { randomBytes, randomUUID } from 'node:crypto'
import { Vault, mergeProfiles, profilesFingerprint } from './vault'
import { ConfigurationFiles } from './configuration-files'
import { registerOperations } from './ipc'
import {
  validateConnection,
  type ConnectionProfile,
} from '../shared/connection'
let window: BrowserWindow | undefined
if (!app.requestSingleInstanceLock()) app.exit(0)
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
        persistent: true,
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
  const preferencesRepository = new DesktopPreferencesRepository(
    app.getPath('userData'),
  )
  const savedPreferences = await preferencesRepository.read()
  let desktopPreferences = savedPreferences.preferences
  let desktopWarning = savedPreferences.warning
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
  const desktop = new DesktopController({
    app,
    window,
    platform: process.platform,
    preferences: desktopPreferences,
    createTray: () => {
      const icon = nativeImage
        .createFromPath(trayIconPath)
        .resize({ width: 20, height: 20 })
      if (icon.isEmpty()) throw Error('Tray icon unavailable')
      if (process.platform === 'darwin') icon.setTemplateImage(true)
      return new Tray(icon)
    },
    buildMenu: (items) => Menu.buildFromTemplate(items),
    loadSessions: async () => {
      await ready
      return (await rpc('state')).sessions
    },
    shutdown: async () => {
      try {
        configuration.clear()
        await rpc('shutdown')
      } finally {
        service.kill()
        if (temporary) await rm(temporary, { recursive: true, force: true })
      }
    },
  })
  const configuration = new ConfigurationFiles({
    save: async () => {
      const result = await dialog.showSaveDialog(window!, {
        title: translator(desktopPreferences.locale)('configurationExport'),
        defaultPath: 'QueueCumber.qcc',
        filters: [
          { name: 'QueueCumber encrypted configuration', extensions: ['qcc'] },
        ],
      })
      return result.canceled ? undefined : result.filePath
    },
    open: async () => {
      const result = await dialog.showOpenDialog(window!, {
        title: translator(desktopPreferences.locale)('configurationImport'),
        properties: ['openFile'],
        filters: [
          { name: 'QueueCumber encrypted configuration', extensions: ['qcc'] },
        ],
      })
      return result.canceled ? undefined : result.filePaths[0]
    },
    profiles: () =>
      vault
        ? vault.all()
        : [...ephemeralProfiles.values()].map((p) => ({ ...p })),
    apply: async (profiles, mode, fingerprint) => {
      if (vault) {
        await vault.importProfiles(profiles, mode, fingerprint)
        return
      }
      if (profilesFingerprint([...ephemeralProfiles.values()]) !== fingerprint)
        throw Error('Connections changed; preview the import again')
      const next = mergeProfiles(
        [...ephemeralProfiles.values()],
        profiles,
        mode,
      )
      ephemeralProfiles.clear()
      for (const p of next) ephemeralProfiles.set(p.id, p)
    },
    storageMode: () => storageMode,
  })
  let choosingExport = false
  registerOperations(window, {
    exportCapture: withReady(async (id, format) => {
      if (choosingExport) throw Error('Export dialog already open')
      choosingExport = true
      try {
        let destination: string | undefined
        const t = translator(desktopPreferences.locale)
        if (format === 'folder') {
          const result = await dialog.showOpenDialog(window!, {
            title: t('exportCapture'),
            properties: ['openDirectory', 'createDirectory'],
          })
          if (!result.canceled && result.filePaths[0])
            destination = join(
              result.filePaths[0],
              `QueueCumber-${new Date().toISOString().slice(0, 10)}-${randomUUID()}`,
            )
        } else {
          const result = await dialog.showSaveDialog(window!, {
            title: t('exportCapture'),
            defaultPath: `QueueCumber.${format}`,
            filters: [
              {
                name: format === 'zip' ? 'ZIP' : 'JSONL',
                extensions: [format],
              },
            ],
          })
          if (!result.canceled) destination = result.filePath
        }
        return destination ? await rpc('export', id, destination, format) : null
      } finally {
        choosingExport = false
      }
    }),
    cancelExport: withReady((id) => rpc('cancelExport', id)),
    deleteCapture: withReady((id) => rpc('deleteCapture', id)),
    exportConfiguration: withReady((password, includeSecrets) =>
      configuration.export(password, includeSecrets),
    ),
    previewConfiguration: withReady((password) =>
      configuration.preview(password),
    ),
    applyConfiguration: withReady((token, mode) =>
      configuration.apply(token, mode),
    ),
    discardConfiguration: () => configuration.clear(),
    saveDesktopPreferences: withReady(async (input) => {
      await preferencesRepository.save(input)
      desktopPreferences = input
      desktopWarning = false
      desktop.setPreferences(input)
    }),
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
      desktop: {
        preferences: desktopPreferences,
        trayAvailable: desktop.trayAvailable,
        warning: desktopWarning,
        platform: process.platform,
      },
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
})
