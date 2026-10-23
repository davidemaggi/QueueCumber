import {
  validateConnection,
  type ConnectionProfile,
} from '../../shared/connection'
import { buildRabbitUrl, rabbitEndpoint } from '../../shared/rabbit-endpoint'
import { Fragment, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { translator } from '../i18n'
export function ConnectionForm({
  t,
  onClose,
  onSave,
  busy,
  initial,
}: {
  t: ReturnType<typeof translator>
  onClose: () => void
  onSave: (input: any) => Promise<void>
  busy: boolean
  initial?: ConnectionProfile | null
}) {
  const rabbit = initial && initial.provider !== 'kafka' ? initial : null
  const kafka = initial?.provider === 'kafka' ? initial : null
  const parsed = rabbit ? new URL(rabbit.protocolUrl) : null
  const managed = rabbit ? new URL(rabbit.managementUrl) : null
  const [host, setHost] = useState(parsed?.hostname ?? '')
  const [port, setPort] = useState(
    parsed?.port || (parsed?.protocol === 'amqp:' ? '5672' : '5671'),
  )
  const [managementHost, setManagementHost] = useState(managed?.hostname ?? '')
  const [managementPort, setManagementPort] = useState(
    managed?.port ||
      (managed?.protocol === 'http:' ? '80' : managed ? '443' : '15671'),
  )
  const [amqpTls, setAmqpTls] = useState(
    parsed ? parsed.protocol === 'amqps:' : true,
  )
  const [managementTls, setManagementTls] = useState(
    managed ? managed.protocol === 'https:' : true,
  )
  const [name, setName] = useState(initial?.name ?? ''),
    [url, setUrl] = useState(rabbit?.protocolUrl ?? ''),
    [management, setManagement] = useState(rabbit?.managementUrl ?? ''),
    [insecure, setInsecure] = useState(initial?.allowInsecure ?? false),
    [ca, setCa] = useState(initial?.caPem ?? ''),
    [provider, setProvider] = useState<'rabbitmq' | 'kafka'>(
      initial?.provider ?? 'rabbitmq',
    ),
    [brokers, setBrokers] = useState(kafka?.brokers.join(', ') ?? ''),
    [tls, setTls] = useState(kafka?.tls ?? true),
    [mechanism, setMechanism] = useState<string>(
      kafka?.sasl?.mechanism ?? 'none',
    ),
    [username, setUsername] = useState(
      kafka?.sasl?.username ??
        (parsed ? decodeURIComponent(parsed.username || 'guest') : ''),
    ),
    [password, setPassword] = useState(
      kafka?.sasl?.password ??
        (parsed ? decodeURIComponent(parsed.password || 'guest') : ''),
    ),
    [setup, setSetup] = useState(
      parsed?.search || (managed && managed.pathname !== '/')
        ? 'url'
        : 'guided',
    ),
    [step, setStep] = useState(0),
    [vhost, setVhost] = useState(
      parsed ? decodeURIComponent(parsed.pathname.slice(1)) || '/' : '/',
    ),
    [formError, setFormError] = useState(false)
  const guided = provider === 'rabbitmq' && setup === 'guided'
  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(false)
    try {
      const input = validateConnection({
        ...(initial ? { id: initial.id } : {}),
        name,
        ...(provider === 'kafka'
          ? {
              provider,
              brokers: brokers.trim().split(/[,\s]+/),
              tls,
              ...(mechanism !== 'none'
                ? { sasl: { mechanism, username, password } }
                : {}),
            }
          : {
              provider,
              protocolUrl: guided
                ? buildRabbitUrl(
                    rabbitEndpoint(host, port, amqpTls, 'amqp'),
                    vhost,
                    username,
                    password,
                  )
                : url,
              managementUrl: guided
                ? rabbitEndpoint(
                    managementHost || host,
                    managementPort,
                    managementTls,
                    'http',
                  )
                : management,
            }),
        allowInsecure: insecure,
        ...(ca ? { caPem: ca } : {}),
      })
      if (guided && step === 0) {
        setStep(1)
        return
      }
      await onSave(input)
    } catch {
      setFormError(true)
    }
  }

  return (
    <section className="connection-form">
      <div className="section-heading">
        <h2>{t(initial ? 'editConnection' : 'newConnection')}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t('cancel')}
        >
          <X size={18} />
        </button>
      </div>
      <p className="muted">
        {t(initial ? 'editConnectionHint' : 'connectionHint')}
      </p>
      <form onSubmit={submit}>
        <label>
          {t('provider')}
          <select
            value={provider}
            disabled={!!initial || busy}
            onChange={(e) => {
              setProvider(e.target.value as 'rabbitmq' | 'kafka')
              setUsername('')
              setPassword('')
              setStep(0)
              setFormError(false)
            }}
          >
            <option value="rabbitmq">RabbitMQ</option>
            <option value="kafka">Kafka</option>
          </select>
        </label>
        <label>
          {t('connectionName')}
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Staging RabbitMQ"
          />
        </label>
        {provider === 'rabbitmq' ? (
          <>
            <label>
              {t('connectionSetup')}
              <select
                disabled={busy}
                value={setup}
                onChange={(e) => {
                  setSetup(e.target.value)
                  setStep(0)
                  setFormError(false)
                }}
              >
                <option value="guided">{t('guidedSetup')}</option>
                <option value="url">{t('connectionUrlSetup')}</option>
              </select>
            </label>
            {guided ? (
              <p className="small muted" role="status">
                {t(step === 0 ? 'guidedEndpoints' : 'guidedCredentials')}
              </p>
            ) : null}
            {guided && step === 1 ? (
              <Fragment key="credentials">
                <p className="small connection-endpoint">
                  {host}:{port} · {t('virtualHost')}: {vhost}
                </p>
                <label>
                  {t('username')}
                  <input
                    autoFocus
                    required
                    autoComplete="off"
                    maxLength={4096}
                    disabled={busy}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </label>
                <label>
                  {t('password')}
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    maxLength={8192}
                    disabled={busy}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              </Fragment>
            ) : (
              <Fragment key="endpoints">
                {guided ? (
                  <>
                    <div className="endpoint-fields">
                      <label>
                        {t('amqpHost')}
                        <input
                          required
                          maxLength={255}
                          disabled={busy}
                          value={host}
                          onChange={(e) => setHost(e.target.value)}
                          placeholder="broker.example.com"
                        />
                      </label>
                      <label>
                        {t('port')}
                        <input
                          required
                          type="number"
                          min="1"
                          max="65535"
                          disabled={busy}
                          value={port}
                          onChange={(e) => {
                            setPort(e.target.value)
                            if (['5671', '5672'].includes(e.target.value))
                              setAmqpTls(e.target.value === '5671')
                          }}
                        />
                      </label>
                    </div>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={amqpTls}
                        onChange={(e) => setAmqpTls(e.target.checked)}
                        disabled={busy}
                      />
                      {t('amqpTls')}
                    </label>
                  </>
                ) : (
                  <label>
                    {t('amqpUrl')}
                    <input
                      required
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={8192}
                      disabled={busy}
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="amqps://user:password@broker:5671/vhost"
                    />
                  </label>
                )}
                {guided ? (
                  <label>
                    {t('virtualHost')}
                    <input
                      required
                      maxLength={255}
                      disabled={busy}
                      value={vhost}
                      onChange={(e) => setVhost(e.target.value)}
                    />
                  </label>
                ) : null}
                {guided ? (
                  <>
                    <div className="endpoint-fields">
                      <label>
                        {t('managementHost')}
                        <input
                          maxLength={255}
                          disabled={busy}
                          value={managementHost}
                          onChange={(e) => setManagementHost(e.target.value)}
                          placeholder={host || 'broker.example.com'}
                        />
                      </label>
                      <label>
                        {t('managementPort')}
                        <input
                          required
                          type="number"
                          min="1"
                          max="65535"
                          disabled={busy}
                          value={managementPort}
                          onChange={(e) => {
                            setManagementPort(e.target.value)
                            if (
                              ['80', '443', '15671', '15672'].includes(
                                e.target.value,
                              )
                            )
                              setManagementTls(
                                ['443', '15671'].includes(e.target.value),
                              )
                          }}
                        />
                      </label>
                    </div>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={managementTls}
                        onChange={(e) => setManagementTls(e.target.checked)}
                        disabled={busy}
                      />
                      {t('managementTls')}
                    </label>
                  </>
                ) : (
                  <label>
                    {t('managementUrl')}
                    <input
                      required
                      type="url"
                      maxLength={8192}
                      disabled={busy}
                      value={management}
                      onChange={(e) => setManagement(e.target.value)}
                      placeholder="https://broker:15671"
                    />
                  </label>
                )}
              </Fragment>
            )}
          </>
        ) : (
          <>
            <label>
              {t('kafkaBrokers')}
              <textarea
                required
                value={brokers}
                spellCheck={false}
                onChange={(e) => setBrokers(e.target.value)}
                rows={2}
                placeholder="broker:9093, broker-2:9093"
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={tls}
                onChange={(e) => setTls(e.target.checked)}
              />
              {t('kafkaTls')}
            </label>
            <label>
              {t('kafkaAuthentication')}
              <select
                value={mechanism}
                onChange={(e) => setMechanism(e.target.value)}
              >
                <option value="none">{t('kafkaNoAuth')}</option>
                <option value="PLAIN">SASL PLAIN</option>
                <option value="SCRAM-SHA-256">SCRAM-SHA-256</option>
                <option value="SCRAM-SHA-512">SCRAM-SHA-512</option>
              </select>
            </label>
            {mechanism !== 'none' ? (
              <>
                <label>
                  {t('username')}
                  <input
                    required
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </label>
                <label>
                  {t('password')}
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              </>
            ) : null}
          </>
        )}
        {!guided || step === 0 ? (
          <>
            <details>
              <summary>{t('caPem')}</summary>
              <label>
                {t('caPem')}
                <textarea
                  value={ca}
                  onChange={(e) => setCa(e.target.value)}
                  rows={3}
                />
              </label>
            </details>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={insecure}
                onChange={(e) => setInsecure(e.target.checked)}
              />
              {t('allowInsecure')}
            </label>
          </>
        ) : null}
        {formError ? (
          <p role="alert" className="notice">
            {t('connectionFieldsInvalid')}
          </p>
        ) : null}
        <div className="actions">
          <button type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          {guided && step === 1 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep(0)
                setFormError(false)
              }}
            >
              {t('backToEndpoints')}
            </button>
          ) : null}
          <button className="primary" disabled={busy}>
            {t(guided && step === 0 ? 'nextCredentials' : 'saveConnection')}
          </button>
        </div>
      </form>
    </section>
  )
}
