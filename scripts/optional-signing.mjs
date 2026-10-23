import { setTimeout } from 'node:timers'
import { releaseVersion } from './release-config.mjs'
import { releaseTitle } from './release-name.mjs'

export function validateSigningContext(context, pkg, commit) {
  if (
    !/^[a-f0-9]{40}$/.test(context.commit ?? '') ||
    context.commit !== commit ||
    context.version !== pkg.version
  )
    throw Error('Signing context does not match the release commit')
  releaseVersion(context.tag, pkg.version)
  releaseTitle(pkg.version, pkg.releaseName)
  const [major, minor, patch] = pkg.version
    .split(/[.+-]/)
    .slice(0, 3)
    .map(Number)
  return major > 1 || (major === 1 && (minor > 0 || patch >= 1))
}
export async function findSigningRunner(list) {
  try {
    for (let page = 1; page <= 20; page++) {
      const result = await list(page)
      if (
        result.runners.some(
          (r) =>
            r.status === 'online' &&
            r.busy === false &&
            ['self-hosted', 'windows', 'x64', 'codesign'].every((label) =>
              r.labels.some((l) => l.name.toLowerCase() === label),
            ),
        )
      )
        return true
      if (page * 100 >= result.total_count) return false
    }
  } catch {
    /* Inventory unavailable means no optional signing. */
  }
  return false
}
export async function waitForSigningStart(
  jobs,
  cancel,
  {
    now = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    timeoutMs = 120000,
  } = {},
) {
  const deadline = now() + timeoutMs
  while (now() < deadline) {
    try {
      const signer = (await jobs()).find((job) => job.name === 'sign-windows')
      if (signer && ['in_progress', 'completed'].includes(signer.status)) return
    } catch {
      /* Bound API outages by the same queue deadline. */
    }
    await sleep(10000)
  }
  const signer = (await jobs()).find((job) => job.name === 'sign-windows')
  if (signer && ['in_progress', 'completed'].includes(signer.status)) return
  if (
    signer &&
    ['queued', 'waiting', 'pending', 'requested'].includes(signer.status)
  ) {
    await cancel()
    return
  }
  throw Error(
    'Unable to confirm signer queue state; unsigned output is unaffected',
  )
}

// workflow_run reports the PR head branch; the trusted release workflow's
// context and its exact main-ancestor commit establish what may be signed.
export function validateReleaseRun(event, repository, eventName) {
  const run = event.workflow_run
  if (
    eventName !== 'workflow_run' ||
    event.repository?.full_name !== repository ||
    run?.conclusion !== 'success' ||
    run.event !== 'pull_request_target' ||
    run.path?.split('@')[0] !== '.github/workflows/release.yml'
  )
    throw Error('Signing requires the successful merged-main release workflow')
}

export function validateSigningRelease(release, context, taggedCommit) {
  if (
    !Number.isSafeInteger(release?.id) ||
    release.id <= 0 ||
    release.tag_name !== context.tag ||
    (taggedCommit !== undefined && taggedCommit !== context.commit) ||
    (release.draft === true
      ? release.target_commitish !== context.commit
      : release.draft !== false || taggedCommit !== context.commit)
  )
    throw Error('Release no longer matches the signed commit')
}

export async function findSigningRelease(list, tag) {
  for (let page = 1; page <= 20; page++) {
    const releases = await list(page)
    const release = releases.find((r) => r.tag_name === tag)
    if (release) return release
    if (releases.length < 100) break
  }
  throw Error('Release for optional signing was not found')
}
