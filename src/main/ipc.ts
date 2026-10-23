import { resourceFilterSchema } from '../shared/resource-filter'
import { kafkaSelectionSchema } from '../shared/kafka'
import { exportFormatSchema } from '../shared/export'
import { passwordSchema, importModeSchema } from '../shared/transfer'
import { desktopPreferencesSchema } from '../shared/desktop'
import { ipcMain, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { connectionSchema } from '../shared/connection'
import { settingsSchema } from '../shared/limits'
const id = z.string().min(1).max(100),
  page = z.number().int().min(1).max(100000)
const resource = z
  .object({
    name: z.string().max(255),
    vhost: z.string().max(255),
    kind: z.enum(['queue', 'exchange', 'stream', 'topic']),
    type: z.string().max(64).optional(),
    messages: z.number().optional(),
    partitions: z.number().int().min(0).max(10000).optional(),
  })
  .strict()
const limits = z
  .object({
    cacheBytes: z.number().optional(),
    diskBytes: z.number().optional(),
    retentionMs: z.number().optional(),
    maxPayloadBytes: z.number().optional(),
    previewBytes: z.number().optional(),
    admittedMessagesPerSecond: z.number().nullable().optional(),
  })
  .strict()
export const operationSchemas = {
  exportCapture: z.tuple([id, exportFormatSchema]),
  cancelExport: z.tuple([z.string().uuid()]),
  deleteCapture: z.tuple([id]),
  exportConfiguration: z.tuple([passwordSchema, z.boolean()]),
  previewConfiguration: z.tuple([passwordSchema]),
  applyConfiguration: z.tuple([z.string().uuid(), importModeSchema]),
  discardConfiguration: z.tuple([]),
  saveDesktopPreferences: z.tuple([desktopPreferencesSchema]),
  getStatus: z.tuple([]),
  getState: z.tuple([]),
  getConnection: z.tuple([id]),
  listRoutingBindings: z.tuple([id]),
  saveConnection: z.tuple([connectionSchema]),
  testConnection: z.tuple([id]),
  listResources: z.tuple([
    id,
    z.string().max(255),
    page,
    resourceFilterSchema.optional(),
  ]),
  getBindings: z.tuple([id, resource]),
  getPartitions: z.tuple([id, resource]),
  startCapture: z.tuple([
    id,
    resource,
    z
      .object({
        captureId: id.optional(),
        allowPartial: z.boolean(),
        bindingKeys: z.array(z.string().max(65536)).max(256).optional(),
        manualRoutes: z
          .array(
            z
              .object({
                source: z.string().min(1).max(255),
                routingKey: z.string().max(255),
              })
              .strict(),
          )
          .max(64)
          .optional(),
        kafkaPartitions: kafkaSelectionSchema.optional(),
        limits: limits.optional(),
        streamStart: z
          .union([
            z.literal('first'),
            z.literal('next'),
            z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
          ])
          .optional(),
      })
      .strict(),
  ]),
  stopCapture: z.tuple([id]),
  readMessages: z.tuple([
    id,
    z.number().int().positive().nullable(),
    z.enum(['asc', 'desc']).optional(),
  ]),
  readMessage: z.tuple([z.number().int().positive()]),
  readPayloadChunk: z.tuple([
    z.number().int().positive(),
    z
      .number()
      .int()
      .min(0)
      .max(64 * 1024 * 1024),
  ]),
  previewSettings: z.tuple([settingsSchema]),
  saveSettings: z.tuple([settingsSchema, z.boolean()]),
}
export function registerOperations(
  window: BrowserWindow,
  handlers: Record<string, (...args: any[]) => unknown>,
) {
  let inFlight = 0
  for (const [name, schema] of Object.entries(operationSchemas)) {
    ipcMain.removeHandler('qc:' + name)
    ipcMain.handle('qc:' + name, async (event, ...args) => {
      if (
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw Error('Untrusted sender')
      if (inFlight >= 16) throw Error('Too many pending operations')
      inFlight++
      try {
        return await handlers[name](...schema.parse(args))
      } catch (error) {
        if ((error as Error).message === 'CONFIRM_SETTINGS_EFFECTS')
          throw Error('CONFIRM_SETTINGS_EFFECTS', { cause: error })
        throw Error(
          'Operation failed. Check connection, permissions, storage and input.',
          { cause: error },
        )
      } finally {
        inFlight--
      }
    })
  }
}
