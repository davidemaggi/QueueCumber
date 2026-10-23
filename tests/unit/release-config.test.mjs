import { it, expect } from 'vitest'
import { releaseVersion } from '../../scripts/release-config.mjs'
it('requires an existing-tag style SemVer that exactly matches the package version', () => {
  for (const version of ['0.1.0-alpha.1', '1.2.3', '1.2.3-rc.2+build.5'])
    expect(releaseVersion('v' + version, version)).toBe(version)
  for (const tag of [
    '1.2.3',
    'v01.2.3',
    'v1.2.3-01',
    'v1.2',
    'v1.2.3;echo bad',
    'v1.2.3\n',
  ])
    expect(() => releaseVersion(tag, '1.2.3')).toThrow()
  expect(() => releaseVersion('v1.2.4', '1.2.3')).toThrow('package version')
})

it('names major/minor releases after Star Wars characters by major initial and leaves patches unnamed', async () => {
  const { releaseTitle } = await import('../../scripts/release-name.mjs')
  expect(releaseTitle('1.0.0', 'Ackbar')).toBe('v1.0.0 — Ackbar')
  expect(releaseTitle('1.1.0', 'Ahsoka Tano')).toBe('v1.1.0 — Ahsoka Tano')
  expect(releaseTitle('2.0.0', 'Boba Fett')).toBe('v2.0.0 — Boba Fett')
  expect(releaseTitle('1.0.0-rc.1', 'Ackbar')).toBe('v1.0.0-rc.1 — Ackbar')
  expect(releaseTitle('1.0.1')).toBe('v1.0.1')
  expect(releaseTitle('0.3.0')).toBe('v0.3.0')
  for (const [version, name] of [
    ['1.0.0', 'Anakin'],
    ['1.1.0', 'Boba Fett'],
    ['2.0.0', 'Ackbar'],
    ['1.0.1', 'Ackbar'],
    ['1.0.0', undefined],
    ['0.3.0', 'Ackbar'],
    ['1.1.0', 'Ahsoka\nTano'],
  ])
    expect(() => releaseTitle(version, name)).toThrow()
})
