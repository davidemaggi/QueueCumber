#!/usr/bin/env node
// Writes the winget manifests and the Chocolatey package for one release, from
// packaging/package-managers.json and the release's signed Windows installer.
// Used by .github/workflows/package-managers.yml; run it locally to look at the output:
//
//   node scripts/package-managers.mjs --version 1.0.4 \
//     --installer path/to/QueueCumber-1.0.4-win-x64-signed-setup.exe \
//     --product-code '…' --display-name 'QueueCumber 1.0.4' --publisher 'Davide Maggi' \
//     --out out/package-managers
//
// --product-code, --display-name and --publisher are what the installer writes in "Installed
// apps" (the workflow reads them from the registry after a real install). Without them the winget
// installer manifest leaves the Apps and Features entry out. Built-in modules only.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { URL } from 'node:url'
import console from 'node:console'
import process from 'node:process'

const { values: args } = parseArgs({
  options: {
    version: { type: 'string' },
    installer: { type: 'string' },
    'product-code': { type: 'string' },
    'display-name': { type: 'string' },
    publisher: { type: 'string' },
    repo: {
      type: 'string',
      default: process.env.GITHUB_REPOSITORY || 'davidemaggi/QueueCumber',
    },
    date: { type: 'string', default: new Date().toISOString().slice(0, 10) },
    out: { type: 'string', default: 'out/package-managers' },
  },
})
if (!args.version || !args.installer)
  fail('--version and --installer are required')
if (!/^\d+\.\d+\.\d+$/.test(args.version.replace(/^v/, '')))
  fail('--version must be a stable SemVer release such as 1.0.4')
if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) fail('--date must be YYYY-MM-DD')

const root = new URL('..', import.meta.url)
const meta = JSON.parse(
  readFileSync(new URL('packaging/package-managers.json', root), 'utf8'),
)
const version = args.version.replace(/^v/, '')
const tag = `v${version}`
const asset = meta.windowsInstaller.asset.replace('{version}', version)
const installerUrl = `https://github.com/${args.repo}/releases/download/${tag}/${asset}`
const sha256 = createHash('sha256')
  .update(readFileSync(args.installer))
  .digest('hex')
const releaseUrl = `https://github.com/${args.repo}/releases/tag/${tag}`
const notes = releaseNotes(version)
const commands = meta.windowsInstaller.commands ?? []

// ── winget ───────────────────────────────────────────────────────────────────────────────
// 1.10.0: the newest schema the runners' winget (1.11) reads without header warnings.
const MANIFEST_VERSION = '1.10.0'
const id = meta.winget.id
const wingetDir = join(
  args.out,
  'winget',
  'manifests',
  id[0].toLowerCase(),
  ...id.split('.'),
  version,
)
mkdirSync(wingetDir, { recursive: true })
const header = (type) =>
  `# yaml-language-server: $schema=https://aka.ms/winget-manifest.${type}.${MANIFEST_VERSION}.schema.json\n\n`
const write = (file, type, body) =>
  writeFileSync(join(wingetDir, file), header(type) + yaml(body))

write(`${id}.yaml`, 'version', {
  PackageIdentifier: id,
  PackageVersion: version,
  DefaultLocale: 'en-US',
  ManifestType: 'version',
  ManifestVersion: MANIFEST_VERSION,
})

const entry = args['product-code']
  ? {
      ProductCode: args['product-code'],
      AppsAndFeaturesEntries: [
        {
          DisplayName: args['display-name'] || `${meta.name} ${version}`,
          Publisher: args.publisher || meta.publisher,
          DisplayVersion: version,
          ProductCode: args['product-code'],
        },
      ],
    }
  : {}
write(`${id}.installer.yaml`, 'installer', {
  PackageIdentifier: id,
  PackageVersion: version,
  Platform: ['Windows.Desktop'],
  MinimumOSVersion: meta.windowsInstaller.minimumOSVersion,
  // electron-builder's one-click NSIS installer, per user, under HKCU.
  InstallerType: 'nullsoft',
  Scope: 'user',
  InstallModes: ['interactive', 'silent', 'silentWithProgress'],
  UpgradeBehavior: 'install',
  ...(commands.length ? { Commands: commands } : {}),
  ReleaseDate: args.date,
  Installers: [
    {
      Architecture: 'x64',
      InstallerUrl: installerUrl,
      InstallerSha256: sha256.toUpperCase(),
      ...entry,
    },
  ],
  ManifestType: 'installer',
  ManifestVersion: MANIFEST_VERSION,
})

for (const [locale, text] of Object.entries(meta.locales)) {
  const isDefault = locale === 'en-US'
  write(`${id}.locale.${locale}.yaml`, isDefault ? 'defaultLocale' : 'locale', {
    PackageIdentifier: id,
    PackageVersion: version,
    PackageLocale: locale,
    Publisher: meta.publisher,
    PublisherUrl: meta.publisherUrl,
    PublisherSupportUrl: meta.supportUrl,
    Author: meta.author,
    PackageName: meta.name,
    PackageUrl: meta.projectUrl,
    License: meta.license,
    LicenseUrl: meta.licenseUrl,
    Copyright: meta.copyright,
    ShortDescription: text.shortDescription,
    Description: text.description,
    ...(isDefault ? { Moniker: meta.winget.moniker } : {}),
    Tags: meta.tags,
    ...(isDefault && notes ? { ReleaseNotes: notes } : {}),
    ReleaseNotesUrl: releaseUrl,
    Documentations: [
      { DocumentLabel: 'User guide', DocumentUrl: meta.docsUrl },
    ],
    ManifestType: isDefault ? 'defaultLocale' : 'locale',
    ManifestVersion: MANIFEST_VERSION,
  })
}

// ── Chocolatey ───────────────────────────────────────────────────────────────────────────
const choco = meta.chocolatey
const chocoDir = join(args.out, 'chocolatey', choco.id)
mkdirSync(join(chocoDir, 'tools'), { recursive: true })
const [owner, repo] = args.repo.split('/')
const iconUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${tag}/${meta.icon}`
const en = meta.locales['en-US']

writeFileSync(
  join(chocoDir, `${choco.id}.nuspec`),
  `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd">
  <metadata>
    <id>${choco.id}</id>
    <version>${version}</version>
    <title>${xml(meta.name)}</title>
    <authors>${xml(meta.author)}</authors>
    <owners>${xml(choco.owners)}</owners>
    <projectUrl>${meta.projectUrl}</projectUrl>
    <projectSourceUrl>${meta.projectUrl}</projectSourceUrl>
    <packageSourceUrl>${meta.projectUrl}/tree/main/packaging</packageSourceUrl>
    <docsUrl>${meta.docsUrl}</docsUrl>
    <bugTrackerUrl>${meta.supportUrl}</bugTrackerUrl>
    <iconUrl>${iconUrl}</iconUrl>
    <licenseUrl>${meta.licenseUrl}</licenseUrl>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <copyright>${xml(meta.copyright)}</copyright>
    <tags>${meta.tags.join(' ')}</tags>
    <summary>${xml(en.shortDescription)}</summary>
    <description>${xml(en.description)}</description>
    <releaseNotes>${xml(notes ? `${notes}\n\n${releaseUrl}` : releaseUrl)}</releaseNotes>
  </metadata>
  <files>
    <file src="tools\\**" target="tools" />
  </files>
</package>
`,
)

writeFileSync(
  join(chocoDir, 'tools', 'chocolateyinstall.ps1'),
  `$ErrorActionPreference = 'Stop'

# The signed installer from the GitHub release. electron-builder's one-click NSIS installer
# installs ${meta.name} for the current user.
$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = '${installerUrl}'
  checksum64     = '${sha256}'
  checksumType64 = 'sha256'
  softwareName   = '${meta.name}*'
  silentArgs     = '${meta.windowsInstaller.silentArgs}'
  validExitCodes = @(0)
}
Install-ChocolateyPackage @packageArgs
`,
)

writeFileSync(
  join(chocoDir, 'tools', 'chocolateyuninstall.ps1'),
  `$ErrorActionPreference = 'Stop'

[array]$keys = Get-UninstallRegistryKey -SoftwareName '${meta.name}*'
if ($keys.Count -eq 0) {
  Write-Warning "${meta.name} isn't installed any more: nothing to uninstall."
  return
}
foreach ($key in $keys) {
  # electron-builder writes '"C:\\...\\Uninstall ${meta.name}.exe" /currentuser'
  if ($key.UninstallString -match '^"([^"]+)"\\s*(.*)$') {
    $file = $Matches[1]
    $silentArgs = "$($Matches[2]) ${meta.windowsInstaller.silentArgs}".Trim()
  } else {
    $file = $key.UninstallString
    $silentArgs = '${meta.windowsInstaller.silentArgs}'
  }
  Uninstall-ChocolateyPackage -PackageName $env:ChocolateyPackageName -FileType 'exe' \`
    -SilentArgs $silentArgs -File $file -ValidExitCodes @(0)
}
`,
)

console.log(
  JSON.stringify(
    { version, installerUrl, sha256, winget: wingetDir, chocolatey: chocoDir },
    null,
    2,
  ),
)

// ── helpers ──────────────────────────────────────────────────────────────────────────────

/** The user-facing part of docs/RELEASE_NOTES_<version>.md, as plain text. */
function releaseNotes(v) {
  const file = new URL(`docs/RELEASE_NOTES_${v}.md`, root)
  if (!existsSync(file)) return ''
  const lines = readFileSync(file, 'utf8').split('\n')
  const body = lines.slice(lines[0]?.startsWith('# ') ? 1 : 0)
  // Build and verification records follow; package users want the changes.
  const end = body.findIndex((l) => l.startsWith('## Downloads'))
  return (end < 0 ? body : body.slice(0, end))
    .join('\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

/** Plain YAML: mappings, lists, strings as JSON (valid YAML double-quoted scalars). */
function yaml(value, indent = '') {
  if (Array.isArray(value))
    return value
      .map((item) =>
        item && typeof item === 'object'
          ? `${indent}- ${yaml(item, `${indent}  `).trimStart()}`
          : `${indent}- ${scalar(item)}\n`,
      )
      .join('')
  return Object.entries(value)
    .map(([key, v]) =>
      v && typeof v === 'object'
        ? `${indent}${key}:\n${yaml(v, `${indent}  `)}`
        : `${indent}${key}: ${scalar(v)}\n`,
    )
    .join('')
}

function scalar(v) {
  return typeof v === 'string' ? JSON.stringify(v) : String(v)
}

function xml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function fail(message) {
  console.error(`package-managers: ${message}`)
  process.exit(1)
}
