import { databaseName, databaseVersion, openLibraryDatabase } from './libraryDatabase'

export const snapshotStoreNames = [
  'savedItems', 'collections', 'categories', 'tags', 'sourceFiles',
  'processingJobs', 'extractedContent', 'analyses', 'analysisJobs',
  'transcripts', 'researchSessions',
] as const

export type SnapshotStoreName = (typeof snapshotStoreNames)[number]
type SnapshotStores = Record<SnapshotStoreName, Record<string, unknown>[]>

export type SnapshotBlob = {
  encoding: 'base64'
  data: string
  sha256: string
  size: number
  mediaType: string
}

export type LibrarySnapshot = {
  format: 'siftory-library-snapshot'
  formatVersion: 1
  databaseVersion: number
  createdAt: string
  stores: SnapshotStores
}

export async function encodeBlob(blob: Blob): Promise<SnapshotBlob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return { encoding: 'base64', data: btoa(binary), sha256, size: bytes.length, mediaType: blob.type }
}

/** Capture every store in one read-only transaction; the source database is never changed. */
export async function createLibrarySnapshot(name = databaseName): Promise<LibrarySnapshot> {
  const database = await openLibraryDatabase(name)
  try {
    const transaction = database.transaction(snapshotStoreNames, 'readonly')
    const entries = await Promise.all(snapshotStoreNames.map(async (store) => [store, await transaction.objectStore(store).getAll()] as const))
    await transaction.done
    const stores = {} as SnapshotStores
    for (const [store, values] of entries) stores[store] = values.map((value) => ({ ...value }))
    stores.sourceFiles = await Promise.all(stores.sourceFiles.map(async (entry) => {
      const file = entry as Record<string, unknown> & { blob: Blob }
      return { ...file, blob: await encodeBlob(file.blob) }
    }))
    stores.transcripts = await Promise.all(stores.transcripts.map(async (entry) => {
      const transcript = entry as Record<string, unknown> & { sourceBlob?: Blob }
      return transcript.sourceBlob ? { ...transcript, sourceBlob: await encodeBlob(transcript.sourceBlob) } : transcript
    }))
    return { format: 'siftory-library-snapshot', formatVersion: 1, databaseVersion, createdAt: new Date().toISOString(), stores }
  } finally {
    database.close()
  }
}
