import { it, expect } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import process from 'node:process'

it('validates a real tag commit/version and refuses tags outside development', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qc-release-'))
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf8',
    }).trim()
  const run = (tag) =>
    spawnSync(process.execPath, [resolve('scripts/validate-release.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        RELEASE_TAG: tag,
        GITHUB_OUTPUT: join(dir, 'output'),
      },
    })
  try {
    git('init')
    git('config', 'commit.gpgsign', 'false')
    git('config', 'core.hooksPath', join(dir, 'no-hooks'))
    git('config', 'user.email', 'synthetic@example.invalid')
    git('config', 'user.name', 'Synthetic')
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ version: '1.2.3+build-alpha' }),
    )
    git('add', 'package.json')
    git('commit', '-m', 'synthetic')
    git('tag', 'v1.2.3+build-alpha')
    git('update-ref', 'refs/remotes/origin/development', 'HEAD')
    expect(run('v1.2.3+build-alpha').status).toBe(0)
    expect(readFileSync(join(dir, 'output'), 'utf8')).toContain(
      'prerelease=false',
    )
    git('tag', 'v1.2.4')
    expect(run('v1.2.4').status).not.toBe(0)
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ version: '1.2.4-alpha.1' }),
    )
    git('add', 'package.json')
    git('commit', '-m', 'outside development')
    git('tag', 'v1.2.4-alpha.1')
    expect(run('v1.2.4-alpha.1').status).not.toBe(0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

it('writes deterministic checksums for actual release files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qc-checksum-'))
  try {
    writeFileSync(join(dir, 'a.zip'), 'abc')
    execFileSync(process.execPath, [resolve('scripts/make-checksums.mjs'), dir])
    expect(readFileSync(join(dir, 'SHA256SUMS.txt'), 'utf8')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  a.zip\n',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

it.skipIf(spawnSync('pwsh', ['--version']).error)(
  'rejects invalid, untimestamped or wrong-publisher Windows signatures',
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'qc-signatures-'))
    try {
      mkdirSync(join(dir, 'win-unpacked'))
      writeFileSync(join(dir, 'win-unpacked', 'QueueCumber.exe'), 'synthetic')
      writeFileSync(join(dir, 'QueueCumber-1.2.3-x64-setup.exe'), 'synthetic')
      const script = `
  $ErrorActionPreference='Stop'
  $cert=[pscustomobject]@{}
  $cert | Add-Member ScriptMethod GetNameInfo { param($type,$issuer) return 'Synthetic Publisher' }
  function Get-AuthenticodeSignature { param($LiteralPath) return [pscustomobject]@{Status=$env:QC_SIGNATURE_STATUS;SignerCertificate=$cert;TimeStamperCertificate=$(if($env:QC_TIMESTAMP -eq 'yes'){$cert}else{$null})} }
  & $env:QC_VERIFY -Directory $env:QC_DIR -Publisher $env:QC_PUBLISHER
  `
      const run = (status, timestamp, publisher) =>
        spawnSync(
          'pwsh',
          ['-NoProfile', '-NonInteractive', '-Command', script],
          {
            encoding: 'utf8',
            env: {
              ...process.env,
              QC_VERIFY: resolve('scripts/verify-windows-signatures.ps1'),
              QC_DIR: dir,
              QC_SIGNATURE_STATUS: status,
              QC_TIMESTAMP: timestamp,
              QC_PUBLISHER: publisher,
            },
          },
        )
      expect(run('Valid', 'yes', 'Synthetic Publisher').status).toBe(0)
      expect(run('NotSigned', 'yes', 'Synthetic Publisher').status).not.toBe(0)
      expect(run('Valid', 'no', 'Synthetic Publisher').status).not.toBe(0)
      expect(run('Valid', 'yes', 'Different Publisher').status).not.toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  },
)
