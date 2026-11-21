import { describe, expect, it } from 'vitest'
import { canTransitionProcessingJob, getProcessingCapability, processingJobKey } from '../../src/domain/processing'
import { createSavedItem } from '../../src/domain/library'

describe('processing domain', () => {
  it('keys work by item, source fingerprint, and extractor version', () => {
    expect(processingJobKey('item', 'fingerprint')).toBe('item:fingerprint:local-text-v1')
  })

  it('allows only supported state transitions', () => {
    expect(canTransitionProcessingJob('queued', 'extracting')).toBe(true)
    expect(canTransitionProcessingJob('extracting', 'completed')).toBe(true)
    expect(canTransitionProcessingJob('completed', 'queued')).toBe(false)
  })

  it('reports links as unsupported and missing local text as missing source', () => {
    const link = createSavedItem({ title: 'Link', url: 'https://example.com', sourceType: 'website', contentType: 'article' }, undefined, 'link')
    expect(getProcessingCapability(link, undefined, []).state).toBe('unsupported')
    const text = { ...link, sourceType: 'text' as const, contentType: 'text' as const, sourceFileId: 'text' }
    expect(getProcessingCapability(text, undefined, []).state).toBe('missing-source')
  })
})
