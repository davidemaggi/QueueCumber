import { it, expect } from 'vitest'
import { execFile, execFileSync, spawnSync } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
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

it('accepts only a merged main PR and its immutable versioned commit', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qc-release-'))
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: dir,
      stdio: 'pipe',
      encoding: 'utf8',
    }).trim()
  const eventPath = join(dir, 'event.json')
  const run = (event, sha) => {
    writeFileSync(eventPath, JSON.stringify(event))
    return spawnSync(
      process.execPath,
      [resolve('scripts/validate-release.mjs')],
      {
        cwd: dir,
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_EVENT_NAME: 'pull_request_target',
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_REPOSITORY: 'synthetic/queuecumber',
          RELEASE_COMMIT: sha,
          GITHUB_OUTPUT: join(dir, 'output'),
          RELEASE_CONTEXT: join(dir, 'release-context.json'),
        },
      },
    )
  }
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
    git('commit', '-m', 'synthetic main merge')
    const sha = git('rev-parse', 'HEAD')
    git('update-ref', 'refs/remotes/origin/main', sha)
    const event = {
      action: 'closed',
      pull_request: {
        merged: true,
        merge_commit_sha: sha,
        base: { ref: 'main', repo: { full_name: 'synthetic/queuecumber' } },
      },
    }
    expect(run(event, sha).status).toBe(0)
    expect(
      JSON.parse(readFileSync(join(dir, 'release-context.json'), 'utf8')),
    ).toEqual({
      commit: sha,
      tag: 'v1.2.3+build-alpha',
      version: '1.2.3+build-alpha',
    })
    mkdirSync(join(dir, 'release-context'))
    writeFileSync(
      join(dir, 'release-context/release-context.json'),
      readFileSync(join(dir, 'release-context.json')),
    )
    const followup = {
      repository: { full_name: 'synthetic/queuecumber' },
      workflow_run: {
        conclusion: 'success',
        event: 'pull_request_target',
        head_branch: 'development',
        path: '.github/workflows/release.yml@main',
      },
    }
    writeFileSync(join(dir, 'followup.json'), JSON.stringify(followup))
    const prepare = spawnSync(
      process.execPath,
      [resolve('scripts/prepare-signing.mjs')],
      {
        cwd: dir,
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_EVENT_NAME: 'workflow_run',
          GITHUB_EVENT_PATH: join(dir, 'followup.json'),
          GITHUB_REPOSITORY: 'synthetic/queuecumber',
          GITHUB_OUTPUT: join(dir, 'sign-output'),
          WINDOWS_SIGNING_ENABLED: 'false',
        },
      },
    )
    expect(prepare.status, prepare.stderr).toBe(0)
    expect(readFileSync(join(dir, 'sign-output'), 'utf8')).toContain(
      'available=false',
    )

    const requested = []
    const release = {
      id: 42,
      draft: true,
      tag_name: 'v1.2.3+build-alpha',
      target_commitish: sha,
    }
    let taggedCommit
    const server = createServer((req, res) => {
      requested.push(req.url)
      res.setHeader('Content-Type', 'application/json')
      if (req.url.includes('/actions/runners?'))
        res.end(
          JSON.stringify({
            total_count: 1,
            runners: [
              {
                status: 'online',
                busy: false,
                labels: ['self-hosted', 'Windows', 'X64', 'codesign'].map(
                  (name) => ({ name }),
                ),
              },
            ],
          }),
        )
      else if (req.url.includes('/releases?'))
        res.end(JSON.stringify([release]))
      else if (req.url.includes('/git/ref/tags/') && taggedCommit)
        res.end(
          JSON.stringify({ object: { type: 'commit', sha: taggedCommit } }),
        )
      else if (req.url.includes('/commits/') && taggedCommit)
        res.end(JSON.stringify({ sha: taggedCommit }))
      else if (req.url.endsWith('/releases/42'))
        res.end(JSON.stringify(release))
      else {
        res.statusCode = 404
        res.end('{}')
      }
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const signingEnv = {
      ...process.env,
      GITHUB_EVENT_NAME: 'workflow_run',
      GITHUB_EVENT_PATH: join(dir, 'followup.json'),
      GITHUB_REPOSITORY: 'synthetic/queuecumber',
      GITHUB_OUTPUT: join(dir, 'enabled-output'),
      GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
      GH_TOKEN: 'synthetic',
      SIGNING_RUNNER_READ_TOKEN: 'synthetic',
      WINDOWS_SIGNING_ENABLED: 'true',
      EXPECTED_RELEASE_ID: '42',
      EXPECTED_COMMIT: sha,
      RELEASE_TAG: release.tag_name,
    }
    try {
      await promisify(execFile)(
        process.execPath,
        [resolve('scripts/prepare-signing.mjs')],
        { cwd: dir, env: signingEnv },
      )
      expect(readFileSync(join(dir, 'enabled-output'), 'utf8')).toContain(
        'available=true',
      )
      expect(readFileSync(join(dir, 'enabled-output'), 'utf8')).toContain(
        'releaseId=42',
      )
      await promisify(execFile)(
        process.execPath,
        [resolve('scripts/verify-signing-release.mjs')],
        { cwd: dir, env: signingEnv },
      )
      expect(requested.some((url) => url.includes('/git/ref/tags/'))).toBe(true)
      expect(requested.some((url) => url.includes('/commits/'))).toBe(false)
      taggedCommit = 'b'.repeat(40)
      await expect(
        promisify(execFile)(
          process.execPath,
          [resolve('scripts/verify-signing-release.mjs')],
          { cwd: dir, env: signingEnv },
        ),
      ).rejects.toThrow()
      taggedCommit = undefined
      release.target_commitish = 'b'.repeat(40)
      await expect(
        promisify(execFile)(
          process.execPath,
          [resolve('scripts/verify-signing-release.mjs')],
          { cwd: dir, env: signingEnv },
        ),
      ).rejects.toThrow()
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }

    expect(readFileSync(join(dir, 'output'), 'utf8')).toContain(
      'tag=v1.2.3+build-alpha',
    )
    expect(readFileSync(join(dir, 'output'), 'utf8')).toContain(
      'prerelease=false',
    )
    expect(
      run(
        { ...event, pull_request: { ...event.pull_request, merged: false } },
        sha,
      ).status,
    ).not.toBe(0)
    expect(
      run(
        {
          ...event,
          pull_request: {
            ...event.pull_request,
            base: { ...event.pull_request.base, ref: 'development' },
          },
        },
        sha,
      ).status,
    ).not.toBe(0)
    expect(run({ ...event, action: 'opened' }, sha).status).not.toBe(0)
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ version: '1.2.4-alpha.1' }),
    )
    git('add', 'package.json')
    git('commit', '-m', 'outside main')
    const outside = git('rev-parse', 'HEAD')
    expect(
      run(
        {
          ...event,
          pull_request: { ...event.pull_request, merge_commit_sha: outside },
        },
        outside,
      ).status,
    ).not.toBe(0)
    git('update-ref', 'refs/remotes/origin/main', outside)
    expect(
      run(
        {
          ...event,
          pull_request: { ...event.pull_request, merge_commit_sha: outside },
        },
        sha,
      ).status,
    ).not.toBe(0)
    git('tag', 'v1.2.4-alpha.1', sha)
    expect(
      run(
        {
          ...event,
          pull_request: { ...event.pull_request, merge_commit_sha: outside },
        },
        outside,
      ).status,
    ).not.toBe(0)
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
      execFileSync(
        'pwsh',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Compress-Archive -LiteralPath (Join-Path $env:QC_DIR "win-unpacked/QueueCumber.exe") -DestinationPath (Join-Path $env:QC_DIR "QueueCumber-1.2.3-signed.zip")',
        ],
        { env: { ...process.env, QC_DIR: dir } },
      )
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
      writeFileSync(
        join(dir, 'win-unpacked', 'QueueCumber.exe'),
        'different executable',
      )
      expect(run('Valid', 'yes', 'Synthetic Publisher').status).not.toBe(0)
      writeFileSync(join(dir, 'win-unpacked', 'QueueCumber.exe'), 'synthetic')
      expect(run('NotSigned', 'yes', 'Synthetic Publisher').status).not.toBe(0)
      expect(run('Valid', 'no', 'Synthetic Publisher').status).not.toBe(0)
      expect(run('Valid', 'yes', 'Different Publisher').status).not.toBe(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  },
)
