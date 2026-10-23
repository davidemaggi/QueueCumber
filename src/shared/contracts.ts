import type { ResourceFilter } from './resource-filter'
import type { ExportFormat, ExportStatus } from './export'
import type { ImportPreview, ImportMode } from './transfer'
import type { DesktopPreferences } from './desktop'
import type {
  ConnectionInput,
  ConnectionSummary,
  ConnectionProfile,
} from './connection'
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
  desktop: {
    preferences: DesktopPreferences
    trayAvailable: boolean
    warning: boolean
    platform: NodeJS.Platform
  }
  exportJob?: ExportStatus
  exportRecovery?: 'none' | 'cleaned' | 'manual'
  sessions: SessionSummary[]
  stats: { cacheBytes: number; diskBytes: number; evicted: number }
}
export type MessageDetail = {
  kafka?: import('./kafka').KafkaProvenance
  offset?: number
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
  exportCapture(id: string, format: ExportFormat): Promise<ExportStatus | null>
  cancelExport(id: string): Promise<void>
  deleteCapture(id: string): Promise<void>
  exportConfiguration(
    password: string,
    includeSecrets: boolean,
  ): Promise<boolean>
  previewConfiguration(password: string): Promise<ImportPreview | null>
  applyConfiguration(token: string, mode: ImportMode): Promise<void>
  discardConfiguration(): Promise<void>
  saveDesktopPreferences(input: DesktopPreferences): Promise<void>
  getStatus(): Promise<AppStatus>
  getState(): Promise<State>
  getConnection(id: string): Promise<ConnectionProfile>
  listRoutingBindings(id: string): Promise<Binding[]>
  saveConnection(input: ConnectionInput): Promise<ConnectionSummary>
  testConnection(
    id: string,
  ): Promise<{ protocol: EndpointStatus; management: EndpointStatus }>
  listResources(
    id: string,
    query: string,
    page: number,
    filter?: ResourceFilter,
  ): Promise<ResourcePage>
  getPartitions(
    id: string,
    resource: ResourceRef,
  ): Promise<import('./kafka').KafkaPartition[]>
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
    order?: 'asc' | 'desc',
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
