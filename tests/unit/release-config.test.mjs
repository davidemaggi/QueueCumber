import { it, expect } from 'vitest'
import {
  windowsSigningConfig,
  releaseVersion,
} from '../../scripts/release-config.mjs'
const signing = {
  AZURE_SIGNING_ENDPOINT: 'https://weu.codesigning.azure.net/',
  AZURE_SIGNING_ACCOUNT: 'synthetic-account',
  AZURE_SIGNING_PROFILE: 'synthetic-profile',
  AZURE_SIGNING_PUBLISHER: 'Synthetic Publisher',
}
it('requires explicit Azure signing settings without falling back to unsigned output', () => {
  for (const key of Object.keys(signing)) {
    const env = { ...signing }
    delete env[key]
    expect(() => windowsSigningConfig(env)).toThrow(key)
  }
  const config = windowsSigningConfig(signing)
  expect(config.forceCodeSigning).toBe(true)
  expect(config.win.azureSignOptions.publisherName).toBe(
    signing.AZURE_SIGNING_PUBLISHER,
  )
  expect(config.win.azureSignOptions.fileDigest).toBe('SHA256')
  expect(config.win.azureSignOptions.timestampDigest).toBe('SHA256')
  expect(config.extends).toBe('./electron-builder.yml')
})
it('rejects non-Azure or insecure signing endpoints without echoing input', () => {
  for (const endpoint of [
    'http://weu.codesigning.azure.net/',
    'https://example.com/',
    'https://weu.codesigning.azure.net.evil.test/',
    'https://user:secret@weu.codesigning.azure.net/',
    'https://weu.codesigning.azure.net/?secret=test',
  ]) {
    expect(() =>
      windowsSigningConfig({ ...signing, AZURE_SIGNING_ENDPOINT: endpoint }),
    ).toThrow('Invalid AZURE_SIGNING_ENDPOINT')
  }
})
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
