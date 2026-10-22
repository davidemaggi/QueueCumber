import type { ConnectionInput, ConnectionSummary } from './connection'
import type { CaptureSettings } from './limits'
import type {
  ResourcePage,
  ResourceRef,
  Binding,
  EndpointStatus,
} from '../service/providers/provider'
import type { SessionSummary, CaptureOptions } from '../service/sessions'
import type { MessageSummary } from '../service/storage'
export type AppStatus = { service: 'ready' | 'failed' }
export type State = {
  profiles: ConnectionSummary[]
  settings: CaptureSettings
  warning?: string
  storageMode: 'secure' | 'session'
  sessions: SessionSummary[]
  stats: { cacheBytes: number; diskBytes: number; evicted: number }
}
export type MessageDetail = {
  id: number
  payload: string
  headers: Record<string, unknown>
  bytes: number
  previewLimit: number
  truncated: boolean
  contentType?: string
  omission?: string
  routingKey: string
  exchange: string
  timestamp: number
}
export interface DesktopApi {
  getStatus(): Promise<AppStatus>
  getState(): Promise<State>
  saveConnection(input: ConnectionInput): Promise<ConnectionSummary>
  testConnection(
    id: string,
  ): Promise<{ protocol: EndpointStatus; management: EndpointStatus }>
  listResources(id: string, query: string, page: number): Promise<ResourcePage>
  getBindings(id: string, resource: ResourceRef): Promise<Binding[]>
  startCapture(
    id: string,
    resource: ResourceRef,
    options: CaptureOptions,
  ): Promise<SessionSummary>
  stopCapture(id: string): Promise<void>
  readMessages(
    id: string,
    cursor: number | null,
  ): Promise<{ records: MessageSummary[]; nextCursor: number | null }>
  readMessage(id: number): Promise<MessageDetail>
  readPayloadChunk(
    id: number,
    offset: number,
  ): Promise<{
    payload: string
    nextOffset: number | null
    totalBytes: number
    offset: number
  }>
  previewSettings(
    input: CaptureSettings,
  ): Promise<{ effects: string[]; active: number }>
  saveSettings(input: CaptureSettings, confirmed: boolean): Promise<void>
}
declare global {
  interface Window {
    queuecumber: DesktopApi
  }
}
