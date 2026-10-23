import type { WebContents } from 'electron'

export function hardenWindow(contents: WebContents) {
  // Broker and file access belong to privileged code; the renderer needs no device permissions.
  contents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  )
  contents.session.setPermissionCheckHandler(() => false)
  contents.session.setDevicePermissionHandler(() => false)
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event) => event.preventDefault())
  contents.on('will-attach-webview', (event) => event.preventDefault())
}
