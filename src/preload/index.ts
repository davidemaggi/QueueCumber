import {contextBridge, ipcRenderer} from 'electron'
contextBridge.exposeInMainWorld('queuecumber', { getStatus: () => ipcRenderer.invoke('status') })
