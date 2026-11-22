import type { AnalysisResult } from './analysis'
import type { TranscriptSegment } from './transcripts'
import type { TranscriptContent } from './transcripts'

export const transcriptChunkerVersion = 'transcript-chunker-v1'
export const transcriptChunkCharacters = 14_000

export function transcriptAnalysisProvenance(transcript: TranscriptContent): string {
  return `${transcript.fingerprint}:${transcript.parserVersion}:${transcriptChunkerVersion}`
}

export type TranscriptAnalysisStep = { id: string; text: string; kind: 'source' | 'merge'; left?: string; right?: string }

export function createTranscriptAnalysisPlan(text: string, segments: TranscriptSegment[] = []): TranscriptAnalysisStep[] {
  const chunks: string[] = []
  if (segments.length) {
    let chunk = ''
    for (const segment of segments) {
      const line = segment.text + '\n'
      if (line.length > transcriptChunkCharacters) {
        if (chunk) chunks.push(chunk.trimEnd())
        chunk = ''
        for (let offset = 0; offset < line.length;) {
          const end = safeEnd(line, offset, transcriptChunkCharacters)
          chunks.push(line.slice(offset, end))
          offset = end
        }
      } else if (chunk.length + line.length > transcriptChunkCharacters) {
        chunks.push(chunk.trimEnd()); chunk = line
      } else chunk += line
    }
    if (chunk.trim()) chunks.push(chunk.trimEnd())
  } else {
    for (let offset = 0; offset < text.length;) {
      let end = safeEnd(text, offset, transcriptChunkCharacters)
      if (end < text.length) {
        const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('. ', end), text.lastIndexOf(' ', end))
        if (boundary > offset + transcriptChunkCharacters * 0.6) end = boundary + (text[boundary] === '.' ? 1 : 0)
      }
      chunks.push(text.slice(offset, end))
      offset = end
    }
  }
  if (!chunks.length) throw new Error('Transcript has no analyzable text.')
  const steps: TranscriptAnalysisStep[] = chunks.map((value, index) => ({ id: `source-${String(index + 1).padStart(3, '0')}`, text: value, kind: 'source' }))
  let layer = steps.map((step) => step.id)
  let level = 1
  while (layer.length > 1) {
    const next: string[] = []
    for (let index = 0; index < layer.length; index += 2) {
      if (!layer[index + 1]) { next.push(layer[index]); continue }
      const id = `merge-${level}-${String(Math.floor(index / 2) + 1).padStart(3, '0')}`
      steps.push({ id, text: '', kind: 'merge', left: layer[index], right: layer[index + 1] })
      next.push(id)
    }
    layer = next; level += 1
  }
  return steps
}

function safeEnd(text: string, offset: number, limit: number): number {
  let end = Math.min(offset + limit, text.length)
  const last = text.charCodeAt(end - 1)
  if (end < text.length && last >= 0xd800 && last <= 0xdbff) end -= 1
  return Math.max(offset + 1, end)
}

export function transcriptStepInput(step: TranscriptAnalysisStep, results: Map<string, AnalysisResult>): string {
  if (step.kind === 'source') return step.text
  const left = step.left ? results.get(step.left) : undefined
  const right = step.right ? results.get(step.right) : undefined
  if (!left || !right) throw new Error('A previous transcript analysis step is missing. Review and retry this item.')
  return [
    'Combine these adjacent transcript analyses into one concise analysis. Preserve only claims supported by the quoted source evidence. Every evidence field must be an exact quote copied from one of the evidence lines below.',
    'LEFT ANALYSIS', formatAnalysis(left), 'RIGHT ANALYSIS', formatAnalysis(right),
  ].join('\n')
}

function formatAnalysis(result: AnalysisResult): string {
  return [
    `Summary: ${result.summary.text}\nEvidence: ${result.summary.evidence}`,
    ...result.points.map((note) => `Point: ${note.text}\nEvidence: ${note.evidence}`),
    ...result.categories.map((note) => `Category: ${note.text}\nEvidence: ${note.evidence}`),
    ...result.mentions.map((note) => `Mention: ${note.text}\nEvidence: ${note.evidence}`),
  ].join('\n')
}

export function locateTranscriptTimestamp(evidence: string, segments: TranscriptSegment[]): number | undefined {
  const normalized = evidence.trim()
  const match = segments.find((segment) => segment.text.includes(normalized))
  return match?.startMs
}
