import { analysisId, analysisVersion } from './analysis.ts'
import type { AnalysisInput } from './analysis.ts'
import type { AnalysisResult } from './analysis.ts'
import type { TranscriptSegment } from './transcripts.ts'

export const maxAnalysisBatchSize = 25
export const analysisAttemptLeaseMs = 10 * 60_000

export type AnalysisJobStatus = 'queued' | 'analyzing' | 'completed' | 'failed' | 'needs-attention' | 'skipped'

export type AnalysisDiagnostic = {
  stage: string
  reason: string
  requestId?: string
  status?: number
  field?: string
  providerStatus?: number
  providerRequestId?: string
  step?: string
}

export type AnalysisJob = {
  id: string
  savedItemId: string
  fingerprint: string
  kind: AnalysisInput['kind']
  model: string
  version: string
  status: AnalysisJobStatus
  createdAt: string
  updatedAt: string
  attempts: number
  attemptId?: string
  leaseUntil?: number
  message?: string
  diagnostic?: AnalysisDiagnostic
  completedSteps?: { id: string; result: AnalysisResult; hasOmittedFindings?: boolean }[]
  totalSteps?: number
  chunkerVersion?: string
}

export type ReviewItem = {
  itemId: string
  title: string
  state: 'ready' | 'cached' | 'unavailable' | 'changed'
  input?: AnalysisInput
  job?: AnalysisJob
  requestCount?: number
  transcriptSegments?: TranscriptSegment[]
}

export type AnalysisReview = {
  model: string
  items: ReviewItem[]
}

export function createAnalysisJob(itemId: string, input: AnalysisInput, fingerprint: string, model: string): AnalysisJob {
  const now = new Date().toISOString()
  return {
    id: analysisId(itemId, fingerprint, model), savedItemId: itemId, fingerprint, kind: input.kind,
    model, version: analysisVersion, status: 'queued', createdAt: now, updatedAt: now, attempts: 0,
  }
}
