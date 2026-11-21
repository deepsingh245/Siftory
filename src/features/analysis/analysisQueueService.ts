import { analysisFingerprint, analysisId, getMentionedLinks, prepareAnalysisInput, validateAnalysis } from '../../domain/analysis'
import type { Analysis } from '../../domain/analysis'
import { createAnalysisJob, maxAnalysisBatchSize } from '../../domain/analysisQueue'
import type { AnalysisJob, AnalysisReview, ReviewItem } from '../../domain/analysisQueue'
import { displayTitle } from '../../domain/library'
import { TEXT_EXTRACTION_VERSION } from '../../domain/processing'
import type { LibraryRepository } from '../../infrastructure/persistence/libraryRepository'
import { ChatGptRequestError } from './chatgptClient'
import type { chatgpt } from './chatgptClient'

export async function prepareAnalysisReview(repository: LibraryRepository, itemIds: string[], model: string, queuedJobs?: AnalysisJob[]): Promise<AnalysisReview> {
  const targets: { itemId: string; existingJob?: AnalysisJob }[] = queuedJobs
    ? queuedJobs.map((existingJob) => ({ itemId: existingJob.savedItemId, existingJob }))
    : [...new Set(itemIds)].map((itemId) => ({ itemId }))
  if (targets.length > maxAnalysisBatchSize) throw new Error(`Select up to ${maxAnalysisBatchSize} items per review.`)
  const items = await Promise.all(targets.map(async ({ itemId, existingJob }): Promise<ReviewItem> => {
    const item = await repository.getItem(itemId)
    if (!item) return { itemId, title: 'Removed item', state: 'unavailable' }
    const title = displayTitle(item)
    const extracted = item.sourceType === 'text' && item.sourceFingerprint
      ? await repository.getExtractedContentForSource(itemId, item.sourceFingerprint, TEXT_EXTRACTION_VERSION)
      : undefined
    const input = prepareAnalysisInput(item, extracted)
    if (!input) return { itemId, title, state: existingJob ? 'changed' : 'unavailable' }
    const fingerprint = await analysisFingerprint(input)
    const id = analysisId(itemId, fingerprint, model)
    if (queuedJobs && existingJob?.id !== id) return { itemId, title, state: 'changed' }
    if (await repository.getAnalysis(id)) return { itemId, title, state: 'cached' }
    return { itemId, title, input, state: 'ready', job: existingJob ?? createAnalysisJob(itemId, input, fingerprint, model) }
  }))
  return { model, items }
}

export async function queueReviewedAnalysis(repository: LibraryRepository, review: AnalysisReview) {
  const jobs = review.items.flatMap((entry) => entry.state === 'ready' && entry.job ? [entry.job] : [])
  await repository.enqueueAnalysisJobs(jobs)
  const stored = await repository.getAnalysisJobs()
  const ids = new Set(jobs.map((job) => job.id))
  return stored.filter((job) => ids.has(job.id) && job.status === 'queued').length
}

export type AnalysisRun = { completed: Analysis[]; message?: string }

export async function runReviewedAnalysis(
  repository: LibraryRepository,
  review: AnalysisReview,
  connectionId: string,
  provider: Pick<typeof chatgpt, 'status' | 'analyze'>,
  update: () => Promise<void>,
): Promise<AnalysisRun> {
  await repository.recoverExpiredAnalysisJobs()
  const status = await provider.status()
  if (status.state !== 'connected' || status.connectionId !== connectionId) {
    return { completed: [], message: 'The ChatGPT connection changed. Reconnect if needed, then review the text and confirm again.' }
  }
  const completed: Analysis[] = []
  let message: string | undefined
  for (const { state, input, job } of review.items) {
    if (state !== 'ready' || !input || !job) continue
    const claim = await repository.claimAnalysisJob(job.id, input)
    if (claim.state === 'busy') {
      message = 'Another analysis is active. Review the waiting jobs again when it finishes.'
      break
    }
    if (claim.state === 'changed') message = 'Some source text changed. Open those items and review the new text.'
    if (claim.state !== 'claimed') continue
    try {
      await update()
      const { result } = await provider.analyze(job.model, input.text, connectionId)
      const analysis: Analysis = {
        id: job.id, savedItemId: job.savedItemId, fingerprint: job.fingerprint, version: job.version,
        kind: job.kind, model: job.model, provider: 'chatgpt-plan', createdAt: new Date().toISOString(),
        result: validateAnalysis(result, input.text), links: getMentionedLinks(input.text, input.truncated),
      }
      if (await repository.completeAnalysisJob(analysis, claim.attemptId, input)) completed.push(analysis)
      else message = 'A result could not be saved because the source changed or the attempt expired.'
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Analysis failed.'
      const pause = cause instanceof TypeError || (cause instanceof ChatGptRequestError && [401, 403, 409, 429, 503].includes(cause.status))
      await repository.failAnalysisJob(job.id, claim.attemptId, pause ? 'needs-attention' : 'failed', detail)
      message = detail
      if (pause) break
    } finally {
      await update()
    }
  }
  return { completed, message }
}
