import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDB } from 'idb'
import type { SavedItem, SourceFileRecord } from '../../src/domain/library'
import { createSavedItem } from '../../src/domain/library'
import { createProcessingJob } from '../../src/domain/processing'
import { createLibraryRepository } from '../../src/infrastructure/persistence/libraryRepository'
import { databaseName, databaseVersion } from '../../src/infrastructure/persistence/libraryDatabase'
import { queueProcessingItem, runProcessingJob } from '../../src/features/processing/processingService'

let name: string
let repository: ReturnType<typeof createLibraryRepository>

beforeEach(() => {
  name = `${databaseName}-processing-${crypto.randomUUID()}`
  repository = createLibraryRepository(name)
})

afterEach(async () => {
  await repository.close()
  await deleteDB(name)
})

async function addTextItem(id = 'text-item') {
  const blob = new Blob(['Local source text'], { type: 'text/plain' })
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const item: SavedItem = {
    ...createSavedItem({ title: 'Local document', sourceType: 'text', contentType: 'text' }, new Date('2026-11-21T00:00:00Z'), id),
    sourceFileId: id,
    sourceFingerprint: fingerprint,
  }
  const file: SourceFileRecord = { savedItemId: id, fileName: 'notes.txt', mediaType: 'text/plain', size: blob.size, blob, sha256: fingerprint, createdAt: item.createdAt }
  await repository.saveImportedBatch([item], [file])
  return { item, file }
}

describe('processing repository', () => {
  it('prevents duplicate active work and reuses the active job', async () => {
    const { item, file } = await addTextItem()
    const first = await repository.enqueueProcessingJob(createProcessingJob(item, file))
    const second = await repository.enqueueProcessingJob(createProcessingJob(item, file))
    expect(second.id).toBe(first.id)
    expect(await repository.getProcessingJobsForItem(item.id)).toHaveLength(1)
  })

  it('commits extracted text and completed job together, retaining source provenance', async () => {
    const { item, file } = await addTextItem()
    const job = await repository.enqueueProcessingJob(createProcessingJob(item, file))
    await repository.startProcessingJob(job.id, new Date('2026-11-21T01:00:00Z'), 120_000)
    const result = {
      id: 'result-1', savedItemId: item.id, kind: 'document_text' as const, text: 'Extracted locally',
      provider: 'local-text-file' as const, processingVersion: job.processingVersion,
      sourceFingerprint: job.sourceFingerprint, sourceFileName: file.fileName, extractedAt: '2026-11-21T01:01:00Z',
    }
    const completed = await repository.completeProcessingJob(job.id, result)
    expect(completed?.status).toBe('completed')
    expect(await repository.getExtractedContent('result-1')).toEqual(result)
    expect((await repository.getSourceFile(item.id))?.blob.size).toBe(file.size)
  })

  it('extracts valid UTF-8 locally and sends malformed text to needs-attention without output', async () => {
    const valid = await addTextItem('valid')
    const queued = await queueProcessingItem(repository, valid.item.id)
    const result = await runProcessingJob(repository, queued.id)
    expect(result?.status).toBe('completed')
    expect((await repository.getExtractedContent(result!.resultId!))?.text).toBe('Local source text')

    const invalidBytes = new Uint8Array([0xc3, 0x28])
    const blob = new Blob([invalidBytes], { type: 'text/plain' })
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
    const invalidHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    const invalidItem: SavedItem = {
      ...createSavedItem({ title: 'Invalid encoding', sourceType: 'text', contentType: 'text' }, undefined, 'invalid'),
      sourceFileId: 'invalid', sourceFingerprint: invalidHash,
    }
    const invalidFile: SourceFileRecord = { savedItemId: 'invalid', fileName: 'bad.txt', mediaType: 'text/plain', size: blob.size, blob, sha256: invalidHash, createdAt: invalidItem.createdAt }
    await repository.saveImportedBatch([invalidItem], [invalidFile])
    const invalidJob = await queueProcessingItem(repository, invalidItem.id)
    const failed = await runProcessingJob(repository, invalidJob.id)
    expect(failed?.status).toBe('needs-attention')
    expect(failed?.errorCode).toBe('invalid-encoding')
    expect(await repository.getExtractedContentForSource(invalidItem.id, invalidFile.sha256, invalidJob.processingVersion)).toBeUndefined()
  })

  it('recovers expired leases as needs-attention and preserves the attempt', async () => {
    const { item, file } = await addTextItem()
    const job = await repository.enqueueProcessingJob(createProcessingJob(item, file))
    await repository.startProcessingJob(job.id, new Date('2026-11-21T01:00:00Z'), 1)
    await repository.recoverExpiredProcessingJobs(Date.parse('2026-11-21T01:00:01Z'))
    const recovered = await repository.getProcessingJob(job.id)
    expect(recovered?.status).toBe('needs-attention')
    expect(recovered?.attempts[0]?.errorCode).toBe('interrupted')
  })

  it('upgrades an existing version 2 database without losing saved items', async () => {
    const request = indexedDB.open(name, 2)
    request.onupgradeneeded = () => {
      const items = request.result.createObjectStore('savedItems', { keyPath: 'id' })
      items.createIndex('by-status', 'status')
      items.createIndex('by-url', 'canonicalUrl')
      items.createIndex('by-updated', 'updatedAt')
      request.result.createObjectStore('categories', { keyPath: 'id' })
      request.result.createObjectStore('collections', { keyPath: 'id' })
      request.result.createObjectStore('tags', { keyPath: 'id' })
      request.result.createObjectStore('sourceFiles', { keyPath: 'savedItemId' })
    }
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const item = createSavedItem({ title: 'Preserved', sourceType: 'website', contentType: 'article' }, undefined, 'preserved')
    const legacyFile: SourceFileRecord = { savedItemId: item.id, fileName: 'legacy.txt', mediaType: 'text/plain', size: 4, blob: new Blob(['keep']), sha256: 'legacy-hash', createdAt: item.createdAt }
    await new Promise<void>((resolve, reject) => {
      const tx = legacy.transaction(['savedItems', 'sourceFiles'], 'readwrite')
      tx.objectStore('savedItems').put(item)
      tx.objectStore('sourceFiles').put(legacyFile)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    legacy.close()

    expect(await repository.getItem(item.id)).toEqual(item)
    expect(await repository.getSourceFile(item.id)).toEqual(legacyFile)
    expect(databaseVersion).toBe(6)
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(name)
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    expect([...upgraded.objectStoreNames]).toContain('processingJobs')
    upgraded.close()
  })
})
