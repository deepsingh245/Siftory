import type { SavedItem } from '../../domain/library'
import type { LibraryData } from '../library/useLibraryData'

export const activityRanges = [7, 30, 90] as const
export type ActivityRange = (typeof activityRanges)[number]
export type ActivityDay = { date: string; label: string; items: number }

const dayMs = 86_400_000
const shortDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function dayNumber(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / dayMs
}

export function libraryActivity(items: readonly SavedItem[], range: ActivityRange, now = new Date()): ActivityDay[] {
  const today = dayNumber(now)
  const first = today - range + 1
  const counts = new Map<number, number>()
  for (const { createdAt } of items) {
    const day = dayNumber(new Date(createdAt))
    if (day >= first && day <= today) counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return Array.from({ length: range }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - range + 1 + index)
    const dateKey = new Date((first + index) * dayMs).toISOString().slice(0, 10)
    return { date: dateKey, label: shortDay.format(date), items: counts.get(first + index) ?? 0 }
  })
}

export function dashboardSnapshot({ items, jobs, analysisJobs }: Pick<LibraryData, 'items' | 'jobs' | 'analysisJobs'>) {
  const ids = new Set(items.map(({ id }) => id))
  const attention = new Set<string>()
  let activeJobs = 0
  for (const queue of [jobs, analysisJobs]) {
    for (const { savedItemId, status } of queue) {
      if (!ids.has(savedItemId)) continue
      if (status === 'failed' || status === 'needs-attention') attention.add(savedItemId)
      if (status === 'queued' || status === 'extracting' || status === 'analyzing') activeJobs += 1
    }
  }
  const recent = items.toSorted((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 6)
  return {
    itemCount: items.length,
    inboxCount: items.filter(({ status }) => status === 'inbox').length,
    transcriptCount: items.filter(({ transcriptId }) => Boolean(transcriptId)).length,
    attentionCount: attention.size,
    activeJobs,
    recent,
  }
}
