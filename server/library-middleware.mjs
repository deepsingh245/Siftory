import { deepStrictEqual } from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseInstagramJson } from '../src/domain/imports.ts'
import { markResearchSourcesUnavailable } from '../src/domain/research.ts'
import { blobField, decodeAttachment, encodeAttachment, openSqliteLibrary, recordKey, sha256, storeNames } from './library-sqlite.mjs'

const rootDirectory = fileURLToPath(new URL('../.siftory/', import.meta.url))
const sourceExport = fileURLToPath(new URL('../data.json', import.meta.url))
const maxRequestBytes = 96 * 1024 * 1024
const audioKey = /^instagram-(?:p|reel|tv)-[\w-]{5,32}$/u
const reads = new Set([
  'getItems', 'getItem', 'findByCanonicalUrl', 'getSourceFile', 'getProcessingJobs', 'getProcessingJobsForItem',
  'getProcessingJob', 'getExtractedContent', 'getExtractedContentForSource', 'getAnalyses', 'getAnalysis',
  'getAnalysisJobs', 'getTranscript', 'getResearchSourceRecords', 'getResearchSessions', 'getResearchSession',
])
const writes = new Set([
  'saveImportedBatch', 'saveResearchSession', 'deleteResearchSession', 'attachTranscript', 'attachGeneratedTranscriptIfMissing',
  'removeTranscript', 'allowAutoTranscript', 'saveAnalysisStep', 'enqueueAnalysisJobs', 'claimAnalysisJob', 'completeAnalysisJob',
  'failAnalysisJob', 'setAnalysisJobQueueState', 'recoverExpiredAnalysisJobs', 'saveAnalysis', 'applySuggestedCategory',
  'enqueueProcessingJob', 'startProcessingJob', 'renewProcessingLease', 'completeProcessingJob', 'failProcessingJob',
  'skipProcessingJob', 'recoverExpiredProcessingJobs', 'saveItem', 'markViewed', 'deleteItem', 'saveCollection',
  'deleteCollection', 'saveCategory', 'deleteCategory', 'saveTag', 'deleteTag',
])
for (const method of ['getCollections', 'getCategories', 'getTags']) reads.add(method)

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function reply(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(value))
}

async function requestBody(request) {
  if (request.headers['content-type']?.split(';', 1)[0] !== 'application/json') throw new RequestError(415, 'Send library data as JSON.')
  if (Number(request.headers['content-length']) > maxRequestBytes) throw new RequestError(413, 'The library request exceeds the 96 MiB limit.')
  const chunks = []
  let length = 0
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    length += chunk.length
    if (length > maxRequestBytes) {
      request.resume()
      throw new RequestError(413, 'The library request exceeds the 96 MiB limit.')
    }
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new RequestError(400, 'The library request was unreadable.') }
}

function fromWire(store, record) {
  const field = blobField(store)
  if (!field || record[field] === undefined) return record
  return { ...record, [field]: new Blob([decodeAttachment(record[field])], { type: record[field].mediaType }) }
}

async function toWire(store, record) {
  const field = blobField(store)
  return field && record?.[field] instanceof Blob ? { ...record, [field]: await encodeAttachment(record[field]) } : record
}

function validateSnapshot(snapshot) {
  if (snapshot?.format !== 'siftory-library-snapshot' || snapshot.formatVersion !== 1 || snapshot.databaseVersion !== 7 ||
      !Number.isFinite(Date.parse(snapshot.createdAt)) || Object.keys(snapshot.stores ?? {}).length !== storeNames.length) {
    throw new RequestError(422, 'The browser library backup has an unsupported format.')
  }
  const stores = {}
  for (const store of storeNames) {
    if (!Array.isArray(snapshot.stores[store])) throw new RequestError(422, 'The browser backup is missing a library store.')
    const keys = new Set()
    stores[store] = snapshot.stores[store].map((row) => {
      const key = row && recordKey(store, row)
      if (typeof key !== 'string' || !key.length || key.length > 8192 || keys.has(key)) throw new RequestError(422, 'The browser backup has an invalid or duplicate record ID.')
      keys.add(key)
      try { return fromWire(store, row) }
      catch { throw new RequestError(422, 'A browser backup attachment failed validation.') }
    })
  }
  return stores
}

function instagramIdentity(value) {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    const match = /^\/(?:p|reel|tv)\/([\w-]{5,32})\/?$/u.exec(url.pathname)
    return match && ['www.instagram.com', 'instagram.com'].includes(url.hostname) ? match[1] : undefined
  } catch { return undefined }
}

async function selectRequiredRecords(stores, selectionPath) {
  let source
  try { source = await readFile(selectionPath, 'utf8') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  if (!source) throw new RequestError(422, 'The original data.json is required to identify the seven records. The backup is saved.')
  const wanted = parseInstagramJson(source).rows.map((row) => instagramIdentity(row.draft?.url))
  if (wanted.length !== 7 || wanted.some((id) => !id) || new Set(wanted).size !== 7) throw new RequestError(422, 'data.json does not identify seven distinct Instagram records. The backup is saved.')

  const selected = wanted.map((identity) => {
    const matches = stores.savedItems.filter((item) => {
      if (item.sourceType !== 'instagram') return false
      const original = item.sourceMetadata && parseInstagramJson(JSON.stringify([item.sourceMetadata])).rows[0]?.draft?.url
      return instagramIdentity(original ?? item.canonicalUrl ?? item.url) === identity
    })
    if (matches.length !== 1) throw new RequestError(422, 'Could not uniquely match all seven original imports in this browser. The backup is saved.')
    return matches[0]
  })
  const ids = new Set(selected.map((item) => item.id))
  const selectedStores = { ...stores, savedItems: selected }
  for (const store of ['sourceFiles', 'processingJobs', 'extractedContent', 'analyses', 'analysisJobs', 'transcripts']) {
    selectedStores[store] = stores[store].filter((row) => ids.has(row.savedItemId))
  }
  for (const [store, field] of [['collections', 'collectionIds'], ['categories', 'categoryIds'], ['tags', 'tagIds']]) {
    const related = new Set(selected.flatMap((item) => item[field] ?? []))
    selectedStores[store] = stores[store].filter((row) => related.has(row.id))
  }
  selectedStores.researchSessions = stores.researchSessions
    .filter((session) => session.sources.some((source) => ids.has(source.savedItemId)))
    .map((session) => {
      const excluded = new Set(session.sources.map((source) => source.savedItemId).filter((id) => !ids.has(id)))
      if (!excluded.size) return session
      let redacted = session
      for (const id of excluded) redacted = markResearchSourcesUnavailable(redacted, id, undefined, 'deleted', new Date().toISOString())
      return redacted
    })
  return selectedStores
}

async function checkReferences(stores, mediaRoot) {
  const audio = new Map()
  for (const item of stores.savedItems) {
    if (item.sourceFileId && !stores.sourceFiles.some((row) => row.savedItemId === item.sourceFileId && row.blob instanceof Blob)) throw new RequestError(422, 'A saved source attachment is missing. The backup is saved.')
    if (item.transcriptId && !stores.transcripts.some((row) => row.id === item.transcriptId && row.savedItemId === item.id)) throw new RequestError(422, 'A saved transcript is missing. The backup is saved.')
  }
  for (const row of stores.transcripts) {
    if (!Array.isArray(row.segments) || typeof row.text !== 'string' ||
        row.segments.some((segment) => !Number.isSafeInteger(segment.startMs) || !Number.isSafeInteger(segment.endMs) ||
          segment.startMs < 0 || segment.endMs <= segment.startMs || typeof segment.text !== 'string' || !segment.text.trim()) ||
        (row.segments.length && row.segments.map((segment) => segment.text).join('\n') !== row.text) ||
        sha256(JSON.stringify([row.parserVersion, row.format, row.text, row.segments])) !== row.fingerprint) {
      throw new RequestError(422, 'A transcript failed its text or timing integrity check. The backup is saved.')
    }
    if (!row.audioSourceKey || audio.has(row.audioSourceKey)) continue
    if (!audioKey.test(row.audioSourceKey)) throw new RequestError(422, 'A transcript has an invalid audio reference. The backup is saved.')
    const folder = join(mediaRoot, row.audioSourceKey)
    try {
      if (!(await lstat(folder)).isDirectory()) throw new Error()
      const info = await lstat(join(folder, 'audio.wav'))
      if (!info.isFile() || info.size <= 44 || info.size > 350 * 1024 * 1024) throw new Error()
      audio.set(row.audioSourceKey, info.size)
    } catch { throw new RequestError(422, 'Referenced local audio is missing or invalid. The backup is saved.') }
  }
  return [...audio.values()].reduce((total, bytes) => total + bytes, 0)
}

async function saveBackup(root, snapshot) {
  const directory = join(root, 'backups')
  await mkdir(directory, { recursive: true })
  const data = JSON.stringify(snapshot)
  const hash = sha256(data)
  const fileName = `browser-${hash.slice(0, 24)}.siftory-backup`
  const path = join(directory, fileName)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, data, { flag: 'wx', flush: true, mode: 0o600 })
    if (sha256(await readFile(temporary)) !== hash) throw new Error('Backup hash mismatch.')
    await rename(temporary, path)
    if (sha256(await readFile(path)) !== hash) throw new Error('Saved backup hash mismatch.')
  } finally {
    await rm(temporary, { force: true })
  }
  return { fileName, sha256: hash, report: Object.fromEntries(storeNames.map((store) => [store, snapshot.stores[store].length])) }
}

export function createLibraryMiddleware(scheme = 'http', { root = rootDirectory, selectionPath = sourceExport, mediaRoot = join(root, 'media') } = {}) {
  let database
  const sqlite = () => database ??= openSqliteLibrary(root)
  const middleware = (request, response, next) => {
    const pathname = request.url?.split('?', 1)[0]
    if (!pathname?.startsWith('/api/library/')) return next()
    const host = request.headers.host ?? ''
    const origin = `${scheme}://${host}`
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress) ||
        !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/iu.test(host) ||
        request.headers['x-siftory-request'] !== '1' ||
        (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin') ||
        (request.headers.origin && request.headers.origin !== origin) ||
        (request.method === 'POST' && request.headers.origin !== origin)) {
      return reply(response, 403, { error: 'The library is available only from Siftory on this device.' })
    }
    async function handle() {
      if (pathname === '/api/library/mode' && request.method === 'GET') return reply(response, 200, { active: sqlite().isActive() })
      if (pathname === '/api/library/status' && request.method === 'GET') {
        const stats = await sqlite().inspect()
        if (!stats.active) return reply(response, 200, stats)
        let audioBytes = 0
        for (const key of await sqlite().audioKeys()) {
          if (!audioKey.test(key)) continue
          const folder = join(mediaRoot, key)
          if (!(await lstat(folder).catch(() => undefined))?.isDirectory()) continue
          const info = await lstat(join(folder, 'audio.wav')).catch(() => undefined)
          if (info?.isFile()) audioBytes += info.size
        }
        return reply(response, 200, { ...stats, audioBytes })
      }
      if (request.method !== 'POST') throw new RequestError(405, 'Use the library controls for this action.')
      if (pathname === '/api/library/snapshot' || pathname === '/api/library/migrate') {
        if (pathname.endsWith('/migrate') && sqlite().isActive()) throw new RequestError(409, 'SQLite is already active. Reload Siftory.')
        const snapshot = await requestBody(request)
        const stores = validateSnapshot(snapshot)
        const backup = await saveBackup(root, snapshot)
        if (pathname.endsWith('/snapshot')) return reply(response, 200, backup)
        const selected = await selectRequiredRecords(stores, selectionPath)
        const audioBytes = await checkReferences(selected, mediaRoot)
        await sqlite().migrate(selected, backup.sha256, async (store, rows) => {
          const expected = new Map(await Promise.all(selected[store].map(async (row) => [recordKey(store, row), await toWire(store, row)])))
          deepStrictEqual(rows.length, expected.size)
          for (const row of rows) deepStrictEqual(await toWire(store, row), expected.get(recordKey(store, row)))
        })
        return reply(response, 200, { ...backup, ...await sqlite().inspect(), audioBytes })
      }
      if (pathname !== '/api/library/repository') throw new RequestError(404, 'Unknown library action.')
      if (!sqlite().isActive()) throw new RequestError(409, 'SQLite migration has not been completed.')
      const { method, args } = (await requestBody(request)) ?? {}
      if (!Array.isArray(args) || (!reads.has(method) && !writes.has(method))) throw new RequestError(400, 'Unknown library operation.')
      if (method === 'saveImportedBatch') {
        args[1] = args[1].map((record) => fromWire('sourceFiles', record))
        if (Array.isArray(args[2])) args[2] = new Set(args[2])
        else args[2] = undefined
      } else if (method === 'attachTranscript' || method === 'attachGeneratedTranscriptIfMissing') {
        args[0] = fromWire('transcripts', args[0])
      } else if (method === 'startProcessingJob') {
        args[1] = new Date(args[1])
      } else if (method === 'recoverExpiredProcessingJobs' && args[0] != null) {
        args[0] = new Date(args[0])
      }
      let result = await sqlite().run(method, args, writes.has(method))
      if (method === 'getSourceFile') result = await toWire('sourceFiles', result)
      if (method === 'getTranscript') result = await toWire('transcripts', result)
      return reply(response, 200, { result })
    }
    void handle().catch((error) => reply(response, error instanceof RequestError ? error.status : 500, {
      error: error instanceof RequestError ? error.message : 'The local SQLite operation could not be completed. Your browser library and backups are retained.',
    }))
  }
  middleware.close = () => database?.close()
  return middleware
}
