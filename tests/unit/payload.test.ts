import { it, expect } from 'vitest'
import { formatPreview } from '../../src/shared/payload'
it('pretty prints valid JSON and keeps malformed content as text', () => {
  expect(
    formatPreview(Buffer.from('{"event":"created"}').toString('base64'), 1024)
      .text,
  ).toBe('{\n  "event": "created"\n}')
  expect(
    formatPreview(Buffer.from('{bad json').toString('base64'), 1024).format,
  ).toBe('text')
  expect(
    formatPreview(
      Buffer.from('<script>alert(1)</script>').toString('base64'),
      1024,
    ).text,
  ).toBe('<script>alert(1)</script>')
})
it('bounds formatting and handles binary input without executing it', () => {
  expect(
    formatPreview(Buffer.from([255, 0, 128]).toString('base64'), 1024).format,
  ).toBe('binary')
  const preview = formatPreview(Buffer.alloc(10000, 97).toString('base64'), 128)
  expect(preview.truncated).toBe(true)
  expect(preview.text.length).toBeLessThanOrEqual(128)
})
