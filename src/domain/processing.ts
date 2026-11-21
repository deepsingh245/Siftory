import type { SavedItem, SourceFileRecord } from './library.ts'

export const TEXT_EXTRACTION_VERSION = 'local-text-v1'
export const MAX_PROCESSING_SOURCE_BYTES = 20 * 1024 * 1024
export const PROCESSING_LEASE_MS = 2 * 60 * 1000

export const processingStatuses = [
  'queued',
  'extracting',
  'completed',
  'failed',
  'needs-attention',
  'skipped',
] as const

export type ProcessingStatus = (typeof processingStatuses)[number]
export type ProcessingStage = 'extracting'
export type ProcessingEventType =
  | 'queued'
  | 'started'
  | 'completed'
  | 'failed'
  | 'needs-attention'
  | 'skipped'
  | 'retried'
  | 'requeued'

export type ProcessingEvent = {
  type: ProcessingEventType
  at: string
  message?: string
}

export type ProcessingAttempt = {
  number: number
  startedAt: string
  finishedAt?: string
  outcome?: 'completed' | 'failed' | 'needs-attention'
  errorCode?: string
  errorMessage?: string
}

export type ProcessingJob = {
  id: string
  savedItemId: string
  jobType: 'extract-text'
  jobKey: string
  activeKey?: string
  sourceFingerprint: string
  processingVersion: string
  status: ProcessingStatus
  stage?: ProcessingStage
  createdAt: string
  updatedAt: string
  queuedAt: string
  startedAt?: string
  completedAt?: string
  leaseExpiresAt?: number
  attemptCount: number
  attempts: ProcessingAttempt[]
  events: ProcessingEvent[]
  resultId?: string
  errorCode?: string
  errorMessage?: string
}

export type ExtractedContent = {
  id: string
  savedItemId: string
  kind: 'document_text'
  text: string
  provider: 'local-text-file'
  processingVersion: string
  sourceFingerprint: string
  sourceFileName: string
  extractedAt: string
}

export type ProcessingCapabilityState =
  | 'available'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'needs-attention'
  | 'skipped'
  | 'unsupported'
  | 'missing-source'

export type ProcessingCapability = {
  state: ProcessingCapabilityState
  reason: string
  job?: ProcessingJob
}

export function processingJobKey(savedItemId: string, fingerprint: string, version = TEXT_EXTRACTION_VERSION): string {
  return `${savedItemId}:${fingerprint}:${version}`
}

export function createProcessingJob(
  item: SavedItem,
  sourceFile: SourceFileRecord,
  now = new Date(),
  id = crypto.randomUUID(),
): ProcessingJob {
  const timestamp = now.toISOString()
  const jobKey = processingJobKey(item.id, sourceFile.sha256)
  return {
    id,
    savedItemId: item.id,
    jobType: 'extract-text',
    jobKey,
    activeKey: jobKey,
    sourceFingerprint: sourceFile.sha256,
    processingVersion: TEXT_EXTRACTION_VERSION,
    status: 'queued',
    createdAt: timestamp,
    updatedAt: timestamp,
    queuedAt: timestamp,
    attemptCount: 0,
    attempts: [],
    events: [{ type: 'queued', at: timestamp }],
  }
}

export function getProcessingCapability(
  item: SavedItem,
  sourceFile: SourceFileRecord | undefined,
  jobs: ProcessingJob[],
  hasCompletedResult = false,
): ProcessingCapability {
  if (item.contentType === 'pdf' || item.sourceType === 'pdf') {
    return { state: 'unsupported', reason: 'PDF text extraction is not available yet. The original file remains stored locally.' }
  }
  if (!item.sourceFileId || item.sourceType !== 'text' || item.contentType !== 'text') {
    return { state: 'unsupported', reason: 'Phase 4 can extract locally stored plain-text files. This source is not processable yet; links are never fetched.' }
  }
  if (!sourceFile) {
    return { state: 'missing-source', reason: 'The original text file is missing from local storage.' }
  }
  if (!item.sourceFingerprint || item.sourceFingerprint !== sourceFile.sha256) {
    return { state: 'needs-attention', reason: 'The source file fingerprint does not match this saved item. Review the original before processing.' }
  }
  if (!sourceFile.fileName.toLowerCase().endsWith('.txt') || sourceFile.mediaType !== 'text/plain') {
    return { state: 'unsupported', reason: 'Only imported .txt files with plain-text media type are supported in this phase.' }
  }
  if (sourceFile.size <= 0 || sourceFile.size > MAX_PROCESSING_SOURCE_BYTES) {
    return { state: 'unsupported', reason: 'This text file is empty or exceeds the current 20 MiB processing limit.' }
  }

  const key = processingJobKey(item.id, sourceFile.sha256)
  const current = jobs
    .filter((job) => job.jobKey === key)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]

  if (current?.status === 'queued') return { state: 'queued', reason: 'This text file is waiting for you to start the queue.', job: current }
  if (current?.status === 'extracting') return { state: 'processing', reason: 'Text extraction is running while Siftory is open.', job: current }
  if (current?.status === 'completed' && hasCompletedResult && current.resultId) {
    return { state: 'completed', reason: 'Text was extracted locally and is available in this item.', job: current }
  }
  if (current?.status === 'failed') {
    return { state: 'failed', reason: current.errorMessage ?? 'The last extraction attempt failed. You can retry it.', job: current }
  }
  if (current?.status === 'needs-attention') {
    return { state: 'needs-attention', reason: current.errorMessage ?? 'This job needs attention before it can be retried.', job: current }
  }
  if (current?.status === 'skipped') return { state: 'skipped', reason: 'This job was skipped. You can add it to the queue again.', job: current }
  if (current?.status === 'completed' && !hasCompletedResult) {
    return { state: 'available', reason: 'The previous result is missing; you can extract the source again.', job: current }
  }

  return { state: 'available', reason: 'This local plain-text file can be extracted without a network connection.' }
}

const allowedTransitions: Record<ProcessingStatus, ProcessingStatus[]> = {
  queued: ['extracting', 'skipped'],
  extracting: ['completed', 'failed', 'needs-attention'],
  completed: [],
  failed: ['queued', 'skipped'],
  'needs-attention': ['queued', 'skipped'],
  skipped: ['queued'],
}

export function canTransitionProcessingJob(from: ProcessingStatus, to: ProcessingStatus): boolean {
  return allowedTransitions[from].includes(to)
}
