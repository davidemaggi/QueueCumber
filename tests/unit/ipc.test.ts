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

it('bounds privileged concurrency and redacts secret-bearing failures', async () => {
  const frame = {},
    webContents = { mainFrame: frame },
    event = { sender: webContents, senderFrame: frame }
  const releases: (() => void)[] = []
  registerOperations({ webContents } as any, {
    getState: () => new Promise<void>((resolve) => releases.push(resolve)),
    testConnection: () => {
      throw Error('amqps://private:secret@example.test')
    },
  })
  const invoke = handlers.get('qc:getState')!
  const pending = Array.from({ length: 16 }, () => invoke(event))
  await expect(invoke(event)).rejects.toThrow('Too many pending operations')
  releases.forEach((resolve) => resolve())
  await Promise.all(pending)
  await expect(handlers.get('qc:testConnection')!(event, 'id')).rejects.toThrow(
    'Operation failed. Check connection, permissions, storage and input.',
  )
})
