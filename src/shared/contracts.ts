export type AppStatus = { service: 'ready' | 'failed' }
export interface DesktopApi { getStatus(): Promise<AppStatus> }
declare global { interface Window { queuecumber: DesktopApi } }
