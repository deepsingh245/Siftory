import 'fake-indexeddb/auto'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { deleteDB } from 'idb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMediaMiddleware } from '../../server/media-middleware.mjs'
import { createSavedItem } from '../../src/domain/library'
import { createTranscriptContent, parseTranscript } from '../../src/domain/transcripts'
import { syncLocalMediaTranscripts } from '../../src/features/media/localMedia'
import { createLibraryRepository } from '../../src/infrastructure/persistence/libraryRepository'

const parent = resolve('.siftory/test-temp')
let folder: string | undefined
let server: ReturnType<typeof createServer> | undefined
let repository: ReturnType<typeof createLibraryRepository> | undefined
let database: string | undefined

afterEach(async () => {
  vi.unstubAllGlobals()
  if (server) await new Promise<void>((done) => server!.close(() => done()))
  if (repository && database) { await repository.close(); await deleteDB(database) }
  if (folder && resolve(folder).startsWith(`${parent}\\`)) await rm(folder, { recursive: true, force: true })
  folder = undefined; server = undefined; repository = undefined; database = undefined
})

describe('local media handoff', () => {
  it('serves only completed local artifacts to a loopback Siftory request', async () => {
    await mkdir(parent, { recursive: true })
    folder = join(parent, randomUUID())
    const key = 'instagram-reel-Abc_123'
    await mkdir(join(folder, key), { recursive: true })
    await writeFile(join(folder, key, 'audio.wav'), 'RIFF synthetic audio')
    await writeFile(join(folder, key, 'transcript.srt'), '1\n00:00:00,000 --> 00:00:01,000\nHello\n')
    await writeFile(join(folder, 'run-20261122T120000000000Z.json'), JSON.stringify({ transcriptionModel: 'base', results: [{ key, status: 'completed' }] }))
    const middleware = createMediaMiddleware('http', folder)
    server = createServer((request, response) => middleware(request, response, () => response.end()))
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No test address.')
    const origin = `http://127.0.0.1:${address.port}`

    expect((await fetch(`${origin}/api/media/transcripts`)).status).toBe(403)
    const listing = await fetch(`${origin}/api/media/transcripts`, { headers: { 'X-Siftory-Request': '1' } })
    expect(listing.status).toBe(200)
    expect(await listing.json()).toMatchObject({ entries: [{ key, url: 'https://www.instagram.com/reel/Abc_123/', model: 'base', text: expect.stringContaining('Hello') }], nextCursor: null })
    expect((await fetch(`${origin}/api/media/audio?key=..%2F..%2Fsecret`, { headers: { 'X-Siftory-Request': '1' } })).status).toBe(400)
    const audio = await fetch(`${origin}/api/media/audio?key=${key}`, { headers: { 'X-Siftory-Request': '1' } })
    expect(audio.status).toBe(200)
    expect(await audio.text()).toBe('RIFF synthetic audio')
    expect((await fetch(`${origin}/api/media/transcripts`, { headers: { 'X-Siftory-Request': '1', Origin: 'https://evil.test' } })).status).toBe(403)
  })

  it('attaches exact matches once and preserves a human transcript', async () => {
    database = `siftory-media-test-${randomUUID()}`
    repository = createLibraryRepository(database)
    const generated = createSavedItem({ title: 'Generated', url: 'https://www.instagram.com/reel/Abc_123/?utm_source=share', sourceType: 'instagram', contentType: 'video' }, undefined, 'generated')
    const human = createSavedItem({ title: 'Human', url: 'https://www.instagram.com/reel/Def_456/', sourceType: 'instagram', contentType: 'video' }, undefined, 'human')
    const otherHost = createSavedItem({ title: 'Other', url: 'https://instagram.com.evil.test/reel/Abc_123/', sourceType: 'instagram', contentType: 'video' }, undefined, 'other')
    await repository.saveItem(generated)
    await repository.saveItem(human)
    await repository.saveItem(otherHost)
    const manual = await createTranscriptContent(human.id, parseTranscript('Human corrected words.', 'text'), 'pasted')
    await repository.attachTranscript(manual)
    const srt = '1\n00:00:00,000 --> 00:00:01,000\nGenerated words\n'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ entries: [
      { key: 'instagram-reel-Abc_123', url: 'https://www.instagram.com/reel/Abc_123/', text: srt, sourceFingerprint: 'a'.repeat(64), model: 'base' },
      { key: 'instagram-reel-Def_456', url: 'https://www.instagram.com/reel/Def_456/', text: srt, sourceFingerprint: 'b'.repeat(64), model: 'base' },
    ], nextCursor: null }), { status: 200 })))
    expect(await syncLocalMediaTranscripts(repository)).toBe(1)
    expect(await syncLocalMediaTranscripts(repository)).toBe(0)
    const attachedItem = await repository.getItem(generated.id)
    const attached = await repository.getTranscript(attachedItem!.transcriptId!)
    expect(attached).toMatchObject({ origin: 'local-asr', asrModel: 'base', audioSourceKey: 'instagram-reel-Abc_123', text: 'Generated words' })
    expect((await repository.getItem(human.id))?.transcriptId).toBe(manual.id)
    expect((await repository.getItem(otherHost.id))?.transcriptId).toBeUndefined()
    await repository.removeTranscript(generated.id)
    expect((await repository.getItem(generated.id))?.autoTranscriptDismissed).toBe(true)
    expect(await syncLocalMediaTranscripts(repository)).toBe(0)
    await repository.allowAutoTranscript(generated.id)
    expect(await syncLocalMediaTranscripts(repository)).toBe(1)
  })
})
