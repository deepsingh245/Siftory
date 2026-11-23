import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDB } from 'idb'
import type { AnalysisInput } from '../../src/domain/analysis'
import { createSavedItem } from '../../src/domain/library'
import { prepareAnalysisReview, runReviewedAnalysis } from '../../src/features/analysis/analysisQueueService'
import { ChatGptRequestError } from '../../src/features/analysis/chatgptClient'
import { createLibraryRepository } from '../../src/infrastructure/persistence/libraryRepository'
import { databaseName } from '../../src/infrastructure/persistence/libraryDatabase'
import { createTranscriptContent, parseTranscript } from '../../src/domain/transcripts'
import type { chatgpt } from '../../src/features/analysis/chatgptClient'

let name: string
let repository: ReturnType<typeof createLibraryRepository>

beforeEach(() => {
  name = `${databaseName}-analysis-${crypto.randomUUID()}`
  repository = createLibraryRepository(name)
})

afterEach(async () => { await repository.close(); await deleteDB(name) })

async function addCaption(id: string, description = 'Important words and a useful link https://example.com/notes') {
  const item = { ...createSavedItem({ title: `Caption ${id}`, sourceType: 'instagram', contentType: 'post', description }, undefined, id), sourceRecordId: id }
  await repository.saveItem(item)
  return item
}

const generated = {
  summary: { text: 'A useful note.', evidence: 'Important words' },
  points: [{ text: 'The source has a link.', evidence: 'https://example.com/notes' }],
  categories: [], mentions: [],
}

describe('persistent AI analysis queue', () => {
  it('reviews exact source text, queues it, and persists validated results', async () => {
    const first = await addCaption('first')
    const second = await addCaption('second', 'Another caption to review.')
    const review = await prepareAnalysisReview(repository, [first.id, second.id], 'gpt-6-sol')
    expect(review.items.map(({ state }) => state)).toEqual(['ready', 'ready'])
    expect(review.items[0].input?.text).toContain(first.description)
    await repository.enqueueAnalysisJobs(review.items.map((entry) => entry.job!))

    const provider = {
      status: vi.fn(async () => ({ state: 'connected', connectionId: 'current', models: [] } as const)),
      analyze: vi.fn(async (_model: string, text: string, _connectionId: string) => ({ result: {
        ...generated,
        summary: { text: 'A useful note.', evidence: text.slice(0, 16) },
        points: text.includes('https://example.com/notes') ? generated.points : [],
      } })),
    } as unknown as Pick<typeof chatgpt, 'status' | 'analyze'>
    const updates = vi.fn(async () => undefined)
    const run = await runReviewedAnalysis(repository, review, 'current', provider, updates)
    expect(run.completed).toHaveLength(2)
    expect(provider.analyze).toHaveBeenCalledTimes(2)
    expect(await repository.getAnalyses(first.id)).toHaveLength(1)
    expect(await repository.getAnalysisJobs()).toEqual(expect.arrayContaining([expect.objectContaining({ savedItemId: first.id, status: 'completed', attempts: 1 })]))
    expect(run.completed[0].links).toEqual(['https://example.com/notes'])
  })

  it('marks a matching saved result as cached so review sends no duplicate request', async () => {
    const item = await addCaption('cached')
    const initial = await prepareAnalysisReview(repository, [item.id], 'gpt-6-sol')
    const entry = initial.items[0]
    await repository.saveAnalysis({
      id: entry.job!.id, savedItemId: item.id, fingerprint: entry.job!.fingerprint, version: entry.job!.version,
      provider: 'chatgpt-plan', model: entry.job!.model, kind: entry.job!.kind, createdAt: new Date().toISOString(),
      result: generated, links: [],
    })
    const refreshed = await prepareAnalysisReview(repository, [item.id], 'gpt-6-sol')
    expect(refreshed.items[0].state).toBe('cached')
    expect(refreshed.items[0].input).toBeUndefined()
  })

  it('allows only one tab to claim a job and fences expired attempts', async () => {
    const item = await addCaption('claim')
    const review = await prepareAnalysisReview(repository, [item.id], 'gpt-6-sol')
    const entry = review.items[0]
    expect(entry.job && entry.input).toBeTruthy()
    await repository.enqueueAnalysisJobs([entry.job!])
    const otherTab = createLibraryRepository(name)
    const input = entry.input as AnalysisInput
    const [first, second] = await Promise.all([
      repository.claimAnalysisJob(entry.job!.id, input),
      otherTab.claimAnalysisJob(entry.job!.id, input),
    ])
    expect([first.state, second.state].filter((state) => state === 'claimed')).toHaveLength(1)
    const claim = first.state === 'claimed' ? first : second
    if (claim.state !== 'claimed') throw new Error('No tab claimed the analysis job.')
    const staleTime = Date.now() + 10 * 60_000 + 1
    expect(await repository.recoverExpiredAnalysisJobs(staleTime)).toBe(1)
    await repository.setAnalysisJobQueueState(entry.job!.id, 'queued')
    const latest = await otherTab.claimAnalysisJob(entry.job!.id, input, staleTime)
    expect(latest.state).toBe('claimed')
    const result = {
      id: entry.job!.id, savedItemId: item.id, fingerprint: entry.job!.fingerprint, version: entry.job!.version,
      provider: 'chatgpt-plan' as const, model: entry.job!.model, kind: entry.job!.kind, createdAt: new Date().toISOString(),
      result: generated, links: [],
    }
    expect(await repository.completeAnalysisJob(result, claim.attemptId, input, staleTime + 1)).toBe(false)
    expect(await otherTab.completeAnalysisJob(result, latest.attemptId, input, staleTime + 1)).toBe(true)
    await otherTab.close()
  })

  it('pauses after an allowance error without starting later jobs', async () => {
    const a = await addCaption('limited-a')
    const b = await addCaption('limited-b')
    const review = await prepareAnalysisReview(repository, [a.id, b.id], 'gpt-6-sol')
    await repository.enqueueAnalysisJobs(review.items.map((entry) => entry.job!))
    const provider = {
      status: vi.fn(async () => ({ state: 'connected', connectionId: 'current', models: [] } as const)),
      analyze: vi.fn(async () => { throw new ChatGptRequestError('Plan allowance reached', 429) }),
    } as unknown as Pick<typeof chatgpt, 'status' | 'analyze'>
    const run = await runReviewedAnalysis(repository, review, 'current', provider, async () => undefined)
    expect(run.message).toContain('Plan allowance')
    expect(provider.analyze).toHaveBeenCalledOnce()
    expect((await repository.getAnalysisJobs()).filter((job) => job.status === 'queued')).toHaveLength(1)
    expect((await repository.getAnalysisJobs()).filter((job) => job.status === 'needs-attention')).toHaveLength(1)
  })

  it('persists the server diagnostic and transcript step on a failed job', async () => {
    const item = await addCaption('diagnostic')
    await repository.attachTranscript(await createTranscriptContent(item.id, parseTranscript('Important words in the recording.', 'text'), 'pasted'))
    const review = await prepareAnalysisReview(repository, [item.id], 'gpt-6-luna')
    await repository.enqueueAnalysisJobs([review.items[0].job!])
    const diagnostic = { requestId: 'local-request-id', stage: 'validation', field: 'summary.evidence', reason: 'Quote is not an exact match.' }
    const provider: Pick<typeof chatgpt, 'status' | 'analyze'> = {
      status: async () => ({ state: 'connected', connectionId: 'current', models: [] }),
      analyze: async () => { throw new ChatGptRequestError('Invalid quote.', 502, diagnostic) },
    }
    await runReviewedAnalysis(repository, review, 'current', provider, async () => undefined)
    await repository.close()
    expect((await repository.getAnalysisJobs())[0]).toMatchObject({
      status: 'failed', diagnostic: { ...diagnostic, status: 502, step: 'source-001' },
    })
  })

  it('marks a queued review changed if its source text has changed', async () => {
    const item = await addCaption('changed')
    const review = await prepareAnalysisReview(repository, [item.id], 'gpt-6-sol')
    await repository.enqueueAnalysisJobs(review.items.map((entry) => entry.job!))
    const changed = { ...item, description: 'Edited after queueing.' }
    await repository.saveItem(changed)
    const claim = await repository.claimAnalysisJob(review.items[0].job!.id, review.items[0].input!)
    expect(claim.state).toBe('changed')
    expect(await repository.getAnalysisJobs()).toEqual(expect.arrayContaining([expect.objectContaining({ status: 'needs-attention', message: expect.stringContaining('changed') })]))
  })

  it('analyzes all transcript chunks, persists partial progress, and resumes without repeating completed steps', async () => {
    const item = await addCaption('long-transcript', 'Original Instagram caption stays intact.')
    const transcriptText = `${'A source sentence with clear evidence. '.repeat(500)}\n${'Another source sentence for later chunks. '.repeat(500)}`
    const transcript = await createTranscriptContent(item.id, parseTranscript(transcriptText, 'text'), 'pasted', { pastedText: transcriptText })
    await repository.attachTranscript(transcript)
    const review = await prepareAnalysisReview(repository, [item.id], 'gpt-6-sol')
    expect(review.items[0].requestCount).toBeGreaterThan(1)
    expect(review.items[0].input?.kind).toBe('transcript')
    expect((await repository.getItem(item.id))?.description).toBe('Original Instagram caption stays intact.')
    await repository.enqueueAnalysisJobs(review.items.map((entry) => entry.job!))

    let failOnMerge = true
    let reportedOmission = false
    const provider = {
      status: vi.fn(async () => ({ state: 'connected', connectionId: 'current', models: [] } as const)),
      analyze: vi.fn(async (_model: string, text: string, _connectionId: string) => {
        if (failOnMerge && text.startsWith('Combine these adjacent')) throw new ChatGptRequestError('Temporary limit', 429)
        const evidence = text.startsWith('Combine these adjacent')
          ? text.split('LEFT ANALYSIS\nSummary: ')[1]?.split('\nEvidence: ')[1]?.split('\n')[0] ?? 'missing evidence'
          : text.slice(0, 40)
        const hasOmittedFindings = !reportedOmission
        reportedOmission = true
        return { result: { summary: { text: 'A transcript summary.', evidence }, points: [], categories: [], mentions: [] }, hasOmittedFindings }
      }),
    } as unknown as Pick<typeof chatgpt, 'status' | 'analyze'>

    const first = await runReviewedAnalysis(repository, review, 'current', provider, async () => undefined)
    expect(first.message).toContain('Temporary limit')
    const interrupted = (await repository.getAnalysisJobs())[0]
    const completedBeforeRetry = interrupted.completedSteps?.length ?? 0
    expect(completedBeforeRetry).toBeGreaterThan(1)
    expect(interrupted.completedSteps?.[0].hasOmittedFindings).toBe(true)
    failOnMerge = false
    await repository.setAnalysisJobQueueState(interrupted.id, 'queued')
    const queued = await repository.getAnalysisJobs()
    const resumed = await prepareAnalysisReview(repository, [], 'gpt-6-sol', queued)
    const callsBeforeRetry = provider.analyze.mock.calls.length
    const second = await runReviewedAnalysis(repository, resumed, 'current', provider, async () => undefined)
    expect(second.completed).toHaveLength(1)
    expect(provider.analyze.mock.calls.length - callsBeforeRetry).toBe(review.items[0].requestCount! - completedBeforeRetry)
    expect((await repository.getAnalysisJobs())[0].status).toBe('completed')
    expect((await repository.getAnalyses(item.id))[0].kind).toBe('transcript')
    expect((await repository.getAnalyses(item.id))[0].hasOmittedFindings).toBe(true)
  })
})
