import process from 'node:process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
const dir = process.argv[2]
const files = (await readdir(dir, { withFileTypes: true }))
  .filter((f) => f.isFile() && f.name !== 'SHA256SUMS.txt')
  .map((f) => f.name)
  .sort()
if (!files.length) throw new Error('No release assets to checksum')
const lines = []
for (const name of files) {
  if (/[\r\n]/.test(name)) throw new Error('Invalid release filename')
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(join(dir, name)))
    hash.update(chunk)
  lines.push(`${hash.digest('hex')}  ${name}\n`)
}
await writeFile(join(dir, 'SHA256SUMS.txt'), lines.join(''))
