import { createProcessingJob, getProcessingCapability, MAX_PROCESSING_SOURCE_BYTES, PROCESSING_LEASE_MS, TEXT_EXTRACTION_VERSION } from '../../domain/processing'
import type { ExtractedContent, ProcessingCapability, ProcessingJob } from '../../domain/processing'
import type { SavedItem, SourceFileRecord } from '../../domain/library'
import type { createLibraryRepository } from '../../infrastructure/persistence/libraryRepository'

type Repository = ReturnType<typeof createLibraryRepository>
type OnChange = () => Promise<void>

class ProcessingFailure extends Error {
  readonly code: string
  readonly needsAttention: boolean

  constructor(code: string, message: string, needsAttention = true) {
    super(message)
    this.code = code
    this.needsAttention = needsAttention
    this.name = 'ProcessingFailure'
  }
}

async function fingerprint(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sourceForItem(repository: Repository, item: SavedItem): Promise<SourceFileRecord | undefined> {
  return item.sourceFileId ? repository.getSourceFile(item.sourceFileId) : undefined
}

export async function inspectProcessingCapability(repository: Repository, item: SavedItem): Promise<ProcessingCapability> {
  const sourceFile = await sourceForItem(repository, item)
  const jobs = await repository.getProcessingJobsForItem(item.id)
  const currentJob = jobs
    .filter((job) => job.processingVersion === TEXT_EXTRACTION_VERSION && (!sourceFile || job.sourceFingerprint === sourceFile.sha256))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
  const hasResult = currentJob?.resultId
    ? Boolean(await repository.getExtractedContent(currentJob.resultId))
    : false
  return getProcessingCapability(item, sourceFile, jobs, hasResult)
}

export async function queueProcessingItem(repository: Repository, savedItemId: string): Promise<ProcessingJob> {
  const item = await repository.getItem(savedItemId)
  if (!item) throw new Error('This saved item no longer exists.')
  const sourceFile = await sourceForItem(repository, item)
  const jobs = await repository.getProcessingJobsForItem(item.id)
  const capability = getProcessingCapability(item, sourceFile, jobs)

  if (capability.state === 'queued' || capability.state === 'processing' || capability.state === 'completed') {
    if (capability.job) return capability.job
  }
  const canRequeueExisting = capability.job && ['failed', 'needs-attention', 'skipped'].includes(capability.state)
  if (capability.state !== 'available' && !canRequeueExisting) throw new Error(capability.reason)
  if (!sourceFile) throw new Error(capability.reason)

  return repository.enqueueProcessingJob(createProcessingJob(item, sourceFile))
}

export async function runProcessingJob(repository: Repository, jobId: string, onChange?: OnChange): Promise<ProcessingJob | undefined> {
  const started = await repository.startProcessingJob(jobId, new Date(), PROCESSING_LEASE_MS)
  if (!started) return repository.getProcessingJob(jobId)
  await onChange?.()

  const heartbeat = setInterval(() => {
    void repository.renewProcessingLease(jobId, Date.now() + PROCESSING_LEASE_MS).catch(() => undefined)
  }, Math.floor(PROCESSING_LEASE_MS / 3))

  try {
    const item = await repository.getItem(started.savedItemId)
    if (!item?.sourceFileId) throw new ProcessingFailure('missing-source', 'The saved item no longer references its original text file.')
    const sourceFile = await repository.getSourceFile(item.sourceFileId)
    if (!sourceFile) throw new ProcessingFailure('missing-source', 'The original text file is missing from local storage.')
    if (!sourceFile.fileName.toLowerCase().endsWith('.txt') || sourceFile.mediaType !== 'text/plain') {
      throw new ProcessingFailure('unsupported-source', 'Only local .txt files with plain-text media type can be processed in this phase.')
    }
    if (sourceFile.size <= 0 || sourceFile.size > MAX_PROCESSING_SOURCE_BYTES || sourceFile.blob.size !== sourceFile.size) {
      throw new ProcessingFailure('invalid-file-size', 'The source file is empty, changed, or above the 20 MiB processing limit.')
    }

    const bytes = await sourceFile.blob.arrayBuffer()
    const actualFingerprint = await fingerprint(new Blob([bytes]))
    if (actualFingerprint !== started.sourceFingerprint || sourceFile.sha256 !== started.sourceFingerprint || item.sourceFingerprint !== started.sourceFingerprint) {
      throw new ProcessingFailure('source-changed', 'The source file no longer matches the fingerprint captured when this job was queued. Queue it again to review the new source.')
    }

    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new ProcessingFailure('invalid-encoding', 'This file is not valid UTF-8 text. The original file is unchanged; replace it with a UTF-8 text file and retry.')
    }

    const extractedAt = new Date().toISOString()
    const content: ExtractedContent = {
      id: crypto.randomUUID(),
      savedItemId: started.savedItemId,
      kind: 'document_text',
      text,
      provider: 'local-text-file',
      processingVersion: started.processingVersion,
      sourceFingerprint: started.sourceFingerprint,
      sourceFileName: sourceFile.fileName,
      extractedAt,
    }
    const completed = await repository.completeProcessingJob(jobId, content)
    await onChange?.()
    return completed
  } catch (cause) {
    const failure = cause instanceof ProcessingFailure
      ? cause
      : new ProcessingFailure('extraction-failed', cause instanceof Error ? cause.message : 'The local text extraction failed.', false)
    const failed = await repository.failProcessingJob(
      jobId,
      failure.needsAttention ? 'needs-attention' : 'failed',
      failure.code,
      failure.message,
    )
    await onChange?.()
    return failed
  } finally {
    clearInterval(heartbeat)
  }
}

export async function runQueuedProcessing(repository: Repository, onChange?: OnChange): Promise<ProcessingJob[]> {
  const jobs = await repository.getProcessingJobs()
  const queued = jobs.filter((job) => job.status === 'queued').sort((left, right) => left.queuedAt.localeCompare(right.queuedAt))
  const completed: ProcessingJob[] = []
  for (const job of queued) {
    const result = await runProcessingJob(repository, job.id, onChange)
    if (result) completed.push(result)
  }
  return completed
}

export async function retryProcessingJob(repository: Repository, jobId: string): Promise<ProcessingJob> {
  const job = await repository.getProcessingJob(jobId)
  if (!job) throw new Error('This processing job no longer exists.')
  return queueProcessingItem(repository, job.savedItemId)
}
