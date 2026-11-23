import { normalizeHttpUrl } from './library.ts'
import type { SavedItem } from './library.ts'
import type { ExtractedContent } from './processing.ts'

export const analysisVersion = '2'
export const maxAnalysisTextLength = 16_000

export type AnalysisInput = {
  kind: 'caption' | 'extracted-text' | 'transcript'
  text: string
  truncated: boolean
  provenance?: string
}

type EvidenceNote = { text: string; evidence: string; timestampMs?: number }

export type AnalysisResult = {
  summary: EvidenceNote
  points: EvidenceNote[]
  categories: EvidenceNote[]
  mentions: EvidenceNote[]
}

export type Analysis = {
  id: string
  savedItemId: string
  fingerprint: string
  version: string
  provider: 'chatgpt-plan'
  kind: AnalysisInput['kind']
  model: string
  createdAt: string
  result: AnalysisResult
  links: string[]
  hasOmittedFindings?: boolean
}

export function prepareAnalysisInput(item: SavedItem, extracted?: ExtractedContent): AnalysisInput | undefined {
  let input: { kind: AnalysisInput['kind']; text: string } | undefined
  if (item.sourceType === 'instagram' && item.description?.trim()) {
    input = { kind: 'caption', text: item.description.trim() }
  } else if (item.sourceType === 'text' && item.contentType === 'text' && item.sourceFileId &&
    extracted?.savedItemId === item.id && extracted.sourceFingerprint === item.sourceFingerprint && extracted.text.trim()) {
    input = { kind: 'extracted-text', text: extracted.text.trim() }
  }
  if (!input) return undefined
  const text = input.text.slice(0, maxAnalysisTextLength).replace(/[\uD800-\uDBFF]$/u, '')
  return { kind: input.kind, text, truncated: text.length < input.text.length }
}

export function prepareTranscriptAnalysisInput(text: string, provenance?: string): AnalysisInput {
  return { kind: 'transcript', text, truncated: false, provenance }
}

export async function analysisFingerprint(input: AnalysisInput): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([input.kind, input.text, input.provenance ?? null]))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function analysisId(itemId: string, fingerprint: string, model: string): string {
  return JSON.stringify([itemId, fingerprint, model, analysisVersion])
}

export function getMentionedLinks(text: string, truncated = false): string[] {
  const links = new Set<string>()
  for (const match of text.matchAll(/https?:\/\/[^\s<>"'`]+/gi)) {
    if (truncated && (match.index ?? 0) + match[0].length === text.length) break
    try {
      let candidate = match[0].replace(/[.,;:!?]+$/, '')
      for (const [open, close] of [['(', ')'], ['[', ']']]) {
        let extraClosers = candidate.split(close).length - candidate.split(open).length
        while (extraClosers > 0 && candidate.endsWith(close)) {
          candidate = candidate.slice(0, -1)
          extraClosers -= 1
        }
      }
      const link = normalizeHttpUrl(candidate)
      if (link && link.length <= 2048) links.add(link)
    } catch {
      // Invalid links stay in the source text and are not rendered as links.
    }
    if (links.size >= 30) break
  }
  return [...links]
}

export class AnalysisValidationError extends Error {
  readonly field: string
  readonly reason: string
  constructor(field: string, reason: string) {
    super('The analysis did not include valid information with matching source quotes. You can retry with a different model.')
    this.field = field
    this.reason = reason
  }
}

const unmatchedSourceQuote = 'Quote is not an exact match in the supplied text.'

export function validateAnalysis(value: unknown, source: string, onUnmatchedFinding?: (field: string) => void): AnalysisResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AnalysisValidationError('result', 'Expected a JSON object.')
  const result = value as Record<string, unknown>

  function note(entry: unknown, maxLength: number, field: string): EvidenceNote {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new AnalysisValidationError(field, 'Expected an object with text and evidence.')
    const { text, evidence } = entry as Record<string, unknown>
    if (typeof text !== 'string' || !text.trim()) throw new AnalysisValidationError(`${field}.text`, 'Expected non-empty text.')
    if (text.length > maxLength) throw new AnalysisValidationError(`${field}.text`, `Text exceeds ${maxLength} characters.`)
    if (typeof evidence !== 'string' || !evidence.trim()) throw new AnalysisValidationError(`${field}.evidence`, 'Expected a non-empty source quote.')
    if (evidence.length > 240) throw new AnalysisValidationError(`${field}.evidence`, 'Quote exceeds 240 characters.')
    if (!source.includes(evidence)) throw new AnalysisValidationError(`${field}.evidence`, unmatchedSourceQuote)
    return { text: text.trim(), evidence }
  }

  function notes(list: unknown, maxItems: number, maxLength: number, field: string): EvidenceNote[] {
    if (!Array.isArray(list)) throw new AnalysisValidationError(field, 'Expected an array.')
    if (list.length > maxItems) throw new AnalysisValidationError(field, `Expected at most ${maxItems} entries.`)
    return list.flatMap((entry, index) => {
      try {
        return [note(entry, maxLength, `${field}[${index}]`)]
      } catch (error) {
        if (!onUnmatchedFinding || !(error instanceof AnalysisValidationError) || error.reason !== unmatchedSourceQuote) throw error
        onUnmatchedFinding(error.field)
        return []
      }
    })
  }

  return {
    summary: note(result.summary, 1000, 'summary'),
    points: notes(result.points, 6, 360, 'points'),
    categories: notes(result.categories, 5, 80, 'categories'),
    mentions: notes(result.mentions, 8, 120, 'mentions'),
  }
}
