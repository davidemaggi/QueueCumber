import { it, expect } from 'vitest'
import process from 'node:process'
import {
  validateSigningContext,
  findSigningRunner,
  waitForSigningStart,
} from '../../scripts/optional-signing.mjs'
const commit = 'a'.repeat(40)
const context = { commit, tag: 'v1.0.1', version: '1.0.1' }
it('validates exact context and enables signing only after 1.0.0', () => {
  expect(validateSigningContext(context, { version: '1.0.1' }, commit)).toBe(
    true,
  )
  expect(
    validateSigningContext(
      { commit, tag: 'v1.0.0', version: '1.0.0' },
      { version: '1.0.0', releaseName: 'Ackbar' },
      commit,
    ),
  ).toBe(false)
  for (const bad of [
    { ...context, commit: 'b'.repeat(40) },
    { ...context, tag: 'v9.0.0' },
    { ...context, version: '1.0.0\n' },
  ])
    expect(() =>
      validateSigningContext(bad, { version: '1.0.1' }, commit),
    ).toThrow()
})
it('requires an online idle runner with all signing labels and fails closed on API errors', async () => {
  const runner = {
    status: 'online',
    busy: false,
    labels: ['self-hosted', 'Windows', 'X64', 'codesign'].map((name) => ({
      name,
    })),
  }
  expect(
    await findSigningRunner(async () => ({
      runners: [runner],
      total_count: 1,
    })),
  ).toBe(true)
  for (const changed of [{ status: 'offline' }, { busy: true }, { labels: [] }])
    expect(
      await findSigningRunner(async () => ({
        runners: [{ ...runner, ...changed }],
        total_count: 1,
      })),
    ).toBe(false)
  expect(
    await findSigningRunner(async () => {
      throw Error('403')
    }),
  ).toBe(false)
  let pages = 0
  expect(
    await findSigningRunner(async () => ({
      runners:
        ++pages === 2
          ? [runner]
          : Array.from({ length: 100 }, () => ({ ...runner, busy: true })),
      total_count: 101,
    })),
  ).toBe(true)
})
it('cancels only the optional run when the signer never starts, but leaves a running/completed signer alone', async () => {
  let now = 0,
    cancelled = 0
  const cancel = async () => {
      cancelled++
    },
    sleep = async () => {
      now += 10000
    }
  await waitForSigningStart(
    async () => [{ name: 'sign-windows', status: 'queued' }],
    cancel,
    { now: () => now, sleep, timeoutMs: 120000 },
  )
  expect(cancelled).toBe(1)
  expect(now).toBe(120000)
  for (const status of ['in_progress', 'completed'])
    await waitForSigningStart(
      async () => [{ name: 'sign-windows', status }],
      cancel,
      { now: () => now, sleep, timeoutMs: 120000 },
    )
  expect(cancelled).toBe(1)
})

it('rejects unrelated or untrusted workflow completions before reading release artifacts', async () => {
  const { validateReleaseRun } =
    await import('../../scripts/optional-signing.mjs')
  const event = {
    repository: { full_name: 'owner/repo' },
    workflow_run: {
      conclusion: 'success',
      event: 'pull_request_target',
      head_branch: 'development',
      path: '.github/workflows/release.yml@main',
    },
  }
  expect(() =>
    validateReleaseRun(event, 'owner/repo', 'workflow_run'),
  ).not.toThrow()
  for (const changes of [
    { event: 'pull_request' },
    { conclusion: 'failure' },
    { path: '.github/workflows/other.yml' },
  ])
    expect(() =>
      validateReleaseRun(
        { ...event, workflow_run: { ...event.workflow_run, ...changes } },
        'owner/repo',
        'workflow_run',
      ),
    ).toThrow()
  expect(() =>
    validateReleaseRun(event, 'other/repo', 'workflow_run'),
  ).toThrow()
  expect(() =>
    validateReleaseRun(event, 'owner/repo', 'workflow_dispatch'),
  ).toThrow()
})
it('keeps unsigned names distinct and refuses incomplete local signing identity', async () => {
  const unsigned = (await import('../../electron-builder.unsigned.mjs')).default
  const configure = (await import('../../electron-builder.self-hosted.mjs'))
    .default
  expect(unsigned.artifactName).toContain('-unsigned.')
  expect(unsigned.mac.notarize).toBe(false)
  const oldSubject = process.env.CODESIGN_CERT_SUBJECT,
    oldTimestamp = process.env.CODESIGN_TIMESTAMP_URL
  try {
    delete process.env.CODESIGN_CERT_SUBJECT
    delete process.env.CODESIGN_TIMESTAMP_URL
    expect(configure).toThrow('CODESIGN_CERT_SUBJECT')
    process.env.CODESIGN_CERT_SUBJECT = 'Synthetic Publisher'
    expect(configure).toThrow('CODESIGN_TIMESTAMP_URL')
    process.env.CODESIGN_TIMESTAMP_URL =
      'https://timestamp.example.test/rfc3161'
    const config = configure()
    expect(config.artifactName).toContain('-signed.')
    expect(config.forceCodeSigning).toBe(true)
    expect(config.win.signtoolOptions).toEqual({
      certificateSubjectName: 'Synthetic Publisher',
      publisherName: 'Synthetic Publisher',
      signingHashAlgorithms: ['sha256'],
      rfc3161TimeStampServer: 'https://timestamp.example.test/rfc3161',
    })
    for (const bad of [
      'file:///tmp/cert',
      'https://user:secret@host',
      'not a URL',
    ]) {
      process.env.CODESIGN_TIMESTAMP_URL = bad
      expect(configure).toThrow('CODESIGN_TIMESTAMP_URL')
    }
  } finally {
    for (const [key, value] of Object.entries({
      CODESIGN_CERT_SUBJECT: oldSubject,
      CODESIGN_TIMESTAMP_URL: oldTimestamp,
    })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

it('rechecks at the deadline so a signer starting in the last polling interval is not cancelled', async () => {
  let now = 0,
    cancelled = 0
  await waitForSigningStart(
    async () => [
      {
        name: 'sign-windows',
        status: now >= 115000 ? 'in_progress' : 'queued',
      },
    ],
    async () => {
      cancelled++
    },
    {
      now: () => now,
      sleep: async () => {
        now += 10000
      },
      timeoutMs: 120000,
    },
  )
  expect(cancelled).toBe(0)
})
it('does not cancel an uncertain signer when the jobs API remains unavailable', async () => {
  let now = 0,
    cancelled = 0
  await expect(
    waitForSigningStart(
      async () => {
        throw Error('503')
      },
      async () => {
        cancelled++
      },
      {
        now: () => now,
        sleep: async () => {
          now += 10000
        },
        timeoutMs: 120000,
      },
    ),
  ).rejects.toThrow()
  expect(cancelled).toBe(0)
})

it('binds unsigned drafts to the exact merge without requiring a Git tag, and checks published tags', async () => {
  const { validateSigningRelease, findSigningRelease } =
    await import('../../scripts/optional-signing.mjs')
  const draft = {
    id: 42,
    tag_name: context.tag,
    target_commitish: commit,
    draft: true,
  }
  expect(() => validateSigningRelease(draft, context)).not.toThrow()
  expect(() => validateSigningRelease(draft, context, 'b'.repeat(40))).toThrow()
  expect(() => validateSigningRelease(draft, context, commit)).not.toThrow()
  for (const changed of [
    { target_commitish: 'main' },
    { target_commitish: 'b'.repeat(40) },
    { tag_name: 'v1.0.2' },
    { id: null },
  ])
    expect(() =>
      validateSigningRelease({ ...draft, ...changed }, context),
    ).toThrow()
  const published = { ...draft, draft: false }
  expect(() => validateSigningRelease(published, context, commit)).not.toThrow()
  expect(() =>
    validateSigningRelease(published, context, 'b'.repeat(40)),
  ).toThrow()
  expect(() => validateSigningRelease(published, context)).toThrow()
  let pages = 0
  expect(
    await findSigningRelease(
      async () =>
        ++pages === 1
          ? Array.from({ length: 100 }, () => ({
              ...draft,
              tag_name: 'v0.1.0',
            }))
          : [draft],
      context.tag,
    ),
  ).toEqual(draft)
  await expect(
    findSigningRelease(async () => [], context.tag),
  ).rejects.toThrow()
})

it('pins signed asset upload to the verified numeric release ID and never falls back to a tag', async () => {
  const { vi } = await import('vitest')
  const { uploadReleaseAsset } = await import('../../scripts/signing-api.mjs')
  const previous = {
    token: process.env.GH_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
    tag: process.env.RELEASE_TAG,
  }
  const calls = []
  try {
    process.env.GH_TOKEN = 'synthetic-token'
    process.env.GITHUB_REPOSITORY = 'synthetic/queuecumber'
    process.env.RELEASE_TAG = 'v1.0.1'
    vi.stubGlobal('fetch', async (url, options) => {
      calls.push({ url, options })
      return { ok: false, status: 404 }
    })
    await expect(
      uploadReleaseAsset(42, 'signed.zip', new Uint8Array([1, 2])),
    ).rejects.toThrow('404')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(
      'https://uploads.github.com/repos/synthetic/queuecumber/releases/42/assets?name=signed.zip',
    )
    expect(calls[0].options.method).toBe('POST')
    expect(calls[0].options.body).toEqual(new Uint8Array([1, 2]))
    expect(calls[0].url).not.toContain('v1.0.1')
  } finally {
    vi.unstubAllGlobals()
    for (const [key, value] of Object.entries({
      GH_TOKEN: previous.token,
      GITHUB_REPOSITORY: previous.repository,
      RELEASE_TAG: previous.tag,
    })) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

it('checks tag existence through Git refs before resolving its commit', async () => {
  const { resolveSigningTag } = await import('../../scripts/signing-api.mjs')
  const originalFetch = globalThis.fetch,
    originalToken = process.env.GH_TOKEN,
    originalRepo = process.env.GITHUB_REPOSITORY
  const paths = []
  process.env.GH_TOKEN = 'synthetic-only'
  process.env.GITHUB_REPOSITORY = 'example/synthetic'
  try {
    globalThis.fetch = async (url) => {
      paths.push(String(url))
      return {
        ok: false,
        status: String(url).includes('/git/ref/tags/') ? 404 : 422,
      }
    }
    await expect(resolveSigningTag('v1.0.1')).resolves.toBeUndefined()
    expect(paths).toHaveLength(1)
    expect(paths[0]).toContain('/git/ref/tags/v1.0.1')
    globalThis.fetch = async (url) =>
      String(url).includes('/git/ref/tags/')
        ? {
            ok: true,
            status: 200,
            json: async () => ({
              object: { type: 'tag', sha: 'b'.repeat(40) },
            }),
          }
        : { ok: true, status: 200, json: async () => ({ sha: 'a'.repeat(40) }) }
    await expect(resolveSigningTag('v1.0.1')).resolves.toBe('a'.repeat(40))
    globalThis.fetch = async () => ({ ok: false, status: 403 })
    await expect(resolveSigningTag('v1.0.1')).rejects.toThrow('403')
  } finally {
    globalThis.fetch = originalFetch
    for (const [name, value] of [
      ['GH_TOKEN', originalToken],
      ['GITHUB_REPOSITORY', originalRepo],
    ]) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})
