export type ResourceRef = {
  name: string
  vhost: string
  kind: 'queue' | 'stream' | 'exchange' | 'topic'
  type?: string
  partitions?: number
  messages?: number
}
export type ResourcePage = {
  resources: ResourceRef[]
  page: number
  hasMore: boolean
}
export type EndpointStatus = { ok: boolean; code?: string }
export type Binding = {
  source: string
  destination: string
  routing_key: string
  arguments: Record<string, unknown>
  type: string
  supported: boolean
}
export interface Provider {
  readonly capabilities: {
    readonly label: string
    readonly resourceKinds: readonly string[]
    readonly bindings: boolean
    readonly partitions: boolean
  }
  test(): Promise<{ protocol: EndpointStatus; management: EndpointStatus }>
  listResources(query: string, page: number): Promise<ResourcePage>
  bindings(queue: string): Promise<Binding[]>
}
