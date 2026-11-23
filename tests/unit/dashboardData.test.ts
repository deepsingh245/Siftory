import { createAnalysisJob } from '../../src/domain/analysisQueue'
import { createSavedItem } from '../../src/domain/library'
import { createProcessingJob } from '../../src/domain/processing'
import { dashboardSnapshot, libraryActivity } from '../../src/features/dashboard/dashboardData'
import { describe, expect, it } from 'vitest'

const itemAt = (id: string, createdAt: Date) => createSavedItem({
  title: id, sourceType: 'text', contentType: 'text',
}, createdAt, id)

describe('local dashboard metrics', () => {
  it('uses library add dates in a continuous local calendar range', () => {
    const ending = new Date(2026, 2, 11, 12)
    const days = libraryActivity([
      itemAt('before range', new Date(2026, 2, 4, 23, 59)),
      itemAt('first morning', new Date(2026, 2, 5, 0, 1)),
      itemAt('first evening', new Date(2026, 2, 5, 23, 59)),
      { ...itemAt('newest', new Date(2026, 2, 11)), savedAt: '2020-01-01' },
      itemAt('after range', new Date(2026, 2, 12, 0, 1)),
    ], 7, ending)

    expect(days.map(({ items }) => items)).toEqual([2, 0, 0, 0, 0, 0, 1])
    expect(days[0].date).toBe('2026-03-05')
    expect(days.at(-1)?.date).toBe('2026-03-11')
  })

  it('counts distinct saved items needing attention and ignores missing items', () => {
    const older = itemAt('first in storage', new Date(2026, 2, 5))
    const newest = { ...itemAt('latest', new Date(2026, 2, 11)), status: 'saved' as const, transcriptId: 'transcript' }
    const timestamp = older.createdAt
    const extraction = createProcessingJob(older, {
      savedItemId: older.id, fileName: 'example.txt', mediaType: 'text/plain', size: 4,
      blob: new Blob(['test']), sha256: 'fixture', createdAt: timestamp,
    }, new Date(timestamp), 'first job')
    const analysis = createAnalysisJob(older.id, { kind: 'caption', text: 'example', truncated: false }, 'fixture', 'fixture')

    const snapshot = dashboardSnapshot({
      items: [older, newest],
      jobs: [{ ...extraction, status: 'failed' }],
      analysisJobs: [
        { ...analysis, status: 'needs-attention' },
        { ...analysis, id: 'active', savedItemId: newest.id, status: 'analyzing' },
        { ...analysis, id: 'removed', savedItemId: 'removed', status: 'failed' },
      ],
    })

    expect(snapshot).toMatchObject({ itemCount: 2, inboxCount: 1, transcriptCount: 1, attentionCount: 1, activeJobs: 1 })
    expect(snapshot.recent.map(({ id }) => id)).toEqual([newest.id, older.id])
  })
})
