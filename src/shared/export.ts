import { z } from 'zod'
export const exportFormatSchema = z.enum(['jsonl', 'folder', 'zip'])
export type ExportFormat = z.infer<typeof exportFormatSchema>
export type ExportStatus = {
  id: string
  sessionId: string
  format: ExportFormat
  state: 'running' | 'cancelling' | 'complete' | 'cancelled' | 'failed'
  recordsWritten: number
  expectedRecords: number
  missingRecords: number
  bytesWritten: number
  peakRecordBytes: number
  error?: string
}
