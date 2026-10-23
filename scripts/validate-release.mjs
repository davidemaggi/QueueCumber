import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { releaseVersion } from './release-config.mjs'
import { releaseTitle } from './release-name.mjs'
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
const pr = event.pull_request
const expected = process.env.RELEASE_COMMIT
if (
  process.env.GITHUB_EVENT_NAME !== 'pull_request_target' ||
  event.action !== 'closed' ||
  pr?.merged !== true ||
  pr.base?.ref !== 'main' ||
  pr.base?.repo?.full_name !== process.env.GITHUB_REPOSITORY ||
  !/^[a-f0-9]{40}$/.test(expected ?? '') ||
  pr.merge_commit_sha !== expected
)
  throw Error('Release builds require a merged pull request into main')
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe' }).trim()
const commit = git('rev-parse', 'HEAD')
if (commit !== expected) throw Error('Checkout does not match the merge commit')
git('merge-base', '--is-ancestor', commit, 'origin/main')
const pkg = JSON.parse(git('show', `${commit}:package.json`))
const tag = `v${pkg.version}`
const version = releaseVersion(tag, pkg.version)
const title = releaseTitle(version, pkg.releaseName)
let existing
try {
  existing = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`)
} catch {
  /* A first release has no tag yet. */
}
if (existing && existing !== commit)
  throw Error('Release tag already belongs to another commit; bump the version')
appendFileSync(
  process.env.GITHUB_OUTPUT,
  `commit=${commit}\ntag=${tag}\nversion=${version}\ntitle=${title}\nprerelease=${version.split('+')[0].includes('-')}\n`,
)

if (process.env.RELEASE_CONTEXT)
  writeFileSync(
    process.env.RELEASE_CONTEXT,
    JSON.stringify({ commit, tag, version }),
  )
