import { app, BrowserWindow, utilityProcess } from 'electron'
import { join } from 'node:path'
import { registerStatus } from './ipc'
app.whenReady().then(() => {
 const service = utilityProcess.fork(join(__dirname,'service.js'))
 const ready = new Promise<void>((resolve,reject) => {
  const timer = setTimeout(() => reject(new Error('Service timeout')),10000)
  service.once('message', () => { clearTimeout(timer); resolve() })
  service.once('exit', () => { clearTimeout(timer); reject(new Error('Service stopped')) })
 }); ready.catch(() => {})
 const window = new BrowserWindow({width:1440,height:900,minWidth:860,minHeight:600,backgroundColor:'#151515',webPreferences:{preload:join(__dirname,'../preload/index.js'),sandbox:true,contextIsolation:true,nodeIntegration:false}})
 registerStatus(window, () => ready)
 window.webContents.setWindowOpenHandler(() => ({action:'deny'}))
 window.webContents.on('will-navigate', event => event.preventDefault())
 if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
 else window.loadFile(join(__dirname,'../renderer/index.html'))
 app.on('before-quit', () => service.kill())
})
app.on('window-all-closed', () => app.quit())
