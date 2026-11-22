
export type ResearchTimedSegment = { startMs: number; endMs: number; text: string }

export const researchVersion = '1'
export const maxResearchQuestionLength = 1000
export const maxResearchSources = 6
export const maxResearchExcerptCharacters = 1500
export const maxResearchContextCharacters = 10_000
export const maxResearchPromptLength = 16_000

export type ResearchSourceKind = 'caption' | 'transcript' | 'extracted-text'
export type ResearchSourceStatus = 'current' | 'changed' | 'deleted'

export type ResearchSourceRecord = {
  id: string
  savedItemId: string
  title: string
  kind: ResearchSourceKind
  fingerprint: string
  text: string
  segments?: ResearchTimedSegment[]
  itemUpdatedAt: string
  storageId?: string
}

export type ResearchRawSourceRecord = Omit<ResearchSourceRecord, 'id' | 'fingerprint'>

export type ResearchCitationSource = {
  id: string
  title: string
  kind: ResearchSourceKind
  excerpt: string
  timedSegments?: ResearchTimedSegment[]
}

export type ResearchContextSource = {
  id: string
  savedItemId: string
  title: string
  kind: ResearchSourceKind
  fingerprint: string
  excerpt: string
  timedSegments?: ResearchTimedSegment[]
  status?: ResearchSourceStatus
  itemUpdatedAt: string
  storageId?: string
}

export type ResearchCitation = {
  sourceId: string
  quote?: string
  timestampMs?: number
  status?: ResearchSourceStatus
}

export type ResearchClaim = { text: string; citations: ResearchCitation[] }
export type ResearchSummary = { text: string; citations: ResearchCitation[] }
export type ResearchAnswer = { evidenceStatus: 'supported' | 'insufficient'; summary: ResearchSummary; claims: ResearchClaim[]; limitations: string[] }

export type ResearchSession = {
  id: string
  version: string
  question: string
  model: string
  provider: 'chatgpt-plan'
  createdAt: string
  updatedAt: string
  answer: ResearchAnswer
  sources: ResearchContextSource[]
}

export type ResearchCandidate = ResearchContextSource & { score: number; selected: boolean }

export type ResearchReview = {
  question: string
  model: string
  candidates: ResearchCandidate[]
  totalCandidateCount: number
  requestCount: 1
}

export type ResearchRanking = { candidates: ResearchCandidate[]; totalMatches: number }

export async function fingerprintResearchSource(kind: ResearchSourceKind, text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([kind, text])))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function researchSourceId(savedItemId: string, kind: ResearchSourceKind, fingerprint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([savedItemId, kind, fingerprint])))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function rankResearchSources(question: string, sources: ResearchSourceRecord[]): ResearchRanking {
  const query = normalize(question)
  const terms = [...new Set(query.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1))]
  if (!terms.length) return { candidates: [], totalMatches: 0 }
  const candidates: ResearchCandidate[] = []
  for (const source of sources) {
    const normalizedText = normalize(source.text)
    const normalizedTitle = normalize(source.title)
    if (!terms.some((term) => normalizedText.includes(term))) continue
    let score = normalizedText.includes(query) ? 12 : 0
    for (const term of terms) {
      score += Math.min(countOccurrences(normalizedText, term), 8)
      if (normalizedTitle.includes(term)) score += 4
    }
    if (score <= 0) continue
    const excerpt = makeExcerpt(source, terms)
    if (!excerpt.text) continue
    candidates.push({
      id: source.id, savedItemId: source.savedItemId, title: source.title, kind: source.kind,
      fingerprint: source.fingerprint, excerpt: excerpt.text,
      itemUpdatedAt: source.itemUpdatedAt,
      ...(source.storageId ? { storageId: source.storageId } : {}),
      ...(excerpt.segments.length ? { timedSegments: excerpt.segments } : {}),
      score, selected: false,
    })
  }
  candidates.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
  return { candidates: candidates.slice(0, 24), totalMatches: candidates.length }
}

export function selectResearchSources(candidates: ResearchCandidate[], selectedIds: string[]): ResearchContextSource[] {
  const selected = candidates.filter((candidate) => selectedIds.includes(candidate.id)).slice(0, maxResearchSources)
  let remaining = maxResearchContextCharacters
  const context: ResearchContextSource[] = []
  for (const candidate of selected) {
    if (remaining <= 0) break
    const excerpt = safeSlice(candidate.excerpt, remaining)
    if (!excerpt.trim()) continue
    const segments = candidate.timedSegments?.filter((segment) => excerpt.includes(segment.text))
    context.push({
      id: candidate.id, savedItemId: candidate.savedItemId, title: candidate.title, kind: candidate.kind,
      fingerprint: candidate.fingerprint, excerpt,
      itemUpdatedAt: candidate.itemUpdatedAt,
      ...(candidate.storageId ? { storageId: candidate.storageId } : {}),
      ...(segments?.length ? { timedSegments: segments } : {}),
    })
    remaining -= excerpt.length
  }
  return context
}

export function buildResearchPrompt(question: string, sources: ResearchCitationSource[]): string {
  if (!question.trim() || question.length > maxResearchQuestionLength) throw new Error('Enter a research question of up to 1,000 characters.')
  if (!sources.length || sources.length > maxResearchSources) throw new Error(`Select between one and ${maxResearchSources} saved sources.`)
  const total = sources.reduce((sum, source) => sum + source.excerpt.length, 0)
  if (total > maxResearchContextCharacters) throw new Error('Selected source excerpts exceed the 10,000-character research context limit.')
  const prompt = JSON.stringify({
    question: question.trim(),
    sources: sources.map(({ id, title, kind, excerpt }) => ({ id, title, kind, excerpt })),
  })
  if (prompt.length > maxResearchPromptLength) throw new Error('The reviewed question and source excerpts exceed the request limit. Remove a source and review again.')
  return prompt
}

export function validateResearchAnswer(value: unknown, sources: ResearchCitationSource[]): ResearchAnswer {
  const invalid = () => new Error('The research answer contains missing or unsupported citations. Review the sources and retry.')
  if (!value || typeof value !== 'object') throw invalid()
  const raw = value as Record<string, unknown>
  if ((raw.evidenceStatus !== 'supported' && raw.evidenceStatus !== 'insufficient') || !raw.summary || typeof raw.summary !== 'object' || !Array.isArray(raw.claims) || raw.claims.length > 12 ||
    !Array.isArray(raw.limitations) || raw.limitations.length > 8) throw invalid()
  const sourceMap = new Map(sources.map((source) => [source.id, source]))
  const summary = raw.summary as Record<string, unknown>
  if (typeof summary.text !== 'string' || !summary.text.trim() || summary.text.length > 2000) throw invalid()
  const summaryCitations = validateCitations(summary.citations, sourceMap, 4, true, invalid)
  const claims = raw.claims.map((entry): ResearchClaim => {
    if (!entry || typeof entry !== 'object') throw invalid()
    const claim = entry as Record<string, unknown>
    if (typeof claim.text !== 'string' || !claim.text.trim() || claim.text.length > 600) throw invalid()
    const citations = validateCitations(claim.citations, sourceMap, 4, false, invalid)
    return { text: claim.text.trim(), citations }
  })
  const limitations = raw.limitations.map((entry) => {
    if (typeof entry !== 'string' || !entry.trim() || entry.length > 300) throw invalid()
    return entry.trim()
  })
  if (raw.evidenceStatus === 'supported' && !summaryCitations.length) throw invalid()
  if (raw.evidenceStatus === 'insufficient' && (summaryCitations.length || claims.length || !limitations.length)) throw invalid()
  return { evidenceStatus: raw.evidenceStatus, summary: { text: summary.text.trim(), citations: summaryCitations }, claims, limitations }
}

function validateCitations(
  value: unknown,
  sourceMap: Map<string, ResearchCitationSource>,
  maxCount: number,
  allowEmpty: boolean,
  invalid: () => Error,
): ResearchCitation[] {
  if (!Array.isArray(value) || value.length > maxCount || (!allowEmpty && !value.length)) throw invalid()
  return value.map((rawCitation): ResearchCitation => {
    if (!rawCitation || typeof rawCitation !== 'object') throw invalid()
    const citation = rawCitation as Record<string, unknown>
    const source = typeof citation.sourceId === 'string' ? sourceMap.get(citation.sourceId) : undefined
    const quote = citation.quote
    if (!source || typeof quote !== 'string' || !quote.trim() || quote.length > 240 || !source.excerpt.includes(quote)) throw invalid()
    const timed = source.timedSegments?.find((segment) => segment.text.includes(quote))
    return { sourceId: source.id, quote, status: 'current', ...(timed ? { timestampMs: timed.startMs } : {}) }
  })
}

export function validateResearchRequestSources(value: unknown): ResearchCitationSource[] {
  const invalid = () => new Error('Review and select valid saved-source excerpts before starting research.')
  if (!Array.isArray(value) || value.length < 1 || value.length > maxResearchSources) throw invalid()
  const seen = new Set<string>()
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') throw invalid()
    const source = entry as Record<string, unknown>
    if (typeof source.id !== 'string' || !/^[a-f0-9]{64}$/u.test(source.id) || seen.has(source.id) ||
      typeof source.title !== 'string' || source.title.length > 300 ||
      typeof source.kind !== 'string' || !['caption', 'transcript', 'extracted-text'].includes(source.kind) ||
      typeof source.excerpt !== 'string' || !source.excerpt.trim() || source.excerpt.length > maxResearchExcerptCharacters) throw invalid()
    seen.add(source.id)
    const excerpt = source.excerpt as string
    let timedSegments: ResearchTimedSegment[] | undefined
    if (source.timedSegments !== undefined) {
      if (!Array.isArray(source.timedSegments) || source.timedSegments.length > 20) throw invalid()
      timedSegments = source.timedSegments.map((value): ResearchTimedSegment => {
        if (!value || typeof value !== 'object') throw invalid()
        const segment = value as Record<string, unknown>
        if (typeof segment.startMs !== 'number' || !Number.isSafeInteger(segment.startMs) || segment.startMs < 0 ||
          typeof segment.endMs !== 'number' || !Number.isSafeInteger(segment.endMs) || segment.endMs <= segment.startMs ||
          typeof segment.text !== 'string' || !segment.text || segment.text.length > 2000 || !excerpt.includes(segment.text)) throw invalid()
        return { startMs: segment.startMs, endMs: segment.endMs, text: segment.text }
      })
    }
    return {
      id: source.id, title: source.title,
      kind: source.kind as ResearchSourceKind, excerpt: source.excerpt,
      ...(timedSegments?.length ? { timedSegments } : {}),
    }
  })
}

export function markResearchSourcesUnavailable(
  session: ResearchSession,
  savedItemId: string,
  kind?: ResearchSourceKind,
  status: Exclude<ResearchSourceStatus, 'current'> = 'deleted',
  at = new Date().toISOString(),
): ResearchSession {
  const affected = new Set(session.sources.filter((source) => source.savedItemId === savedItemId && (!kind || source.kind === kind) &&
    (status === 'deleted' ? source.status !== 'deleted' : (source.status ?? 'current') === 'current')).map((source) => source.id))
  if (!affected.size) return session
  const sources = session.sources.map((source) => affected.has(source.id)
    ? { ...source, status, ...(status === 'deleted' ? { excerpt: '', timedSegments: undefined } : {}) }
    : source)
  const answer = {
    ...session.answer,
    summary: {
      ...session.answer.summary,
      citations: session.answer.summary.citations.map((citation) => affected.has(citation.sourceId)
        ? { ...citation, status, ...(status === 'deleted' ? { quote: undefined, timestampMs: undefined } : {}) }
        : citation),
    },
    claims: session.answer.claims.map((claim) => ({
      ...claim,
      citations: claim.citations.map((citation) => affected.has(citation.sourceId)
        ? { ...citation, status, ...(status === 'deleted' ? { quote: undefined, timestampMs: undefined } : {}) }
        : citation),
    })),
    limitations: session.answer.limitations.includes(status === 'deleted'
      ? 'A cited source was deleted from the library; its saved excerpt was removed from this session.'
      : 'A cited source has changed since this research session was created. Its saved quote is a historical snapshot.')
      ? session.answer.limitations
      : [...session.answer.limitations, status === 'deleted'
      ? 'A cited source was deleted from the library; its saved excerpt was removed from this session.'
      : 'A cited source has changed since this research session was created. Its saved quote is a historical snapshot.'],
  }
  return { ...session, sources, answer, updatedAt: at }
}

function makeExcerpt(source: ResearchSourceRecord, terms: string[]): { text: string; segments: ResearchTimedSegment[] } {
  if (source.segments?.length) {
    const cueIndex = source.segments.findIndex((segment) => terms.some((term) => normalize(segment.text).includes(term)))
    if (cueIndex >= 0) {
      const chosen: ResearchTimedSegment[] = []
      let length = 0
      for (let index = cueIndex; index < source.segments.length && length < maxResearchExcerptCharacters; index += 1) {
        const segment = source.segments[index]
        if (length + segment.text.length + (chosen.length ? 1 : 0) > maxResearchExcerptCharacters) break
        chosen.push(segment); length += segment.text.length + (chosen.length > 1 ? 1 : 0)
      }
      if (chosen.length) return { text: chosen.map((segment) => segment.text).join('\n'), segments: chosen }
    }
  }
  const lowerText = source.text.toLowerCase()
  const index = terms.map((term) => lowerText.indexOf(term)).filter((entry) => entry >= 0).sort((a, b) => a - b)[0] ?? 0
  const start = Math.max(0, index - Math.floor(maxResearchExcerptCharacters * 0.25))
  const safeStart = start > 0 ? Math.max(start, source.text.indexOf(' ', start)) : 0
  const end = Math.min(source.text.length, safeStart + maxResearchExcerptCharacters)
  const safeEndIndex = end < source.text.length && source.text.lastIndexOf(' ', end) > safeStart
    ? source.text.lastIndexOf(' ', end)
    : end
  return { text: source.text.slice(safeStart, safeEndIndex).trim(), segments: [] }
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
}

function countOccurrences(text: string, term: string): number {
  let count = 0
  let from = 0
  while (count < 8) {
    const index = text.indexOf(term, from)
    if (index < 0) break
    count += 1; from = index + term.length
  }
  return count
}

function safeSlice(text: string, length: number): string {
  let end = Math.min(length, text.length)
  if (end < text.length && text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff) end -= 1
  return text.slice(0, end)
}
