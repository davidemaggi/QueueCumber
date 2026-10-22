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
    labels: ['self-hosted', 'Windows', 'X64', 'queuecumber-signing'].map(
      (name) => ({ name }),
    ),
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
      head_branch: 'main',
      path: '.github/workflows/release.yml@main',
    },
  }
  expect(() =>
    validateReleaseRun(event, 'owner/repo', 'workflow_run'),
  ).not.toThrow()
  for (const changes of [
    { event: 'pull_request' },
    { conclusion: 'failure' },
    { head_branch: 'development' },
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
  const oldThumbprint = process.env.WINDOWS_SIGNING_CERTIFICATE_SHA1,
    oldPublisher = process.env.WINDOWS_SIGNING_PUBLISHER
  try {
    delete process.env.WINDOWS_SIGNING_CERTIFICATE_SHA1
    expect(configure).toThrow('WINDOWS_SIGNING_CERTIFICATE_SHA1')
    process.env.WINDOWS_SIGNING_CERTIFICATE_SHA1 = 'a'.repeat(40)
    delete process.env.WINDOWS_SIGNING_PUBLISHER
    expect(configure).toThrow('WINDOWS_SIGNING_PUBLISHER')
    process.env.WINDOWS_SIGNING_PUBLISHER = 'Synthetic Publisher'
    expect(configure().artifactName).toContain('-signed.')
    expect(configure().forceCodeSigning).toBe(true)
  } finally {
    for (const [key, value] of Object.entries({
      WINDOWS_SIGNING_CERTIFICATE_SHA1: oldThumbprint,
      WINDOWS_SIGNING_PUBLISHER: oldPublisher,
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
