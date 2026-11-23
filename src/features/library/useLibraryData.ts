import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Category, Collection, SavedItem, SourceFileRecord, Tag } from '../../domain/library'
import type { Analysis } from '../../domain/analysis'
import type { AnalysisJob, AnalysisReview } from '../../domain/analysisQueue'
import type { ExtractedContent, ProcessingCapability, ProcessingJob } from '../../domain/processing'
import type { TranscriptContent } from '../../domain/transcripts'
import type { ResearchSession, ResearchReview } from '../../domain/research'
import { getProcessingCapability } from '../../domain/processing'
import type { LibraryRepository } from '../../infrastructure/persistence/libraryRepository'
import { createLocalLibrary } from '../../infrastructure/persistence/localLibrary'
import { queueProcessingItem, retryProcessingJob, runProcessingJob, runQueuedProcessing } from '../processing/processingService'
import { prepareAnalysisReview, queueReviewedAnalysis, runReviewedAnalysis } from '../analysis/analysisQueueService'
import type { AnalysisRun } from '../analysis/analysisQueueService'
import { chatgpt } from '../analysis/chatgptClient'
import { prepareResearchReview, submitResearch } from '../research/researchService'
import { syncLocalMediaTranscripts } from '../media/localMedia'

const repository = createLocalLibrary(() => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('siftory:database-blocked'))
})

export type LibraryData = {
  items: SavedItem[]
  collections: Collection[]
  categories: Category[]
  tags: Tag[]
  jobs: ProcessingJob[]
  analysisJobs: AnalysisJob[]
  analysisRunning: boolean
  analysisMessage?: string
  loading: boolean
  error: string | undefined
  refresh: () => Promise<void>
  perform: <T>(task: () => Promise<T>) => Promise<T>
  findDuplicate: (canonicalUrl: string) => Promise<SavedItem | undefined>
  getSourceFile: (savedItemId: string) => Promise<SourceFileRecord | undefined>
  getProcessingCapability: (item: SavedItem) => Promise<ProcessingCapability>
  getExtractedContent: (id: string) => Promise<ExtractedContent | undefined>
  getAnalyses: (id: string) => Promise<Analysis[]>
  getTranscript: (id: string) => Promise<TranscriptContent | undefined>
  getResearchSessions: () => Promise<ResearchSession[]>
  getResearchSession: (id: string) => Promise<ResearchSession | undefined>
  prepareResearchReview: (question: string, model: string) => Promise<ResearchReview>
  prepareAnalysisReview: (ids: string[], model: string, jobs?: AnalysisJob[]) => Promise<AnalysisReview>
  actions: {
    saveItem: (item: SavedItem) => Promise<void>
    attachTranscript: (transcript: TranscriptContent) => Promise<void>
    removeTranscript: (itemId: string) => Promise<void>
    allowAutoTranscript: (itemId: string) => Promise<void>
    saveResearch: (review: ResearchReview, selectedIds: string[], connectionId: string) => Promise<ResearchSession>
    deleteResearchSession: (id: string) => Promise<void>
    applySuggestedCategory: (id: string, name: string) => Promise<void>
    saveImportedBatch: LibraryRepository['saveImportedBatch']
    queueAnalysis: (review: AnalysisReview) => Promise<number>
    startAnalysis: (review: AnalysisReview, connectionId: string, enqueue?: boolean) => Promise<AnalysisRun>
    setAnalysisJobQueueState: (id: string, status: 'queued' | 'skipped') => Promise<void>
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
  const [analysisJobs, setAnalysisJobs] = useState<AnalysisJob[]>([])
  const [analysisRunning, setAnalysisRunning] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState<string>()
  const analysisRunActive = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const refresh = useCallback(async () => {
    try {
      const [nextItems, nextCollections, nextCategories, nextTags, nextJobs, nextAnalysisJobs] = await Promise.all([
        repository.getItems(),
        repository.getCollections(),
        repository.getCategories(),
        repository.getTags(),
        repository.getProcessingJobs(),
        repository.getAnalysisJobs(),
      ])
      setItems(nextItems)
      setCollections(nextCollections)
      setCategories(nextCategories)
      setTags(nextTags)
      setJobs(nextJobs)
      setAnalysisJobs(nextAnalysisJobs)
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The local library could not be opened.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshAnalysisJobs = useCallback(async () => { setAnalysisJobs(await repository.getAnalysisJobs()) }, [])

  useEffect(() => {
    const showBlockedMessage = () => {
      setError('Another Siftory tab is holding an older library connection. Close that tab, then retry.')
      setLoading(false)
    }
    window.addEventListener('siftory:database-blocked', showBlockedMessage)
    const recoverExpired = async () => {
      try {
        const [recovered] = await Promise.all([repository.recoverExpiredProcessingJobs(), repository.recoverExpiredAnalysisJobs()])
        if (recovered.length) await refresh()
        else await refreshAnalysisJobs()
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
  }, [refresh, refreshAnalysisJobs])

  useEffect(() => {
    let running = false
    const sync = async () => {
      if (running) return
      running = true
      try {
        if (await syncLocalMediaTranscripts(repository)) await refresh()
      } catch { /* Siftory still works when the optional local media worker is absent. */ }
      finally { running = false }
    }
    void sync()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void sync() }, 30_000)
    return () => window.clearInterval(timer)
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
  const getTranscript = useCallback((id: string) => repository.getTranscript(id), [])
  const getResearchSessions = useCallback(() => repository.getResearchSessions(), [])
  const getResearchSession = useCallback((id: string) => repository.getResearchSession(id), [])
  const reviewResearch = useCallback((question: string, model: string) => prepareResearchReview(repository, question, model), [])
  const reviewAnalysis = useCallback((ids: string[], model: string, queuedJobs?: AnalysisJob[]) => prepareAnalysisReview(repository, ids, model, queuedJobs), [])
  const queueAnalysis = useCallback(async (review: AnalysisReview) => {
    const count = await queueReviewedAnalysis(repository, review)
    await refreshAnalysisJobs()
    return count
  }, [refreshAnalysisJobs])
  const startAnalysis = useCallback(async (review: AnalysisReview, connectionId: string, enqueue = false) => {
    if (analysisRunActive.current) throw new Error('Analysis is already running. Review the queue when it finishes.')
    analysisRunActive.current = true
    setAnalysisRunning(true)
    setAnalysisMessage(undefined)
    try {
      if (enqueue) await queueAnalysis(review)
      const result = await runReviewedAnalysis(repository, review, connectionId, chatgpt, refreshAnalysisJobs)
      setAnalysisMessage(result.message ?? `${result.completed.length} ${result.completed.length === 1 ? 'analysis' : 'analyses'} saved.`)
      return result
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The analysis queue stopped.'
      setAnalysisMessage(message)
      throw cause
    } finally {
      analysisRunActive.current = false
      setAnalysisRunning(false)
    }
  }, [queueAnalysis, refreshAnalysisJobs])
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
    attachTranscript: (transcript: TranscriptContent) => perform(() => repository.attachTranscript(transcript)),
    removeTranscript: (itemId: string) => perform(() => repository.removeTranscript(itemId)),
    allowAutoTranscript: (itemId: string) => perform(() => repository.allowAutoTranscript(itemId)),
    saveResearch: (review: ResearchReview, selectedIds: string[], connectionId: string) => submitResearch(repository, review, selectedIds, connectionId, chatgpt),
    deleteResearchSession: (id: string) => perform(() => repository.deleteResearchSession(id)),
    applySuggestedCategory: (id: string, name: string) => perform(() => repository.applySuggestedCategory(id, name)),
    saveImportedBatch: (items: SavedItem[], files: SourceFileRecord[], duplicates?: ReadonlySet<string>) => perform(async () => {
      const result = await repository.saveImportedBatch(items, files, duplicates)
      if (items.some((item) => item.sourceType === 'instagram') && result.savedIds.length) {
        void syncLocalMediaTranscripts(repository).then((attached) => attached ? refresh() : undefined).catch(() => undefined)
      }
      return result
    }),
    queueAnalysis,
    startAnalysis,
    setAnalysisJobQueueState: async (id: string, status: 'queued' | 'skipped') => {
      await repository.setAnalysisJobQueueState(id, status)
      await refreshAnalysisJobs()
    },
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
  }), [perform, refresh, queueAnalysis, startAnalysis, refreshAnalysisJobs])

  return { items, collections, categories, tags, jobs, analysisJobs, analysisRunning, analysisMessage, loading, error, refresh, perform, findDuplicate, getSourceFile, getExtractedContent, getAnalyses, getTranscript, getResearchSessions, getResearchSession, prepareResearchReview: reviewResearch, prepareAnalysisReview: reviewAnalysis, getProcessingCapability: getCapability, actions }
}
