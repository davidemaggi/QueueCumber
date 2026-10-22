// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MessageView } from '../../src/renderer/components/Messages'
import { translator } from '../../src/renderer/i18n'
afterEach(cleanup)
it('pages the complete original bytes without accumulating previous chunks', async () => {
  const readPayloadChunk = vi.fn(async (_id: number, offset: number) => ({
    payload: btoa(offset ? 'tail' : 'head'),
    offset,
    nextOffset: offset ? null : 65536,
    totalBytes: 65540,
  }))
  window.queuecumber = { readPayloadChunk } as unknown as Window['queuecumber']
  render(
    <MessageView
      t={translator('en')}
      message={{
        id: 1,
        payload: btoa('preview'),
        headers: {},
        bytes: 65540,
        previewLimit: 1024,
        truncated: true,
        routingKey: '',
        exchange: '',
        timestamp: 0,
      }}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Raw bytes' }))
  expect(await screen.findByText(/68 65 61 64/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Next chunk' }))
  expect(await screen.findByText(/74 61 69 6c/)).toBeTruthy()
  expect(screen.queryByText(/68 65 61 64/)).toBeNull()
  expect(readPayloadChunk.mock.calls.map((c) => c[1])).toEqual([0, 65536])
})
