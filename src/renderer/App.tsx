import { KafkaPartitions } from './components/KafkaPartitions'
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
import type { ConnectionSummary } from '../shared/connection'
import { CaptureTools } from './components/CaptureTools'
import { useCallback, useEffect, useRef, useState } from 'react'
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
    [editingProfile, setEditingProfile] = useState<ConnectionSummary | null>(
      null,
    ),
    [connection, setConnection] = useState(''),
    [resource, setResource] = useState<ResourceRef | null>(null)
  const [resources, setResources] = useState<ResourceRef[]>([]),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState('all'),
    [resourcePage, setResourcePage] = useState(1),
    [hasMore, setHasMore] = useState(false)
  const [bindings, setBindings] = useState<Binding[]>([]),
    [bindingReady, setBindingReady] = useState(false),
    [partial, setPartial] = useState(false),
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
  const [streamChoice, setStreamChoice] = useState<'first' | 'next' | 'offset'>(
      'next',
    ),
    [streamOffset, setStreamOffset] = useState('')
  const [partitions, setPartitions] = useState<KafkaPartition[]>([]),
    [kafkaSelection, setKafkaSelection] = useState<KafkaSelection>([])
  const chosenProvider =
    state?.profiles.find((p) => p.id === connection)?.provider ?? 'rabbitmq'
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
    if (!connection) return
    let cancelled = false
    const timer = setTimeout(() => {
      void api
        .listResources(connection, query, resourcePage)
        .then((p) => {
          if (!cancelled) {
            setResources(p.resources)
            setHasMore(p.hasMore)
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
  }, [connection, query, resourcePage, resourceRevision])
  useEffect(() => {
    if (!sessionId) {
      setRows([])
      return
    }
    let cancelled = false,
      timer: ReturnType<typeof setTimeout>
    async function tick() {
      try {
        const page = await api.readMessages(sessionId, cursor)
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
  }, [sessionId, cursor])
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
  async function chooseResource(r: ResourceRef) {
    const token = ++selection.current
    setResource(r)
    setBindings([])
    setBindingReady(false)
    setPartial(false)
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
    const existing = state?.sessions.find(
      (s) =>
        s.connectionId === connection &&
        s.resource.name === r.name &&
        s.state === 'capturing',
    )
    setSessionId(existing?.id ?? '')
    setPartitions([])
    setKafkaSelection([])
    if (r.kind === 'topic') {
      try {
        const p = await api.getPartitions(connection, r)
        if (token === selection.current) {
          setPartitions(p)
          setKafkaSelection(
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
  const shownBindings = session?.bindings ?? bindings
  const shownResources = resources.filter(
    (r) => kind === 'all' || r.kind === kind,
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
        allowPartial: partial,
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
          <svg aria-hidden="true" viewBox="0 0 32 32">
            <ellipse
              cx="16"
              cy="16"
              rx="10"
              ry="13"
              transform="rotate(30 16 16)"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 10l2 2m5-2l-1 3m-6 4l3 1m5-1l-1 3m-5 3l2 1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
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
              aria-label={p.name}
              key={p.id}
              onClick={() => {
                selection.current++
                messageSelection.current++
                setNextCursor(null)
                setKind('all')
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
                    setPartial(false)
                    setKind('all')
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
                      s.kafkaPositions?.map((p) => ({
                        partition: p.partition,
                        from: p.start,
                      })) ?? [],
                    )
                    setBindings(s.bindings)
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
          <span className="small">
            {version}
            {releaseName ? ` · ${releaseName}` : ''}
          </span>
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
          <main className="inspection">
            <section className="resource-pane">
              <div className="pane-title">
                <h2>{t('resources')}</h2>
                <button
                  className="icon-button"
                  title={t('testConnection')}
                  aria-label={t('testConnection')}
                  disabled={busy}
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
                disabled={busy}
                onClick={() => {
                  setEditingProfile(
                    state?.profiles.find((p) => p.id === connection) ?? null,
                  )
                  setForm(true)
                }}
              >
                {t('editConnection')}
              </button>
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
              <div className="tabs resource-tabs">
                <button
                  className={kind === 'all' ? 'active' : ''}
                  onClick={() => setKind('all')}
                >
                  {t('allResources')}
                </button>
                <button
                  className={
                    kind === (capabilities.partitions ? 'topic' : 'queue')
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setKind(capabilities.partitions ? 'topic' : 'queue')
                  }
                >
                  {t(capabilities.partitions ? 'topics' : 'queues')}
                </button>
              </div>
              <div className="resource-list">
                {shownResources.length ? (
                  shownResources.map((r) => (
                    <button
                      key={r.kind + ':' + r.name}
                      className={
                        'resource-row ' +
                        (resource?.name === r.name && resource.kind === r.kind
                          ? 'selected'
                          : '')
                      }
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
              {hasMore ? (
                <button onClick={() => setResourcePage((p) => p + 1)}>
                  {t('older')}
                </button>
              ) : null}
              {resourcePage > 1 ? (
                <button onClick={() => setResourcePage(1)}>
                  {t('refresh')}
                </button>
              ) : null}
            </section>
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
                        (!active &&
                          resource.kind === 'topic' &&
                          !kafkaSelectionSchema.safeParse(kafkaSelection)
                            .success) ||
                        (resource.kind === 'queue' &&
                          (!bindingReady ||
                            (!active &&
                              (!bindings.some((b) => b.supported) ||
                                (bindings.some((b) => !b.supported) &&
                                  !partial))))) ||
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
                            <th>{t('source')}</th>
                            <th>{t('route')}</th>
                            <th>{t('coverage')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shownBindings.map((b, i) => (
                            <tr key={i}>
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
                    {bindings.some((b) => !b.supported) ? (
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={partial}
                          disabled={!!active}
                          onChange={(e) => setPartial(e.target.checked)}
                        />
                        {t('partial')}
                      </label>
                    ) : null}
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
                        {t('latest')}
                      </button>
                    ) : null}
                    {nextCursor ? (
                      <button onClick={() => setCursor(nextCursor)}>
                        {t('older')}
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
    </div>
  )
}
