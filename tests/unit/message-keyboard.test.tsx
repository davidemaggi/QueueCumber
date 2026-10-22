// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MessageList } from '../../src/renderer/components/Messages'
import { translator } from '../../src/renderer/i18n'
afterEach(cleanup)
it('navigates the complete virtualized page with arrows, Home and End while preserving focus', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  const select = vi.fn(),
    rows = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      timestamp: 0,
      bytes: 1,
      routingKey: 'route-' + i,
      exchange: '',
      preview: 'synthetic',
    }))
  const { rerender } = render(
    <MessageList rows={rows} onSelect={select} t={translator('en')} />,
  )
  const list = screen.getByRole('listbox', { name: 'Messages' })
  list.focus()
  fireEvent.keyDown(list, { key: 'ArrowDown' })
  expect(select).toHaveBeenLastCalledWith(1)
  fireEvent.keyDown(list, { key: 'End' })
  expect(select).toHaveBeenLastCalledWith(100)
  expect(screen.getByRole('option', { selected: true }).textContent).toContain(
    'route-99',
  )
  expect(screen.getAllByRole('option').length).toBeLessThan(30)
  expect(document.activeElement).toBe(list)
  fireEvent.keyDown(list, { key: 'ArrowUp' })
  expect(select).toHaveBeenLastCalledWith(99)
  fireEvent.keyDown(list, { key: 'Home' })
  expect(select).toHaveBeenLastCalledWith(1)
  rerender(<MessageList rows={[]} onSelect={select} t={translator('en')} />)
  fireEvent.keyDown(list, { key: 'End' })
  expect(select).toHaveBeenCalledTimes(4)
  expect(list.hasAttribute('aria-activedescendant')).toBe(false)
})
