import { normalizeHttpUrl } from './library'

export type YouTubeReference = { videoId: string; contentType: 'video' | 'short' }

export function identifyYouTubeUrl(value: string): YouTubeReference | undefined {
  let url: URL
  try {
    const normalized = normalizeHttpUrl(value)
    if (!normalized) return undefined
    url = new URL(normalized)
  } catch { return undefined }
  const host = url.hostname.toLocaleLowerCase().replace(/^www\./u, '').replace(/^m\./u, '')
  let videoId: string | undefined
  let contentType: YouTubeReference['contentType'] = 'video'
  if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0]
  else if (host === 'youtube.com') {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v') ?? undefined
    else {
      const match = url.pathname.match(/^\/(shorts|live)\/([A-Za-z0-9_-]{11})(?:\/|$)/u)
      if (match) { videoId = match[2]; contentType = match[1] === 'shorts' ? 'short' : 'video' }
    }
  }
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/u.test(videoId)) return undefined
  return { videoId, contentType }
}
