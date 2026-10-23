import { ConfigurationTransfer } from './ConfigurationTransfer'
import { useState } from 'react'
import {
  DEFAULT_SETTINGS,
  validateSettings,
  type CaptureSettings,
} from '../../shared/limits'
import type { State } from '../../shared/contracts'
import type { DesktopPreferences } from '../../shared/desktop'
import type { Locale, translator, CopyKey } from '../i18n'
export function Settings({
  t,
  settings,
  locale,
  setLocale,
  theme,
  setTheme,
  onSave,
  busy,
  desktop,
  onDesktopChange,
  onConfigurationChanged,
}: {
  t: ReturnType<typeof translator>
  settings: CaptureSettings
  locale: Locale
  setLocale: (v: Locale) => void
  theme: string
  setTheme: (v: string) => void
  onSave: (s: CaptureSettings, confirmed: boolean) => Promise<void>
  busy: boolean
  onConfigurationChanged: () => Promise<void>
  desktop: State['desktop']
  onDesktopChange: (preferences: DesktopPreferences) => Promise<void>
}) {
  const [draft, setDraft] = useState(settings),
    [confirm, setConfirm] = useState(false),
    [invalid, setInvalid] = useState(false)
  const fields: [keyof CaptureSettings, CopyKey, number][] = [
    ['cacheBytes', 'cache', 1024 ** 2],
    ['diskBytes', 'disk', 1024 ** 3],
    ['retentionMs', 'retention', 86400000],
    ['maxPayloadBytes', 'maxPayload', 1024 ** 2],
    ['previewBytes', 'preview', 1024],
  ]
  async function save(confirmed = false) {
    try {
      const next = validateSettings(draft)
      setInvalid(false)
      const effects = await window.queuecumber.previewSettings(next)
      if ((effects.effects.length || effects.active) && !confirmed) {
        setConfirm(true)
        return
      }
      await onSave(next, confirmed)
      setConfirm(false)
    } catch {
      setInvalid(true)
    }
  }
  return (
    <main className="settings-page">
      <header>
        <h1>{t('settings')}</h1>
      </header>
      <section className="settings-section">
        <div>
          <h2>{t('appearance')}</h2>
          <p>{t('appearanceHint')}</p>
        </div>
        <div className="settings-fields">
          <label>
            {t('theme')}
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="system">{t('system')}</option>
              <option value="dark">{t('dark')}</option>
              <option value="light">{t('light')}</option>
            </select>
          </label>
          <label>
            {t('language')}
            <select
              value={locale}
              disabled={busy}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              <option value="en">English</option>
              <option value="it">Italiano</option>
            </select>
          </label>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>{t('background')}</h2>
          <p>{t('backgroundHint')}</p>
        </div>
        <div className="settings-fields">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={desktop.preferences.closeToTray}
              disabled={busy}
              onChange={(e) =>
                void onDesktopChange({
                  ...desktop.preferences,
                  closeToTray: e.target.checked,
                })
              }
            />
            {t('closeToTray')}
          </label>
          {desktop.platform === 'linux' ? (
            <p className="muted small">{t('backgroundLinux')}</p>
          ) : !desktop.trayAvailable ? (
            <p className="muted small">{t('backgroundUnavailable')}</p>
          ) : null}
          {desktop.warning ? (
            <p role="alert" className="notice">
              {t('desktopPreferencesWarning')}
            </p>
          ) : null}
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>{t('captureLimits')}</h2>
          <p>{t('limitsHint')}</p>
          <p>{t('stopBeforeSettings')}</p>
        </div>
        <div className="settings-fields">
          {fields.map(([key, label, unit]) => (
            <label key={key}>
              {t(label)}
              <input
                type="number"
                min="0"
                step="any"
                value={Number(draft[key]) / unit}
                onChange={(e) => {
                  setDraft({
                    ...draft,
                    [key]: Math.round(Number(e.target.value) * unit),
                  })
                  setConfirm(false)
                }}
              />
            </label>
          ))}
          <label>
            {t('rate')}
            <input
              type="number"
              min="1"
              value={draft.admittedMessagesPerSecond ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  admittedMessagesPerSecond: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
            />
          </label>
          {invalid ? (
            <p role="alert" className="error">
              {t('invalidSettings')}
            </p>
          ) : null}
          {confirm ? (
            <div className="confirmation">
              <p>{t('confirmEffects')}</p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                {t('applyChanges')}
              </button>
            </div>
          ) : null}
          <div className="actions">
            <button
              onClick={() => {
                setDraft({ ...DEFAULT_SETTINGS })
                setConfirm(false)
              }}
            >
              {t('restoreDefaults')}
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void save()}
            >
              {t('saveSettings')}
            </button>
          </div>
        </div>
      </section>
      <ConfigurationTransfer t={t} onChanged={onConfigurationChanged} />
    </main>
  )
}
