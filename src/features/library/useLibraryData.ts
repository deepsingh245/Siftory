import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category, Collection, SavedItem, SourceFileRecord, Tag } from '../../domain/library'
import type { Analysis } from '../../domain/analysis'
import type { ExtractedContent, ProcessingCapability, ProcessingJob } from '../../domain/processing'
import { getProcessingCapability } from '../../domain/processing'
import { createLibraryRepository } from '../../infrastructure/persistence/libraryRepository'
import { queueProcessingItem, retryProcessingJob, runProcessingJob, runQueuedProcessing } from '../processing/processingService'

const repository = createLibraryRepository(undefined, () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('siftory:database-blocked'))
})

export type LibraryData = {
  items: SavedItem[]
  collections: Collection[]
  categories: Category[]
  tags: Tag[]
  jobs: ProcessingJob[]
  loading: boolean
  error: string | undefined
  refresh: () => Promise<void>
  perform: <T>(task: () => Promise<T>) => Promise<T>
  findDuplicate: (canonicalUrl: string) => Promise<SavedItem | undefined>
  getSourceFile: (savedItemId: string) => Promise<SourceFileRecord | undefined>
  getProcessingCapability: (item: SavedItem) => Promise<ProcessingCapability>
  getExtractedContent: (id: string) => Promise<ExtractedContent | undefined>
  getAnalyses: (id: string) => Promise<Analysis[]>
  actions: {
    saveItem: (item: SavedItem) => Promise<void>
    saveAnalysis: (analysis: Analysis) => Promise<void>
    applySuggestedCategory: (id: string, name: string) => Promise<void>
    saveImportedBatch: (items: SavedItem[], files: SourceFileRecord[]) => Promise<void>
    queueProcessing: (savedItemId: string) => Promise<ProcessingJob>
    processNow: (savedItemId: string) => Promise<ProcessingJob | undefined>
    processQueue: () => Promise<ProcessingJob[]>
    retryProcessing: (jobId: string) => Promise<ProcessingJob>
    skipProcessing: (jobId: string) => Promise<ProcessingJob | undefined>
    deleteItem: (id: string) => Promise<void>
    markViewed: (id: string) => Promise<void>
    saveCollection: (collection: Collection) => Promise<void>
    deleteCollection: (id: string) => Promise<void>
    saveCategory: (category: Category) => Promise<void>
    deleteCategory: (id: string) => Promise<void>
    saveTag: (tag: Tag) => Promise<void>
    deleteTag: (id: string) => Promise<void>
  }
}

export function useLibraryData(): LibraryData {
  const [items, setItems] = useState<SavedItem[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [jobs, setJobs] = useState<ProcessingJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const refresh = useCallback(async () => {
    try {
      const [nextItems, nextCollections, nextCategories, nextTags, nextJobs] = await Promise.all([
        repository.getItems(),
        repository.getCollections(),
        repository.getCategories(),
        repository.getTags(),
        repository.getProcessingJobs(),
      ])
      setItems(nextItems)
      setCollections(nextCollections)
      setCategories(nextCategories)
      setTags(nextTags)
      setJobs(nextJobs)
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The local library could not be opened.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const showBlockedMessage = () => {
      setError('Another Siftory tab is holding an older library connection. Close that tab, then retry.')
      setLoading(false)
    }
    window.addEventListener('siftory:database-blocked', showBlockedMessage)
    const recoverExpired = async () => {
      try {
        const recovered = await repository.recoverExpiredProcessingJobs()
        if (recovered.length) await refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Interrupted processing jobs could not be recovered.')
      }
    }
    // oxlint-disable-next-line react/set-state-in-effect -- Open local IndexedDB state and recover expired job leases after mount.
    void (async () => {
      await recoverExpired()
      await refresh()
    })()
    const recoveryTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void recoverExpired()
    }, 30_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void recoverExpired()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('siftory:database-blocked', showBlockedMessage)
      window.clearInterval(recoveryTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  const perform = useCallback(async <T,>(task: () => Promise<T>) => {
    const result = await task()
    await refresh()
    return result
  }, [refresh])

  const findDuplicate = useCallback((canonicalUrl: string) => repository.findByCanonicalUrl(canonicalUrl), [])
  const getSourceFile = useCallback((savedItemId: string) => repository.getSourceFile(savedItemId), [])
  const getExtractedContent = useCallback((id: string) => repository.getExtractedContent(id), [])
  const getAnalyses = useCallback((id: string) => repository.getAnalyses(id), [])
  const getCapability = useCallback(async (item: SavedItem) => {
    if (item.sourceType !== 'text' || item.contentType !== 'text' || !item.sourceFileId) {
      return getProcessingCapability(item, undefined, [])
    }
    const [sourceFile, itemJobs] = await Promise.all([
      item.sourceFileId ? repository.getSourceFile(item.sourceFileId) : Promise.resolve(undefined),
      repository.getProcessingJobsForItem(item.id),
    ])
    const active = itemJobs
      .filter((job) => !sourceFile || job.sourceFingerprint === sourceFile.sha256)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    const hasResult = active?.resultId ? Boolean(await repository.getExtractedContent(active.resultId)) : false
    return getProcessingCapability(item, sourceFile, itemJobs, hasResult)
  }, [])
  const actions = useMemo(() => ({
    saveItem: (item: SavedItem) => perform(() => repository.saveItem(item)),
    saveAnalysis: (analysis: Analysis) => repository.saveAnalysis(analysis),
    applySuggestedCategory: (id: string, name: string) => perform(() => repository.applySuggestedCategory(id, name)),
    saveImportedBatch: (items: SavedItem[], files: SourceFileRecord[]) => perform(() => repository.saveImportedBatch(items, files)),
    queueProcessing: (savedItemId: string) => perform(() => queueProcessingItem(repository, savedItemId)),
    processNow: async (savedItemId: string) => {
      const job = await queueProcessingItem(repository, savedItemId)
      await refresh()
      if (job.status === 'completed') return job
      const completed = await runProcessingJob(repository, job.id, refresh)
      await refresh()
      return completed
    },
    processQueue: async () => {
      const completed = await runQueuedProcessing(repository, refresh)
      await refresh()
      return completed
    },
    retryProcessing: (jobId: string) => perform(() => retryProcessingJob(repository, jobId)),
    skipProcessing: (jobId: string) => perform(() => repository.skipProcessingJob(jobId)),
    deleteItem: (id: string) => perform(() => repository.deleteItem(id)),
    markViewed: (id: string) => perform(() => repository.markViewed(id)),
    saveCollection: (collection: Collection) => perform(() => repository.saveCollection(collection)),
    deleteCollection: (id: string) => perform(() => repository.deleteCollection(id)),
    saveCategory: (category: Category) => perform(() => repository.saveCategory(category)),
    deleteCategory: (id: string) => perform(() => repository.deleteCategory(id)),
    saveTag: (tag: Tag) => perform(() => repository.saveTag(tag)),
    deleteTag: (id: string) => perform(() => repository.deleteTag(id)),
  }), [perform, refresh])

  return { items, collections, categories, tags, jobs, loading, error, refresh, perform, findDuplicate, getSourceFile, getExtractedContent, getAnalyses, getProcessingCapability: getCapability, actions }
}
