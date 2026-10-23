import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi } from '../shared/contracts'
const api: DesktopApi = {
  exportCapture: (id, format) =>
    ipcRenderer.invoke('qc:exportCapture', id, format),
  cancelExport: (id) => ipcRenderer.invoke('qc:cancelExport', id),
  deleteCapture: (id) => ipcRenderer.invoke('qc:deleteCapture', id),
  exportConfiguration: (password, includeSecrets) =>
    ipcRenderer.invoke('qc:exportConfiguration', password, includeSecrets),
  previewConfiguration: (password) =>
    ipcRenderer.invoke('qc:previewConfiguration', password),
  applyConfiguration: (token, mode) =>
    ipcRenderer.invoke('qc:applyConfiguration', token, mode),
  discardConfiguration: () => ipcRenderer.invoke('qc:discardConfiguration'),
  saveDesktopPreferences: (input) =>
    ipcRenderer.invoke('qc:saveDesktopPreferences', input),
  getStatus: () => ipcRenderer.invoke('qc:getStatus'),
  getState: () => ipcRenderer.invoke('qc:getState'),
  getConnection: (id) => ipcRenderer.invoke('qc:getConnection', id),
  listRoutingBindings: (id) => ipcRenderer.invoke('qc:listRoutingBindings', id),
  saveConnection: (input) => ipcRenderer.invoke('qc:saveConnection', input),
  testConnection: (id) => ipcRenderer.invoke('qc:testConnection', id),
  listResources: (id, query, page, filter) =>
    ipcRenderer.invoke('qc:listResources', id, query, page, filter),
  getPartitions: (id, resource) =>
    ipcRenderer.invoke('qc:getPartitions', id, resource),
  getBindings: (id, resource) =>
    ipcRenderer.invoke('qc:getBindings', id, resource),
  startCapture: (id, resource, options) =>
    ipcRenderer.invoke('qc:startCapture', id, resource, options),
  stopCapture: (id) => ipcRenderer.invoke('qc:stopCapture', id),
  readMessages: (id, cursor, order) =>
    ipcRenderer.invoke('qc:readMessages', id, cursor, order),
  readMessage: (id) => ipcRenderer.invoke('qc:readMessage', id),
  readPayloadChunk: (id, offset) =>
    ipcRenderer.invoke('qc:readPayloadChunk', id, offset),
  previewSettings: (input) => ipcRenderer.invoke('qc:previewSettings', input),
  saveSettings: (input, confirmed) =>
    ipcRenderer.invoke('qc:saveSettings', input, confirmed),
}
contextBridge.exposeInMainWorld('queuecumber', api)
