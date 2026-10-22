import { useEffect, useRef, useState } from 'react'
import type { MessageSummary } from '../../service/storage'
import type { DesktopApi, MessageDetail } from '../../shared/contracts'
import { formatPreview } from '../../shared/payload'
import type { translator } from '../i18n'
const rowHeight = 46
export function MessageList({
  rows,
  selected,
  onSelect,
  t,
}: {
  rows: MessageSummary[]
  selected?: number
  onSelect: (id: number) => void
  t: ReturnType<typeof translator>
}) {
  const container = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(600)
  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(() => setHeight(element.clientHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const [scroll, setScroll] = useState(0),
    start = Math.max(0, Math.floor(scroll / rowHeight) - 3),
    end = Math.min(rows.length, start + Math.ceil(height / rowHeight) + 6)
  return (
    <div
      className="message-scroll"
      ref={container}
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
    >
      <div style={{ height: rows.length * rowHeight, position: 'relative' }}>
        {rows.slice(start, end).map((m, i) => (
          <button
            className={'message-row ' + (selected === m.id ? 'selected' : '')}
            style={{
              position: 'absolute',
              top: (start + i) * rowHeight,
              height: rowHeight,
            }}
            key={m.id}
            onClick={() => onSelect(m.id)}
          >
            <span className="mono muted">
              {new Date(m.timestamp).toLocaleTimeString()}
            </span>
            <span>
              <strong className="mono">
                {m.kafka
                  ? `p${m.kafka.partition} · ${m.kafka.offset}`
                  : m.routingKey || m.exchange || '—'}
              </strong>
              <small>{m.omission ? t('omission') : m.preview || '—'}</small>
            </span>
            <span className="num muted">{m.bytes.toLocaleString()} B</span>
          </button>
        ))}
      </div>
    </div>
  )
}
export function MessageView({
  message,
  t,
}: {
  message: MessageDetail | null
  t: ReturnType<typeof translator>
}) {
  const [tab, setTab] = useState<'payload' | 'headers'>('payload'),
    [raw, setRaw] = useState(false)
  const preview = message
    ? formatPreview(message.payload, message.previewLimit)
    : null
  return (
    <section className="message-detail">
      <div className="pane-title">
        <h2>{t('messageDetail')}</h2>
        {message ? <span className="mono muted">#{message.id}</span> : null}
      </div>
      {message ? (
        <>
          <div className="detail-meta">
            <span className="mono">
              {message.routingKey || message.exchange || '—'}
            </span>
            <span className="muted num">
              {message.bytes.toLocaleString()} {t('bytes')}
            </span>
          </div>
          {message.kafka ? (
            <p className="mono small">
              {t('kafkaPartition')}: {message.kafka.partition} ·{' '}
              {t('kafkaOffset')}: {message.kafka.offset}
              {message.kafka.tombstone ? ` · ${t('kafkaTombstone')}` : ''}
            </p>
          ) : null}
          {message.offset !== undefined ? (
            <p className="detail-meta mono">
              {t('streamOffset')}: {message.offset.toLocaleString()}
            </p>
          ) : null}
          <div className="tabs">
            <button
              className={tab === 'payload' ? 'active' : ''}
              onClick={() => setTab('payload')}
            >
              {t('payload')}
            </button>
            <button
              className={tab === 'headers' ? 'active' : ''}
              onClick={() => setTab('headers')}
            >
              {t('headers')}
            </button>
          </div>
          {message.omission ? <p className="notice">{t('omission')}</p> : null}
          {message.truncated || preview?.truncated ? (
            <p className="notice">{t('previewTruncated')}</p>
          ) : null}
          {tab === 'payload' ? (
            <>
              <div className="payload-controls">
                <span>
                  {preview?.format === 'json'
                    ? 'JSON'
                    : preview?.format === 'binary'
                      ? t('binary')
                      : 'Text'}
                </span>
                <button aria-pressed={raw} onClick={() => setRaw(!raw)}>
                  {raw ? t('pretty') : t('rawBytes')}
                </button>
              </div>
              {raw && !message.omission ? (
                <RawChunks key={message.id} id={message.id} t={t} />
              ) : (
                <pre>{preview?.text}</pre>
              )}
            </>
          ) : (
            <div className="header-table">
              <table>
                <tbody>
                  {Object.entries(message.headers).map(([key, value]) => (
                    <tr key={key}>
                      <th className="mono">{key}</th>
                      <td className="mono">
                        {JSON.stringify(value, null, 2)?.slice(0, 4096) ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="pane-empty">
          <p>{t('chooseMessage')}</p>
        </div>
      )}
    </section>
  )
}

function RawChunks({
  id,
  t,
}: {
  id: number
  t: ReturnType<typeof translator>
}) {
  const [offset, setOffset] = useState(0)
  const [chunk, setChunk] = useState<Awaited<
    ReturnType<DesktopApi['readPayloadChunk']>
  > | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    setChunk(null)
    setError(false)
    void window.queuecumber
      .readPayloadChunk(id, offset)
      .then((value) => {
        if (!cancelled) setChunk(value)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [id, offset])
  const bytes = chunk
    ? Uint8Array.from(atob(chunk.payload), (c) => c.charCodeAt(0))
    : new Uint8Array()
  const lines: string[] = []
  for (let i = 0; i < bytes.length; i += 16) {
    const row = bytes.subarray(i, i + 16)
    lines.push(
      (offset + i).toString(16).padStart(8, '0') +
        '  ' +
        Array.from(row, (n) => n.toString(16).padStart(2, '0'))
          .join(' ')
          .padEnd(47) +
        '  ' +
        Array.from(row, (n) =>
          n >= 32 && n <= 126 ? String.fromCharCode(n) : '.',
        ).join(''),
    )
  }
  return (
    <>
      <div className="payload-controls">
        <span>
          {t('chunkRange')}: {offset.toLocaleString()}–
          {(offset + bytes.length).toLocaleString()}
          {chunk ? ` / ${chunk.totalBytes.toLocaleString()} B` : ''}
        </span>
        <button
          disabled={!chunk || offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 65536))}
        >
          {t('previousChunk')}
        </button>
        <button
          disabled={!chunk || chunk.nextOffset === null}
          onClick={() => setOffset(chunk!.nextOffset!)}
        >
          {t('nextChunk')}
        </button>
      </div>
      {error ? (
        <p role="alert" className="notice">
          {t('chunkFailure')}
        </p>
      ) : (
        <pre>{chunk ? lines.join('\n') : t('loading')}</pre>
      )}
    </>
  )
}
