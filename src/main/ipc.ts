import { ipcMain, type BrowserWindow } from 'electron'
export function registerStatus(window: BrowserWindow, ready: () => Promise<void>) {
 ipcMain.handle('status', async event => {
  if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted sender')
  try { await ready(); return {service: 'ready'} } catch { return {service: 'failed'} }
 })
}
