import { AnalysisValidationError, analysisFingerprint, analysisId, getMentionedLinks, prepareAnalysisInput, prepareTranscriptAnalysisInput, validateAnalysis } from '../../domain/analysis'
import type { Analysis, AnalysisResult } from '../../domain/analysis'
import { createAnalysisJob, maxAnalysisBatchSize } from '../../domain/analysisQueue'
import type { AnalysisDiagnostic, AnalysisJob, AnalysisReview, ReviewItem } from '../../domain/analysisQueue'
import { displayTitle } from '../../domain/library'
import { TEXT_EXTRACTION_VERSION } from '../../domain/processing'
import { createTranscriptAnalysisPlan, locateTranscriptTimestamp, transcriptAnalysisProvenance, transcriptChunkerVersion, transcriptStepInput } from '../../domain/transcriptAnalysis'
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
    const transcript = item.transcriptId ? await repository.getTranscript(item.transcriptId) : undefined
    const input = transcript && transcript.savedItemId === itemId
      ? prepareTranscriptAnalysisInput(transcript.text, transcriptAnalysisProvenance(transcript))
      : prepareAnalysisInput(item, extracted)
    if (!input) return { itemId, title, state: existingJob ? 'changed' : 'unavailable' }
    const fingerprint = await analysisFingerprint(input)
    const id = analysisId(itemId, fingerprint, model)
    if (queuedJobs && existingJob?.id !== id) return { itemId, title, state: 'changed' }
    if (await repository.getAnalysis(id)) return { itemId, title, state: 'cached' }
    const requestCount = input.kind === 'transcript' && transcript
      ? Math.max(0, createTranscriptAnalysisPlan(input.text, transcript.segments).length - (existingJob?.completedSteps?.length ?? 0))
      : 1
    const job = existingJob
      ? { ...existingJob, totalSteps: existingJob.totalSteps ?? requestCount, ...(input.kind === 'transcript' ? { chunkerVersion: transcriptChunkerVersion } : {}) }
      : { ...createAnalysisJob(itemId, input, fingerprint, model), totalSteps: requestCount, ...(input.kind === 'transcript' ? { chunkerVersion: transcriptChunkerVersion } : {}) }
    return { itemId, title, input, state: 'ready', job, requestCount, transcriptSegments: transcript?.segments }
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
    let currentStep: string | undefined
    try {
      await update()
      let result: AnalysisResult
      let hasOmittedFindings = job.completedSteps?.some((step) => step.hasOmittedFindings) ?? false
      let evidenceSource = input.text
      let transcriptSegments: import('../../domain/transcripts').TranscriptSegment[] | undefined
      if (input.kind === 'transcript') {
        const transcript = await repository.getTranscript((await repository.getItem(job.savedItemId))?.transcriptId ?? '')
        if (!transcript || transcriptAnalysisProvenance(transcript) !== input.provenance) throw new Error('The attached transcript changed. Review the updated transcript before analysis.')
        const steps = createTranscriptAnalysisPlan(input.text, transcript.segments)
        const results = new Map((job.completedSteps ?? []).map((entry) => [entry.id, entry.result]))
        for (const step of steps) {
          if (results.has(step.id)) continue
          currentStep = step.id
          const text = transcriptStepInput(step, results)
          const response = await provider.analyze(job.model, text, connectionId)
          const validated = validateAnalysis(response.result, text)
          hasOmittedFindings ||= response.hasOmittedFindings === true
          if (!await repository.saveAnalysisStep(job.id, claim.attemptId, step.id, validated, response.hasOmittedFindings)) throw new Error('The analysis attempt expired before progress could be saved. Review and retry; completed transcript steps are retained.')
          results.set(step.id, validated)
          await update()
        }
        currentStep = 'final'
        const finalStep = steps[steps.length - 1]
        const finalResult = results.get(finalStep.id)
        if (!finalResult) throw new Error('The transcript analysis did not produce a final result. Retry the item.')
        evidenceSource = input.text
        transcriptSegments = transcript.segments
        result = finalResult
      } else {
        const response = await provider.analyze(job.model, input.text, connectionId)
        result = validateAnalysis(response.result, input.text)
        hasOmittedFindings = response.hasOmittedFindings === true
      }
      if (!result) throw new Error('The analysis did not produce a result. Review and retry the item.')
      const validatedResult = validateAnalysis(result, evidenceSource, () => { hasOmittedFindings = true })
      const resultWithProvenance: AnalysisResult = transcriptSegments ? {
        summary: { ...validatedResult.summary, timestampMs: locateTranscriptTimestamp(validatedResult.summary.evidence, transcriptSegments) },
        points: validatedResult.points.map((note) => ({ ...note, timestampMs: locateTranscriptTimestamp(note.evidence, transcriptSegments) })),
        categories: validatedResult.categories.map((note) => ({ ...note, timestampMs: locateTranscriptTimestamp(note.evidence, transcriptSegments) })),
        mentions: validatedResult.mentions.map((note) => ({ ...note, timestampMs: locateTranscriptTimestamp(note.evidence, transcriptSegments) })),
      } : validatedResult
      const analysis: Analysis = {
        id: job.id, savedItemId: job.savedItemId, fingerprint: job.fingerprint, version: job.version,
        kind: job.kind, model: job.model, provider: 'chatgpt-plan', createdAt: new Date().toISOString(),
        result: resultWithProvenance, links: getMentionedLinks(input.text, input.truncated),
        ...(hasOmittedFindings ? { hasOmittedFindings: true } : {}),
      }
      if (await repository.completeAnalysisJob(analysis, claim.attemptId, input)) completed.push(analysis)
      else message = 'A result could not be saved because the source changed or the attempt expired.'
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Analysis failed.'
      const pause = cause instanceof TypeError || (cause instanceof ChatGptRequestError && [401, 403, 409, 429, 503].includes(cause.status))
      let diagnostic: AnalysisDiagnostic | undefined
      if (cause instanceof ChatGptRequestError) {
        diagnostic = { stage: 'request', reason: detail, status: cause.status, ...cause.diagnostic, step: currentStep }
      } else if (cause instanceof AnalysisValidationError) {
        diagnostic = { stage: 'local validation', field: cause.field, reason: cause.reason, step: currentStep }
      } else if (cause instanceof TypeError) {
        diagnostic = { stage: 'local request', reason: 'The browser could not complete the request. Check that Siftory is still running.', step: currentStep }
      }
      await repository.failAnalysisJob(job.id, claim.attemptId, pause ? 'needs-attention' : 'failed', detail, diagnostic)
      message = detail
      if (pause) break
    } finally {
      await update()
    }
  }
  return { completed, message }
}
