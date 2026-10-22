import { it, expect, vi } from 'vitest'
const handlers = new Map<string, (...args: any[]) => Promise<any>>()
vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: (name: string) => handlers.delete(name),
    handle: (name: string, handler: (...args: any[]) => Promise<any>) =>
      handlers.set(name, handler),
  },
}))
import { registerOperations } from '../../src/main/ipc'
it('rejects other windows and malformed renderer operations before invoking privileged code', async () => {
  const frame = {},
    webContents = { mainFrame: frame },
    window = { webContents } as any
  let writes = 0
  registerOperations(window, {
    saveConnection: () => {
      writes++
    },
  })
  const handler = handlers.get('qc:saveConnection')!
  await expect(handler({ sender: {}, senderFrame: frame }, {})).rejects.toThrow(
    'Untrusted sender',
  )
  await expect(
    handler({ sender: webContents, senderFrame: {} }, {}),
  ).rejects.toThrow('Untrusted sender')
  await expect(
    handler({ sender: webContents, senderFrame: frame }, { name: 'broken' }),
  ).rejects.toThrow()
  expect(writes).toBe(0)
})
