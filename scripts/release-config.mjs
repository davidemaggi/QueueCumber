export function releaseVersion(tag, packageVersion) {
  // SemVer numeric prerelease identifiers cannot have leading zeroes.
  const number = '(?:0|[1-9][0-9]*)'
  const identifier = `(?:${number}|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)`
  const pattern = new RegExp(
    `^v(${number}\\.${number}\\.${number}(?:-${identifier}(?:\\.${identifier})*)?(?:\\+[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*)?)$`,
  )
  if (
    typeof tag !== 'string' ||
    tag.length > 128 ||
    /[\r\n]/.test(tag) ||
    !pattern.test(tag)
  )
    throw new Error('Release tag must be v followed by a valid SemVer version')
  const version = tag.slice(1)
  if (version !== packageVersion)
    throw new Error('Release tag must match the package version')
  return version
}
