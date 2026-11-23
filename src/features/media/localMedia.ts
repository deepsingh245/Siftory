import type { SavedItem } from '../../domain/library'
import { createTranscriptContent, parseTranscript } from '../../domain/transcripts'
import { createLibraryRepository } from '../../infrastructure/persistence/libraryRepository'

type LocalTranscript = { key: string; url: string; text: string; sourceFingerprint: string; model: string | null }
type LocalPage = { entries: LocalTranscript[]; nextCursor: string | null }
const sourceKey = /^instagram-(p|reel|tv)-([A-Za-z0-9_-]{5,32})$/u

function keyForItem(item: SavedItem): string | undefined {
  if (item.sourceType !== 'instagram') return undefined
  try {
    const url = new URL(item.canonicalUrl ?? item.url ?? '')
    const path = url.pathname.replace(/^\/+|\/+$/gu, '').split('/')
    if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname) || path.length !== 2) return undefined
    const key = `instagram-${path[0]}-${path[1]}`
    return sourceKey.test(key) ? key : undefined
  } catch { return undefined }
}

async function pageAfter(after?: string): Promise<LocalPage> {
  const response = await fetch(`/api/media/transcripts${after ? `?after=${encodeURIComponent(after)}` : ''}`, { headers: { 'X-Siftory-Request': '1' }, credentials: 'same-origin' })
  if (!response.ok) throw new Error('The local media worker is unavailable.')
  const page = await response.json() as LocalPage
  if (!Array.isArray(page.entries) || (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !sourceKey.test(page.nextCursor)))) throw new Error('The local media index is invalid.')
  return page
}

export async function syncLocalMediaTranscripts(repository: ReturnType<typeof createLibraryRepository>): Promise<number> {
  const items = await repository.getItems()
  const candidates = new Map<string, SavedItem[]>()
  for (const item of items) {
    if (item.transcriptId || item.autoTranscriptDismissed) continue
    const key = keyForItem(item)
    if (key) candidates.set(key, [...(candidates.get(key) ?? []), item])
  }
  if (!candidates.size) return 0

  let attached = 0
  let cursor: string | undefined
  for (let pageCount = 0; pageCount < 25; pageCount += 1) {
    const page = await pageAfter(cursor)
    for (const entry of page.entries) {
      const matches = candidates.get(entry.key)
      if (matches?.length !== 1 || !sourceKey.test(entry.key) || typeof entry.text !== 'string' || typeof entry.sourceFingerprint !== 'string' || !/^[a-f0-9]{64}$/u.test(entry.sourceFingerprint)) continue
      const item = matches[0]
      try {
        const parsed = parseTranscript(entry.text, 'srt')
        const record = await createTranscriptContent(item.id, parsed, 'local-asr', {
          fileName: 'transcript.srt', mediaType: 'application/x-subrip', sourceFingerprint: entry.sourceFingerprint,
          sourceBlob: new Blob([entry.text], { type: 'application/x-subrip' }),
          asrModel: ['tiny', 'base', 'small'].includes(entry.model ?? '') ? entry.model! : undefined,
          audioSourceKey: entry.key,
        })
        if (await repository.attachGeneratedTranscriptIfMissing(record)) attached += 1
      } catch { /* An invalid generated transcript must not change the saved item. */ }
    }
    if (!page.nextCursor || page.nextCursor === cursor) break
    cursor = page.nextCursor
  }
  return attached
}

export async function downloadLocalAudio(key: string): Promise<void> {
  if (!sourceKey.test(key)) throw new Error('The local audio source is invalid.')
  const response = await fetch(`/api/media/audio?key=${encodeURIComponent(key)}`, { headers: { 'X-Siftory-Request': '1' }, credentials: 'same-origin' })
  if (!response.ok) throw new Error('The local audio is unavailable. Run the local media worker again if its files were moved.')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${key}.wav`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function localAudioUrl(key: string): string | undefined {
  if (sourceKey.test(key)) return `/api/media/audio?key=${encodeURIComponent(key)}`
}
