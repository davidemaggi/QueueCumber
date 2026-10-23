import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const css = readFileSync('src/renderer/styles.css', 'utf8')
function luminance(hex: string) {
  const expanded = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
    const c = parseInt(expanded.slice(index * 2, index * 2 + 2), 16) / 255
    return (
      sum + weight * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    )
  }, 0)
}
it('keeps shipped theme text and form boundaries above minimum contrast ratios', () => {
  for (const selector of [':root', ":root[data-theme='dark']"]) {
    const block = css.slice(css.indexOf(selector + ' {')).split('}')[0]
    const colors = Object.fromEntries(
      [...block.matchAll(/--([\w-]+): #([\da-f]+);/g)].map((match) => [
        match[1],
        luminance(match[2]),
      ]),
    )
    const contrast = (a: string, b: string) =>
      (Math.max(colors[a], colors[b]) + 0.05) /
      (Math.min(colors[a], colors[b]) + 0.05)
    for (const surface of ['ground', 'surface', 'raised']) {
      for (const ink of ['ink', 'muted', 'accent'])
        expect(
          contrast(ink, surface),
          `${selector} ${ink}/${surface}`,
        ).toBeGreaterThanOrEqual(4.5)
    }
    expect(
      contrast('control', 'surface'),
      `${selector} input border`,
    ).toBeGreaterThanOrEqual(3)
    expect(contrast('primary', 'on-primary')).toBeGreaterThanOrEqual(4.5)
  }
})
