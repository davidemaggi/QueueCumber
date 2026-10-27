#!/usr/bin/env node
// Writes the Homebrew cask, the AUR package (PKGBUILD) and the dnf .repo file for one release,
// from packaging/package-managers.json and the release's SHA256SUMS.txt. Nothing is rebuilt: the
// cask and the PKGBUILD point at files already on the GitHub release.
// Used by .github/workflows/package-managers.yml; run it locally to look at the output:
//
//   node scripts/package-managers-unix.mjs --version 1.0.5 --sums path/to/SHA256SUMS.txt \
//     --out out/package-managers
//
// The AUR .SRCINFO needs makepkg, so the workflow writes it in an Arch container. Built-in
// modules only.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { URL } from 'node:url'
import console from 'node:console'
import process from 'node:process'

const { values: args } = parseArgs({
  options: {
    version: { type: 'string' },
    sums: { type: 'string' },
    repo: {
      type: 'string',
      default: process.env.GITHUB_REPOSITORY || 'davidemaggi/QueueCumber',
    },
    out: { type: 'string', default: 'out/package-managers' },
  },
})
if (!args.version || !args.sums) fail('--version and --sums are required')
const version = args.version.replace(/^v/, '')
if (!/^\d+\.\d+\.\d+$/.test(version))
  fail('--version must be a stable SemVer release such as 1.0.5')

const meta = JSON.parse(
  readFileSync(
    new URL('../packaging/package-managers.json', import.meta.url),
    'utf8',
  ),
)
const en = meta.locales['en-US']
/** Release download URL; `ver` is the version as the target format writes it (a variable there) */
const download = (file, ver = version) =>
  `https://github.com/${args.repo}/releases/download/v${ver}/${file}`
const assetFor = (template, arch, ver = version) =>
  template.replaceAll('{version}', ver).replaceAll('{arch}', arch)

// SHA256SUMS lines: "<hash>  <file>" (or "<hash> *<file>")
const sums = new Map(
  readFileSync(args.sums, 'utf8')
    .split('\n')
    .map((line) => line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/))
    .filter(Boolean)
    .map(([, hash, file]) => [file, hash.toLowerCase()]),
)
const sumOf = (file) => sums.get(file) ?? fail(`${file} isn't in ${args.sums}`)

// ── Homebrew cask ─────────────────────────────────────────────────────────────────────────────
const brew = meta.homebrew
const brewDir = join(args.out, 'homebrew', 'Casks')
mkdirSync(brewDir, { recursive: true })
const brewArch = Object.entries(brew.arches) // e.g. [['arm', 'arm64'], ['intel', 'x64']]
let archLines, shaLine, urlFile, onlyArch
if (brewArch.length === 1) {
  // One architecture only: no arch stanza, and brew refuses the other one up front
  const [[key, arch]] = brewArch
  archLines = []
  shaLine = `sha256 "${sumOf(assetFor(brew.asset, arch))}"`
  urlFile = assetFor(brew.asset, arch, '#{version}')
  onlyArch = key === 'arm' ? 'arm64' : 'x86_64'
} else {
  // Keys padded to one width: brew style aligns the values of a multi-line hash
  const width = Math.max(...brewArch.map(([key]) => key.length)) + 1
  archLines = [
    `arch ${brewArch.map(([key, arch]) => `${key}: "${arch}"`).join(', ')}`,
    '',
  ]
  shaLine = `sha256 ${brewArch
    .map(
      ([key, arch]) =>
        `${`${key}:`.padEnd(width)} "${sumOf(assetFor(brew.asset, arch))}"`,
    )
    .join(',\n         ')}`
  urlFile = assetFor(brew.asset, '#{arch}', '#{version}')
}
const depends = [
  ...(onlyArch ? [`depends_on arch: :${onlyArch}`] : []),
  `depends_on macos: :${brew.minimumMacOS}`,
]
const appdirPath = (inside) => `"#{appdir}/${brew.app}/${inside}"`
const cask = [
  `cask "${brew.cask}" do`,
  ...archLines.map((line) => (line ? `  ${line}` : '')),
  `  version "${version}"`,
  `  ${shaLine}`,
  '',
  `  url "${download(urlFile, '#{version}')}"`,
  `  name "${meta.name}"`,
  `  desc "${brew.desc.replace(/"/g, '\\"')}"`,
  `  homepage "${meta.projectUrl}"`,
  '',
  '  livecheck do',
  '    url :url',
  '    strategy :github_latest',
  '  end',
  '',
  ...depends.map((line) => `  ${line}`),
  '',
  `  app "${brew.app}"`,
  ...brew.binaries.map((inside) => `  binary ${appdirPath(inside)}`),
  ...(brew.removeQuarantine
    ? [
        '',
        '  # Not notarized by Apple: without this, macOS refuses to open it the first time',
        '  postflight_steps do',
        `    run "/usr/bin/xattr", args: ["-dr", "com.apple.quarantine", "{{appdir}}/${brew.app}"]`,
        '  end',
      ]
    : []),
  '',
  '  zap trash: [',
  ...[...brew.zap].sort().map((path) => `    "${path}",`),
  '  ]',
  'end',
  '',
]
writeFileSync(join(brewDir, `${brew.cask}.rb`), cask.join('\n'))

// ── AUR ───────────────────────────────────────────────────────────────────────────────────────
const aur = meta.aur
const aurDir = join(args.out, 'aur', aur.package)
mkdirSync(aurDir, { recursive: true })
const aurArch = Object.entries(aur.arches) // e.g. [['x86_64', 'amd64']]
const quote = (s) => `'${s.replace(/'/g, `'"'"'`)}'`
const sourceName = (arch) => `${aur.provides}-\${pkgver}-${arch}.deb`
const pkgbuild = [
  `# Maintainer: ${aur.maintainer}`,
  "# Generated by scripts/package-managers-unix.mjs from the release's own .deb: the app",
  `# isn't rebuilt here. Source: ${meta.projectUrl}`,
  '',
  `pkgname=${aur.package}`,
  `pkgver=${version}`,
  'pkgrel=1',
  `pkgdesc=${quote(en.shortDescription)}`,
  `arch=(${aurArch.map(([arch]) => quote(arch)).join(' ')})`,
  `url=${quote(meta.projectUrl)}`,
  `license=(${quote(meta.license)})`,
  `depends=(${aur.depends.map(quote).join(' ')})`,
  ...(aur.optdepends?.length
    ? [`optdepends=(${aur.optdepends.map(quote).join(' ')})`]
    : []),
  `provides=(${quote(aur.provides)})`,
  `conflicts=(${quote(aur.provides)})`,
  "options=('!strip' '!debug')",
  ...aurArch.map(
    ([arch, debArch]) =>
      `source_${arch}=("${sourceName(arch)}::${download(assetFor(aur.asset, debArch, '${pkgver}'), '${pkgver}')}")`,
  ),
  ...aurArch.map(
    ([arch, debArch]) =>
      `sha256sums_${arch}=('${sumOf(assetFor(aur.asset, debArch))}')`,
  ),
  '',
  'package() {',
  '  bsdtar -xf data.tar.xz -C "$pkgdir"',
  '  rm -rf "$pkgdir/usr/share/doc"',
  "  # Chromium's sandbox helper must be setuid root where user namespaces are off",
  `  chmod 4755 "$pkgdir${aur.installDir}/chrome-sandbox"`,
  '  install -d "$pkgdir/usr/bin"',
  ...Object.entries(aur.links).map(
    ([link, target]) => `  ln -s ${quote(target)} "$pkgdir${link}"`,
  ),
  '}',
  '',
]
writeFileSync(join(aurDir, 'PKGBUILD'), pkgbuild.join('\n'))

// ── dnf .repo file ────────────────────────────────────────────────────────────────────────────
// Cloudsmith's setup.rpm.sh points sslcacert at /etc/pki/tls/certs/ca-bundle.crt, which Fedora
// 43+ no longer ships, so dnf can't read the repository. This file leaves sslcacert out.
const cs = meta.cloudsmith
const csDir = join(args.out, 'cloudsmith')
mkdirSync(csDir, { recursive: true })
const repoFile = `${cs.rpmPackage}.repo`
writeFileSync(
  join(csDir, repoFile),
  [
    `[${cs.owner}-${cs.repository}]`,
    `name=${meta.name}`,
    `baseurl=https://dl.cloudsmith.io/public/${cs.owner}/${cs.repository}/rpm/any-distro/any-version/$basearch`,
    'enabled=1',
    'gpgcheck=1',
    'repo_gpgcheck=1',
    `gpgkey=${cs.gpgKey}`,
    '',
  ].join('\n'),
)

console.log(
  JSON.stringify(
    {
      version,
      homebrew: join(brewDir, `${brew.cask}.rb`),
      aur: aurDir,
      dnfRepo: join(csDir, repoFile),
    },
    null,
    2,
  ),
)

function fail(message) {
  console.error(`package-managers-unix: ${message}`)
  process.exit(1)
}
