import { URL } from 'node:url'

export function windowsSigningConfig(env) {
  const required = (key) => {
    const value = env[key]?.trim()
    if (!value || value.length > 256 || /[\r\n\0]/.test(value))
      throw new Error(`Missing or invalid ${key}`)
    return value
  }
  const endpoint = required('AZURE_SIGNING_ENDPOINT')
  let url
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error('Invalid AZURE_SIGNING_ENDPOINT')
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.codesigning.azure.net') ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid AZURE_SIGNING_ENDPOINT')
  return {
    extends: './electron-builder.yml',
    forceCodeSigning: true,
    win: {
      azureSignOptions: {
        endpoint,
        codeSigningAccountName: required('AZURE_SIGNING_ACCOUNT'),
        certificateProfileName: required('AZURE_SIGNING_PROFILE'),
        publisherName: required('AZURE_SIGNING_PUBLISHER'),
        fileDigest: 'SHA256',
        timestampDigest: 'SHA256',
        timestampRfc3161: 'http://timestamp.acs.microsoft.com',
      },
    },
  }
}

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

export function macSigningConfig(env) {
  for (const key of [
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_TEAM_ID',
  ]) {
    if (
      typeof env[key] !== 'string' ||
      !env[key].trim() ||
      /[\r\n\0]/.test(env[key])
    )
      throw Error(`Missing or invalid ${key}`)
  }
  if (env.CSC_IDENTITY_AUTO_DISCOVERY === 'false')
    throw Error('CSC_IDENTITY_AUTO_DISCOVERY must allow Developer ID signing')
  return {
    extends: './electron-builder.yml',
    forceCodeSigning: true,
    mac: { hardenedRuntime: true, notarize: true },
  }
}
