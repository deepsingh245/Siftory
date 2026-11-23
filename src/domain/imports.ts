import { createSavedItem, normalizeHttpUrl } from './library.ts'
import type { ContentType, ItemDraft, SavedItem, SourceFileRecord, SourceType } from './library.ts'
import { identifyYouTubeUrl } from './youtube.ts'

export const MAX_SOURCE_FILE_BYTES = 20 * 1024 * 1024
export const MAX_IMPORT_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_IMPORT_TOTAL_BYTES = 50 * 1024 * 1024
export const MAX_IMPORT_ROWS = 1000
export const MAX_INSTAGRAM_IMPORT_ROWS = 5000
export const MAX_CONFIRMED_ROWS = 100
export const MAX_IMPORTED_TITLE_CHARS = 300
export const MAX_IMPORTED_DESCRIPTION_CHARS = 20_000
export const MAX_IMPORTED_URL_CHARS = 4096

export type ImportKind = 'instagram' | 'bookmarks' | 'url' | 'file'

export type ImportRow = {
  id: string
  draft?: ItemDraft
  sourceMetadata?: Record<string, unknown>
  sourceRecordId?: string
  importRecordKey?: string
  sourceFingerprint?: string
  sourceBlob?: Blob
  sourceFileName?: string
  sourceMediaType?: string
  sourceSize?: number
  warnings: string[]
  errors: string[]
  duplicateOf?: { id: string; title: string; kind: 'exact' | 'possible' }
  selected: boolean
}

export type ImportParseResult = { rows: ImportRow[]; errors: string[] }

const emptyDraft = (sourceType: SourceType, contentType: ContentType): ItemDraft => ({
  title: '', sourceType, contentType,
})

function recordId(prefix: string, index = 0): string {
  return `${prefix}-${index}-${crypto.randomUUID()}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectKeyValues(value: unknown, wanted: Set<string>, depth = 0): unknown[] {
  if (depth > 10 || value === null || typeof value !== 'object') return []
  const found: unknown[] = []
  if (Array.isArray(value)) {
    for (const entry of value) found.push(...collectKeyValues(entry, wanted, depth + 1))
    return found
  }
  for (const [key, entry] of Object.entries(value)) {
    if (wanted.has(key.toLowerCase()) && entry !== null && entry !== undefined) found.push(entry)
    found.push(...collectKeyValues(entry, wanted, depth + 1))
  }
  return found
}

function firstString(value: unknown, keys: string[]): string | undefined {
  for (const candidate of collectKeyValues(value, new Set(keys.map((key) => key.toLowerCase())))) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    if (isRecord(candidate)) {
      const nested = candidate.value ?? candidate.text ?? candidate.uri ?? candidate.url
      if (typeof nested === 'string' && nested.trim()) return nested.trim()
    }
  }
}

function firstIdentifier(value: unknown, keys: string[]): string | undefined {
  for (const key of keys) {
    for (const candidate of collectKeyValues(value, new Set([key]))) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
      if (typeof candidate === 'number' && Number.isSafeInteger(candidate)) return String(candidate)
    }
  }
}

function parseSavedDate(value: unknown): string | undefined {
  let date: Date
  if (typeof value === 'number' && Number.isFinite(value)) {
    date = new Date(value < 100_000_000_000 ? value * 1000 : value)
  } else if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    date = Number.isFinite(numeric) && value.trim() !== ''
      ? new Date(numeric < 100_000_000_000 ? numeric * 1000 : numeric)
      : new Date(value)
  } else {
    return undefined
  }
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function getUrl(value: unknown): { url?: string; error?: string } {
  let firstError: string | undefined
  for (const key of ['url', 'href', 'link', 'uri']) {
    const values = collectKeyValues(value, new Set([key]))
    for (const candidate of values) {
      if (typeof candidate !== 'string' || !candidate.trim()) continue
      if (candidate.length > MAX_IMPORTED_URL_CHARS) {
        firstError ??= `A source URL exceeds the ${MAX_IMPORTED_URL_CHARS}-character limit.`
        continue
      }
      try {
        const url = normalizeHttpUrl(candidate)
        if (url) return { url }
      } catch (cause) {
        firstError ??= cause instanceof Error ? cause.message : 'The source URL is invalid.'
      }
    }
  }
  return { error: firstError }
}

function hasLikelyMojibake(text: string): boolean {
  return /(?:Ã.|Â.|â€|â€™|â€œ|ðŸ|ï¿½)/u.test(text)
}

function instagramContentType(value: unknown): ContentType {
  const explicit = firstString(value, ['content_type', 'media_type', 'post_type', 'type'])?.toLowerCase()
  if (explicit === 'video' || explicit === 'reel' || explicit === 'short') return explicit === 'reel' ? 'short' : explicit
  if (explicit === 'image' || explicit === 'photo') return 'image'
  if (explicit === 'post' || explicit === 'carousel_album' || explicit === 'carousel') return 'post'
  return 'unknown'
}

function createRow(
  prefix: string,
  index: number,
  draft: ItemDraft | undefined,
  options: Partial<Pick<ImportRow, 'sourceMetadata' | 'sourceRecordId' | 'sourceFingerprint' | 'sourceBlob' | 'sourceFileName' | 'sourceMediaType' | 'sourceSize'>> = {},
  warnings: string[] = [],
  errors: string[] = [],
): ImportRow {
  return {
    id: recordId(prefix, index), draft, ...options,
    warnings, errors, selected: Boolean(draft && errors.length === 0),
  }
}

export function parseInstagramJson(text: string): ImportParseResult {
  let payload: unknown
  try {
    payload = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown
  } catch {
    return { rows: [], errors: ['This file is not valid JSON. Check the export file and try again.'] }
  }
  if (!Array.isArray(payload)) {
    return { rows: [], errors: ['Expected an Instagram export containing a top-level array of saved records.'] }
  }
  if (payload.length > MAX_INSTAGRAM_IMPORT_ROWS) {
    return { rows: [], errors: [`This export contains more than ${MAX_INSTAGRAM_IMPORT_ROWS.toLocaleString()} records. Split it into smaller JSON arrays and try again.`] }
  }

  const rows = payload.map((entry: unknown, index: number) => {
    if (!isRecord(entry)) return createRow('instagram', index, undefined, {}, [], ['This row is not a JSON object.'])

    const urlResult = getUrl(entry)
    const rawCaption = firstString(entry, ['caption', 'description', 'text'])
    const rawTitle = firstString(entry, ['title', 'name']) || (rawCaption ? rawCaption.slice(0, 120) : '')
    const caption = rawCaption?.slice(0, MAX_IMPORTED_DESCRIPTION_CHARS)
    const title = rawTitle.slice(0, MAX_IMPORTED_TITLE_CHARS)
    const rawCreatorName = firstString(entry, ['owner_name', 'owner', 'creator_name', 'full_name'])
    const rawCreatorHandle = firstString(entry, ['username', 'owner_username', 'creator_username', 'handle'])
    const creatorName = rawCreatorName?.slice(0, MAX_IMPORTED_TITLE_CHARS)
    const creatorHandle = rawCreatorHandle?.slice(0, MAX_IMPORTED_TITLE_CHARS)
    const sourceRecordId = firstIdentifier(entry, ['media_id', 'shortcode', 'pk', 'id'])
    const savedAt = parseSavedDate(entry.timestamp ?? firstString(entry, ['timestamp', 'saved_at', 'date_saved']))
    const warnings: string[] = []
    const errors: string[] = []

    if (urlResult.error) errors.push(urlResult.error)
    if (!title && !urlResult.url) errors.push('No title, caption, or valid web URL was found.')
    if (caption && hasLikelyMojibake(caption)) warnings.push('This caption may contain encoding artifacts. The original is retained in source metadata; you can correct the editable description before saving.')
    if (rawTitle.length > MAX_IMPORTED_TITLE_CHARS) warnings.push(`The title preview is limited to ${MAX_IMPORTED_TITLE_CHARS} characters; the original remains in source metadata.`)
    if (rawCaption && rawCaption.length > MAX_IMPORTED_DESCRIPTION_CHARS) warnings.push(`The description preview is limited to ${MAX_IMPORTED_DESCRIPTION_CHARS} characters; the original remains in source metadata.`)
    if ((rawCreatorName?.length ?? 0) > MAX_IMPORTED_TITLE_CHARS || (rawCreatorHandle?.length ?? 0) > MAX_IMPORTED_TITLE_CHARS) warnings.push(`Creator fields are limited to ${MAX_IMPORTED_TITLE_CHARS} characters; original values remain in source metadata.`)
    if (entry.media === undefined || entry.media === null) warnings.push('The export has no media field; content type remains unknown.')
    else if (Array.isArray(entry.media) && entry.media.length === 0) warnings.push('The export media list is empty; this does not establish whether media exists.')

    const draft = errors.length ? undefined : {
      ...emptyDraft('instagram', instagramContentType(entry)),
      title,
      url: urlResult.url,
      description: caption,
      creatorName,
      creatorHandle,
      savedAt,
    }
    return createRow('instagram', index, draft, { sourceMetadata: entry, sourceRecordId }, warnings, errors)
  })
  return { rows, errors: [] }
}

function directChild(element: Element, tagName: string): Element | undefined {
  return Array.from(element.children).find((child) => child.tagName === tagName)
}

function directOrParagraphChild(element: Element, tagName: string): Element | undefined {
  const paragraph = directChild(element, 'P')
  return directChild(element, tagName) ?? (paragraph ? directChild(paragraph, tagName) : undefined)
}

export function parseBookmarksHtml(text: string): ImportParseResult {
  const template = document.createElement('template')
  template.innerHTML = text
  const roots = Array.from(template.content.querySelectorAll('dl'))
  const root = roots.find((node) => !node.parentElement?.closest('dl'))
  if (!root) return { rows: [], errors: ['No Netscape bookmark list was found in this HTML file.'] }

  const entries: { anchor: Element; folders: string[]; index: number }[] = []
  let nestingLimitReached = false
  function visit(list: Element, folders: string[], depth = 0) {
    if (depth > 100) {
      nestingLimitReached = true
      return
    }
    for (const child of Array.from(list.children)) {
      if (child.tagName !== 'DT') {
        if (child.children.length) visit(child, folders, depth + 1)
        continue
      }
      const heading = directOrParagraphChild(child, 'H3')
      const anchor = directOrParagraphChild(child, 'A')
      const nested = directOrParagraphChild(child, 'DL')
      if (anchor) entries.push({ anchor, folders, index: entries.length })
      if (heading && nested) {
        const folder = heading.textContent?.trim()
        visit(nested, folder ? [...folders, folder] : folders, depth + 1)
      } else if (nested) {
        visit(nested, folders, depth + 1)
      }
    }
  }
  visit(root, [])
  if (entries.length > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [`This export contains more than ${MAX_IMPORT_ROWS} bookmarks. Split it into smaller files and try again.`] }
  }

  const rows = entries.map(({ anchor, folders, index }) => {
    const href = anchor.getAttribute('href') ?? ''
    let url: string | undefined
    const errors: string[] = []
    try {
      if (href.length > MAX_IMPORTED_URL_CHARS) throw new Error(`This bookmark URL exceeds the ${MAX_IMPORTED_URL_CHARS}-character limit.`)
      url = normalizeHttpUrl(href)
      if (!url) errors.push('This bookmark has no URL.')
    } catch (cause) {
      errors.push(cause instanceof Error ? cause.message : 'This bookmark URL is invalid.')
    }
    const rawTitle = anchor.textContent?.trim() ?? ''
    const title = rawTitle.slice(0, MAX_IMPORTED_TITLE_CHARS)
    if (!title && !url) errors.push('This bookmark has no title or valid web URL.')
    const rawDate = anchor.getAttribute('add_date')
    const savedAt = rawDate ? parseSavedDate(rawDate) : undefined
    const metadata = {
      href,
      addDate: rawDate ?? undefined,
      icon: anchor.getAttribute('icon') ?? undefined,
      folderPath: folders,
    }
    const warnings = rawTitle.length > MAX_IMPORTED_TITLE_CHARS
      ? [`The title preview is limited to ${MAX_IMPORTED_TITLE_CHARS} characters; the original remains in source metadata.`]
      : []
    const draft = errors.length ? undefined : {
      ...emptyDraft('bookmark', 'bookmark'), title, url, savedAt,
      description: folders.length ? `Bookmark folder: ${folders.join(' / ')}`.slice(0, MAX_IMPORTED_DESCRIPTION_CHARS) : undefined,
    }
    return createRow('bookmark', index, draft, { sourceMetadata: metadata }, warnings, errors)
  })
  if (!rows.length) return { rows: [], errors: ['No bookmark links were found in this HTML file.'] }
  return { rows, errors: nestingLimitReached ? ['Some bookmarks were nested beyond the 100-level limit and were not included.'] : [] }
}

export function parseManualUrl(urlInput: string, titleInput = ''): ImportParseResult {
  try {
    if (urlInput.length > MAX_IMPORTED_URL_CHARS) {
      return { rows: [], errors: [`The URL exceeds the ${MAX_IMPORTED_URL_CHARS}-character limit.`] }
    }
    const url = normalizeHttpUrl(urlInput)
    if (!url) return { rows: [], errors: ['Enter a web URL to continue.'] }
    const youtube = identifyYouTubeUrl(url)
    return {
      rows: [createRow('url', 0, { ...emptyDraft(youtube ? 'youtube' : 'website', youtube ? youtube.contentType : 'unknown'), url, title: titleInput.trim().slice(0, MAX_IMPORTED_TITLE_CHARS) }, youtube ? { sourceMetadata: { youtubeVideoId: youtube.videoId } } : {})],
      errors: [],
    }
  } catch (cause) {
    return { rows: [], errors: [cause instanceof Error ? cause.message : 'Enter a valid HTTP or HTTPS URL.'] }
  }
}

export async function parseSourceFile(file: File): Promise<ImportParseResult> {
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    return { rows: [], errors: [`${file.name} exceeds the ${formatBytes(MAX_SOURCE_FILE_BYTES)} per-file limit.`] }
  }
  const extension = file.name.toLowerCase().split('.').pop()
  const isPdf = extension === 'pdf' && (!file.type || file.type.startsWith('application/pdf') || file.type === 'application/octet-stream')
  const isText = extension === 'txt' && (!file.type || file.type.startsWith('text/plain') || file.type === 'application/octet-stream')
  if (!isPdf && !isText) {
    return { rows: [], errors: [`${file.name} is not a supported PDF or plain-text file (.pdf or .txt).`] }
  }
  if (file.size === 0) return { rows: [], errors: [`${file.name} is empty.`] }

  const blob = file.slice(0, file.size, isPdf ? 'application/pdf' : 'text/plain')
  const sha256 = await fingerprintBlob(blob)
  const mediaType = isPdf ? 'application/pdf' : 'text/plain'
  const draft: ItemDraft = {
    ...emptyDraft(isPdf ? 'pdf' : 'text', isPdf ? 'pdf' : 'text'),
    title: file.name.replace(/\.(pdf|txt)$/i, '').slice(0, MAX_IMPORTED_TITLE_CHARS),
  }
  return {
    rows: [createRow('file', 0, draft, {
      sourceMetadata: { fileName: file.name, mediaType, size: file.size },
      sourceFingerprint: sha256,
      sourceBlob: blob,
      sourceFileName: file.name,
      sourceMediaType: mediaType,
      sourceSize: file.size,
    })],
    errors: [],
  }
}

export async function fingerprintBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function toImportedItems(rows: ImportRow[]): { items: SavedItem[]; files: SourceFileRecord[] } {
  const now = new Date()
  const items: SavedItem[] = []
  const files: SourceFileRecord[] = []
  for (const row of rows) {
    if (!row.selected || !row.draft || row.errors.length) continue
    const item = createSavedItem(row.draft, now)
    item.sourceMetadata = row.sourceMetadata
    item.sourceRecordId = row.sourceRecordId
    item.importRecordKey = row.importRecordKey
    item.sourceFingerprint = row.sourceFingerprint
    if (row.sourceBlob && row.sourceFileName && row.sourceMediaType && row.sourceFingerprint) {
      item.sourceFileId = item.id
      files.push({
        savedItemId: item.id,
        fileName: row.sourceFileName,
        mediaType: row.sourceMediaType,
        size: row.sourceSize ?? row.sourceBlob.size,
        blob: row.sourceBlob,
        sha256: row.sourceFingerprint,
        createdAt: now.toISOString(),
      })
    }
    items.push(item)
  }
  return { items, files }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) ? 1 : 0)} MB`
}
