import { it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import process from 'node:process'
import meta from '../../packaging/package-managers.json'

const run = (...args) =>
  spawnSync(process.execPath, ['scripts/package-managers-unix.mjs', ...args], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_REPOSITORY: '' },
  })

// Synthetic hashes: one per release file the cask and the PKGBUILD use
const macSha = 'a'.repeat(64),
  debSha = 'B'.repeat(64)
const sums = [
  `${macSha}  QueueCumber-1.0.5-mac-arm64-unsigned.zip`,
  `${debSha} *QueueCumber-1.0.5-linux-amd64-unsigned.deb`,
  `${'c'.repeat(64)}  QueueCumber-1.0.5-linux-x86_64-unsigned.rpm`,
  '',
].join('\n')

const withSums = (content, test) => {
  const dir = mkdtempSync(join(tmpdir(), 'qc-pm-unix-'))
  try {
    writeFileSync(join(dir, 'SHA256SUMS.txt'), content)
    test(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

it('keeps Unix package metadata matched to the release files', () => {
  expect(meta.checksums).toBe('SHA256SUMS.txt')
  expect(meta.homebrew.tap).toBe('davidemaggi/homebrew-tap')
  expect(meta.homebrew.desc.length).toBeLessThan(80)
  expect(meta.homebrew.desc).not.toMatch(/^QueueCumber|\.$/)
  expect(meta.aur.enabled).toBe(false)
  expect(meta.aur.package).toBe(`${meta.aur.provides}-bin`)
  // dnf matches package names case-sensitively: these are the names inside the .deb and .rpm
  expect(meta.cloudsmith.debPackage).toBe('queuecumber')
  expect(meta.cloudsmith.rpmPackage).toBe('queuecumber')
  // electron-builder.unsigned.mjs names the files this way
  expect(readFileSync('electron-builder.unsigned.mjs', 'utf8')).toContain(
    "'QueueCumber-${version}-${os}-${arch}-unsigned.${ext}'",
  )
})

it('writes a Homebrew cask, a PKGBUILD and a dnf .repo file from SHA256SUMS', () => {
  withSums(sums, (dir) => {
    const result = run(
      '--version',
      'v1.0.5',
      '--sums',
      join(dir, 'SHA256SUMS.txt'),
      '--out',
      dir,
    )
    expect(result.status, result.stderr).toBe(0)
    const out = JSON.parse(result.stdout)

    const cask = readFileSync(out.homebrew, 'utf8')
    expect(cask).toMatch(/^cask "queuecumber" do\n {2}version "1\.0\.5"\n/)
    // arm64 only: no arch stanza, and brew refuses Intel Macs up front
    expect(cask).not.toContain('arch arm:')
    expect(cask).toContain(`sha256 "${macSha}"`)
    expect(cask).toContain(
      'url "https://github.com/davidemaggi/QueueCumber/releases/download/v#{version}/QueueCumber-#{version}-mac-arm64-unsigned.zip"',
    )
    expect(cask).toContain('depends_on arch: :arm64')
    expect(cask).toContain('depends_on macos: :ventura')
    expect(cask).toContain('strategy :github_latest')
    expect(cask).toContain('app "QueueCumber.app"')
    expect(cask).not.toContain('binary')
    // Homebrew 7 rejects postflight blocks; postflight_steps is the supported form
    expect(cask).toContain(
      'run "/usr/bin/xattr", args: ["-dr", "com.apple.quarantine", "{{appdir}}/QueueCumber.app"]',
    )
    expect(cask).not.toMatch(/postflight do/)
    const zap = [...cask.matchAll(/^ {4}"(~[^"]+)",$/gm)].map(([, p]) => p)
    expect(zap).toEqual([...meta.homebrew.zap].sort())

    const pkgbuild = readFileSync(join(out.aur, 'PKGBUILD'), 'utf8')
    expect(pkgbuild).toContain('pkgname=queuecumber-bin\npkgver=1.0.5\n')
    expect(pkgbuild).toContain("arch=('x86_64')")
    expect(pkgbuild).toContain(`sha256sums_x86_64=('${debSha.toLowerCase()}')`)
    expect(pkgbuild).toContain(
      'source_x86_64=("queuecumber-${pkgver}-x86_64.deb::https://github.com/davidemaggi/QueueCumber/releases/download/v${pkgver}/QueueCumber-${pkgver}-linux-amd64-unsigned.deb")',
    )
    expect(pkgbuild).toContain("options=('!strip' '!debug')")
    expect(pkgbuild).toContain(
      'chmod 4755 "$pkgdir/opt/QueueCumber/chrome-sandbox"',
    )
    expect(pkgbuild).toContain(
      `ln -s '/opt/QueueCumber/queuecumber' "$pkgdir/usr/bin/queuecumber"`,
    )
    expect(pkgbuild).toContain(
      `pkgdesc='See what'"'"'s flowing through RabbitMQ`,
    )

    const repo = readFileSync(out.dnfRepo, 'utf8')
    expect(repo).toContain(
      'baseurl=https://dl.cloudsmith.io/public/davidemaggi/dm-queuecumber/rpm/any-distro/any-version/$basearch',
    )
    expect(repo).toContain('gpgcheck=1\nrepo_gpgcheck=1\n')
    expect(repo).toContain(`gpgkey=${meta.cloudsmith.gpgKey}`)
    // Fedora 43+ has no /etc/pki/tls/certs/ca-bundle.crt: pointing at it breaks dnf
    expect(repo).not.toContain('sslcacert')
  })
})

it('refuses missing hashes, pre-releases and missing inputs', () => {
  withSums(sums.replace(/^.*mac-arm64.*$/m, ''), (dir) => {
    const result = run(
      '--version',
      '1.0.5',
      '--sums',
      join(dir, 'SHA256SUMS.txt'),
      '--out',
      dir,
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('QueueCumber-1.0.5-mac-arm64-unsigned.zip')
  })
  expect(run('--version', '1.0.5').status).not.toBe(0)
  expect(
    run('--version', 'v1.1.0-beta.1', '--sums', 'package.json').status,
  ).not.toBe(0)
})
