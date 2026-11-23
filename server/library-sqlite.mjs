import { createHash, randomUUID } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createLibraryRepository } from '../src/infrastructure/persistence/libraryRepository.ts'

const byItem = { 'by-item': ['savedItemId'] }
const byCreated = { 'by-created': ['createdAt'] }
export const storeIndexes = {
  savedItems: {
    'by-url': ['canonicalUrl'], 'by-source-record': ['sourceType', 'sourceRecordId'],
    'by-fingerprint': ['sourceFingerprint'], 'by-import-key': ['importRecordKey'],
  },
  collections: {}, categories: {}, tags: {}, sourceFiles: {},
  processingJobs: { ...byItem, ...byCreated, 'by-status': ['status'], 'by-job-key': ['jobKey'], 'by-active-key': ['activeKey'] },
  extractedContent: { ...byItem, 'by-source-key': ['savedItemId', 'sourceFingerprint', 'processingVersion'] },
  analyses: byItem, analysisJobs: { ...byItem, 'by-status': ['status'] },
  transcripts: {}, researchSessions: { 'by-updated': ['updatedAt'] },
}
export const storeNames = Object.keys(storeIndexes)
export const blobField = (store) => store === 'sourceFiles' ? 'blob' : store === 'transcripts' ? 'sourceBlob' : undefined
export const recordKey = (store, row) => row[store === 'sourceFiles' ? 'savedItemId' : 'id']
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
export const maxAttachmentBytes = 20 * 1024 * 1024

export function decodeAttachment(value) {
  if (value?.encoding !== 'base64' || typeof value.data !== 'string' || value.data.length > Math.ceil(maxAttachmentBytes / 3) * 4 ||
      typeof value.mediaType !== 'string' || value.mediaType.length > 256) throw new Error('Invalid library attachment.')
  const bytes = Buffer.from(value.data, 'base64')
  if (bytes.length !== value.size || bytes.length > maxAttachmentBytes || bytes.toString('base64') !== value.data ||
      sha256(bytes) !== value.sha256) throw new Error('Library attachment failed verification.')
  return bytes
}

export async function encodeAttachment(blob) {
  const bytes = Buffer.from(await blob.arrayBuffer())
  return { encoding: 'base64', data: bytes.toString('base64'), size: bytes.length, sha256: sha256(bytes), mediaType: blob.type }
}

const expression = (field) => `json_extract(payload, '$.${field}')`
const sizeOf = (path) => existsSync(path) ? lstatSync(path).size : 0

export function openSqliteLibrary(root) {
  mkdirSync(root, { recursive: true })
  const path = join(root, 'library.sqlite3')
  const attachments = join(root, 'attachments')
  const sql = new DatabaseSync(path)
  try {
    sql.exec('PRAGMA busy_timeout=3000; PRAGMA synchronous=FULL; PRAGMA journal_mode=DELETE;')
    const { user_version: version } = sql.prepare('PRAGMA user_version').get()
    if (version > 1) throw new Error('This library requires a newer version of Siftory.')
    if (version === 0) {
      sql.exec('PRAGMA auto_vacuum=INCREMENTAL')
      sql.exec('BEGIN IMMEDIATE')
      try {
        sql.exec(`CREATE TABLE IF NOT EXISTS records (
          store TEXT NOT NULL, key TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
          PRIMARY KEY (store, key)
        ) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS library_state (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;`)
        for (const [store, indexes] of Object.entries(storeIndexes)) {
          for (const [name, fields] of Object.entries(indexes)) {
            const description = name === 'by-active-key' ? 'UNIQUE ' : ''
            sql.exec(`CREATE ${description}INDEX IF NOT EXISTS "${store}-${name}" ON records (${fields.map(expression).join(', ')}) WHERE store = '${store}'`)
          }
        }
        sql.exec('PRAGMA user_version=1; COMMIT')
      } catch (error) {
        sql.exec('ROLLBACK')
        throw error
      }
    }
    if (sql.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('The SQLite library failed its integrity check.')
  } catch (error) {
    sql.close()
    throw error
  }

  const getRow = sql.prepare('SELECT payload FROM records WHERE store=? AND key=?')
  const allRows = sql.prepare('SELECT payload FROM records WHERE store=? ORDER BY key')
  const insert = sql.prepare('INSERT INTO records VALUES (?, ?, ?)')
  const upsert = sql.prepare('INSERT INTO records VALUES (?, ?, ?) ON CONFLICT(store,key) DO UPDATE SET payload=excluded.payload')
  const remove = sql.prepare('DELETE FROM records WHERE store=? AND key=?')
  const active = sql.prepare("SELECT value FROM library_state WHERE key='migration'")
  let queue = Promise.resolve()

  function attachmentPath(hash) {
    if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/u.test(hash)) throw new Error('Invalid local attachment reference.')
    return join(attachments, hash)
  }

  function restore(store, record) {
    if (!record) return undefined
    const parsed = JSON.parse(record.payload)
    const field = blobField(store)
    if (field && parsed[field]) {
      const ref = parsed[field]
      const path = attachmentPath(ref.sha256)
      const info = lstatSync(path)
      if (!info.isFile() || info.size !== ref.size || info.size > maxAttachmentBytes) throw new Error('A local attachment is missing or damaged.')
      const bytes = readFileSync(path)
      if (sha256(bytes) !== ref.sha256) throw new Error('A local attachment failed its integrity check.')
      parsed[field] = new Blob([bytes], { type: ref.mediaType })
    }
    if (store === 'transcripts' && parsed.text === undefined) parsed.text = parsed.segments.map((segment) => segment.text).join('\n')
    return parsed
  }

  async function write(store, value, addOnly = false) {
    const key = recordKey(store, value)
    if (typeof key !== 'string' || !key.length || key.length > 8192) throw new Error('Invalid library record ID.')
    const payload = { ...value }
    const field = blobField(store)
    if (field && payload[field] !== undefined) {
      if (!(payload[field] instanceof Blob) || payload[field].size > maxAttachmentBytes) throw new Error('Invalid library attachment.')
      const bytes = Buffer.from(await payload[field].arrayBuffer())
      const hash = sha256(bytes)
      mkdirSync(attachments, { recursive: true })
      const target = attachmentPath(hash)
      if (!existsSync(target)) {
        const temporary = `${target}.${randomUUID()}.tmp`
        try {
          writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o600, flush: true })
          renameSync(temporary, target)
        } finally {
          rmSync(temporary, { force: true })
        }
      } else if (!lstatSync(target).isFile() || sha256(readFileSync(target)) !== hash) {
        throw new Error('An existing local attachment failed its integrity check.')
      }
      payload[field] = { sha256: hash, size: bytes.length, mediaType: payload[field].type }
    }
    if (store === 'transcripts' && payload.segments?.length &&
        payload.segments.map((segment) => segment.text).join('\n') === payload.text) delete payload.text
    const statement = addOnly ? insert : upsert
    statement.run(store, key, JSON.stringify(payload))
    return key
  }

  function index(store, name) {
    const fields = storeIndexes[store][name].map(expression)
    function select(key, columns = 'payload') {
      const args = Array.isArray(key) ? key : [key]
      const filter = key === undefined ? fields.map((field) => `${field} IS NOT NULL`) : fields.map((field) => `${field}=?`)
      const statement = sql.prepare(`SELECT ${columns} FROM records WHERE store='${store}' AND ${filter.join(' AND ')} ORDER BY ${fields.join(', ')}, key`)
      return statement.all(...(key === undefined ? [] : args))
    }
    return {
      get: async (key) => restore(store, select(key)[0]),
      getAll: async (key) => select(key).map((record) => restore(store, record)),
      getAllKeys: async (key) => select(key, 'key').map((record) => record.key),
      count: async (key) => select(key, 'key').length,
    }
  }

  function objectStore(store) {
    return {
      get: async (key) => restore(store, getRow.get(store, key)),
      getKey: async (key) => getRow.get(store, key) ? key : undefined,
      getAll: async () => allRows.all(store).map((record) => restore(store, record)),
      index: (name) => index(store, name),
      add: (value) => write(store, value, true),
      put: (value) => write(store, value),
      delete: async (key) => { remove.run(store, key) },
    }
  }

  // Each repository operation owns a transaction. Reuse the browser repository's
  // domain rules through this small connection adapter.
  const connection = {
    addEventListener() {},
    close() {},
    get: (store, key) => objectStore(store).get(key),
    getAll: (store) => objectStore(store).getAll(),
    getFromIndex: (store, name, key) => index(store, name).get(key),
    getAllFromIndex: (store, name, key) => index(store, name).getAll(key),
    transaction(stores) {
      return { objectStore, store: typeof stores === 'string' ? objectStore(stores) : undefined, done: Promise.resolve(), abort() {} }
    },
  }
  const repository = createLibraryRepository(undefined, undefined, async () => connection)

  function transaction(task, write = true) {
    const result = queue.then(async () => {
      sql.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN')
      try {
        const value = await task()
        sql.exec('COMMIT')
        return value
      } catch (error) {
        if (sql.isTransaction) sql.exec('ROLLBACK')
        throw error
      }
    })
    queue = result.catch(() => undefined)
    return result
  }

  function inspect() {
    const rows = sql.prepare('SELECT store, count(*) AS count FROM records GROUP BY store').all()
    const attachmentSizes = sql.prepare(`SELECT DISTINCT
      coalesce(json_extract(payload, '$.blob.sha256'), json_extract(payload, '$.sourceBlob.sha256')) AS hash,
      coalesce(json_extract(payload, '$.blob.size'), json_extract(payload, '$.sourceBlob.size')) AS size
      FROM records WHERE store IN ('sourceFiles', 'transcripts') AND hash IS NOT NULL`).all()
    const attachmentDiskBytes = existsSync(attachments) ? readdirSync(attachments, { withFileTypes: true })
      .filter((entry) => entry.isFile()).reduce((total, entry) => total + sizeOf(join(attachments, entry.name)), 0) : 0
    return {
      active: Boolean(active.get()),
      databaseBytes: sizeOf(path),
      journalBytes: sizeOf(`${path}-journal`),
      attachmentBytes: attachmentSizes.reduce((total, entry) => total + entry.size, 0),
      attachmentDiskBytes,
      freePageBytes: sql.prepare('PRAGMA freelist_count').get().freelist_count * sql.prepare('PRAGMA page_size').get().page_size,
      counts: Object.assign(Object.fromEntries(storeNames.map((store) => [store, 0])), Object.fromEntries(rows.map(({ store, count }) => [store, count]))),
    }
  }

  return {
    isActive: () => Boolean(active.get()),
    inspect: () => transaction(inspect, false),
    audioKeys: () => transaction(() => sql.prepare(`SELECT DISTINCT json_extract(payload, '$.audioSourceKey') AS key
      FROM records WHERE store='transcripts' AND key IS NOT NULL`).all().map((row) => row.key).filter(Boolean), false),
    run: (method, args, write = true) => transaction(async () => {
      const result = await repository[method](...args)
      if (method === 'deleteItem' || method === 'removeTranscript') sql.exec('PRAGMA incremental_vacuum(16)')
      return result
    }, write),
    migrate(stores, backupHash, verify) {
      return transaction(async () => {
        const previous = active.get()?.value
        if (previous === backupHash) return inspect()
        if (previous || sql.prepare('SELECT 1 FROM records LIMIT 1').get()) throw new Error('SQLite already contains a library.')
        for (const store of storeNames) {
          for (const row of stores[store]) await objectStore(store).add(row)
        }
        for (const store of storeNames) await verify(store, await objectStore(store).getAll())
        sql.prepare("INSERT INTO library_state VALUES ('migration', ?)").run(backupHash)
        return inspect()
      })
    },
    close: () => sql.close(),
  }
}
