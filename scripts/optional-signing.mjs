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
            ['self-hosted', 'windows', 'x64', 'queuecumber-signing'].every(
              (label) => r.labels.some((l) => l.name.toLowerCase() === label),
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

export function validateReleaseRun(event, repository, eventName) {
  const run = event.workflow_run
  if (
    eventName !== 'workflow_run' ||
    event.repository?.full_name !== repository ||
    run?.conclusion !== 'success' ||
    run.event !== 'pull_request_target' ||
    run.head_branch !== 'main' ||
    run.path?.split('@')[0] !== '.github/workflows/release.yml'
  )
    throw Error('Signing requires the successful merged-main release workflow')
}
