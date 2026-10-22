import { releaseVersion } from './release-config.mjs'

export function releaseTitle(version, name) {
  releaseVersion(`v${version}`, version)
  const [major, minor, patch] = version.split(/[.+-]/).slice(0, 3).map(Number)
  if (major === 0 || patch > 0) {
    if (name !== undefined)
      throw Error('Pre-1.0 and patch releases do not have character names')
    return `v${version}`
  }
  const initial = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[major - 1]
  if (!initial)
    throw Error('Agree a naming rule beyond major 26 before releasing')
  if (
    typeof name !== 'string' ||
    !/^[A-Z][\p{L}\p{N} .'’-]{0,79}$/u.test(name) ||
    !name.startsWith(initial)
  )
    throw Error(`Choose a Star Wars character name beginning with ${initial}`)
  if (major === 1 && minor === 0 && name !== 'Ackbar')
    throw Error('The 1.0 release name is Ackbar')
  return `v${version} — ${name}`
}
