import type { ConnectionSummary } from '../../shared/connection'
import { useState, type FormEvent } from 'react'
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
    [password, setPassword] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    await onSave({
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
        : { provider, protocolUrl: url, managementUrl: management }),
      allowInsecure: insecure,
      ...(ca ? { caPem: ca } : {}),
    })
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
            onChange={(e) =>
              setProvider(e.target.value as 'rabbitmq' | 'kafka')
            }
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
              {t('amqpUrl')}
              <input
                required
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="amqps://user:password@broker:5671/vhost"
              />
            </label>
            <label>
              {t('managementUrl')}
              <input
                required
                type="url"
                value={management}
                onChange={(e) => setManagement(e.target.value)}
                placeholder="https://broker:15671"
              />
            </label>
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
        <div className="actions">
          <button type="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="primary" disabled={busy}>
            {t('saveConnection')}
          </button>
        </div>
      </form>
    </section>
  )
}
