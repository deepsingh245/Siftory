import type { IDBPDatabase, IDBPTransaction } from 'idb'
import { prepareAnalysisInput } from '../../domain/analysis'
import type { Analysis, AnalysisInput } from '../../domain/analysis'
import { analysisAttemptLeaseMs, maxAnalysisBatchSize } from '../../domain/analysisQueue'
import type { AnalysisJob } from '../../domain/analysisQueue'
import type { Category, Collection, SavedItem, SourceFileRecord, Tag } from '../../domain/library'
import { MAX_PROCESSING_SOURCE_BYTES, TEXT_EXTRACTION_VERSION } from '../../domain/processing'
import type { ExtractedContent, ProcessingJob, ProcessingStatus } from '../../domain/processing'
import { databaseName } from './libraryDatabase'
import { openLibraryDatabase } from './libraryDatabase'
import type { LibraryDatabase } from './libraryDatabase'

export type LibraryRepository = ReturnType<typeof createLibraryRepository>

type ImportReviewResult = { savedIds: string[]; duplicates: { itemId: string; existing: SavedItem }[] }
const analysisStores = ['savedItems', 'extractedContent', 'analyses', 'analysisJobs'] as const
type AnalysisTransaction = IDBPTransaction<LibraryDatabase, typeof analysisStores, 'readwrite'>

export function createLibraryRepository(name = databaseName, onBlocked?: () => void) {
  let connectionPromise: Promise<IDBPDatabase<LibraryDatabase>> | undefined

  function connection(): Promise<IDBPDatabase<LibraryDatabase>> {
    if (connectionPromise) return connectionPromise

    let opening!: Promise<IDBPDatabase<LibraryDatabase>>
    opening = openLibraryDatabase(name, onBlocked).then((db) => {
      db.addEventListener('versionchange', () => {
        db.close()
        if (connectionPromise === opening) connectionPromise = undefined
      })
      return db
    })
    connectionPromise = opening
    return opening
  }

  async function writeAnalysis<T>(action: (tx: AnalysisTransaction) => Promise<T>): Promise<T> {
    const tx = (await connection()).transaction(analysisStores, 'readwrite')
    try {
      const value = await action(tx)
      await tx.done
      return value
    } catch (error) {
      await tx.done.catch(() => undefined)
      throw error
    }
  }

  async function sourceMatches(tx: AnalysisTransaction, itemId: string, expected: AnalysisInput) {
    const item = await tx.objectStore('savedItems').get(itemId)
    if (!item) return false
    const extraction = expected.kind === 'extracted-text' && item.sourceFingerprint
      ? await tx.objectStore('extractedContent').index('by-source-key').get([itemId, item.sourceFingerprint, TEXT_EXTRACTION_VERSION])
      : undefined
    const current = prepareAnalysisInput(item, extraction)
    return current?.text === expected.text && current.kind === expected.kind
  }

  function finishAttempt(job: AnalysisJob, status: AnalysisJob['status'], message?: string, now = Date.now()): AnalysisJob {
    return { ...job, status, message, attemptId: undefined, leaseUntil: undefined, updatedAt: new Date(now).toISOString() }
  }

  return {
    async close() {
      const db = await connectionPromise
      db?.close()
      connectionPromise = undefined
    },

    async getItems() {
      return (await connection()).getAll('savedItems')
    },

    async getItem(id: string) {
      return (await connection()).get('savedItems', id)
    },

    async findByCanonicalUrl(url: string) {
      return (await connection()).getFromIndex('savedItems', 'by-url', url)
    },

    async saveImportedBatch(items: SavedItem[], files: SourceFileRecord[], keepDuplicateIds?: ReadonlySet<string>): Promise<ImportReviewResult> {
      const result: ImportReviewResult = { savedIds: [], duplicates: [] }
      if (!items.length) return result
      const db = await connection()
      const tx = db.transaction(['savedItems', 'sourceFiles'], 'readwrite')
      try {
        const saved = tx.objectStore('savedItems')
        const sources = tx.objectStore('sourceFiles')
        const filesByItem = new Map(files.map((file) => [file.savedItemId, file]))
        for (const item of items) {
          if (keepDuplicateIds && !keepDuplicateIds.has(item.id)) {
            const existing = (item.sourceRecordId && await saved.index('by-source-record').get([item.sourceType, item.sourceRecordId])) ||
              (item.canonicalUrl && await saved.index('by-url').get(item.canonicalUrl)) ||
              (item.sourceFingerprint && await saved.index('by-fingerprint').get(item.sourceFingerprint)) ||
              (item.importRecordKey && await saved.index('by-import-key').get(item.importRecordKey))
            if (existing) {
              result.duplicates.push({ itemId: item.id, existing })
              continue
            }
          }
          await saved.add(item)
          const file = filesByItem.get(item.id)
          if (file) await sources.add(file)
          result.savedIds.push(item.id)
        }
        await tx.done
        return result
      } catch (cause) {
        await tx.done.catch(() => undefined)
        throw cause
      }
    },

    async getSourceFile(savedItemId: string) {
      return (await connection()).get('sourceFiles', savedItemId)
    },

    async getProcessingJobs() {
      return (await connection()).getAllFromIndex('processingJobs', 'by-created')
    },

    async getProcessingJobsForItem(savedItemId: string) {
      return (await connection()).getAllFromIndex('processingJobs', 'by-item', savedItemId)
    },

    async getProcessingJob(id: string) {
      return (await connection()).get('processingJobs', id)
    },

    async getExtractedContent(id: string) {
      return (await connection()).get('extractedContent', id)
    },

    async getExtractedContentForSource(savedItemId: string, fingerprint: string, version: string) {
      return (await connection()).getFromIndex('extractedContent', 'by-source-key', [savedItemId, fingerprint, version])
    },

    async getAnalyses(id: string) {
      return (await connection()).getAllFromIndex('analyses', 'by-item', id)
    },

    async getAnalysis(id: string) {
      return (await connection()).get('analyses', id)
    },

    async getAnalysisJobs() {
      return (await connection()).getAll('analysisJobs')
    },

    async enqueueAnalysisJobs(candidates: AnalysisJob[]) {
      if (candidates.length > maxAnalysisBatchSize) throw new Error(`Select up to ${maxAnalysisBatchSize} items at a time.`)
      return writeAnalysis(async (tx) => {
        const store = tx.objectStore('analysisJobs')
        for (const candidate of candidates) {
          if (!await tx.objectStore('savedItems').getKey(candidate.savedItemId)) continue
          if (await tx.objectStore('analyses').getKey(candidate.id)) continue
          const existing = await store.get(candidate.id)
          if (!existing) await store.add(candidate)
          else if (existing.status !== 'analyzing' && existing.status !== 'queued') await store.put(finishAttempt(existing, 'queued'))
        }
      })
    },

    async claimAnalysisJob(id: string, expected: AnalysisInput, now = Date.now()) {
      return writeAnalysis(async (tx) => {
        const store = tx.objectStore('analysisJobs')
        const job = await store.get(id)
        if (job?.status !== 'queued') return { state: 'unavailable' } as const
        if (await tx.objectStore('analyses').getKey(id)) {
          await store.put(finishAttempt(job, 'completed', 'Reused the saved analysis.', now))
          return { state: 'cached' } as const
        }
        if (await store.index('by-status').count('analyzing')) return { state: 'busy' } as const
        if (!await sourceMatches(tx, job.savedItemId, expected)) {
          await store.put(finishAttempt(job, 'needs-attention', 'The source text changed or was removed. Review it again from the saved item.', now))
          return { state: 'changed' } as const
        }
        const attemptId = crypto.randomUUID()
        await store.put({ ...job, status: 'analyzing', attemptId, leaseUntil: now + analysisAttemptLeaseMs, attempts: job.attempts + 1, updatedAt: new Date(now).toISOString() })
        return { state: 'claimed', attemptId } as const
      })
    },

    async completeAnalysisJob(analysis: Analysis, attemptId: string, expected: AnalysisInput, now = Date.now()) {
      return writeAnalysis(async (tx) => {
        const store = tx.objectStore('analysisJobs')
        const job = await store.get(analysis.id)
        if (job?.status !== 'analyzing' || job.attemptId !== attemptId || (job.leaseUntil ?? 0) <= now) return false
        if (job.savedItemId !== analysis.savedItemId || job.fingerprint !== analysis.fingerprint || job.model !== analysis.model ||
          job.version !== analysis.version || !await sourceMatches(tx, job.savedItemId, expected)) {
          await store.put(finishAttempt(job, 'needs-attention', 'The source changed during analysis. Review it again from the saved item.', now))
          return false
        }
        await tx.objectStore('analyses').put(analysis)
        await store.put(finishAttempt(job, 'completed', undefined, now))
        return true
      })
    },

    async failAnalysisJob(id: string, attemptId: string, status: 'failed' | 'needs-attention', message: string) {
      return writeAnalysis(async (tx) => {
        const store = tx.objectStore('analysisJobs')
        const job = await store.get(id)
        if (job?.status === 'analyzing' && job.attemptId === attemptId) await store.put(finishAttempt(job, status, message))
      })
    },

    async setAnalysisJobQueueState(id: string, status: 'queued' | 'skipped') {
      return writeAnalysis(async (tx) => {
        const store = tx.objectStore('analysisJobs')
        const job = await store.get(id)
        if (job && job.status !== 'analyzing' && job.status !== 'completed') await store.put(finishAttempt(job, status))
      })
    },

    async recoverExpiredAnalysisJobs(now = Date.now()) {
      return writeAnalysis(async (tx) => {
        const store = tx.objectStore('analysisJobs')
        const interrupted = (await store.index('by-status').getAll('analyzing')).filter((job) => (job.leaseUntil ?? 0) <= now)
        await Promise.all(interrupted.map((job) => store.put(finishAttempt(job, 'needs-attention', 'Analysis stopped before a result was saved. Review the text and retry.', now))))
        return interrupted.length
      })
    },

    async saveAnalysis(analysis: Analysis) {
      const db = await connection()
      const tx = db.transaction(['savedItems', 'analyses'], 'readwrite')
      try {
        const item = await tx.objectStore('savedItems').get(analysis.savedItemId)
        if (!item) throw new Error('The saved item was removed before its analysis could be stored.')
        await tx.objectStore('analyses').put(analysis)
        await tx.done
      } catch (error) {
        await tx.done.catch(() => undefined)
        throw error
      }
    },

    async applySuggestedCategory(id: string, name: string) {
      const label = name.trim()
      if (!label || label.length > 80) throw new Error('Enter a category name of up to 80 characters.')
      const db = await connection()
      const tx = db.transaction(['savedItems', 'categories'], 'readwrite')
      try {
        const items = tx.objectStore('savedItems')
        const item = await items.get(id)
        if (!item) throw new Error('The saved item was removed.')
        const categories = tx.objectStore('categories')
        const found = (await categories.getAll()).find((category) => category.name.toLowerCase() === label.toLowerCase())
        const now = new Date().toISOString()
        const categoryId = found?.id ?? crypto.randomUUID()
        const writes = []
        if (!found) writes.push(categories.add({ id: categoryId, name: label, createdAt: now, updatedAt: now }))
        if (!item.categoryIds.includes(categoryId)) writes.push(items.put({ ...item, categoryIds: [...item.categoryIds, categoryId], updatedAt: now }))
        await Promise.all(writes)
        await tx.done
      } catch (error) {
        await tx.done.catch(() => undefined)
        throw error
      }
    },

    async enqueueProcessingJob(job: ProcessingJob) {
      const db = await connection()
      const tx = db.transaction(['savedItems', 'sourceFiles', 'processingJobs', 'extractedContent'], 'readwrite')
      try {
        const item = await tx.objectStore('savedItems').get(job.savedItemId)
        if (!item || !item.sourceFileId) throw new Error('This saved item no longer has an imported source file.')
        const file = await tx.objectStore('sourceFiles').get(item.sourceFileId)
        if (!file) throw new Error('The original local source file is missing.')
        if (item.sourceType !== 'text' || item.contentType !== 'text' || !file.fileName.toLowerCase().endsWith('.txt') || file.mediaType !== 'text/plain') {
          throw new Error('Only imported local .txt files can be added to the processing queue.')
        }
        if (file.size <= 0 || file.size > MAX_PROCESSING_SOURCE_BYTES || file.blob.size !== file.size) {
          throw new Error('The text file is empty, changed, or above the 20 MiB processing limit.')
        }
        if (file.sha256 !== job.sourceFingerprint || item.sourceFingerprint !== job.sourceFingerprint) {
          throw new Error('The source file fingerprint no longer matches this saved item. Review the original file before processing.')
        }

        const jobs = tx.objectStore('processingJobs')
        const active = await jobs.index('by-active-key').get(job.jobKey)
        if (active) {
          await tx.done
          return active
        }

        const previous = (await jobs.index('by-job-key').getAll(job.jobKey))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        const completed = previous.find((candidate) => candidate.status === 'completed' && candidate.resultId)
        if (completed?.resultId && await tx.objectStore('extractedContent').get(completed.resultId)) {
          await tx.done
          return completed
        }

        const retryable = previous.find((candidate) => ['failed', 'needs-attention', 'skipped'].includes(candidate.status))
        if (retryable) {
          const at = new Date().toISOString()
          const next: ProcessingJob = {
            ...retryable,
            status: 'queued',
            activeKey: retryable.jobKey,
            stage: undefined,
            queuedAt: at,
            updatedAt: at,
            leaseExpiresAt: undefined,
            resultId: undefined,
            errorCode: undefined,
            errorMessage: undefined,
            events: [...retryable.events, {
              type: retryable.status === 'failed' || retryable.status === 'needs-attention' ? 'retried' : 'requeued',
              at,
            }],
          }
          await jobs.put(next)
          await tx.done
          return next
        }

        await jobs.add(job)
        await tx.done
        return job
      } catch (cause) {
        await tx.done.catch(() => undefined)
        throw cause
      }
    },

    async startProcessingJob(id: string, now: Date, leaseMs: number) {
      const db = await connection()
      const tx = db.transaction('processingJobs', 'readwrite')
      const store = tx.objectStore('processingJobs')
      const job = await store.get(id)
      if (!job || job.status !== 'queued') {
        await tx.done
        return undefined
      }
      const at = now.toISOString()
      const attemptCount = job.attemptCount + 1
      const next: ProcessingJob = {
        ...job,
        status: 'extracting',
        stage: 'extracting',
        startedAt: at,
        updatedAt: at,
        leaseExpiresAt: now.getTime() + leaseMs,
        attemptCount,
        attempts: [...job.attempts, { number: attemptCount, startedAt: at }],
        events: [...job.events, { type: 'started', at }],
      }
      await store.put(next)
      await tx.done
      return next
    },

    async renewProcessingLease(id: string, expiresAt: number) {
      const db = await connection()
      const tx = db.transaction('processingJobs', 'readwrite')
      const store = tx.objectStore('processingJobs')
      const job = await store.get(id)
      if (!job || job.status !== 'extracting') {
        await tx.done
        return false
      }
      await store.put({ ...job, leaseExpiresAt: expiresAt, updatedAt: new Date().toISOString() })
      await tx.done
      return true
    },

    async completeProcessingJob(id: string, content: ExtractedContent) {
      const db = await connection()
      const tx = db.transaction(['processingJobs', 'extractedContent'], 'readwrite')
      const jobs = tx.objectStore('processingJobs')
      const job = await jobs.get(id)
      if (!job || job.status !== 'extracting' || job.sourceFingerprint !== content.sourceFingerprint) {
          await tx.done.catch(() => undefined)
        throw new Error('This processing job changed before its result could be saved.')
      }
      const at = content.extractedAt
      const lastAttempt = job.attempts.at(-1)
      const next: ProcessingJob = {
        ...job,
        status: 'completed',
        stage: undefined,
        activeKey: undefined,
        leaseExpiresAt: undefined,
        updatedAt: at,
        completedAt: at,
        resultId: content.id,
        errorCode: undefined,
        errorMessage: undefined,
        attempts: lastAttempt
          ? [...job.attempts.slice(0, -1), { ...lastAttempt, finishedAt: at, outcome: 'completed' }]
          : job.attempts,
        events: [...job.events, { type: 'completed', at }],
      }
      await tx.objectStore('extractedContent').add(content)
      await jobs.put(next)
      await tx.done
      return next
    },

    async failProcessingJob(id: string, status: Extract<ProcessingStatus, 'failed' | 'needs-attention'>, errorCode: string, errorMessage: string) {
      const db = await connection()
      const tx = db.transaction('processingJobs', 'readwrite')
      const store = tx.objectStore('processingJobs')
      const job = await store.get(id)
      if (!job || job.status !== 'extracting') {
        await tx.done
        return job
      }
      const at = new Date().toISOString()
      const lastAttempt = job.attempts.at(-1)
      const next: ProcessingJob = {
        ...job,
        status,
        activeKey: undefined,
        leaseExpiresAt: undefined,
        updatedAt: at,
        errorCode,
        errorMessage,
        attempts: lastAttempt
          ? [...job.attempts.slice(0, -1), { ...lastAttempt, finishedAt: at, outcome: status, errorCode, errorMessage }]
          : job.attempts,
        events: [...job.events, { type: status, at, message: errorMessage }],
      }
      await store.put(next)
      await tx.done
      return next
    },

    async skipProcessingJob(id: string) {
      const db = await connection()
      const tx = db.transaction('processingJobs', 'readwrite')
      const store = tx.objectStore('processingJobs')
      const job = await store.get(id)
      if (!job || !['queued', 'failed', 'needs-attention'].includes(job.status)) {
        await tx.done
        return job
      }
      const at = new Date().toISOString()
      const next: ProcessingJob = {
        ...job,
        status: 'skipped',
        activeKey: undefined,
        stage: undefined,
        leaseExpiresAt: undefined,
        updatedAt: at,
        events: [...job.events, { type: 'skipped', at }],
      }
      await store.put(next)
      await tx.done
      return next
    },

    async recoverExpiredProcessingJobs(now = Date.now()) {
      const db = await connection()
      const tx = db.transaction('processingJobs', 'readwrite')
      const store = tx.objectStore('processingJobs')
      const active = await store.index('by-status').getAll('extracting')
      const expired = active.filter((job) => job.leaseExpiresAt !== undefined && job.leaseExpiresAt <= now)
      const at = new Date(now).toISOString()
      const message = 'Processing stopped before it finished. Retry it while Siftory is open.'
      const writes = expired.map((job): ProcessingJob => {
        const lastAttempt = job.attempts.at(-1)
        const next: ProcessingJob = {
          ...job,
          status: 'needs-attention',
          activeKey: undefined,
          leaseExpiresAt: undefined,
          updatedAt: at,
          errorCode: 'interrupted',
          errorMessage: message,
          attempts: lastAttempt
            ? [...job.attempts.slice(0, -1), { ...lastAttempt, finishedAt: at, outcome: 'needs-attention', errorCode: 'interrupted', errorMessage: message }]
            : job.attempts,
          events: [...job.events, { type: 'needs-attention', at, message }],
        }
        return next
      })
      await Promise.all(writes.map((job) => store.put(job)))
      await tx.done
      return writes
    },

    async saveItem(item: SavedItem) {
      const db = await connection()
      const tx = db.transaction('savedItems', 'readwrite')
      await tx.store.put(item)
      await tx.done
    },

    async markViewed(id: string, viewedAt = new Date().toISOString()) {
      const db = await connection()
      const tx = db.transaction('savedItems', 'readwrite')
      const item = await tx.store.get(id)
      if (item) await tx.store.put({ ...item, lastViewedAt: viewedAt })
      await tx.done
    },

    async deleteItem(id: string) {
      const db = await connection()
      const tx = db.transaction(['savedItems', 'sourceFiles', 'processingJobs', 'extractedContent', 'analyses', 'analysisJobs'], 'readwrite')
      const jobs = await tx.objectStore('processingJobs').index('by-item').getAllKeys(id)
      const contents = await tx.objectStore('extractedContent').index('by-item').getAllKeys(id)
      const analyses = await tx.objectStore('analyses').index('by-item').getAllKeys(id)
      const analysisJobs = await tx.objectStore('analysisJobs').index('by-item').getAllKeys(id)
      await tx.objectStore('savedItems').delete(id)
      await tx.objectStore('sourceFiles').delete(id)
      await Promise.all([
        ...jobs.map((key) => tx.objectStore('processingJobs').delete(key)),
        ...contents.map((key) => tx.objectStore('extractedContent').delete(key)),
        ...analyses.map((key) => tx.objectStore('analyses').delete(key)),
        ...analysisJobs.map((key) => tx.objectStore('analysisJobs').delete(key)),
      ])
      await tx.done
    },

    async getCollections() {
      return (await connection()).getAll('collections')
    },

    async saveCollection(collection: Collection) {
      const db = await connection()
      const tx = db.transaction('collections', 'readwrite')
      await tx.store.put(collection)
      await tx.done
    },

    async deleteCollection(id: string) {
      return removeLabel('collections', 'collectionIds', id)
    },

    async getCategories() {
      return (await connection()).getAll('categories')
    },

    async saveCategory(category: Category) {
      const db = await connection()
      const tx = db.transaction('categories', 'readwrite')
      await tx.store.put(category)
      await tx.done
    },

    async deleteCategory(id: string) {
      return removeLabel('categories', 'categoryIds', id)
    },

    async getTags() {
      return (await connection()).getAll('tags')
    },

    async saveTag(tag: Tag) {
      const db = await connection()
      const tx = db.transaction('tags', 'readwrite')
      await tx.store.put(tag)
      await tx.done
    },

    async deleteTag(id: string) {
      return removeLabel('tags', 'tagIds', id)
    },
  }

  async function removeLabel(
    storeName: 'collections' | 'categories' | 'tags',
    relation: 'collectionIds' | 'categoryIds' | 'tagIds',
    id: string,
  ) {
    const db = await connection()
    const tx = db.transaction(['savedItems', storeName], 'readwrite')
    const items = await tx.objectStore('savedItems').getAll()
    const related = items.filter((item) => item[relation].includes(id))

    for (const item of related) {
      await tx.objectStore('savedItems').put({
        ...item,
        [relation]: item[relation].filter((relationId) => relationId !== id),
      })
    }

    await tx.objectStore(storeName).delete(id)
    await tx.done
  }
}
