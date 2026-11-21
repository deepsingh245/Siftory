import { describe, expect, it } from 'vitest'
import { analysisFingerprint, getMentionedLinks, prepareAnalysisInput, validateAnalysis } from '../../src/domain/analysis'
import { createSavedItem } from '../../src/domain/library'

describe('analysis sources and evidence', () => {
  it('prepares only a saved Instagram caption and fingerprints the exact text', async () => {
    const item = createSavedItem({ sourceType: 'instagram', contentType: 'unknown', title: 'Title', description: ' caption ', userNotes: 'private notes' })
    const input = prepareAnalysisInput(item)!
    expect(input).toEqual({ kind: 'caption', text: 'caption', truncated: false })
    expect(await analysisFingerprint(input)).not.toBe(await analysisFingerprint({ ...input, text: 'edited caption' }))
    expect(prepareAnalysisInput({ ...item, description: undefined })).toBeUndefined()
  })

  it('rejects invented evidence, extracts only literal web links, and skips cut off links', () => {
    const source = 'Try the toolkit (https://example.com/toolkit) and read https://example.com/reference.'
    const result = { summary: { text: 'A toolkit is suggested.', evidence: 'Try the toolkit' }, points: [], categories: [], mentions: [] }
    expect(validateAnalysis(result, source)).toEqual(result)
    expect(() => validateAnalysis({ ...result, summary: { ...result.summary, evidence: 'Invented quote' } }, source)).toThrow('matching source quotes')
    expect(getMentionedLinks(source)).toEqual(['https://example.com/toolkit', 'https://example.com/reference'])
    expect(getMentionedLinks('Text https://example.com/cut-of', true)).toEqual([])
  })
})
