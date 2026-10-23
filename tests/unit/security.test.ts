import { it, expect, vi } from 'vitest'
import { hardenWindow } from '../../src/main/security'
it('denies browser permissions, new windows, navigation and attached webviews', () => {
  const listeners = new Map<
    string,
    (event: { preventDefault(): void }) => void
  >()
  const session = {
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
    setDevicePermissionHandler: vi.fn(),
  }
  const contents = {
    session,
    setWindowOpenHandler: vi.fn(),
    on: (name: string, cb: (event: { preventDefault(): void }) => void) =>
      listeners.set(name, cb),
  }
  hardenWindow(contents as any)
  const answer = vi.fn()
  session.setPermissionRequestHandler.mock.calls[0][0](
    {},
    'notifications',
    answer,
  )
  expect(answer).toHaveBeenCalledWith(false)
  expect(session.setPermissionCheckHandler.mock.calls[0][0]()).toBe(false)
  expect(session.setDevicePermissionHandler.mock.calls[0][0]()).toBe(false)
  expect(contents.setWindowOpenHandler.mock.calls[0][0]()).toEqual({
    action: 'deny',
  })
  for (const name of ['will-navigate', 'will-attach-webview']) {
    const event = { preventDefault: vi.fn() }
    listeners.get(name)!(event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  }
})
