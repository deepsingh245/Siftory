import {
  buildResearchPrompt,
  fingerprintResearchSource,
  maxResearchQuestionLength,
  rankResearchSources,
  researchSourceId,
  selectResearchSources,
  validateResearchAnswer,
} from '../../domain/research'
import type { ResearchReview, ResearchSession, ResearchSourceRecord } from '../../domain/research'
import type { LibraryRepository } from '../../infrastructure/persistence/libraryRepository'
import type { chatgpt } from '../analysis/chatgptClient'

export async function prepareResearchReview(repository: LibraryRepository, question: string, model: string): Promise<ResearchReview> {
  const normalizedQuestion = question.trim()
  if (!normalizedQuestion || normalizedQuestion.length > maxResearchQuestionLength) throw new Error('Enter a research question of up to 1,000 characters.')
  const records = await repository.getResearchSourceRecords()
  const sources = await Promise.all(records.map(async (record): Promise<ResearchSourceRecord> => {
    const fingerprint = await fingerprintResearchSource(record.kind, record.text)
    const id = await researchSourceId(record.savedItemId, record.kind, fingerprint)
    return { ...record, fingerprint, id }
  }))
  const ranked = rankResearchSources(normalizedQuestion, sources)
  const candidates = ranked.candidates.map((source, index) => ({ ...source, selected: index < 6 }))
  return { question: normalizedQuestion, model, candidates, totalCandidateCount: ranked.totalMatches, requestCount: 1 }
}

export async function submitResearch(
  repository: LibraryRepository,
  review: ResearchReview,
  selectedIds: string[],
  connectionId: string,
  provider: Pick<typeof chatgpt, 'status' | 'research'>,
): Promise<ResearchSession> {
  const connection = await provider.status()
  if (connection.state !== 'connected' || connection.connectionId !== connectionId) {
    throw new Error('The ChatGPT connection changed. Reconnect if needed, then review the question and sources again.')
  }
  const sources = selectResearchSources(review.candidates, selectedIds)
  buildResearchPrompt(review.question, sources)
  const response = await provider.research(review.model, review.question, sources, connectionId)
  const answer = validateResearchAnswer(response.answer, sources)
  const now = new Date().toISOString()
  const session: ResearchSession = {
    id: crypto.randomUUID(), version: '1', question: review.question, model: review.model,
    provider: 'chatgpt-plan', createdAt: now, updatedAt: now, answer,
    sources: sources.map((source) => ({ ...source, status: 'current' })),
  }
  await repository.saveResearchSession(session)
  return session
}
