import { describe, expect, it } from 'vitest'
import {
  buildResearchPrompt,
  rankResearchSources,
  selectResearchSources,
  validateResearchAnswer,
  validateResearchRequestSources,
} from '../../src/domain/research'
import type { ResearchSourceRecord } from '../../src/domain/research'

function source(id: string, text: string): ResearchSourceRecord {
  return {
    id: id.repeat(64), savedItemId: `item-${id}`, title: `Source ${id}`, kind: 'transcript',
    fingerprint: 'fingerprint', text, itemUpdatedAt: '2026-11-22T00:00:00.000Z',
  }
}

describe('library research contracts', () => {
  it('ranks matching source text locally and selects only bounded excerpts', () => {
    const records = [source('a', 'Local search ranks evidence from saved text. '.repeat(50)), source('b', 'Unrelated gardening notes.')]
    const ranked = rankResearchSources('local search evidence', records)
    expect(ranked.totalMatches).toBe(1)
    expect(ranked.candidates[0]).toMatchObject({ id: 'a'.repeat(64), selected: false, itemUpdatedAt: records[0].itemUpdatedAt })
    expect(ranked.candidates[0].excerpt.length).toBeLessThanOrEqual(1500)
    expect(selectResearchSources(ranked.candidates, ['a'.repeat(64)])).toHaveLength(1)
  })

  it('accepts only exact quotes from the reviewed excerpts and derives timestamps from included segments', () => {
    const id = 'b'.repeat(64)
    const sources = validateResearchRequestSources([{ id, title: 'Timed source', kind: 'transcript', excerpt: 'A precise line from the recording.', timedSegments: [{ startMs: 12_000, endMs: 13_500, text: 'A precise line from the recording.' }] }])
    const answer = validateResearchAnswer({
      evidenceStatus: 'supported',
      summary: { text: 'The recording contains a precise line.', citations: [{ sourceId: id, quote: 'A precise line from the recording.' }] },
      claims: [{ text: 'The line is in the recording.', citations: [{ sourceId: id, quote: 'precise line from the recording' }] }],
      limitations: [],
    }, sources)
    expect(answer.summary.citations[0]).toMatchObject({ sourceId: id, timestampMs: 12_000, status: 'current' })
    expect(() => validateResearchAnswer({ ...answer, claims: [{ text: 'Unsupported', citations: [{ sourceId: id, quote: 'Not in the source' }] }] }, sources)).toThrow(/unsupported citations/u)
    expect(() => validateResearchAnswer({ ...answer, summary: { text: 'A supported result without summary evidence.', citations: [] }, claims: [], limitations: [] }, sources)).toThrow(/unsupported citations/u)
    expect(validateResearchAnswer({ evidenceStatus: 'insufficient', summary: { text: 'The selected source has no relevant evidence.', citations: [] }, claims: [], limitations: ['No reviewed excerpt discusses the question.'] }, sources).evidenceStatus).toBe('insufficient')
  })

  it('bounds request sources and rejects duplicate IDs or oversized context', () => {
    const id = 'c'.repeat(64)
    const reviewed = { id, title: 'Source', kind: 'caption', excerpt: 'A reviewed excerpt.' }
    expect(buildResearchPrompt('What does this say?', [reviewed])).toContain('reviewed excerpt')
    expect(() => validateResearchRequestSources([reviewed, reviewed])).toThrow(/valid saved-source excerpts/u)
    expect(() => buildResearchPrompt('Question', Array.from({ length: 7 }, (_, index) => ({ ...reviewed, id: String(index).padStart(64, '0') })))).toThrow(/between one and 6/u)
  })
})
