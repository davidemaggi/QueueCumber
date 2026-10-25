import { it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import meta from '../../packaging/package-managers.json'

const run = (...args) =>
  spawnSync(process.execPath, ['scripts/package-managers.mjs', ...args], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_REPOSITORY: '' },
  })

it('keeps package metadata within winget and Chocolatey conventions', () => {
  expect(meta.winget.id).toBe('DavideMaggi.QueueCumber')
  expect(meta.chocolatey).toEqual({ id: 'queuecumber', owners: 'davidemaggi' })
  expect(meta.publisher).toBe('Davide Maggi')
  expect(meta.tags.length).toBeLessThanOrEqual(16)
  for (const tag of meta.tags) expect(tag).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  expect(Object.keys(meta.locales).sort()).toEqual(['en-US', 'it-IT'])
  // The signing configuration names the installer this way.
  expect(readFileSync('electron-builder.self-hosted.mjs', 'utf8')).toContain(
    "'QueueCumber-${version}-win-${arch}-signed-setup.${ext}'",
  )
  expect(meta.windowsInstaller.asset).toBe(
    'QueueCumber-{version}-win-x64-signed-setup.exe',
  )
  const png = readFileSync(meta.icon)
  expect(png.readUInt32BE(16)).toBe(256)
  expect(png.readUInt32BE(20)).toBe(256)
})

it('writes winget 1.10.0 manifests and a Chocolatey package for a signed installer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qc-pm-'))
  try {
    const installer = join(dir, 'setup.exe'),
      bytes = Buffer.from('synthetic installer bytes')
    writeFileSync(installer, bytes)
    const sha = createHash('sha256').update(bytes).digest('hex')
    const result = run(
      '--version',
      'v1.0.4',
      '--installer',
      installer,
      '--product-code',
      'a1b2-product',
      '--display-name',
      'QueueCumber 1.0.4',
      '--publisher',
      'Davide Maggi',
      '--date',
      '2026-10-24',
      '--out',
      dir,
    )
    expect(result.status, result.stderr).toBe(0)
    const out = JSON.parse(result.stdout)
    expect(out.winget).toBe(
      join(dir, 'winget/manifests/d/DavideMaggi/QueueCumber/1.0.4'),
    )
    const read = (file) => readFileSync(join(out.winget, file), 'utf8')
    const installerYaml = read('DavideMaggi.QueueCumber.installer.yaml')
    expect(installerYaml).toContain('winget-manifest.installer.1.10.0.schema')
    expect(installerYaml).toContain('ManifestVersion: "1.10.0"')
    expect(installerYaml).toContain('InstallerType: "nullsoft"')
    expect(installerYaml).toContain('Scope: "user"')
    expect(installerYaml).toContain(`InstallerSha256: "${sha.toUpperCase()}"`)
    expect(installerYaml).toContain(
      'InstallerUrl: "https://github.com/davidemaggi/QueueCumber/releases/download/v1.0.4/QueueCumber-1.0.4-win-x64-signed-setup.exe"',
    )
    expect(installerYaml).toContain('ProductCode: "a1b2-product"')
    expect(installerYaml).not.toContain('Commands')
    const en = read('DavideMaggi.QueueCumber.locale.en-US.yaml')
    expect(en).toContain('Moniker: "queuecumber"')
    // Notes come from docs/RELEASE_NOTES_1.0.4.md, without build records or Markdown.
    expect(en).toMatch(/ReleaseNotes: ".*Routing keys are now one flat list/)
    expect(en).not.toContain('Downloads and verification')
    expect(en).not.toContain('**')
    expect(en).not.toContain('Icons')
    const it = read('DavideMaggi.QueueCumber.locale.it-IT.yaml')
    expect(it).toContain('ManifestType: "locale"')
    expect(it).not.toContain('Moniker')

    const nuspec = readFileSync(
      join(out.chocolatey, 'queuecumber.nuspec'),
      'utf8',
    )
    expect(nuspec).toContain('<owners>davidemaggi</owners>')
    expect(nuspec).toContain(
      '<iconUrl>https://cdn.jsdelivr.net/gh/davidemaggi/QueueCumber@v1.0.4/resources/linux/256x256.png</iconUrl>',
    )
    expect(nuspec).toContain(
      '<packageSourceUrl>https://github.com/davidemaggi/QueueCumber/tree/main/packaging</packageSourceUrl>',
    )
    const install = readFileSync(
      join(out.chocolatey, 'tools/chocolateyinstall.ps1'),
      'utf8',
    )
    expect(install).toContain(`checksum64     = '${sha}'`)
    expect(install).toContain("silentArgs     = '/S'")
    const uninstall = readFileSync(
      join(out.chocolatey, 'tools/chocolateyuninstall.ps1'),
      'utf8',
    )
    expect(uninstall).toContain(
      "Get-UninstallRegistryKey -SoftwareName 'QueueCumber*'",
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

it('refuses pre-release versions and missing inputs', () => {
  expect(run('--version', '1.0.4').status).not.toBe(0)
  expect(
    run('--version', 'v1.1.0-beta.1', '--installer', 'package.json').status,
  ).not.toBe(0)
})
