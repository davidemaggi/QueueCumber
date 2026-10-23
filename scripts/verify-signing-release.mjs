import process from 'node:process'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  github,
  resolveSigningTag,
  uploadReleaseAsset,
} from './signing-api.mjs'
import { validateSigningRelease } from './optional-signing.mjs'
const id = process.env.EXPECTED_RELEASE_ID,
  commit = process.env.EXPECTED_COMMIT,
  tag = process.env.RELEASE_TAG
if (!/^[1-9]\d*$/.test(id ?? '') || !/^[a-f0-9]{40}$/.test(commit ?? ''))
  throw Error('Invalid signed release identity')
const release = await github(`releases/${id}`)
const tagged = await resolveSigningTag(tag)
validateSigningRelease(release, { commit, tag }, tagged)
const args = process.argv.slice(2)
if (args.length) {
  if (args.length !== 2 || args[0] !== '--upload')
    throw Error('Expected --upload followed by the signed-assets directory')
  const files = await readdir(args[1], { withFileTypes: true })
  const expected = [
    `QueueCumber-${tag.slice(1)}-win-x64-signed-setup.exe`,
    `QueueCumber-${tag.slice(1)}-win-x64-signed.zip`,
    'SHA256SUMS-signed-windows-x64.txt',
  ]
  if (
    files.length !== 3 ||
    files.some((file) => !file.isFile() || !expected.includes(file.name))
  )
    throw Error('Unexpected signed assets; refusing upload')
  for (const file of files)
    await uploadReleaseAsset(
      release.id,
      file.name,
      await readFile(join(args[1], file.name)),
    )
}
