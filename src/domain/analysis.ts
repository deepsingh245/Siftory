import { normalizeHttpUrl } from './library.ts'
import type { SavedItem } from './library.ts'
import type { ExtractedContent } from './processing.ts'

export const analysisVersion = '1'
export const maxAnalysisTextLength = 16_000

export type AnalysisInput = {
  kind: 'caption' | 'extracted-text'
  text: string
  truncated: boolean
}

type EvidenceNote = { text: string; evidence: string }

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

export async function analysisFingerprint(input: AnalysisInput): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([input.kind, input.text]))
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

export function validateAnalysis(value: unknown, source: string): AnalysisResult {
  const invalid = () => new Error('The analysis did not include valid information with matching source quotes. You can retry with a different model.')
  if (!value || typeof value !== 'object') throw invalid()
  const result = value as Record<string, unknown>

  function note(entry: unknown, maxLength: number): EvidenceNote {
    if (!entry || typeof entry !== 'object') throw invalid()
    const { text, evidence } = entry as Record<string, unknown>
    if (typeof text !== 'string' || !text.trim() || text.length > maxLength ||
      typeof evidence !== 'string' || !evidence.trim() || evidence.length > 240 || !source.includes(evidence)) {
      throw invalid()
    }
    return { text: text.trim(), evidence }
  }

  function notes(list: unknown, maxItems: number, maxLength: number): EvidenceNote[] {
    if (!Array.isArray(list) || list.length > maxItems) throw invalid()
    return list.map((entry) => note(entry, maxLength))
  }

  return {
    summary: note(result.summary, 1000),
    points: notes(result.points, 6, 360),
    categories: notes(result.categories, 5, 80),
    mentions: notes(result.mentions, 8, 120),
  }
}
