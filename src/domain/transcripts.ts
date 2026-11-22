import { MAX_SOURCE_FILE_BYTES } from './imports'

export const transcriptParserVersion = 'transcript-v1'
export const maxTranscriptCharacters = 100_000

export type TranscriptFormat = 'text' | 'srt' | 'vtt'
export type TranscriptOrigin = 'pasted' | 'text-file' | 'srt-file' | 'vtt-file' | 'local-asr'

export type TranscriptSegment = {
  startMs: number
  endMs: number
  text: string
}

export type ParsedTranscript = {
  format: TranscriptFormat
  text: string
  segments: TranscriptSegment[]
}

export type TranscriptContent = ParsedTranscript & {
  id: string
  savedItemId: string
  fingerprint: string
  parserVersion: string
  origin: TranscriptOrigin
  importedAt: string
  fileName?: string
  mediaType?: string
  sourceFingerprint?: string
  sourceBlob?: Blob
  pastedText?: string
  asrModel?: string
  audioSourceKey?: string
}

export function parseTranscript(text: string, format: TranscriptFormat): ParsedTranscript {
  if (text.length > maxTranscriptCharacters) throw new Error(`Transcript text exceeds the ${maxTranscriptCharacters.toLocaleString()}-character limit.`)
  if (hasUnsupportedControlCharacters(text)) throw new Error('Transcript contains unsupported control characters.')
  if (format === 'text') {
    const normalized = text.replace(/\r\n?/gu, '\n').trim()
    if (!normalized) throw new Error('Transcript text is empty.')
    return { format, text: normalized, segments: [] }
  }

  const normalized = text.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n')
  const blocks = normalized.split(/\n\s*\n/gu)
  const segments: TranscriptSegment[] = []
  const errors: string[] = []
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (!lines[0] || /^WEBVTT(?:\s|$)/iu.test(lines[0]) || /^(?:NOTE|STYLE|REGION)(?:\s|$)/iu.test(lines[0])) continue
    const timingIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingIndex < 0) continue
    const timing = lines[timingIndex].match(/^\s*((?:\d{2}:){1,2}\d{2}[.,]\d{1,3})\s+-->\s+((?:\d{2}:){1,2}\d{2}[.,]\d{1,3})(?:\s+.*)?$/u)
    if (!timing) {
      errors.push(`Subtitle cue ${segments.length + errors.length + 1} has an invalid timestamp.`)
      continue
    }
    const startMs = parseTimestamp(timing[1])
    const endMs = parseTimestamp(timing[2])
    if (startMs === undefined || endMs === undefined) {
      errors.push(`Subtitle cue ${segments.length + errors.length + 1} has an invalid timestamp.`)
      continue
    }
    const cueText = lines.slice(timingIndex + 1).join('\n').replace(/<\/?(?:b|i|u|c(?:\.[\w-]+)*|v(?:\s+[^>]*)?|lang(?:\s+[^>]*)?)>/giu, '').trim()
    if (endMs <= startMs || !cueText) {
      errors.push(`Subtitle cue ${segments.length + errors.length + 1} has an invalid time range or no text.`)
      continue
    }
    segments.push({ startMs, endMs, text: cueText })
  }
  if (errors.length) throw new Error(errors.slice(0, 3).join(' ') + (errors.length > 3 ? ` ${errors.length - 3} more cues need correction.` : ''))
  if (!segments.length) throw new Error('No valid timed subtitle cues were found.')
  return { format, text: segments.map((segment) => segment.text).join('\n'), segments }
}

export function parseTranscriptFileName(fileName: string): TranscriptFormat | undefined {
  const extension = fileName.toLocaleLowerCase().split('.').pop()
  return extension === 'srt' ? 'srt' : extension === 'vtt' ? 'vtt' : extension === 'txt' ? 'text' : undefined
}

export async function parseTranscriptFile(file: File): Promise<{ parsed: ParsedTranscript; origin: TranscriptOrigin; fingerprint: string }> {
  if (!file.size || file.size > MAX_SOURCE_FILE_BYTES) throw new Error(`Choose a non-empty transcript file up to ${Math.round(MAX_SOURCE_FILE_BYTES / 1024 / 1024)} MiB.`)
  const format = parseTranscriptFileName(file.name)
  if (!format) throw new Error('Choose a plain-text, SRT, or WebVTT transcript file (.txt, .srt, or .vtt).')
  if (file.type && !['text/plain', 'application/x-subrip', 'text/vtt', 'application/octet-stream'].includes(file.type.toLocaleLowerCase())) {
    throw new Error('The selected file type does not match a supported transcript format.')
  }
  const text = await file.text()
  const parsed = parseTranscript(text, format)
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return { parsed, origin: format === 'text' ? 'text-file' : `${format}-file`, fingerprint }
}

export async function transcriptFingerprint(parsed: ParsedTranscript): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([transcriptParserVersion, parsed.format, parsed.text, parsed.segments]))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createTranscriptContent(
  savedItemId: string,
  parsed: ParsedTranscript,
  origin: TranscriptOrigin,
  options: Pick<TranscriptContent, 'fileName' | 'mediaType' | 'sourceFingerprint' | 'sourceBlob' | 'pastedText' | 'asrModel' | 'audioSourceKey'> = {},
  now = new Date(),
): Promise<TranscriptContent> {
  return transcriptFingerprint(parsed).then((fingerprint) => ({
    ...parsed,
    id: JSON.stringify([savedItemId, fingerprint, transcriptParserVersion]),
    savedItemId,
    fingerprint,
    parserVersion: transcriptParserVersion,
    origin,
    importedAt: now.toISOString(),
    ...options,
  }))
}

function parseTimestamp(value: string): number | undefined {
  const [clock, fraction] = value.split(/[.,]/u)
  const parts = clock?.split(':').map(Number)
  if (!parts || (parts.length !== 2 && parts.length !== 3) || !fraction || !/^\d{1,3}$/u.test(fraction)) return undefined
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]]
  const milliseconds = Number(fraction.padEnd(3, '0'))
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || !Number.isInteger(seconds)) return undefined
  if (minutes > 59 || seconds > 59) return undefined
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + milliseconds
}

function hasUnsupportedControlCharacters(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return true
  }
  return false
}
