import { createLibraryRepository, type LibraryRepository } from './libraryRepository'
import { createLibrarySnapshot, encodeBlob, type SnapshotBlob } from './librarySnapshot'

export type StorageStatus = {
  active: boolean
  databaseBytes: number
  journalBytes: number
  attachmentBytes: number
  attachmentDiskBytes: number
  freePageBytes: number
  audioBytes?: number
  counts: Record<string, number>
}

async function api<T>(path: string, input?: unknown): Promise<T> {
  const response = await fetch(`/api/library/${path}`, {
    method: input === undefined ? 'GET' : 'POST',
    headers: { 'X-Siftory-Request': '1', ...(input === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: input === undefined ? undefined : JSON.stringify(input),
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Open Siftory with its local server to use the library.')
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'The local library is unavailable.')
  return data
}

const storageLock = 'siftory-library-storage'
let onDisk = false
let checkingMode: Promise<boolean> | undefined

function isSqliteActive() {
  if (onDisk) return Promise.resolve(true)
  checkingMode ??= api<{ active: boolean }>('mode').then(({ active }) => {
    onDisk = active
    return active
  }).finally(() => { checkingMode = undefined })
  return checkingMode
}

function decodeBlob(attachment: SnapshotBlob): Blob {
  const binary = atob(attachment.data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: attachment.mediaType })
}

async function callSqlite(method: keyof LibraryRepository, args: unknown[]) {
  const prepared = [...args]
  if (method === 'saveImportedBatch') {
    const files = args[1] as Parameters<LibraryRepository['saveImportedBatch']>[1]
    const duplicates = args[2] as Parameters<LibraryRepository['saveImportedBatch']>[2]
    prepared[1] = await Promise.all(files.map(async (file) => ({ ...file, blob: await encodeBlob(file.blob) })))
    prepared[2] = duplicates ? [...duplicates] : undefined
  } else if (method === 'attachTranscript' || method === 'attachGeneratedTranscriptIfMissing') {
    const transcript = args[0] as Parameters<LibraryRepository['attachTranscript']>[0]
    if (transcript.sourceBlob) prepared[0] = { ...transcript, sourceBlob: await encodeBlob(transcript.sourceBlob) }
  }
  const { result } = await api<{ result?: Record<string, unknown> }>('repository', { method, args: prepared })
  if (method === 'getSourceFile' && result?.blob) return { ...result, blob: decodeBlob(result.blob as SnapshotBlob) }
  if (method === 'getTranscript' && result?.sourceBlob) return { ...result, sourceBlob: decodeBlob(result.sourceBlob as SnapshotBlob) }
  return result
}

export function createLocalLibrary(onBlocked: () => void): LibraryRepository {
  const browser = createLibraryRepository(undefined, onBlocked)
  return new Proxy(browser, {
    get(target, key: keyof LibraryRepository) {
      const method = target[key]
      if (!Object.hasOwn(target, key) || typeof method !== 'function' || key === 'close') return method
      return (...args: never[]) => {
        const call = async () => await isSqliteActive() ? callSqlite(key, args) : Reflect.apply(method, target, args)
        return navigator.locks ? navigator.locks.request(storageLock, { mode: 'shared' }, call) : call()
      }
    },
  })
}

export function getStorageStatus() {
  return api<StorageStatus>('status')
}

export function backupBrowserLibrary(migrate: boolean) {
  const save = async () => {
    if (await isSqliteActive()) throw new Error('SQLite is already active. Reload Siftory to view storage status.')
    const backup = await api<{ fileName: string; sha256: string }>(migrate ? 'migrate' : 'snapshot', await createLibrarySnapshot())
    if (migrate) onDisk = true
    return backup
  }
  if (navigator.locks) return navigator.locks.request(storageLock, save)
  if (migrate) return Promise.reject(new Error('Use a current browser with local storage locking to move this library.'))
  return save()
}
