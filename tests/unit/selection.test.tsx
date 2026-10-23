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
    desktop: {
      preferences: { schemaVersion: 1, closeToTray: false, locale: 'en' },
      trayAvailable: false,
      warning: false,
      platform: 'darwin',
    },
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
  fireEvent.click(await screen.findByRole('option', { name: /route-a/ }))
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
it('disables language changes while a background preference save is pending', async () => {
  let finish!: () => void
  state.desktop.preferences.closeToTray = true
  bridge.saveDesktopPreferences = (preferences) =>
    new Promise((resolve) => {
      finish = () => {
        state.desktop.preferences = preferences
        resolve()
      }
    })
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Settings' }))
  fireEvent.click(screen.getByLabelText('Keep running when the window closes'))
  const language = screen.getByRole('combobox', {
    name: /Language/,
  }) as HTMLSelectElement
  expect(language.disabled).toBe(true)
  await act(async () => finish())
  await waitFor(() => expect(language.disabled).toBe(false))
  expect(state.desktop.preferences.closeToTray).toBe(false)
})

function kafkaBrowse() {
  state.profiles[1].provider = 'kafka'
  const topic = { name: 'topic-a', vhost: '', kind: 'topic' as const }
  bridge.listResources = async (id) => ({
    resources: id === 'profile-b' ? [topic] : [resource('queue-a')],
    page: 1,
    hasMore: false,
  })
  bridge.getPartitions = async () =>
    [0, 1].map((partition) => ({ partition, first: '0', end: '10', leader: 1 }))
  return topic
}
it('restores the actual partition subset when reopening an active topic', async () => {
  const topic = kafkaBrowse()
  state.sessions.push({
    ...session('kafka-active', 'topic-a'),
    connectionId: 'profile-b',
    provider: 'kafka',
    resource: topic,
    state: 'capturing',
    kafkaPositions: [
      { partition: 1, first: '0', end: '10', leader: 1, start: '4', next: '7' },
    ],
  })
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Connection B' }))
  fireEvent.click(await screen.findByRole('button', { name: 'topic topic-a' }))
  await waitFor(() =>
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Partition 1',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true),
  )
  expect(
    (screen.getByRole('checkbox', { name: 'Partition 0' }) as HTMLInputElement)
      .checked,
  ).toBe(false)
  expect(
    (screen.getByLabelText('Kafka offset 1') as HTMLInputElement).value,
  ).toBe('4')
})
it('resets provider-specific filters when switching connections in either direction', async () => {
  kafkaBrowse()
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Connection B' }))
  await screen.findByRole('button', { name: 'topic topic-a' })
  fireEvent.click(screen.getByRole('button', { name: 'Topics' }))
  fireEvent.click(screen.getByRole('button', { name: 'Connection A' }))
  await screen.findByRole('button', { name: 'queue queue-a' })
  fireEvent.click(screen.getByRole('button', { name: 'Queues' }))
  fireEvent.click(screen.getByRole('button', { name: 'Connection B' }))
  await screen.findByRole('button', { name: 'topic topic-a' })
})

it('clears the previous payload while another selected message is pending or fails', async () => {
  bridge.readMessages = async () => ({
    records: [1, 2].map((id) => ({
      id,
      timestamp: 0,
      bytes: 10,
      routingKey: 'message-' + id,
      exchange: '',
      preview: 'synthetic',
    })),
    nextCursor: null,
  })
  let reject!: (error: Error) => void
  bridge.readMessage = async (id) => {
    if (id === 2)
      return new Promise((_resolve, fail) => {
        reject = fail
      })
    return {
      id,
      payload: btoa('payload from A'),
      headers: {},
      bytes: 14,
      previewLimit: 1024,
      truncated: false,
      routingKey: 'message-1',
      exchange: '',
      timestamp: 0,
    }
  }
  await browseA()
  fireEvent.click(screen.getByRole('button', { name: /queue-a.*stopped/i }))
  fireEvent.click(await screen.findByRole('option', { name: /message-1/ }))
  expect(await screen.findByText('payload from A')).toBeTruthy()
  fireEvent.click(screen.getByRole('option', { name: /message-2/ }))
  expect(screen.queryByText('payload from A')).toBeNull()
  await act(async () => reject(Error('Record evicted')))
  expect(screen.queryByText('payload from A')).toBeNull()
  expect(
    screen.getByRole('option', { selected: true, name: /message-2/ })
      .textContent,
  ).toContain('message-2')
})
