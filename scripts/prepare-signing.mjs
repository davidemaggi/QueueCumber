import console from 'node:console'
import process from 'node:process'
import { readFileSync, appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import {
  validateSigningContext,
  findSigningRunner,
  validateReleaseRun,
} from './optional-signing.mjs'
import { github } from './signing-api.mjs'
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
validateReleaseRun(
  event,
  process.env.GITHUB_REPOSITORY,
  process.env.GITHUB_EVENT_NAME,
)
const context = JSON.parse(
  readFileSync('release-context/release-context.json', 'utf8'),
)
if (!/^[a-f0-9]{40}$/.test(context.commit ?? ''))
  throw Error('Invalid signing commit')
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe' }).trim()
git('merge-base', '--is-ancestor', context.commit, 'origin/main')
const pkg = JSON.parse(git('show', `${context.commit}:package.json`))
let available = false
if (
  validateSigningContext(
    context,
    pkg,
    git('rev-parse', `${context.commit}^{commit}`),
  ) &&
  process.env.WINDOWS_SIGNING_ENABLED === 'true'
) {
  const tagged = await github(`commits/${encodeURIComponent(context.tag)}`)
  if (tagged.sha !== context.commit)
    throw Error('Signing tag belongs to another commit')
  available = await findSigningRunner((page) =>
    github(
      `actions/runners?per_page=100&page=${page}`,
      process.env.SIGNING_RUNNER_READ_TOKEN,
    ),
  )
}
appendFileSync(
  process.env.GITHUB_OUTPUT,
  `available=${available}\ncommit=${context.commit}\ntag=${context.tag}\n`,
)
console.log(
  available
    ? 'Idle signing runner found; optional signing may proceed.'
    : 'Optional Windows signing skipped: version, enablement or idle runner unavailable.',
)
