import process from 'node:process'
import { waitForSigningStart } from './optional-signing.mjs'
import { github } from './signing-api.mjs'
if (
  process.env.GITHUB_EVENT_NAME !== 'workflow_run' ||
  !/^\d+$/.test(process.env.GITHUB_RUN_ID ?? '')
)
  throw Error('Invalid optional signing run')
await waitForSigningStart(
  async () =>
    (
      await github(
        `actions/runs/${process.env.GITHUB_RUN_ID}/jobs?per_page=100`,
      )
    ).jobs,
  () =>
    github(
      `actions/runs/${process.env.GITHUB_RUN_ID}/cancel`,
      undefined,
      'POST',
    ),
)
