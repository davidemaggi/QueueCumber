import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { CopyKey, translator } from '../i18n'

type Translate = ReturnType<typeof translator>
export type PadButton = 'up' | 'down' | 'left' | 'right' | 'b' | 'a'
export const KONAMI: readonly PadButton[] = [
  'up',
  'up',
  'down',
  'down',
  'left',
  'right',
  'left',
  'right',
  'b',
  'a',
]
const KEYS: Record<string, PadButton> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  b: 'b',
  B: 'b',
  a: 'a',
  A: 'a',
}
const LABELS: Record<PadButton, CopyKey> = {
  up: 'padUp',
  down: 'padDown',
  left: 'padLeft',
  right: 'padRight',
  b: 'padB',
  a: 'padA',
}
export const UNLOCK_CLICKS = 7
const CLICK_GAP_MS = 1000

// A miss keeps whatever "up" prefix still counts, so ↑↑↑↓↓… is forgiven.
export function konamiStep(progress: number, input: PadButton) {
  if (KONAMI[progress] === input) return progress + 1
  if (input !== 'up') return 0
  return progress === 2 ? 2 : 1
}

export function VersionButton({
  label,
  onUnlock,
}: {
  label: string
  onUnlock: () => void
}) {
  const clicks = useRef({ count: 0, last: 0 })
  return (
    <button
      type="button"
      className="version-button"
      onClick={() => {
        const now = Date.now(),
          c = clicks.current
        c.count = now - c.last < CLICK_GAP_MS ? c.count + 1 : 1
        c.last = now
        if (c.count < UNLOCK_CLICKS) return
        c.count = 0
        onUnlock()
      }}
    >
      {label}
    </button>
  )
}

export function EasterEgg({
  t,
  onClose,
}: {
  t: Translate
  onClose: () => void
}) {
  const [progress, setProgress] = useState(0),
    [pressed, setPressed] = useState<PadButton | null>(null),
    dialog = useRef<HTMLDivElement>(null),
    apology = useRef<HTMLButtonElement>(null),
    close = useRef(onClose)
  close.current = onClose
  const busted = progress === KONAMI.length
  const press = (input: PadButton) => {
    setPressed(input)
    setProgress((p) => (p === KONAMI.length ? p : konamiStep(p, input)))
  }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    return () => previous?.focus()
  }, [])
  useEffect(() => {
    if (busted) apology.current?.focus()
  }, [busted])
  useEffect(() => {
    if (!pressed) return
    const id = window.setTimeout(() => setPressed(null), 140)
    return () => window.clearTimeout(id)
  }, [pressed])
  useEffect(() => {
    if (busted) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') return close.current()
      const input = KEYS[e.key]
      if (!input || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      press(input)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busted])
  const trapFocus = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialog.current) return
    const focusable = [
      ...dialog.current.querySelectorAll<HTMLElement>('button'),
    ].filter((el) => !el.hasAttribute('disabled'))
    if (!focusable.length) return
    const first = focusable[0],
      last = focusable[focusable.length - 1],
      active = document.activeElement
    if (active !== dialog.current && active !== (e.shiftKey ? first : last))
      return
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  }
  const pad = (input: PadButton, className: string) => (
    <button
      type="button"
      className={className + (pressed === input ? ' pressed' : '')}
      aria-label={t(LABELS[input])}
      onClick={() => press(input)}
    >
      {input === 'a' || input === 'b' ? (
        <span aria-hidden="true">{input.toUpperCase()}</span>
      ) : null}
    </button>
  )
  return (
    <div className="egg-backdrop">
      {busted ? <Confetti /> : null}
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="egg-title"
        aria-describedby="egg-hint"
        tabIndex={-1}
        className={'egg-dialog' + (busted ? ' busted' : '')}
        onKeyDown={trapFocus}
      >
        {busted ? (
          <>
            <h2 id="egg-title">{t('eggBustedTitle')}</h2>
            <p id="egg-hint">{t('eggBustedBody')}</p>
            <button
              ref={apology}
              type="button"
              className="primary"
              onClick={onClose}
            >
              {t('eggApology')}
            </button>
          </>
        ) : (
          <>
            <h2 id="egg-title">{t('eggTitle')}</h2>
            <p id="egg-hint" className="muted">
              {t('eggHint')}
            </p>
            <div className="egg-pad" role="group" aria-label={t('eggPad')}>
              <div className="egg-dpad">
                {pad('up', 'egg-dir up')}
                {pad('left', 'egg-dir left')}
                <span className="egg-dir-hub" aria-hidden="true" />
                {pad('right', 'egg-dir right')}
                {pad('down', 'egg-dir down')}
              </div>
              <div className="egg-middle" aria-hidden="true">
                <span className="egg-brand">QUEUECUMBER</span>
                <span className="egg-pills">
                  <span>
                    <i />
                    SELECT
                  </span>
                  <span>
                    <i />
                    START
                  </span>
                </span>
              </div>
              <div className="egg-face">
                {pad('b', 'egg-round')}
                {pad('a', 'egg-round')}
              </div>
            </div>
            <div className="egg-progress">
              <ol aria-hidden="true">
                {KONAMI.map((_, i) => (
                  <li key={i} className={i < progress ? 'done' : ''} />
                ))}
              </ol>
              <span className="small muted" role="status">
                {t('eggProgress')
                  .replace('{done}', String(progress))
                  .replace('{total}', String(KONAMI.length))}
              </span>
            </div>
            <button type="button" className="egg-close" onClick={onClose}>
              {t('eggClose')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const COLORS = [
  '#3c6b2e',
  '#9cc87b',
  '#e3b341',
  '#c4202b',
  '#3d7bd9',
  '#f4f1e8',
]
const MAX_PIECES = 160

// Runs until unmounted. Pieces are recycled, so cost stays flat no matter how
// long someone stares at the apology button.
function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      return
    const ctx = el.getContext('2d')
    if (!ctx) return
    let w = 0,
      h = 0,
      frame = 0
    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      w = window.innerWidth
      h = window.innerHeight
      el.width = w * ratio
      el.height = h * ratio
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    const spawn = (scatter: boolean) => ({
      x: Math.random() * w,
      y: scatter ? (Math.random() - 0.75) * h : -20,
      vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 3,
      size: 6 + Math.random() * 6,
      spin: Math.random() * Math.PI,
      vspin: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    })
    resize()
    const pieces = Array.from({ length: MAX_PIECES }, () => spawn(true))
    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      for (const [i, p] of pieces.entries()) {
        p.x += p.vx
        p.y += p.vy
        p.spin += p.vspin
        if (p.y > h + 20) pieces[i] = spawn(false)
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.spin)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={canvas} className="egg-confetti" aria-hidden="true" />
}
