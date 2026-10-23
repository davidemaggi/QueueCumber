import {
  validateConnection,
  type ConnectionSummary,
} from '../../shared/connection'
import { buildRabbitUrl } from '../../shared/rabbit-endpoint'
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
  initial?: ConnectionSummary | null
}) {
  const [name, setName] = useState(initial?.name ?? ''),
    [url, setUrl] = useState(''),
    [management, setManagement] = useState(''),
    [insecure, setInsecure] = useState(false),
    [ca, setCa] = useState(''),
    [provider, setProvider] = useState<'rabbitmq' | 'kafka'>(
      initial?.provider ?? 'rabbitmq',
    ),
    [brokers, setBrokers] = useState(''),
    [tls, setTls] = useState(true),
    [mechanism, setMechanism] = useState('none'),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [setup, setSetup] = useState('guided'),
    [step, setStep] = useState(0),
    [endpoint, setEndpoint] = useState(''),
    [vhost, setVhost] = useState('/'),
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
                ? buildRabbitUrl(endpoint, vhost, username, password)
                : url,
              managementUrl: management,
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
                  {endpoint} · {t('virtualHost')}: {vhost}
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
                <label>
                  {t(guided ? 'amqpEndpoint' : 'amqpUrl')}
                  <input
                    required
                    type={guided ? 'url' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={8192}
                    disabled={busy}
                    value={guided ? endpoint : url}
                    onChange={(e) =>
                      guided
                        ? setEndpoint(e.target.value)
                        : setUrl(e.target.value)
                    }
                    placeholder={
                      guided
                        ? 'amqps://broker:5671'
                        : 'amqps://user:password@broker:5671/vhost'
                    }
                  />
                </label>
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
