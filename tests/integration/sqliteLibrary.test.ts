import 'fake-indexeddb/auto'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { createLibraryMiddleware } from '../../server/library-middleware.mjs'
import { openSqliteLibrary, sha256 } from '../../server/library-sqlite.mjs'
import { createMediaMiddleware } from '../../server/media-middleware.mjs'
import { createLibraryRepository } from '../../src/infrastructure/persistence/libraryRepository'
import { createLibrarySnapshot, type LibrarySnapshot } from '../../src/infrastructure/persistence/librarySnapshot'
import { createSavedItem } from '../../src/domain/library'
import { createTranscriptContent, parseTranscript } from '../../src/domain/transcripts'

let directory: string
let middleware: ReturnType<typeof createLibraryMiddleware>
let server: ReturnType<typeof createServer>
let origin: string
let snapshot: LibrarySnapshot
let selectedIds: string[]
const subtitle = '1\n00:00:00,000 --> 00:00:01,000\nA synthetic spoken line.'
const audioKey = 'instagram-reel-fixture0'

async function start() {
  middleware = createLibraryMiddleware('http', { root: directory, selectionPath: join(directory, 'fixture.json') })
  const media = createMediaMiddleware('http', join(directory, 'media'))
  server = createServer((request, response) => middleware(request, response, () => media(request, response, () => response.end())))
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server could not start.')
  origin = `http://127.0.0.1:${address.port}`
}

async function stop() {
  await new Promise<void>((done) => server.close(() => done()))
  middleware.close()
}

async function post(route: string, body: unknown, requestOrigin = origin) {
  return fetch(`${origin}/api/library/${route}`, {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'X-Siftory-Request': '1', Origin: requestOrigin },
  })
}

async function call(method: string, ...args: unknown[]) {
  const response = await post('repository', { method, args })
  expect(response.status).toBe(200)
  return (await response.json()).result
}

beforeEach(async () => {
  await mkdir(resolve('.siftory'), { recursive: true })
  directory = await mkdtemp(resolve('.siftory', 'sqlite-test-'))
  const dbName = `sqlite-fixtures-${crypto.randomUUID()}`
  const browser = createLibraryRepository(dbName)
  const selection: { url: string }[] = []
  selectedIds = []
  for (let index = 0; index < 8; index++) {
    const url = `https://www.instagram.com/reel/fixture${index}/`
    const item = createSavedItem({ title: `Test import ${index}`, sourceType: 'instagram', contentType: 'video', url })
    await browser.saveItem(item)
    if (index === 7) continue
    selectedIds.push(item.id)
    selection.push({ url })
    const attach = index === 0 ? { sourceBlob: new Blob([subtitle], { type: 'application/x-subrip' }), audioSourceKey: audioKey } : {}
    const transcript = await createTranscriptContent(item.id, parseTranscript(subtitle, 'srt'), 'local-asr', attach)
    await browser.attachTranscript(transcript)
    if (index === 0) await browser.saveAnalysis({
      id: 'stored-analysis', savedItemId: item.id, fingerprint: 'test-fingerprint', version: 'test-version',
      provider: 'chatgpt-plan', kind: 'transcript', model: 'example', createdAt: new Date().toISOString(),
      result: { summary: { text: 'An example summary.', evidence: 'A synthetic spoken line.' }, points: [], categories: [], mentions: [] }, links: [],
    })
  }
  snapshot = await createLibrarySnapshot(dbName)
  await browser.close()
  const mediaFolder = join(directory, 'media', audioKey)
  await mkdir(mediaFolder, { recursive: true })
  await writeFile(join(mediaFolder, 'audio.wav'), Buffer.alloc(128, 1))
  await writeFile(join(directory, 'fixture.json'), JSON.stringify(selection))
  await start()
})

afterEach(async () => {
  await stop()
  await rm(directory, { recursive: true, force: true })
})

it('backs up every browser row, migrates the seven selected records and reopens them after server restart', async () => {
  expect((await post('migrate', snapshot, 'https://example.test')).status).toBe(403)
  const migrated = await post('migrate', snapshot)
  const receipt = await migrated.json()
  expect(migrated.status, JSON.stringify(receipt)).toBe(200)
  expect(receipt).toMatchObject({ active: true, counts: { savedItems: 7, transcripts: 7, analyses: 1 }, report: { savedItems: 8 }, audioBytes: 128, journalBytes: 0 })
  expect(receipt.databaseBytes).toBeLessThan(200_000)
  const backup = await readFile(join(directory, 'backups', receipt.fileName))
  expect(sha256(backup)).toBe(receipt.sha256)
  expect(JSON.parse(backup.toString())).toEqual(snapshot)
  expect((await post('migrate', snapshot)).status).toBe(409)
  expect(await readdir(join(directory, 'backups'))).toHaveLength(1)
  await stop()
  await start()
  for (const id of selectedIds) {
    const item = await call('getItem', id)
    const transcript = await call('getTranscript', item.transcriptId)
    expect(transcript).toEqual(snapshot.stores.transcripts.find((row) => row.id === item.transcriptId))
  }
  expect(await call('getAnalyses', selectedIds[0])).toEqual(snapshot.stores.analyses)
  const first = await call('getItem', selectedIds[0])
  await call('saveItem', { ...first, userNotes: 'Persist my edits' })
  expect(await call('getItem', first.id)).toMatchObject({ userNotes: 'Persist my edits' })
  const firstTranscript = await call('getTranscript', first.transcriptId)
  const corrected = await createTranscriptContent(first.id, parseTranscript(subtitle.replace('spoken', 'corrected'), 'srt'), 'local-asr', { audioSourceKey: audioKey })
  await call('attachTranscript', { ...corrected, sourceBlob: firstTranscript.sourceBlob, reviewedAt: '2026-11-22T00:00:00.000Z' })
  expect(await call('getTranscript', first.transcriptId)).toBeUndefined()
  expect(await call('getTranscript', corrected.id)).toMatchObject({
    audioSourceKey: audioKey, segments: [{ startMs: 0, endMs: 1000, text: 'A synthetic corrected line.' }],
  })
  expect(await call('getAnalyses', selectedIds[0])).toEqual([])
  const audio = await fetch(`${origin}/api/media/audio?key=${audioKey}`, { headers: { 'Sec-Fetch-Dest': 'audio', 'Sec-Fetch-Site': 'same-origin', Range: 'bytes=0-31' } })
  expect(audio.status).toBe(206)
  expect(audio.headers.get('content-range')).toBe('bytes 0-31/128')
  expect((await audio.arrayBuffer()).byteLength).toBe(32)
  expect((await fetch(`${origin}/api/media/audio?key=${audioKey}`)).status).toBe(403)
})

it('keeps the backup when transcript integrity fails and permits a corrected retry', async () => {
  const damaged = structuredClone(snapshot)
  damaged.stores.transcripts[0].text = 'Does not match the timed segments.'
  expect((await post('migrate', damaged)).status).toBe(422)
  expect(await readdir(join(directory, 'backups'))).toHaveLength(1)
  const status = await fetch(`${origin}/api/library/status`, { headers: { 'X-Siftory-Request': '1' } })
  expect(await status.json()).toMatchObject({ active: false, counts: { savedItems: 0 } })
  expect((await post('migrate', snapshot)).status).toBe(200)
})

it('rolls back the SQL transaction when read-back validation fails', async () => {
  const database = openSqliteLibrary(directory)
  try {
    const stores = { ...snapshot.stores, transcripts: [] }
    await expect(database.migrate(stores, 'test-checksum', () => { throw new Error('Read-back failed') })).rejects.toThrow('Read-back failed')
    expect(await database.inspect()).toMatchObject({ active: false, counts: { savedItems: 0 } })
  } finally {
    database.close()
  }
})
