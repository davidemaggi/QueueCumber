import { useEffect, useRef, useState } from 'react'
import {
  passwordSchema,
  type ImportMode,
  type ImportPreview,
} from '../../shared/transfer'
import type { translator } from '../i18n'
export function ConfigurationTransfer({
  t,
  onChanged,
}: {
  t: ReturnType<typeof translator>
  onChanged: () => Promise<void>
}) {
  const [password, setPassword] = useState(''),
    [secrets, setSecrets] = useState(false),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [mode, setMode] = useState<ImportMode>('copy'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [done, setDone] = useState(false)
  const staged = useRef(false)
  useEffect(
    () => () => {
      if (staged.current)
        void window.queuecumber.discardConfiguration().catch(() => {})
    },
    [],
  )
  async function run(operation: () => Promise<void>) {
    setBusy(true)
    setError(false)
    setDone(false)
    try {
      await operation()
    } catch {
      setError(true)
    } finally {
      setPassword('')
      setBusy(false)
    }
  }
  return (
    <section className="settings-section">
      <div>
        <h2>{t('configuration')}</h2>
        <p>{t('configurationHint')}</p>
        <p>{t('configurationSecretsHint')}</p>
      </div>
      <div className="settings-fields">
        {!preview ? (
          <>
            <label>
              {t('configurationPassword')}
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={1024}
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={secrets}
                disabled={busy}
                onChange={(e) => setSecrets(e.target.checked)}
              />
              {t('includeSecrets')}
            </label>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    passwordSchema.parse(password)
                    const saved = await window.queuecumber.exportConfiguration(
                      password,
                      secrets,
                    )
                    setDone(saved)
                  })
                }
              >
                {t('configurationExport')}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    passwordSchema.parse(password)
                    const next =
                      await window.queuecumber.previewConfiguration(password)
                    staged.current = !!next
                    setPreview(next)
                  })
                }
              >
                {t('configurationImport')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3>{t('importPreview')}</h3>
            <p>
              {t(
                preview.includeSecrets ? 'importHasSecrets' : 'importNoSecrets',
              )}
            </p>
            {preview.storageMode === 'session' ? (
              <p className="notice">{t('importSessionOnly')}</p>
            ) : null}
            <ul className="import-preview">
              {preview.profiles.map((p, i) => (
                <li key={i}>
                  {p.name}
                  {p.conflict ? (
                    <>
                      {' '}
                      · {t('importConflict')}: {p.existingName}
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            <label>
              {t('importConflicts')}
              <select
                disabled={busy}
                value={mode}
                onChange={(e) => setMode(e.target.value as ImportMode)}
              >
                <option value="copy">{t('importCopy')}</option>
                <option value="skip">{t('importSkip')}</option>
                <option value="replace">{t('importReplace')}</option>
              </select>
            </label>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await window.queuecumber.discardConfiguration()
                    staged.current = false
                    setPreview(null)
                  })
                }
              >
                {t('cancel')}
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    try {
                      await window.queuecumber.applyConfiguration(
                        preview.token,
                        mode,
                      )
                      setDone(true)
                      await onChanged()
                    } finally {
                      staged.current = false
                      setPreview(null)
                    }
                  })
                }
              >
                {t('applyImport')}
              </button>
            </div>
          </>
        )}
        {busy ? <p role="status">{t('loading')}</p> : null}
        {error ? (
          <p role="alert" className="notice">
            {t('configurationError')}
          </p>
        ) : null}
        {done ? <p role="status">{t('configurationDone')}</p> : null}
      </div>
    </section>
  )
}
