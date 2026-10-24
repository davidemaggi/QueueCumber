import type { ResourceFilter } from '../shared/resource-filter'
import { bindingKey } from '../shared/routes'
import { KafkaPartitions } from './components/KafkaPartitions'
import brandMark from '../../resources/branding/mark.svg'
import {
  kafkaSelectionSchema,
  type KafkaPartition,
  type KafkaSelection,
} from '../shared/kafka'
import { PROVIDER_CAPABILITIES } from '../shared/providers'
import packageInfo from '../../package.json'
const { version } = packageInfo
const releaseName =
  'releaseName' in packageInfo && typeof packageInfo.releaseName === 'string'
    ? packageInfo.releaseName
    : undefined
import type { ConnectionProfile } from '../shared/connection'
import { CaptureTools } from './components/CaptureTools'
import {
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  Plus,
  Settings as SettingsIcon,
  Network,
  Search,
  RefreshCw,
  Play,
  Square,
  ArrowRight,
  Database,
  ChevronRight,
  Radio,
} from 'lucide-react'
import type { DesktopPreferences } from '../shared/desktop'
import type { State, MessageDetail } from '../shared/contracts'
import type { ResourceRef, Binding } from '../service/providers/provider'
import type { MessageSummary } from '../service/storage'
import { translator, type Locale } from './i18n'
import { ConnectionForm } from './components/ConnectionForm'
import { Settings } from './components/Settings'
import { MessageList, MessageView } from './components/Messages'
import { EasterEgg, VersionButton } from './components/EasterEgg'
const api = window.queuecumber
const bytes = (n: number) =>
  n >= 1024 ** 2
    ? `${(n / 1024 ** 2).toFixed(1)} MiB`
    : `${(n / 1024).toFixed(1)} KiB`
export default function App() {
  const [state, setState] = useState<State | null>(null),
    [locale, setLocale] = useState<Locale>(() =>
      localStorage.getItem('qc.locale') === 'it' ? 'it' : 'en',
    ),
    [theme, setTheme] = useState(
      () => localStorage.getItem('qc.theme') || 'system',
    )
  const [screen, setScreen] = useState<'inspect' | 'settings'>('inspect'),
    [form, setForm] = useState(false),
    [easterEgg, setEasterEgg] = useState(false),
    [deletingConnection, setDeletingConnection] = useState(''),
    [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(
      null,
    ),
    [connection, setConnection] = useState(''),
    [resource, setResource] = useState<ResourceRef | null>(null)
  const [resources, setResources] = useState<ResourceRef[]>([]),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState('all'),
    [resourcePage, setResourcePage] = useState(1),
    [hasMore, setHasMore] = useState(false),
    [nextResourcePage, setNextResourcePage] = useState(2)
  const [bindings, setBindings] = useState<Binding[]>([]),
    [bindingReady, setBindingReady] = useState(false),
    [sessionId, setSessionId] = useState('')
  const [rows, setRows] = useState<MessageSummary[]>([]),
    [cursor, setCursor] = useState<number | null>(null),
    [nextCursor, setNextCursor] = useState<number | null>(null),
    [message, setMessage] = useState<MessageDetail | null>(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [fatal, setFatal] = useState(false),
    [notice, setNotice] = useState(''),
    [sessionCache, setSessionCache] = useState(''),
    [sessionDisk, setSessionDisk] = useState(''),
    [sessionRate, setSessionRate] = useState('')
  const [resourceRevision, setResourceRevision] = useState(0)
  const [messageOrder, setMessageOrder] = useState<'asc' | 'desc'>('desc')
  const [messageFilter, setMessageFilter] = useState('all')
  const [routeKeys, setRouteKeys] = useState<string[]>([])
  const [manualRoutes, setManualRoutes] = useState<
    { source: string; routingKey: string }[]
  >([])
  const [manualSource, setManualSource] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [routingBindings, setRoutingBindings] = useState<Binding[]>([])
  const [routingLoading, setRoutingLoading] = useState(false)
  const routingGroups = useMemo(() => {
    const groups = new Map<string, Binding[]>()
    const seen = new Set<string>()
    for (const binding of routingBindings) {
      const identity = JSON.stringify([
        binding.source,
        binding.destination,
        binding.routing_key,
      ])
      if (seen.has(identity)) continue
      seen.add(identity)
      const group = groups.get(binding.routing_key) ?? []
      group.push(binding)
      groups.set(binding.routing_key, group)
    }
    return [...groups]
      .filter(([key]) => key.toLowerCase().includes(query.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b))
  }, [routingBindings, query])
  const [paneWidth, setPaneWidth] = useState(() =>
    Math.min(
      480,
      Math.max(200, Number(localStorage.getItem('qc.resourceWidth')) || 280),
    ),
  )
  useEffect(() => {
    localStorage.setItem('qc.resourceWidth', String(paneWidth))
  }, [paneWidth])
  useEffect(() => {
    if (!connection || kind !== 'routingKeys') return
    let cancelled = false
    setRoutingBindings([])
    setRoutingLoading(true)
    void api
      .listRoutingBindings(connection)
      .then((rows) => {
        if (!cancelled) setRoutingBindings(rows)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setRoutingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [connection, kind, resourceRevision])
  const [streamChoice, setStreamChoice] = useState<'first' | 'next' | 'offset'>(
      'next',
    ),
    [streamOffset, setStreamOffset] = useState('')
  const [partitions, setPartitions] = useState<KafkaPartition[]>([]),
    [kafkaSelection, setKafkaSelection] = useState<KafkaSelection>([])
  const chosenProvider =
    state?.profiles.find((p) => p.id === connection)?.provider ??
    state?.sessions.find((s) => s.id === sessionId)?.provider ??
    'rabbitmq'
  const connectionExists = !!state?.profiles.some((p) => p.id === connection)
  const capabilities = PROVIDER_CAPABILITIES[chosenProvider]
  const desktopLocaleLoaded = useRef(false)
  const selection = useRef(0),
    messageSelection = useRef(0),
    t = translator(locale)
  const refresh = useCallback(async () => {
    try {
      const next = await api.getState()
      setState(next)
      if (!desktopLocaleLoaded.current) {
        desktopLocaleLoaded.current = true
        setLocale(next.desktop.preferences.locale)
      }
      setFatal(false)
    } catch {
      setFatal(true)
    }
  }, [])
  useEffect(() => {
    let cancelled = false,
      timer: ReturnType<typeof setTimeout>
    async function tick() {
      await refresh()
      if (!cancelled) timer = setTimeout(() => void tick(), 1000)
    }
    void tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [refresh])
  useEffect(() => {
    localStorage.setItem('qc.locale', locale)
    document.documentElement.lang = locale
  }, [locale])
  useEffect(() => {
    localStorage.setItem('qc.theme', theme)
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  useEffect(() => {
    if (!connection || !connectionExists) return
    let cancelled = false
    const timer = setTimeout(() => {
      void api
        .listResources(connection, query, resourcePage, {
          kind: (kind === 'routingKeys'
            ? 'all'
            : kind) as ResourceFilter['kind'],
          messages: messageFilter as ResourceFilter['messages'],
        })
        .then((p) => {
          if (!cancelled) {
            setResources(p.resources)
            setHasMore(p.hasMore)
            setNextResourcePage(p.page + 1)
          }
        })
        .catch(() => {
          if (!cancelled) setError(true)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    connection,
    connectionExists,
    query,
    resourcePage,
    resourceRevision,
    kind,
    messageFilter,
  ])
  useEffect(() => {
    if (!sessionId) {
      setRows([])
      return
    }
    let cancelled = false,
      timer: ReturnType<typeof setTimeout>
    async function tick() {
      try {
        const page = await api.readMessages(sessionId, cursor, messageOrder)
        if (!cancelled) {
          setRows(page.records)
          setNextCursor(page.nextCursor)
        }
      } catch {
        if (!cancelled) setError(true)
      }
      if (!cancelled) timer = setTimeout(() => void tick(), 1000)
    }
    void tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sessionId, cursor, messageOrder])
  async function run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    setBusy(true)
    setError(false)
    setNotice('')
    try {
      return await operation()
    } catch {
      setError(true)
      return undefined
    } finally {
      setBusy(false)
    }
  }
  async function saveDesktop(preferences: DesktopPreferences) {
    await run(async () => {
      await api.saveDesktopPreferences(preferences)
      setLocale(preferences.locale)
      await refresh()
    })
  }
  async function chooseResource(r: ResourceRef, onlyKey?: string) {
    const token = ++selection.current
    setResource(r)
    setBindings([])
    setRouteKeys([])
    setManualRoutes([])
    setManualSource('')
    setManualKey('')
    setBindingReady(false)
    setStreamChoice('next')
    setStreamOffset('')
    setMessage(null)
    messageSelection.current++
    setCursor(null)
    setRows([])
    setNextCursor(null)
    setSessionCache('')
    setSessionDisk('')
    setSessionRate('')
    const existing = state?.sessions
      .slice()
      .reverse()
      .find(
        (s) =>
          s.connectionId === connection &&
          s.resource.name === r.name &&
          s.resource.kind === r.kind &&
          s.resource.vhost === r.vhost,
      )
    if (existing?.streamStart !== undefined) {
      setStreamChoice(
        typeof existing.streamStart === 'number'
          ? 'offset'
          : existing.streamStart,
      )
      setStreamOffset(
        typeof existing.streamStart === 'number'
          ? String(existing.streamStart)
          : '',
      )
    }
    setSessionId(existing?.id ?? '')
    setManualRoutes(existing?.options?.manualRoutes ?? [])
    setPartitions([])
    setKafkaSelection([])
    if (r.kind === 'topic') {
      try {
        const p = await api.getPartitions(connection, r)
        if (token === selection.current) {
          setPartitions(p)
          setKafkaSelection(
            existing?.options?.kafkaPartitions ??
              existing?.kafkaPositions?.map((p) => ({
                partition: p.partition,
                from: p.start,
              })) ??
              p
                .slice(0, 128)
                .map((p) => ({ partition: p.partition, from: 'next' })),
          )
        }
      } catch {
        if (token === selection.current) setError(true)
      }
      return
    }
    if (r.kind !== 'queue') return
    try {
      const b = await api.getBindings(connection, r)
      if (token === selection.current) {
        setBindings(b)
        setRouteKeys(
          onlyKey !== undefined
            ? b
                .filter(
                  (route) => route.supported && route.routing_key === onlyKey,
                )
                .map(bindingKey)
            : (existing?.options?.bindingKeys ??
                b.filter((route) => route.supported).map(bindingKey)),
        )
        setBindingReady(true)
      }
    } catch {
      if (token === selection.current) setError(true)
    }
  }
  const session = state?.sessions.find((s) => s.id === sessionId),
    active =
      session &&
      ['capturing', 'connecting', 'reconnecting'].includes(session.state)
  const validStreamOffset =
    streamOffset.trim() !== '' &&
    Number.isSafeInteger(Number(streamOffset)) &&
    Number(streamOffset) >= 0
  const shownBindings = active ? session.bindings : bindings
  const shownResources = resources.filter(
    (r) =>
      (kind === 'all' || r.kind === kind) &&
      (messageFilter === 'all' ||
        (r.messages !== undefined &&
          (messageFilter === 'empty' ? r.messages === 0 : r.messages > 0))),
  )
  async function start() {
    if (!resource) return
    const token = selection.current
    await run(async () => {
      const limits = {
        ...(sessionCache
          ? { cacheBytes: Math.round(Number(sessionCache) * 1024 ** 2) }
          : {}),
        ...(sessionDisk
          ? { diskBytes: Math.round(Number(sessionDisk) * 1024 ** 2) }
          : {}),
        ...(sessionRate
          ? { admittedMessagesPerSecond: Number(sessionRate) }
          : {}),
      }
      const s = await api.startCapture(connection, resource, {
        ...(sessionId ? { captureId: sessionId } : {}),
        ...(resource.kind === 'queue'
          ? { bindingKeys: routeKeys, manualRoutes }
          : {}),
        allowPartial: false,
        limits,
        ...(resource.kind === 'topic'
          ? { kafkaPartitions: kafkaSelection }
          : {}),
        ...(resource.kind === 'stream'
          ? {
              streamStart:
                streamChoice === 'offset' ? Number(streamOffset) : streamChoice,
            }
          : {}),
      })
      if (token === selection.current) {
        setSessionId(s.id)
        setCursor(null)
      }
      await refresh()
    })
  }
  async function selectMessage(id: number) {
    setMessage(null)
    const token = ++messageSelection.current
    await run(async () => {
      const detail = await api.readMessage(id)
      if (token === messageSelection.current) setMessage(detail)
    })
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src={brandMark} alt="" width={32} height={32} />
          <strong>QueueCumber</strong>
        </div>
        <nav className="main-nav" aria-label={t('workspace')}>
          <button
            aria-pressed={screen === 'inspect'}
            className={screen === 'inspect' ? 'active' : ''}
            onClick={() => setScreen('inspect')}
          >
            <Network size={17} />
            {t('inspect')}
          </button>
          <button
            aria-pressed={screen === 'settings'}
            className={screen === 'settings' ? 'active' : ''}
            onClick={() => {
              setScreen('settings')
              setForm(false)
            }}
          >
            <SettingsIcon size={17} />
            {t('settings')}
          </button>
        </nav>
        <div className="sidebar-heading">
          <h2>{t('connections')}</h2>
          <button
            className="icon-button"
            aria-label={t('addConnection')}
            title={t('addConnection')}
            onClick={() => {
              setEditingProfile(null)
              setForm(true)
              setScreen('inspect')
            }}
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="connection-list">
          {state?.profiles.map((p) => (
            <button
              className={
                connection === p.id ? 'connection selected' : 'connection'
              }
              title={p.name}
              aria-label={p.name}
              key={p.id}
              onClick={() => {
                selection.current++
                messageSelection.current++
                setNextCursor(null)
                setKind('all')
                setMessageFilter('all')
                setDeletingConnection('')
                setConnection(p.id)
                setResource(null)
                setRows([])
                setSessionId('')
                setMessage(null)
                setResources([])
                setQuery('')
                setResourcePage(1)
                setScreen('inspect')
                setForm(false)
              }}
            >
              <Database size={15} />
              <span>
                {p.name}
                <small>{PROVIDER_CAPABILITIES[p.provider].label}</small>
              </span>
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
        <div className="sidebar-heading">
          <h2>{t('sessionHistory')}</h2>
          <span className="muted num">{state?.sessions.length ?? 0}</span>
        </div>
        <div className="session-list">
          {state?.sessions.length ? (
            state.sessions
              .slice()
              .reverse()
              .map((s) => (
                <button
                  key={s.id}
                  className={sessionId === s.id ? 'selected' : ''}
                  onClick={() => {
                    selection.current++
                    messageSelection.current++
                    setRows([])
                    setNextCursor(null)
                    setKind('all')
                    setDeletingConnection('')
                    setResources([])
                    setConnection(s.connectionId)
                    setResource(s.resource)
                    setStreamChoice(
                      typeof s.streamStart === 'number'
                        ? 'offset'
                        : (s.streamStart ?? 'next'),
                    )
                    setStreamOffset(
                      typeof s.streamStart === 'number'
                        ? String(s.streamStart)
                        : '',
                    )
                    setPartitions(s.kafkaPositions ?? [])
                    setKafkaSelection(
                      s.options?.kafkaPartitions ??
                        s.kafkaPositions?.map((p) => ({
                          partition: p.partition,
                          from: p.start,
                        })) ??
                        [],
                    )
                    setBindings(s.bindings)
                    setRouteKeys(
                      s.options?.bindingKeys ??
                        s.bindings.filter((b) => b.supported).map(bindingKey),
                    )
                    setManualRoutes(s.options?.manualRoutes ?? [])
                    setBindingReady(true)
                    setSessionId(s.id)
                    setCursor(null)
                    setMessage(null)
                    setScreen('inspect')
                    setForm(false)
                  }}
                >
                  <span className={'status-dot ' + s.state} />
                  <span className="ellipsis mono">{s.resource.name}</span>
                  <small>{t(s.state)}</small>
                </button>
              ))
          ) : (
            <p className="muted small">{t('noSessions')}</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <p>
            {t(
              state?.desktop.preferences.closeToTray
                ? 'closeBehaviorBackground'
                : 'closeBehaviorQuit',
            )}
          </p>
          <VersionButton
            label={version + (releaseName ? ` · ${releaseName}` : '')}
            onUnlock={() => setEasterEgg(true)}
          />
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="muted">{capabilities.label}</span>
            <ChevronRight size={13} />
            <strong>
              {state?.profiles.find((p) => p.id === connection)?.name ??
                t('workspace')}
            </strong>
          </div>
          <span className="small muted">
            {state?.storageMode === 'secure'
              ? t('secureStorage')
              : t('sessionStorage')}
          </span>
        </header>
        {fatal ? (
          <div role="alert" className="notice error">
            {t('serviceError')}{' '}
            <button onClick={() => void refresh()}>{t('retry')}</button>
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="notice error">
            {t('error')}{' '}
            <button
              onClick={() => {
                setError(false)
                setResourceRevision((v) => v + 1)
                void refresh()
              }}
            >
              {t('retry')}
            </button>
          </div>
        ) : null}
        {notice ? (
          <div role="status" className="notice">
            {notice}
          </div>
        ) : null}
        {state?.exportRecovery && state.exportRecovery !== 'none' ? (
          <div role="status" className="notice">
            {t(
              state.exportRecovery === 'cleaned'
                ? 'exportRecoveryCleaned'
                : 'exportRecoveryManual',
            )}
          </div>
        ) : null}
        {state?.exportJob ? (
          <div role="status" className="notice export-progress">
            <span>
              {t(
                (
                  {
                    running: 'exportRunning',
                    cancelling: 'exportCancelling',
                    complete: 'exportComplete',
                    cancelled: 'exportCancelled',
                    failed: 'exportFailed',
                  } as const
                )[state.exportJob.state],
              )}{' '}
              · {state.exportJob.recordsWritten.toLocaleString()} /{' '}
              {state.exportJob.expectedRecords.toLocaleString()}
              {state.exportJob.missingRecords
                ? ` · ${state.exportJob.missingRecords} ${t('exportMissing')}`
                : ''}
            </span>
            {state.exportJob.error === 'EXPORT_CLEANUP_FAILED' ? (
              <p role="alert">{t('exportCleanupFailed')}</p>
            ) : null}
            {['running', 'cancelling'].includes(state.exportJob.state) ? (
              <button
                disabled={state.exportJob.state === 'cancelling'}
                onClick={() =>
                  void run(async () => {
                    await api.cancelExport(state.exportJob!.id)
                    await refresh()
                  })
                }
              >
                {t('cancelExport')}
              </button>
            ) : null}
          </div>
        ) : null}
        {state?.warning ? (
          <div role="alert" className="notice">
            {t(
              state.warning === 'HISTORY_STORAGE_FAILED'
                ? 'historyFailure'
                : 'invalidSettings',
            )}
          </div>
        ) : null}
        {screen === 'settings' && state ? (
          <Settings
            t={t}
            settings={state.settings}
            locale={locale}
            setLocale={(next) =>
              void saveDesktop({ ...state.desktop.preferences, locale: next })
            }
            desktop={state.desktop}
            onDesktopChange={saveDesktop}
            onConfigurationChanged={refresh}
            theme={theme}
            setTheme={setTheme}
            busy={busy}
            onSave={async (s, confirmed) => {
              await api.saveSettings(s, confirmed)
              await refresh()
              setNotice(t('limitsSaved'))
            }}
          />
        ) : form ? (
          <ConnectionForm
            key={editingProfile?.id ?? 'new'}
            initial={editingProfile}
            t={t}
            busy={busy}
            onClose={() => setForm(false)}
            onSave={async (input) => {
              await run(async () => {
                const saved = await api.saveConnection(input)
                selection.current++
                messageSelection.current++
                setConnection(saved.id)
                setKind('all')
                setResource(null)
                setSessionId('')
                setRows([])
                setMessage(null)
                setResources([])
                setQuery('')
                setResourcePage(1)
                setResourceRevision((value) => value + 1)
                await refresh()
                setForm(false)
              })
            }}
          />
        ) : !connection ? (
          <main className="welcome">
            <div className="welcome-content">
              <div className="connection-path" aria-hidden="true">
                <Database size={24} />
                <span />
                <Radio size={24} />
                <span />
                <Network size={24} />
              </div>
              <h1>{t('noConnections')}</h1>
              <p>{t('intro')}</p>
              <button
                className="primary"
                onClick={() => {
                  setEditingProfile(null)
                  setForm(true)
                }}
              >
                <Plus size={16} />
                {t('addConnection')}
              </button>
              <div className="welcome-note">
                <span>RabbitMQ</span>
                <ArrowRight size={14} />
                <span>{t('bindings')}</span>
                <ArrowRight size={14} />
                <span>{t('messages')}</span>
              </div>
            </div>
            {state?.storageMode === 'session' ? (
              <p className="session-disclaimer">{t('sessionHint')}</p>
            ) : null}
          </main>
        ) : (
          <main
            className="inspection"
            style={{ '--resource-width': `${paneWidth}px` } as CSSProperties}
          >
            <section className="resource-pane">
              <div className="pane-title">
                <h2>{t('resources')}</h2>
                <button
                  className="icon-button"
                  title={t('testConnection')}
                  aria-label={t('testConnection')}
                  disabled={busy || !connectionExists}
                  onClick={() =>
                    void run(async () => {
                      const result = await api.testConnection(connection)
                      setNotice(
                        result.protocol.ok && result.management.ok
                          ? t(
                              chosenProvider === 'kafka'
                                ? 'kafkaTestPassed'
                                : 'testPassed',
                            )
                          : `${t('testFailed')}: ${chosenProvider === 'kafka' ? 'Kafka' : t('protocol')} ${result.protocol.ok ? t('ok') : result.protocol.code}; ${chosenProvider === 'kafka' ? t('kafkaMetadata') : t('management')} ${result.management.ok ? t('ok') : result.management.code}`,
                      )
                    })
                  }
                >
                  <Network size={16} />
                </button>
              </div>
              <button
                className="text-button edit-connection"
                disabled={busy || !connectionExists}
                onClick={() => {
                  const token = selection.current
                  void run(async () => {
                    const profile = await api.getConnection(connection)
                    if (token !== selection.current) return
                    setEditingProfile(profile)
                    setForm(true)
                  })
                }}
              >
                {t('editConnection')}
              </button>
              <button
                className="text-button edit-connection"
                disabled={busy || !connectionExists}
                onClick={() => setDeletingConnection(connection)}
              >
                {t('deleteConnection')}
              </button>
              {deletingConnection === connection ? (
                <div
                  className="confirmation"
                  role="group"
                  aria-label={t('deleteConnection')}
                >
                  <p>
                    <strong>
                      {state?.profiles.find((p) => p.id === connection)?.name}
                    </strong>
                  </p>
                  <p>{t('deleteConnectionConfirm')}</p>
                  <div className="actions">
                    <button
                      disabled={busy}
                      onClick={() => setDeletingConnection('')}
                    >
                      {t('cancel')}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const id = deletingConnection
                          const token = selection.current
                          await api.deleteConnection(id)
                          setDeletingConnection('')
                          if (token === selection.current) {
                            selection.current++
                            messageSelection.current++
                            setConnection('')
                            setResource(null)
                            setSessionId('')
                            setResources([])
                            setRows([])
                            setMessage(null)
                          }
                          await refresh()
                        })
                      }
                    >
                      {t('confirmDeleteConnection')}
                    </button>
                  </div>
                </div>
              ) : null}
              {!connectionExists ? (
                <p className="small muted">{t('connectionRemoved')}</p>
              ) : null}
              <div className="resource-search">
                <Search size={15} />
                <input
                  placeholder={t('search')}
                  aria-label={t('search')}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setResourcePage(1)
                  }}
                />
              </div>
              <div className="resource-filters">
                <label>
                  {t('resourceType')}
                  <select
                    value={kind}
                    onChange={(e) => {
                      setKind(e.target.value)
                      setResourcePage(1)
                    }}
                  >
                    <option value="all">{t('allResources')}</option>
                    {chosenProvider === 'rabbitmq' ? (
                      <>
                        <option value="queue">{t('queues')}</option>
                        <option value="stream">{t('streams')}</option>
                        <option value="exchange">{t('exchanges')}</option>
                        <option value="routingKeys">{t('routingKeys')}</option>
                      </>
                    ) : (
                      <option value="topic">{t('topics')}</option>
                    )}
                  </select>
                </label>
                {chosenProvider === 'rabbitmq' && kind !== 'routingKeys' ? (
                  <label>
                    {t('messageFilter')}
                    <select
                      value={messageFilter}
                      onChange={(e) => {
                        setMessageFilter(e.target.value)
                        setResourcePage(1)
                      }}
                    >
                      <option value="all">{t('anyMessageCount')}</option>
                      <option value="nonempty">{t('withMessages')}</option>
                      <option value="empty">{t('withoutMessages')}</option>
                    </select>
                  </label>
                ) : null}
              </div>
              <div className="resource-list">
                {kind === 'routingKeys' ? (
                  routingLoading ? (
                    <p className="empty-line">{t('loading')}</p>
                  ) : !routingGroups.length ? (
                    <p className="empty-line">{t('noResults')}</p>
                  ) : (
                    routingGroups
                      .slice((resourcePage - 1) * 100, resourcePage * 100)
                      .map(([key, routes]) => (
                        <details className="routing-key-group" key={key}>
                          <summary className="mono" title={key}>
                            {key || t('emptyRoutingKey')}
                          </summary>
                          {routes.map((b, i) => (
                            <button
                              key={i}
                              title={`${b.source} → ${b.destination}`}
                              onClick={() =>
                                void chooseResource(
                                  {
                                    name: b.destination,
                                    vhost: b.vhost ?? '/',
                                    kind: b.destinationKind ?? 'queue',
                                  },
                                  key,
                                )
                              }
                            >
                              <span className="mono">
                                {b.source || t('defaultExchange')} →{' '}
                                {b.destination}
                              </span>
                            </button>
                          ))}
                        </details>
                      ))
                  )
                ) : shownResources.length ? (
                  shownResources.map((r) => (
                    <button
                      key={r.kind + ':' + r.name}
                      className={
                        'resource-row ' +
                        (resource?.name === r.name && resource.kind === r.kind
                          ? 'selected'
                          : '')
                      }
                      title={r.name || t('defaultExchange')}
                      aria-label={
                        t(r.kind) + ' ' + (r.name || t('defaultExchange'))
                      }
                      onClick={() => void chooseResource(r)}
                    >
                      <span className="resource-glyph">
                        <Database size={15} />
                      </span>
                      <span className="resource-name mono">
                        {r.name || t('defaultExchange')}
                        <small>
                          {t(r.kind)} · {r.type ?? '—'}
                        </small>
                      </span>
                      {r.messages !== undefined ? (
                        <span className="num small muted">
                          {r.messages.toLocaleString()}
                        </span>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <p className="empty-line">{t('noResults')}</p>
                )}
              </div>
              {(
                kind === 'routingKeys'
                  ? resourcePage * 100 < routingGroups.length
                  : hasMore
              ) ? (
                <button
                  onClick={() =>
                    setResourcePage(
                      kind === 'routingKeys'
                        ? resourcePage + 1
                        : nextResourcePage,
                    )
                  }
                >
                  {t('older')}
                </button>
              ) : null}
              {resourcePage > 1 ? (
                <button onClick={() => setResourcePage(1)}>
                  {t('refresh')}
                </button>
              ) : null}
            </section>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t('resizeResources')}
              aria-valuemin={200}
              aria-valuemax={480}
              aria-valuenow={paneWidth}
              tabIndex={0}
              className="pane-resizer"
              onKeyDown={(e) => {
                if (
                  ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)
                ) {
                  e.preventDefault()
                  setPaneWidth((w) =>
                    e.key === 'Home'
                      ? 200
                      : e.key === 'End'
                        ? 480
                        : Math.min(
                            480,
                            Math.max(
                              200,
                              w + (e.key === 'ArrowRight' ? 20 : -20),
                            ),
                          ),
                  )
                }
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  const left =
                    e.currentTarget.parentElement!.getBoundingClientRect().left
                  setPaneWidth(Math.min(480, Math.max(200, e.clientX - left)))
                }
              }}
            />
            <div className="capture-workspace">
              {!resource ? <p className="notice">{t('captureGuide')}</p> : null}
              <section
                className={
                  'capture-heading' +
                  (resource?.kind === 'topic' ? ' kafka-heading' : '')
                }
              >
                <div className="capture-title">
                  <div>
                    <h1 className="mono">
                      {resource?.name || t('chooseQueue')}
                    </h1>
                    <p className="muted">
                      {t(
                        resource?.kind === 'topic'
                          ? 'kafkaHint'
                          : resource?.kind === 'stream'
                            ? 'streamHint'
                            : 'bindingHint',
                      )}
                    </p>
                  </div>
                  {resource &&
                  (resource.kind === 'queue' ||
                    resource.kind === 'stream' ||
                    resource.kind === 'topic') ? (
                    <button
                      className={active ? '' : 'primary'}
                      disabled={
                        busy ||
                        !connectionExists ||
                        (!active &&
                          resource.kind === 'topic' &&
                          !kafkaSelectionSchema.safeParse(kafkaSelection)
                            .success) ||
                        (resource.kind === 'queue' &&
                          !active &&
                          (!bindingReady ||
                            (!routeKeys.length && !manualRoutes.length))) ||
                        (resource.kind === 'stream' &&
                          !active &&
                          streamChoice === 'offset' &&
                          !validStreamOffset)
                      }
                      onClick={() =>
                        void (active
                          ? run(async () => {
                              await api.stopCapture(sessionId)
                              await refresh()
                            })
                          : start())
                      }
                    >
                      {active ? <Square size={14} /> : <Play size={14} />}{' '}
                      {active ? t('stopCapture') : t('startCapture')}
                    </button>
                  ) : null}
                </div>
                {resource?.kind === 'topic' ? (
                  <KafkaPartitions
                    key={connection + resource.name}
                    t={t}
                    partitions={partitions}
                    value={kafkaSelection}
                    onChange={setKafkaSelection}
                    disabled={!!active || busy}
                    positions={session?.kafkaPositions}
                    topologyChanged={session?.kafkaTopologyChanged}
                  />
                ) : null}
                {session ? (
                  <CaptureTools
                    key={session.id}
                    t={t}
                    busy={busy}
                    exporting={
                      !!state?.exportJob &&
                      ['running', 'cancelling'].includes(state.exportJob.state)
                    }
                    onExport={async (format) => {
                      await run(async () => {
                        await api.exportCapture(session.id, format)
                        await refresh()
                      })
                    }}
                    onDelete={async () => {
                      await run(async () => {
                        await api.deleteCapture(session.id)
                        selection.current++
                        messageSelection.current++
                        setMessage(null)
                        setSessionId('')
                        setRows([])
                        await refresh()
                      })
                    }}
                  />
                ) : null}
                {resource?.kind === 'queue' ? (
                  <>
                    <div className="binding-title">
                      <h2>{t('bindings')}</h2>
                      <button
                        className="text-button"
                        disabled={busy || !!active}
                        onClick={() => void chooseResource(resource)}
                      >
                        <RefreshCw size={13} />
                        {t('refreshSnapshot')}
                      </button>
                    </div>
                    <div className="binding-table">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('includeRoute')}</th>
                            <th>{t('source')}</th>
                            <th>{t('route')}</th>
                            <th>{t('coverage')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shownBindings.map((b, i) => (
                            <tr key={i}>
                              <td>
                                <input
                                  type="checkbox"
                                  aria-label={`${t('includeRoute')} ${b.source} ${b.routing_key}`}
                                  disabled={!!active || busy || !b.supported}
                                  checked={
                                    !!active ||
                                    routeKeys.includes(bindingKey(b))
                                  }
                                  onChange={(e) =>
                                    setRouteKeys((keys) =>
                                      e.target.checked
                                        ? [...keys, bindingKey(b)]
                                        : keys.filter(
                                            (key) => key !== bindingKey(b),
                                          ),
                                    )
                                  }
                                />
                              </td>
                              <td className="mono">
                                {b.source || t('defaultExchange')}
                              </td>
                              <td className="mono">
                                {b.routing_key || '—'}
                                {Object.keys(b.arguments).length ? (
                                  <details>
                                    <summary>{t('arguments')}</summary>
                                    <pre>
                                      {JSON.stringify(b.arguments, null, 2)}
                                    </pre>
                                  </details>
                                ) : null}
                              </td>
                              <td>
                                {b.supported ? (
                                  <span>{t('supported')}</span>
                                ) : (
                                  <span className="muted">
                                    {t('unsupported')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <details className="manual-routes">
                      <summary>{t('manualRoute')}</summary>
                      <p className="small muted">{t('manualRouteHint')}</p>
                      <div className="endpoint-fields route-fields">
                        <label>
                          {t('source')}
                          <input
                            value={manualSource}
                            maxLength={255}
                            disabled={!!active || busy}
                            onChange={(e) => setManualSource(e.target.value)}
                            list="route-exchanges"
                          />
                        </label>
                        <datalist id="route-exchanges">
                          {[
                            ...new Set(
                              bindings
                                .filter((b) =>
                                  ['direct', 'topic'].includes(b.type),
                                )
                                .map((b) => b.source),
                            ),
                          ].map((source) => (
                            <option key={source} value={source} />
                          ))}
                        </datalist>
                        <label>
                          {t('route')}
                          <input
                            value={manualKey}
                            maxLength={255}
                            disabled={!!active || busy}
                            onChange={(e) => setManualKey(e.target.value)}
                          />
                        </label>
                      </div>
                      <button
                        disabled={
                          !!active ||
                          busy ||
                          !manualSource.trim() ||
                          manualRoutes.length >= 64
                        }
                        onClick={() => {
                          setManualRoutes((routes) =>
                            routes.some(
                              (r) =>
                                r.source === manualSource.trim() &&
                                r.routingKey === manualKey,
                            )
                              ? routes
                              : [
                                  ...routes,
                                  {
                                    source: manualSource.trim(),
                                    routingKey: manualKey,
                                  },
                                ],
                          )
                          setManualKey('')
                        }}
                      >
                        {t('addRoute')}
                      </button>
                    </details>
                    {manualRoutes.map((route, i) => (
                      <div className="manual-route" key={i}>
                        <span className="mono">
                          {route.source} →{' '}
                          {route.routingKey || t('emptyRoutingKey')}
                        </span>
                        <button
                          disabled={!!active || busy}
                          aria-label={`${t('removeRoute')} ${route.source} ${route.routingKey}`}
                          onClick={() =>
                            setManualRoutes((routes) =>
                              routes.filter((_, index) => index !== i),
                            )
                          }
                        >
                          {t('removeRoute')}
                        </button>
                      </div>
                    ))}
                    <p className="small muted">{t('partialHint')}</p>
                  </>
                ) : resource?.kind === 'stream' ? (
                  <div className="stream-options">
                    <label>
                      {t('streamStart')}
                      <select
                        value={streamChoice}
                        disabled={!!active || busy}
                        onChange={(e) =>
                          setStreamChoice(
                            e.target.value as 'first' | 'next' | 'offset',
                          )
                        }
                      >
                        <option value="first">{t('streamFirst')}</option>
                        <option value="next">{t('streamNext')}</option>
                        <option value="offset">{t('streamSpecific')}</option>
                      </select>
                    </label>
                    {streamChoice === 'offset' ? (
                      <label>
                        {t('streamOffset')}
                        <input
                          type="number"
                          min="0"
                          step="1"
                          max={Number.MAX_SAFE_INTEGER}
                          disabled={!!active || busy}
                          value={streamOffset}
                          onChange={(e) => setStreamOffset(e.target.value)}
                        />
                      </label>
                    ) : null}
                    {streamChoice === 'offset' && !validStreamOffset ? (
                      <p role="status" className="small muted">
                        {t('streamOffsetHint')}
                      </p>
                    ) : null}
                    {session?.lastOffset !== undefined ? (
                      <p className="mono">
                        {t('lastOffset')}: {session.lastOffset.toLocaleString()}
                      </p>
                    ) : null}
                    {session?.offsetNotice ? (
                      <p role="status" className="notice">
                        {t(
                          session.offsetNotice === 'OFFSET_UNVERIFIED'
                            ? 'streamOffsetUnverified'
                            : 'streamOffsetChanged',
                        )}
                      </p>
                    ) : null}
                  </div>
                ) : resource?.kind === 'topic' ? null : resource ? (
                  <p className="empty-line">{t('futureResource')}</p>
                ) : null}
                {resource &&
                (resource.kind === 'queue' ||
                  resource.kind === 'stream' ||
                  resource.kind === 'topic') ? (
                  <>
                    {' '}
                    <details className="session-options">
                      <summary>{t('perSession')}</summary>
                      <div className="session-fields">
                        <label>
                          {t('sessionCache')}
                          <input
                            type="number"
                            min="1"
                            value={sessionCache}
                            disabled={!!active}
                            onChange={(e) => setSessionCache(e.target.value)}
                          />
                        </label>
                        <label>
                          {t('sessionDisk')}
                          <input
                            type="number"
                            min="1"
                            value={sessionDisk}
                            disabled={!!active}
                            onChange={(e) => setSessionDisk(e.target.value)}
                          />
                        </label>
                        <label>
                          {t('sessionRate')}
                          <input
                            type="number"
                            min="1"
                            value={sessionRate}
                            disabled={!!active}
                            onChange={(e) => setSessionRate(e.target.value)}
                          />
                        </label>
                      </div>
                    </details>
                  </>
                ) : null}
              </section>
              <div className="messages-workspace">
                <section className="messages-pane">
                  <div className="pane-title">
                    <h2>{t('messages')}</h2>
                    <select
                      aria-label={t('messageOrder')}
                      value={messageOrder}
                      onChange={(e) => {
                        setMessageOrder(e.target.value as 'asc' | 'desc')
                        setCursor(null)
                        setRows([])
                        setNextCursor(null)
                      }}
                    >
                      <option value="desc">{t('newestFirst')}</option>
                      <option value="asc">{t('oldestFirst')}</option>
                    </select>
                    <span className={'session-state ' + (session?.state ?? '')}>
                      {session ? t(session.state) : '—'}
                    </span>
                  </div>
                  {session ? (
                    <div className="capture-stats">
                      <span className="num">
                        {session.captured.toLocaleString()} {t('captured')}
                      </span>
                      <span className="num">
                        {session.omitted.toLocaleString()} {t('omitted')}
                      </span>
                      <span className="num">
                        {session.gaps.toLocaleString()} {t('gaps')}
                      </span>
                    </div>
                  ) : null}
                  {session ? (
                    <p className="buffer-note">
                      {t('captureStarted')}:{' '}
                      {new Date(session.startedAt).toLocaleString()}
                      {session.retained ? (
                        <>
                          {' '}
                          · {session.retained.count} {t('retained')}
                          {session.retained.first !== null ? (
                            <>
                              {' '}
                              ·{' '}
                              {new Date(
                                session.retained.first,
                              ).toLocaleString()}{' '}
                              –{' '}
                              {new Date(
                                session.retained.last!,
                              ).toLocaleString()}
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {session?.bindingChanged ? (
                    <p role="status" className="notice">
                      {t('bindingsChanged')}
                    </p>
                  ) : null}
                  {session?.error ? (
                    <p role="alert" className="notice">
                      {session.error}
                    </p>
                  ) : null}
                  {rows.length ? (
                    <MessageList
                      rows={rows}
                      selected={message?.id}
                      onSelect={(id) => void selectMessage(id)}
                      t={t}
                    />
                  ) : (
                    <div className="pane-empty">
                      <Radio size={22} />
                      <p>{t(session ? 'noMessages' : 'noCapture')}</p>
                    </div>
                  )}
                  <div className="pagination">
                    {cursor ? (
                      <button onClick={() => setCursor(null)}>
                        {t(messageOrder === 'desc' ? 'latest' : 'oldestFirst')}
                      </button>
                    ) : null}
                    {nextCursor ? (
                      <button onClick={() => setCursor(nextCursor)}>
                        {t(messageOrder === 'desc' ? 'older' : 'newer')}
                      </button>
                    ) : null}
                  </div>
                  {session ? (
                    <p className="buffer-note">
                      {t(
                        session.resource.kind === 'topic'
                          ? 'kafkaRetention'
                          : session.resource.kind === 'stream'
                            ? 'streamRetention'
                            : 'potentialOverflow',
                      )}
                    </p>
                  ) : null}
                </section>
                <MessageView message={message} t={t} />
              </div>
            </div>
          </main>
        )}
        <footer className="statusbar">
          <span>
            <span
              className={'status-dot ' + (fatal ? 'failed' : 'capturing')}
            />
            {t('localOnly')}
          </span>
          <span className="num">
            {state
              ? `${bytes(state.stats.cacheBytes)} / ${bytes(state.settings.cacheBytes)} RAM · ${bytes(state.stats.diskBytes)} ${t('disk').split(' (')[0]} · ${state.stats.evicted} ${t('evicted')}`
              : t('loading')}
          </span>
        </footer>
      </div>
      {easterEgg ? (
        <EasterEgg t={t} onClose={() => setEasterEgg(false)} />
      ) : null}
    </div>
  )
}
