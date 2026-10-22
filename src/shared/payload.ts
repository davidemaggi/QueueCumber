export type PreviewResult = {
  text: string
  format: 'json' | 'text' | 'binary'
  truncated: boolean
}
export function formatPreview(base64: string, limit: number): PreviewResult {
  const binary = atob(base64.slice(0, Math.ceil(limit / 3) * 4)),
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0)).subarray(0, limit)
  const truncated = base64.length > Math.ceil(limit / 3) * 4
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (text.includes('\u0000')) throw Error('Binary')
  } catch {
    return {
      text: Array.from(bytes.subarray(0, Math.min(limit, 1024)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join(' '),
      format: 'binary',
      truncated,
    }
  }
  if (!truncated) {
    try {
      const parsed = JSON.parse(text)
      const pretty = JSON.stringify(parsed, null, 2)
      if (pretty.length <= limit * 4)
        return { text: pretty, format: 'json', truncated: false }
    } catch {
      /* Plain text remains available. */
    }
  }
  return { text, format: 'text', truncated }
}
