// @vitest-environment jsdom
import { beforeAll, beforeEach, afterEach, it, expect, vi } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from '@testing-library/react'
import type { ComponentType } from 'react'
import type {
  DesktopApi,
  State,
  MessageDetail,
} from '../../src/shared/contracts'
import type { SessionSummary } from '../../src/service/sessions'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
const bridge = {} as DesktopApi
let App: ComponentType
const resource = (name: string) => ({
  name,
  vhost: '/',
  kind: 'queue' as const,
})
const binding = (name: string) => ({
  source: 'exchange-' + name,
  destination: name,
  routing_key: name,
  arguments: {},
  type: 'direct',
  supported: true,
})
const session = (id: string, name: string): SessionSummary => ({
  id,
  connectionId: 'profile-a',
  resource: resource(name),
  state: 'stopped',
  captured: 1,
  omitted: 0,
  gaps: 0,
  startedAt: Date.now(),
  bindings: [binding(name)],
  potentialOverflow: true,
})
let state: State
beforeAll(async () => {
  window.queuecumber = bridge
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  App = (await import('../../src/renderer/App')).default
})
beforeEach(() => {
  localStorage.clear()
  state = {
    profiles: [
      { id: 'profile-a', name: 'Connection A', provider: 'rabbitmq' },
      { id: 'profile-b', name: 'Connection B', provider: 'rabbitmq' },
    ],
    settings: { ...DEFAULT_SETTINGS },
    storageMode: 'session',
    sessions: [
      session('history-a', 'queue-a'),
      session('history-b', 'queue-b'),
    ],
    stats: { cacheBytes: 0, diskBytes: 0, evicted: 0 },
  }
  Object.assign(bridge, {
    getState: async () => structuredClone(state),
    getStatus: async () => ({ service: 'ready' }),
    listResources: async () => ({
      resources: [resource('queue-a'), resource('queue-b')],
      page: 1,
      hasMore: false,
    }),
    getBindings: async (_id: string, r: { name: string }) => [binding(r.name)],
    readMessages: async (id: string) => ({
      records: [
        {
          id: id === 'history-a' ? 1 : 2,
          timestamp: Date.now(),
          bytes: 9,
          routingKey: id === 'history-a' ? 'route-a' : 'route-b',
          exchange: 'e',
          preview: 'pending',
        },
      ],
      nextCursor: null,
    }),
  })
})
afterEach(cleanup)
async function browseA() {
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Connection A' }))
  await screen.findByRole('button', { name: 'queue queue-a' })
}
it('keeps a late capture start attached to its original queue', async () => {
  let resolve!: (s: SessionSummary) => void
  bridge.startCapture = () =>
    new Promise((r) => {
      resolve = r
    })
  await browseA()
  fireEvent.click(screen.getByRole('button', { name: 'queue queue-a' }))
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Start capture' })
        .hasAttribute('disabled'),
    ).toBe(false),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Start capture' }))
  fireEvent.click(screen.getByRole('button', { name: 'queue queue-b' }))
  const capture = {
    ...session('new-a', 'queue-a'),
    state: 'capturing' as const,
  }
  state.sessions.push(capture)
  await act(async () => resolve(capture))
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'queue-b' })).toBeTruthy(),
  )
  expect(document.querySelector('.session-state')?.textContent).toBe('—')
})
it('discards a message response after changing connection', async () => {
  let resolve!: (m: MessageDetail) => void
  bridge.readMessage = () =>
    new Promise((r) => {
      resolve = r
    })
  await browseA()
  fireEvent.click(screen.getByRole('button', { name: /queue-a.*stopped/i }))
  fireEvent.click(await screen.findByRole('button', { name: /route-a/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Connection B' }))
  await act(async () =>
    resolve({
      id: 1,
      payload: btoa('private-a'),
      headers: {},
      bytes: 9,
      previewLimit: 1024,
      truncated: false,
      routingKey: 'route-a',
      exchange: 'e',
      timestamp: Date.now(),
    }),
  )
  expect(document.querySelector('pre')?.textContent ?? '').not.toContain(
    'private-a',
  )
})
it('discards pending bindings after selecting a history session', async () => {
  let resolve!: (value: ReturnType<typeof binding>[]) => void
  bridge.getBindings = () =>
    new Promise((r) => {
      resolve = r
    })
  await browseA()
  fireEvent.click(screen.getByRole('button', { name: 'queue queue-a' }))
  fireEvent.click(screen.getByRole('button', { name: /queue-b.*stopped/i }))
  expect(await screen.findByText('exchange-queue-b')).toBeTruthy()
  await act(async () => resolve([binding('queue-a')]))
  expect(screen.queryByText('exchange-queue-a')).toBeNull()
})
it('shows the reconnected session binding snapshot, retained range and capture time', async () => {
  const s = state.sessions[0]
  s.state = 'capturing'
  s.bindingChanged = true
  s.bindings = [binding('changed-route')]
  s.retained = { count: 1, first: 1000, last: 2000 }
  await browseA()
  fireEvent.click(screen.getByRole('button', { name: /queue-a.*capturing/i }))
  expect(await screen.findByText('exchange-changed-route')).toBeTruthy()
  expect(screen.getByText(/Bindings changed during reconnect/)).toBeTruthy()
  expect(screen.getByText(/Current capture started/).textContent).toContain(
    '1 retained',
  )
})
