import { useState } from 'react'
import type { ExportFormat } from '../../shared/export'
import type { translator } from '../i18n'
export function CaptureTools({
  t,
  busy,
  exporting,
  onExport,
  onDelete,
}: {
  t: ReturnType<typeof translator>
  busy: boolean
  exporting: boolean
  onExport: (format: ExportFormat) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [format, setFormat] = useState<ExportFormat>('jsonl'),
    [confirm, setConfirm] = useState(false)
  return (
    <div className="capture-tools">
      <div className="actions">
        <label>
          {t('dumpFormat')}
          <select
            aria-label={t('dumpFormat')}
            disabled={busy || exporting}
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
          >
            <option value="jsonl">JSONL</option>
            <option value="folder">{t('folder')}</option>
            <option value="zip">ZIP</option>
          </select>
        </label>
        <button
          disabled={busy || exporting}
          onClick={() => void onExport(format)}
        >
          {t('exportCapture')}
        </button>
        <button disabled={busy} onClick={() => setConfirm(true)}>
          {t('deleteCapture')}
        </button>
      </div>
      <p className="small muted">{t('dumpHint')}</p>
      {confirm ? (
        <div className="confirmation">
          <p>{t('deleteCaptureConfirm')}</p>
          <div className="actions">
            <button disabled={busy} onClick={() => setConfirm(false)}>
              {t('cancel')}
            </button>
            <button
              disabled={busy}
              onClick={() => void onDelete().then(() => setConfirm(false))}
            >
              {t('confirmDeleteCapture')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
