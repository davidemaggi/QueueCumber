// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  EasterEgg,
  KONAMI,
  VersionButton,
  konamiStep,
  type PadButton,
} from '../../src/renderer/components/EasterEgg'
import { translator } from '../../src/renderer/i18n'
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
const KEY: Record<PadButton, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  b: 'b',
  a: 'a',
}
it('tracks the Konami sequence and forgives extra ups', () => {
  const run = (steps: PadButton[]) => steps.reduce(konamiStep, 0)
  expect(run([...KONAMI])).toBe(10)
  expect(run(['up', 'up', 'up', 'down'])).toBe(3)
  expect(run(['up', 'up', 'down', 'up'])).toBe(1)
  expect(run(['up', 'a'])).toBe(0)
})
it('unlocks only after seven quick clicks on the version', () => {
  vi.useFakeTimers()
  const unlock = vi.fn()
  render(<VersionButton label="1.0.2" onUnlock={unlock} />)
  const version = screen.getByRole('button', { name: '1.0.2' })
  for (let i = 0; i < 6; i++) fireEvent.click(version)
  vi.advanceTimersByTime(1500)
  fireEvent.click(version)
  expect(unlock).not.toHaveBeenCalled()
  for (let i = 0; i < 6; i++) {
    vi.advanceTimersByTime(300)
    fireEvent.click(version)
  }
  expect(unlock).toHaveBeenCalledTimes(1)
})
it('accepts the code from the keyboard, celebrates and waits for an apology', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const close = vi.fn()
  render(<EasterEgg t={translator('en')} onClose={close} />)
  expect(screen.getByRole('dialog').textContent).toContain('enter the code')
  fireEvent.keyDown(window, { key: 'ArrowUp' })
  fireEvent.keyDown(window, { key: 'x' })
  expect(screen.getByRole('status').textContent).toBe('1 of 10 inputs')
  fireEvent.keyDown(window, { key: 'a' })
  expect(screen.getByRole('status').textContent).toBe('0 of 10 inputs')
  for (const step of KONAMI) fireEvent.keyDown(window, { key: KEY[step] })
  const apology = screen.getByRole('button', { name: 'Sorry, back to work' })
  expect(document.activeElement).toBe(apology)
  expect(document.querySelector('canvas.egg-confetti')).not.toBeNull()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(apology)
  expect(close).toHaveBeenCalledTimes(1)
})
it('accepts the code from the on-screen controller in Italian', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const close = vi.fn()
  render(<EasterEgg t={translator('it')} onClose={close} />)
  const names: Record<PadButton, string> = {
    up: 'Su',
    down: 'Giù',
    left: 'Sinistra',
    right: 'Destra',
    b: 'Pulsante B',
    a: 'Pulsante A',
  }
  for (const step of KONAMI)
    fireEvent.click(screen.getByRole('button', { name: names[step] }))
  fireEvent.click(
    screen.getByRole('button', { name: 'Scusa, torno a lavorare' }),
  )
  expect(close).toHaveBeenCalledTimes(1)
})
it('lets a player back out before finishing the code', () => {
  const close = vi.fn()
  render(<EasterEgg t={translator('en')} onClose={close} />)
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(close).toHaveBeenCalledTimes(2)
})
