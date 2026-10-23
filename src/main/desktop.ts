import type {
  App,
  BrowserWindow,
  Tray,
  Menu,
  MenuItemConstructorOptions,
} from 'electron'
import type { DesktopPreferences } from '../shared/desktop'
import type { SessionSummary } from '../service/sessions'
import { translator } from '../renderer/i18n'
type Options = {
  app: Pick<App, 'on' | 'quit'>
  window: Pick<
    BrowserWindow,
    | 'on'
    | 'hide'
    | 'show'
    | 'focus'
    | 'restore'
    | 'minimize'
    | 'isMinimized'
    | 'isDestroyed'
  >
  createTray: () => Pick<
    Tray,
    'on' | 'destroy' | 'setToolTip' | 'setContextMenu'
  >
  buildMenu: (items: MenuItemConstructorOptions[]) => Menu
  loadSessions: () => Promise<SessionSummary[]>
  shutdown: () => Promise<void>
  preferences: DesktopPreferences
  platform: NodeJS.Platform
  pollMilliseconds?: number
}
export class DesktopController {
  private tray?: ReturnType<Options['createTray']>
  private timer?: ReturnType<typeof setTimeout>
  private phase: 'running' | 'stopping' | 'finished' = 'running'
  private preferences: DesktopPreferences
  private sessions: SessionSummary[] = []
  private failed = false
  private fingerprint = ''
  private disposed = false
  constructor(private options: Options) {
    this.preferences = options.preferences
    try {
      this.tray = options.createTray()
      this.tray.on('click', () => this.open())
    } catch {
      /* Keep a minimized window route if the native tray cannot be created. */
    }
    options.window.on('close', (event) => {
      if (this.phase !== 'running' || !this.preferences.closeToTray) return
      event.preventDefault()
      if (this.tray && options.platform !== 'linux') options.window.hide()
      else options.window.minimize()
    })
    options.app.on('activate', () => this.open())
    options.app.on('second-instance', () => this.open())
    options.app.on('window-all-closed', () => options.app.quit())
    options.app.on('before-quit', (event) => {
      if (this.phase === 'finished') return
      event.preventDefault()
      if (this.phase === 'stopping') return
      this.phase = 'stopping'
      void this.dispose()
        .then(options.shutdown)
        .catch(() => {})
        .finally(() => {
          this.phase = 'finished'
          options.app.quit()
        })
    })
    this.update([], false)
    void this.poll()
  }
  get trayAvailable() {
    return !!this.tray && !this.disposed
  }
  setPreferences(preferences: DesktopPreferences) {
    this.preferences = preferences
    this.update(this.sessions, this.failed)
  }
  open() {
    const window = this.options.window
    if (this.phase !== 'running' || window.isDestroyed()) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }
  update(sessions: SessionSummary[], failed: boolean) {
    if (this.disposed) return
    this.sessions = sessions.slice(0, 100)
    this.failed = failed
    const fingerprint = JSON.stringify([
      this.preferences.locale,
      this.sessions.map((s) => [s.id, s.resource.name, s.state]),
      failed,
    ])
    if (fingerprint === this.fingerprint) return
    this.fingerprint = fingerprint
    const t = translator(this.preferences.locale)
    const items: MenuItemConstructorOptions[] = [
      { label: t('trayOpen'), click: () => this.open() },
      { type: 'separator' },
    ]
    const active = this.sessions.filter((s) =>
      ['capturing', 'connecting', 'reconnecting'].includes(s.state),
    )
    if (failed) items.push({ label: t('trayFailed'), enabled: false })
    else if (!this.sessions.length)
      items.push({ label: t('noSessions'), enabled: false })
    else {
      const shown = [
        ...active,
        ...this.sessions.filter((s) => !active.includes(s)).reverse(),
      ].slice(0, 16)
      for (const s of shown)
        items.push({
          // eslint-disable-next-line no-control-regex -- strip untrusted native-menu control characters
          label: `${s.resource.name.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 100)} — ${t(s.state)}`,
          click: () => this.open(),
        })
      if (this.sessions.length > shown.length)
        items.push({
          label: `+${this.sessions.length - shown.length}`,
          enabled: false,
        })
    }
    items.push(
      { type: 'separator' },
      { label: t('trayQuit'), click: () => this.options.app.quit() },
    )
    this.tray?.setToolTip(
      `QueueCumber · ${failed ? t('trayFailed') : `${active.length} ${t('trayActive')}`}`,
    )
    this.tray?.setContextMenu(this.options.buildMenu(items))
  }
  private async poll() {
    if (this.disposed) return
    try {
      this.update(await this.options.loadSessions(), false)
    } catch {
      this.update([], true)
    }
    if (!this.disposed)
      this.timer = setTimeout(
        () => void this.poll(),
        this.options.pollMilliseconds ?? 2000,
      )
  }
  async dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.timer) clearTimeout(this.timer)
    this.tray?.destroy()
  }
}
