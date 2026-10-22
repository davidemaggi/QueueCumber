import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { releaseVersion } from './release-config.mjs'
const tag = process.env.RELEASE_TAG
// Validate before passing the tag to Git; all later checkouts use the resolved commit.
releaseVersion(tag, tag?.slice(1))
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const commit = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`)
git('merge-base', '--is-ancestor', commit, 'origin/development')
const pkg = JSON.parse(git('show', `${commit}:package.json`))
const version = releaseVersion(tag, pkg.version)
appendFileSync(
  process.env.GITHUB_OUTPUT,
  `commit=${commit}\nversion=${version}\nprerelease=${version.split('+')[0].includes('-')}\n`,
)
