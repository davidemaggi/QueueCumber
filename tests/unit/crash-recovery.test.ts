import { it, expect } from 'vitest'
import { build } from 'vite'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import process from 'node:process'
import { CaptureStorage } from '../../src/service/storage'
import { DEFAULT_SETTINGS } from '../../src/shared/limits'
it('recovers encrypted committed records and rolls back an interrupted SQLite transaction after a hard process exit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qc-crash-')),
    key = randomBytes(32),
    data = join(dir, 'data')
  let child: ReturnType<typeof spawn> | undefined
  try {
    await build({
      configFile: false,
      logLevel: 'silent',
      ssr: { noExternal: ['zod'] },
      build: {
        ssr: resolve('src/service/storage.ts'),
        outDir: dir,
        emptyOutDir: false,
        rollupOptions: {
          output: { format: 'cjs', entryFileNames: 'storage.cjs' },
        },
      },
    })
    const code = `const {CaptureStorage}=require(${JSON.stringify(join(dir, 'storage.cjs'))});const {DatabaseSync}=require('node:sqlite');const s=new CaptureStorage(${JSON.stringify(data)},Buffer.from(${JSON.stringify(key.toString('hex'))},'hex'),${JSON.stringify(DEFAULT_SETTINGS)});for(let i=0;i<3;i++)s.append('crash',{payload:Buffer.from('synthetic-private-'+i),headers:{},routingKey:'r',exchange:'e'});const db=new DatabaseSync(${JSON.stringify(join(data, 'captures.db'))});db.exec('BEGIN IMMEDIATE');db.prepare('INSERT INTO captures(session,time,data) VALUES(?,?,?)').run('crash',Date.now(),Buffer.from('uncommitted'));process.stdout.write('ready\\n');setInterval(()=>{},1000);`
    child = spawn(process.execPath, ['-e', code], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await new Promise<void>((resolve, reject) => {
      child!.stdout!.on('data', (chunk) => {
        if (chunk.toString().includes('ready')) resolve()
      })
      child!.once('exit', (code) =>
        reject(Error('Fixture exited before ready: ' + code)),
      )
      child!.once('error', reject)
    })
    const exited = once(child, 'exit')
    child.kill('SIGKILL')
    await exited
    const store = new CaptureStorage(data, key, DEFAULT_SETTINGS)
    try {
      const records = store.readPage('crash', null, 10).records
      expect(records).toHaveLength(3)
      expect(store.get(records[0].id).payload.toString()).toBe(
        'synthetic-private-2',
      )
      expect(
        (await readFile(join(data, 'captures.db'))).includes(
          'synthetic-private',
        ),
      ).toBe(false)
    } finally {
      store.close()
    }
  } finally {
    child?.kill('SIGKILL')
    await rm(dir, { recursive: true, force: true })
  }
}, 20000)
