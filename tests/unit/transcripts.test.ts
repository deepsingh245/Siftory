import { describe, expect, it } from 'vitest'
import { parseTranscript } from '../../src/domain/transcripts'
import { createTranscriptAnalysisPlan, locateTranscriptTimestamp, transcriptChunkCharacters } from '../../src/domain/transcriptAnalysis'

describe('user-provided transcript parsing', () => {
  it('parses timed SRT cues and preserves their source offsets', () => {
    const result = parseTranscript('1\n00:00:01,250 --> 00:00:03,000\nFirst exact quote.\n\n2\n00:01:02,000 --> 00:01:03,000\nSecond quote.', 'srt')
    expect(result.text).toBe('First exact quote.\nSecond quote.')
    expect(result.segments).toEqual([
      { startMs: 1250, endMs: 3000, text: 'First exact quote.' },
      { startMs: 62_000, endMs: 63_000, text: 'Second quote.' },
    ])
    expect(locateTranscriptTimestamp('Second quote.', result.segments)).toBe(62_000)
  })

  it('accepts valid WebVTT minute-second cues', () => {
    const result = parseTranscript('WEBVTT\n\n00:01.000 --> 00:02.500\nA timed line.', 'vtt')
    expect(result.segments).toEqual([{ startMs: 1000, endMs: 2500, text: 'A timed line.' }])
  })

  it('rejects malformed cue timestamps and over-limit plain text', () => {
    expect(() => parseTranscript('1\n00:90:00,000 --> 00:91:00,000\nBad cue', 'srt')).toThrow(/invalid timestamp/u)
    expect(() => parseTranscript('x'.repeat(100_001), 'text')).toThrow(/character limit/u)
  })

  it('plans bounded source requests followed by deterministic reduction requests', () => {
    const transcript = Array.from({ length: 3 }, (_, index) => `${index + 1}: ${'meaningful source words '.repeat(300)}`).join('\n')
    const plan = createTranscriptAnalysisPlan(transcript)
    const sourceSteps = plan.filter((step) => step.kind === 'source')
    const mergeSteps = plan.filter((step) => step.kind === 'merge')
    expect(sourceSteps.length).toBeGreaterThan(1)
    expect(sourceSteps.every((step) => step.text.length <= transcriptChunkCharacters)).toBe(true)
    expect(sourceSteps.map((step) => step.text).join('')).toBe(transcript)
    expect(mergeSteps).toHaveLength(sourceSteps.length - 1)
    expect(plan).toEqual(createTranscriptAnalysisPlan(transcript))
  })

  it('does not split a Unicode surrogate pair at a chunk edge', () => {
    const text = `${'a'.repeat(transcriptChunkCharacters - 1)}😀tail`
    const plan = createTranscriptAnalysisPlan(text)
    expect(plan.filter((step) => step.kind === 'source').map((step) => step.text).join('')).toBe(text)
  })
})
