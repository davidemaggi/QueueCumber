import { useState } from 'react'
import type {
  KafkaPartition,
  KafkaPosition,
  KafkaSelection,
} from '../../shared/kafka'
import type { translator } from '../i18n'
export function KafkaPartitions({
  t,
  partitions,
  value,
  onChange,
  disabled,
  positions,
  topologyChanged,
}: {
  t: ReturnType<typeof translator>
  partitions: KafkaPartition[]
  value: KafkaSelection
  onChange: (next: KafkaSelection) => void
  disabled: boolean
  positions?: KafkaPosition[]
  topologyChanged?: boolean
}) {
  const [page, setPage] = useState(0)
  const rows = partitions.slice(page * 8, page * 8 + 8)
  const update = (partition: number, from: string) =>
    onChange(value.map((p) => (p.partition === partition ? { ...p, from } : p)))
  return (
    <div className="kafka-partitions">
      <div className="binding-title">
        <h2>{t('kafkaPartitions')}</h2>
        <span className="small muted">
          {value.length} / 128 {t('kafkaSelected')}
        </span>
      </div>
      {!disabled ? (
        <p className="small muted">{t('kafkaPositionHint')}</p>
      ) : null}
      {!disabled ? (
        <div className="actions">
          <button
            disabled={disabled || partitions.length > 128}
            onClick={() =>
              onChange(
                partitions.map((p) => ({
                  partition: p.partition,
                  from: 'next',
                })),
              )
            }
          >
            {t('kafkaSelectAll')}
          </button>
          <button disabled={disabled} onClick={() => onChange([])}>
            {t('kafkaClear')}
          </button>
          <label>
            {t('kafkaSetSelected')}
            <select
              disabled={disabled}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value)
                  onChange(value.map((p) => ({ ...p, from: e.target.value })))
                e.target.value = ''
              }}
            >
              <option value="">{t('kafkaChoose')}</option>
              <option value="first">{t('streamFirst')}</option>
              <option value="next">{t('streamNext')}</option>
            </select>
          </label>
        </div>
      ) : null}
      <div className="partition-table">
        <table>
          <thead>
            <tr>
              <th>{t('kafkaPartition')}</th>
              <th>{t('kafkaRange')}</th>
              <th>{t('streamStart')}</th>
              <th>{t('kafkaNextOffset')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const selected = value.find((s) => s.partition === p.partition),
                actual = positions?.find((s) => s.partition === p.partition)
              return (
                <tr key={p.partition}>
                  <td>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        aria-label={`${t('kafkaPartition')} ${p.partition}`}
                        checked={!!selected}
                        disabled={
                          disabled || (!selected && value.length >= 128)
                        }
                        onChange={(e) =>
                          onChange(
                            e.target.checked
                              ? [
                                  ...value,
                                  { partition: p.partition, from: 'next' },
                                ]
                              : value.filter(
                                  (s) => s.partition !== p.partition,
                                ),
                          )
                        }
                      />
                      <span className="mono">{p.partition}</span>
                    </label>
                  </td>
                  <td className="mono">
                    {actual?.first ?? p.first} → {actual?.end ?? p.end}
                  </td>
                  <td>
                    {selected ? (
                      <div className="partition-start">
                        <select
                          aria-label={`${t('streamStart')} ${p.partition}`}
                          disabled={disabled}
                          value={
                            ['first', 'next'].includes(selected.from)
                              ? selected.from
                              : 'offset'
                          }
                          onChange={(e) =>
                            update(
                              p.partition,
                              e.target.value === 'offset'
                                ? '0'
                                : e.target.value,
                            )
                          }
                        >
                          <option value="first">{t('streamFirst')}</option>
                          <option value="next">{t('streamNext')}</option>
                          <option value="offset">{t('streamSpecific')}</option>
                        </select>
                        {!['first', 'next'].includes(selected.from) ? (
                          <input
                            aria-label={`${t('kafkaOffset')} ${p.partition}`}
                            inputMode="numeric"
                            value={selected.from}
                            disabled={disabled}
                            maxLength={19}
                            onChange={(e) =>
                              update(p.partition, e.target.value)
                            }
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="mono">
                    {actual?.next ?? '—'}
                    {actual?.notice ? (
                      <span className="small notice">
                        {t(
                          actual.notice === 'RETENTION_CLAMPED'
                            ? 'kafkaClamped'
                            : actual.notice === 'OFFSET_AHEAD'
                              ? 'kafkaAhead'
                              : 'kafkaTruncated',
                        )}
                      </span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {partitions.length > 8 ? (
        <div className="actions">
          <button disabled={page === 0} onClick={() => setPage((n) => n - 1)}>
            {t('previousChunk')}
          </button>
          <span className="small">
            {page + 1} / {Math.ceil(partitions.length / 8)}
          </span>
          <button
            disabled={(page + 1) * 8 >= partitions.length}
            onClick={() => setPage((n) => n + 1)}
          >
            {t('nextChunk')}
          </button>
        </div>
      ) : null}
      {topologyChanged ? (
        <p role="status" className="notice">
          {t('kafkaTopologyChanged')}
        </p>
      ) : null}
    </div>
  )
}
