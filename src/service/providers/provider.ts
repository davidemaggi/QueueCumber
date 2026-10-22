export type ResourceRef={name:string;vhost:string;kind:'queue'|'stream'|'exchange';type?:string;messages?:number}
export type ResourcePage={resources:ResourceRef[];page:number;hasMore:boolean}
export type EndpointStatus={ok:boolean;code?:string}
export type Binding={source:string;destination:string;routing_key:string;arguments:Record<string,unknown>;type:string;supported:boolean}
export interface Provider {test():Promise<{protocol:EndpointStatus;management:EndpointStatus}>;listResources(query:string,page:number):Promise<ResourcePage>;bindings(queue:string):Promise<Binding[]>}
