export const sourceTypes = [
  'website',
  'youtube',
  'instagram',
  'reddit',
  'x',
  'tiktok',
  'pinterest',
  'bookmark',
  'pdf',
  'document',
  'image',
  'text',
  'other',
] as const

export type SourceType = (typeof sourceTypes)[number]

export const contentTypes = [
  'unknown',
  'video',
  'short',
  'post',
  'article',
  'bookmark',
  'pdf',
  'document',
  'image',
  'text',
] as const

export type ContentType = (typeof contentTypes)[number]
export type ItemStatus = 'inbox' | 'saved' | 'archived'

export type SavedItem = {
  id: string
  title: string
  url?: string
  canonicalUrl?: string
  sourceType: SourceType
  contentType: ContentType
  creatorName?: string
  creatorHandle?: string
  description?: string
  userNotes?: string
  savedAt?: string
  createdAt: string
  updatedAt: string
  lastViewedAt?: string
  status: ItemStatus
  collectionIds: string[]
  categoryIds: string[]
  tagIds: string[]
}

export type Collection = {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export type Category = {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export type Tag = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type ItemDraft = Pick<SavedItem, 'title' | 'sourceType' | 'contentType'> &
  Partial<Pick<SavedItem, 'url' | 'creatorName' | 'creatorHandle' | 'description' | 'userNotes' | 'savedAt'>>

export type SortOrder = 'recent' | 'oldest' | 'title' | 'updated'

export type ItemFilters = {
  query?: string
  status?: ItemStatus
  sourceType?: SourceType | ''
  contentType?: ContentType | ''
  collectionId?: string
  categoryId?: string
  tagId?: string
  fromDate?: string
  toDate?: string
  sort?: SortOrder
}

export function normalizeHttpUrl(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Enter a complete URL beginning with http:// or https://.')
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http:// and https:// links can be saved.')
  }

  if (url.username || url.password) {
    throw new Error('Remove the username and password from this link before saving it.')
  }

  return url.href
}

export function canonicalizeUrl(value?: string): string | undefined {
  if (!value) return undefined
  const canonical = new URL(value)
  canonical.hash = ''
  return canonical.href
}

export function createSavedItem(draft: ItemDraft, now = new Date(), id = crypto.randomUUID()): SavedItem {
  const timestamp = now.toISOString()
  const normalized = normalizeDraft(draft)
  return {
    id,
    ...normalized,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'inbox',
    collectionIds: [],
    categoryIds: [],
    tagIds: [],
  }
}

export function updateSavedItem(item: SavedItem, draft: ItemDraft, now = new Date()): SavedItem {
  return {
    ...item,
    ...normalizeDraft(draft),
    updatedAt: now.toISOString(),
  }
}

function normalizeDraft(draft: ItemDraft): Pick<SavedItem,
  'title' | 'sourceType' | 'contentType' | 'url' | 'canonicalUrl' | 'creatorName' | 'creatorHandle' | 'description' | 'userNotes' | 'savedAt'
> {
  const title = draft.title.trim()
  const url = normalizeHttpUrl(draft.url ?? '')
  if (!title && !url) throw new Error('Add a title or a link to save this item.')

  return {
    title,
    url,
    canonicalUrl: canonicalizeUrl(url),
    sourceType: draft.sourceType,
    contentType: draft.contentType,
    creatorName: draft.creatorName?.trim() || undefined,
    creatorHandle: draft.creatorHandle?.trim() || undefined,
    description: draft.description?.trim() || undefined,
    userNotes: draft.userNotes?.trim() || undefined,
    savedAt: draft.savedAt || undefined,
  }
}

export function displayTitle(item: SavedItem): string {
  if (item.title.trim()) return item.title.trim()
  if (item.url) {
    try {
      return new URL(item.url).hostname.replace(/^www\./, '')
    } catch {
      return item.url
    }
  }
  return 'Untitled item'
}

function matchesQuery(item: SavedItem, query: string): boolean {
  if (!query) return true
  const haystack = [
    item.title,
    item.url,
    item.creatorName,
    item.creatorHandle,
    item.description,
    item.userNotes,
  ].join(' ').toLocaleLowerCase()
  return haystack.includes(query)
}

export function filterAndSortItems(items: SavedItem[], filters: ItemFilters = {}): SavedItem[] {
  const query = filters.query?.trim().toLocaleLowerCase() ?? ''
  const filtered = items.filter((item) => {
    if (filters.status && item.status !== filters.status) return false
    if (filters.sourceType && item.sourceType !== filters.sourceType) return false
    if (filters.contentType && item.contentType !== filters.contentType) return false
    if (filters.collectionId && !item.collectionIds.includes(filters.collectionId)) return false
    if (filters.categoryId && !item.categoryIds.includes(filters.categoryId)) return false
    if (filters.tagId && !item.tagIds.includes(filters.tagId)) return false
    if (!matchesQuery(item, query)) return false

    const date = (item.savedAt ?? item.createdAt).slice(0, 10)
    if (filters.fromDate && date < filters.fromDate) return false
    if (filters.toDate && date > filters.toDate) return false
    return true
  })

  switch (filters.sort ?? 'recent') {
    case 'oldest':
      return filtered.sort((a, b) => (a.savedAt ?? a.createdAt).localeCompare(b.savedAt ?? b.createdAt))
    case 'title':
      return filtered.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)))
    case 'updated':
      return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    default:
      return filtered.sort((a, b) => (b.savedAt ?? b.createdAt).localeCompare(a.savedAt ?? a.createdAt))
  }
}
