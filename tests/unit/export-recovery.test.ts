import { it, expect } from 'vitest'
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { ExportJournal } from '../../src/service/export-journal'
it('recovers encrypted export journals without deleting an existing destination', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-journal-')),
    key = randomBytes(32),
    temporary = join(dir, '.queuecumber-export-synthetic.part'),
    destination = join(dir, 'existing.jsonl')
  try {
    const journal = new ExportJournal(dir, key)
    await writeFile(temporary, 'partial private dump')
    await writeFile(destination, 'existing')
    await journal.begin(temporary, destination)
    expect(
      (await readFile(join(dir, 'export.pending'))).includes(temporary),
    ).toBe(false)
    expect(await new ExportJournal(dir, key).recover()).toBe('cleaned')
    await expect(access(temporary)).rejects.toThrow()
    expect(await readFile(destination, 'utf8')).toBe('existing')
    expect(await journal.recover()).toBe('none')
    await writeFile(join(dir, 'export.pending'), 'corrupt')
    expect(await journal.recover()).toBe('manual')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
