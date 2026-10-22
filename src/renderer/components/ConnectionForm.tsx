import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { translator } from '../i18n'
export function ConnectionForm({
  t,
  onClose,
  onSave,
  busy,
}: {
  t: ReturnType<typeof translator>
  onClose: () => void
  onSave: (input: any) => Promise<void>
  busy: boolean
}) {
  const [name, setName] = useState(''),
    [url, setUrl] = useState(''),
    [management, setManagement] = useState(''),
    [insecure, setInsecure] = useState(false),
    [ca, setCa] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    await onSave({
      name,
      protocolUrl: url,
      managementUrl: management,
      allowInsecure: insecure,
      ...(ca ? { caPem: ca } : {}),
    })
  }
  return (
    <section className="connection-form">
      <div className="section-heading">
        <h2>{t('newConnection')}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t('cancel')}
        >
          <X size={18} />
        </button>
      </div>
      <p className="muted">{t('connectionHint')}</p>
      <form onSubmit={submit}>
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
