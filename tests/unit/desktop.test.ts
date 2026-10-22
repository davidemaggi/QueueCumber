import { it, expect } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DesktopPreferencesRepository } from '../../src/main/preferences'
import {
  desktopPreferencesSchema,
  DEFAULT_DESKTOP_PREFERENCES,
} from '../../src/shared/desktop'
it('persists opt-in background behavior atomically and fails safely on corrupt preferences', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-preferences-'))
  try {
    const repository = new DesktopPreferencesRepository(dir)
    expect((await repository.read()).preferences).toEqual(
      DEFAULT_DESKTOP_PREFERENCES,
    )
    await repository.save({
      ...DEFAULT_DESKTOP_PREFERENCES,
      closeToTray: true,
      locale: 'it',
    })
    expect((await repository.read()).preferences.closeToTray).toBe(true)
    await writeFile(join(dir, 'desktop.json'), '{bad')
    const recovered = await repository.read()
    expect(recovered.preferences.closeToTray).toBe(false)
    expect(recovered.warning).toBe(true)
    expect(() =>
      desktopPreferencesSchema.parse({
        ...DEFAULT_DESKTOP_PREFERENCES,
        closeToTray: 'true',
      }),
    ).toThrow()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

import { EventEmitter } from 'node:events'
import { vi } from 'vitest'
import { DesktopController } from '../../src/main/desktop'
function fixture(platform: NodeJS.Platform = 'darwin', trayWorks = true) {
  const application = Object.assign(new EventEmitter(), { quit: vi.fn() })
  const window = Object.assign(new EventEmitter(), {
    hide: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    minimize: vi.fn(),
    isMinimized: () => false,
    isDestroyed: () => false,
  })
  const tray = Object.assign(new EventEmitter(), {
    destroy: vi.fn(),
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
  })
  let menu: any[] = []
  const shutdown = vi.fn(async () => {})
  const controller = new DesktopController({
    app: application as any,
    window: window as any,
    createTray: () => {
      if (!trayWorks) throw Error('no host')
      return tray as any
    },
    buildMenu: (items: any) => {
      menu = items
      return items as any
    },
    loadSessions: async () => [],
    shutdown,
    preferences: { ...DEFAULT_DESKTOP_PREFERENCES, closeToTray: true },
    platform,
    pollMilliseconds: 60000,
  })
  return { application, window, tray, shutdown, controller, menu: () => menu }
}
it('hides only on opt-in and keeps an accessible minimized fallback without a usable tray', async () => {
  for (const [platform, trayWorks, hidden] of [
    ['darwin', true, true],
    ['win32', true, true],
    ['linux', true, false],
    ['darwin', false, false],
  ] as const) {
    const f = fixture(platform, trayWorks),
      event = { preventDefault: vi.fn() }
    f.window.emit('close', event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(f.window.hide).toHaveBeenCalledTimes(hidden ? 1 : 0)
    expect(f.window.minimize).toHaveBeenCalledTimes(hidden ? 0 : 1)
    await f.controller.dispose()
  }
})
it('default close exits normally, while explicit Quit shuts down once and bypasses hiding', async () => {
  const f = fixture()
  f.controller.setPreferences({ ...DEFAULT_DESKTOP_PREFERENCES })
  const close = { preventDefault: vi.fn() }
  f.window.emit('close', close)
  expect(close.preventDefault).not.toHaveBeenCalled()
  const event = { preventDefault: vi.fn() }
  f.application.emit('before-quit', event)
  f.application.emit('before-quit', event)
  await vi.waitFor(() => expect(f.application.quit).toHaveBeenCalledOnce())
  expect(f.shutdown).toHaveBeenCalledOnce()
  expect(f.tray.destroy).toHaveBeenCalledOnce()
  f.controller.setPreferences({
    ...DEFAULT_DESKTOP_PREFERENCES,
    closeToTray: true,
  })
  f.window.emit('close', close)
  expect(close.preventDefault).not.toHaveBeenCalled()
  await f.controller.dispose()
})
it('shows localized bounded session status, opens from tray and reports service failure', async () => {
  const f = fixture()
  const sessions = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    resource: { name: 'queue-' + i },
    state: i === 0 ? 'capturing' : 'stopped',
  }))
  f.controller.setPreferences({
    ...DEFAULT_DESKTOP_PREFERENCES,
    locale: 'it',
    closeToTray: true,
  })
  f.controller.update(sessions as any, false)
  expect(f.menu().length).toBeLessThanOrEqual(21)
  expect(f.menu().some((item) => item.label?.includes('queue-0'))).toBe(true)
  expect(f.menu()[0].label).toBe('Apri QueueCumber')
  f.menu()[0].click()
  expect(f.window.show).toHaveBeenCalled()
  f.controller.update([], true)
  expect(
    f
      .menu()
      .some(
        (item) => item.label === 'Servizio di acquisizione non disponibile',
      ),
  ).toBe(true)
  await f.controller.dispose()
})
it('polls native status independently and replaces stale sessions when the utility fails', async () => {
  const f = fixture()
  await f.controller.dispose()
  let calls = 0
  const controller = new DesktopController({
    app: f.application as any,
    window: f.window as any,
    createTray: () => f.tray as any,
    buildMenu: (items) => items as any,
    loadSessions: async () => {
      calls++
      throw Error('service exited')
    },
    shutdown: async () => {},
    preferences: DEFAULT_DESKTOP_PREFERENCES,
    platform: 'darwin',
    pollMilliseconds: 5,
  })
  await vi.waitFor(() =>
    expect(f.tray.setToolTip).toHaveBeenCalledWith(
      'QueueCumber · Capture service unavailable',
    ),
  )
  expect(calls).toBeGreaterThan(0)
  await controller.dispose()
  const stopped = calls
  await new Promise((resolve) => setTimeout(resolve, 15))
  expect(calls).toBe(stopped)
})
