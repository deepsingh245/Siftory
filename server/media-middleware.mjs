import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultRoot = fileURLToPath(new URL('../.siftory/media/', import.meta.url))
const sourceKey = /^instagram-(p|reel|tv)-([A-Za-z0-9_-]{5,32})$/u
const pageSize = 20
const maxSubtitleBytes = 512_000
const maxAudioBytes = 350 * 1024 * 1024

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(value))
}

function localOrigin(request, scheme) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) return undefined
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/iu.test(request.headers.host ?? '')) return undefined
  return `${scheme}://${request.headers.host}`
}

async function regularFile(path, maxBytes) {
  try {
    const info = await lstat(path)
    return info.isFile() && info.size > 0 && info.size <= maxBytes ? info : undefined
  } catch {
    return undefined
  }
}

async function modelBySource(root) {
  const models = new Map()
  const files = (await readdir(root)).filter((name) => /^run-\d{8}T\d+Z\.json$/u.test(name)).sort().reverse().slice(0, 100)
  for (const file of files) {
    try {
      const path = join(root, file)
      if (!await regularFile(path, 1_000_000)) continue
      const run = JSON.parse(await readFile(path, 'utf8'))
      if (!['tiny', 'base', 'small'].includes(run.transcriptionModel) || !Array.isArray(run.results)) continue
      for (const result of run.results) {
        if (result?.status === 'completed' && sourceKey.test(result.key) && !models.has(result.key)) models.set(result.key, run.transcriptionModel)
      }
    } catch { /* A damaged local manifest must not expose files or block other results. */ }
  }
  return models
}

export function createMediaMiddleware(scheme = 'http', root = defaultRoot) {
  return (request, response, next) => {
    const origin = localOrigin(request, scheme)
    const pathname = request.url?.split('?', 1)[0]
    if (!pathname?.startsWith('/api/media/')) return next()
    const nativeAudio = pathname === '/api/media/audio' && request.headers['sec-fetch-site'] === 'same-origin' &&
      request.headers['sec-fetch-dest'] === 'audio'
    if (!origin || request.method !== 'GET' || (request.headers['x-siftory-request'] !== '1' && !nativeAudio) ||
      (request.headers.origin && request.headers.origin !== origin) ||
      (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin')) {
      return sendJson(response, 403, { error: 'Local media is available only from Siftory on this device.' })
    }

    async function handle() {
      const url = new URL(request.url, origin)
      if (pathname === '/api/media/transcripts') {
        let names
        try { names = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory() && sourceKey.test(entry.name)).map((entry) => entry.name).sort() }
        catch (error) {
          if (error?.code === 'ENOENT') return sendJson(response, 200, { entries: [], nextCursor: null })
          throw error
        }
        const after = url.searchParams.get('after')
        if (after && !sourceKey.test(after)) return sendJson(response, 400, { error: 'Invalid media cursor.' })
        const start = after ? names.findIndex((name) => name > after) : 0
        if (start < 0) return sendJson(response, 200, { entries: [], nextCursor: null })
        const page = names.slice(start, start + pageSize)
        const models = await modelBySource(root)
        const entries = []
        for (const key of page) {
          const folder = join(root, key)
          const info = await lstat(folder)
          if (!info.isDirectory() || !await regularFile(join(folder, 'audio.wav'), maxAudioBytes) || !await regularFile(join(folder, 'transcript.srt'), maxSubtitleBytes)) continue
          const text = await readFile(join(folder, 'transcript.srt'), 'utf8')
          if (text.length > 100_000) continue
          const [, kind, code] = key.match(sourceKey)
          entries.push({ key, url: `https://www.instagram.com/${kind}/${code}/`, text, sourceFingerprint: createHash('sha256').update(text).digest('hex'), model: models.get(key) ?? null })
        }
        return sendJson(response, 200, { entries, nextCursor: start + pageSize < names.length ? page.at(-1) : null })
      }
      if (pathname === '/api/media/audio') {
        const key = url.searchParams.get('key')
        if (!key || !sourceKey.test(key)) return sendJson(response, 400, { error: 'Invalid media key.' })
        const folder = join(root, key)
        let directory
        try { directory = await lstat(folder) } catch { /* The local result may have been moved. */ }
        if (!directory?.isDirectory()) return sendJson(response, 404, { error: 'Local audio is unavailable.' })
        const path = join(folder, 'audio.wav')
        const info = await regularFile(path, maxAudioBytes)
        if (!info) return sendJson(response, 404, { error: 'Local audio is unavailable.' })
        const headers = {
          'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin',
        }
        if (request.headers.range) {
          const range = /^bytes=(\d+)-(\d*)$/u.exec(request.headers.range)
          const start = Number(range?.[1])
          const end = range?.[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1
          if (!range || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= info.size || end < start) {
            response.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` })
            return response.end()
          }
          response.writeHead(206, { ...headers, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${info.size}` })
          const stream = createReadStream(path, { start, end })
          stream.on('error', () => response.destroy())
          response.once('close', () => stream.destroy())
          return stream.pipe(response)
        }
        response.writeHead(200, { ...headers, 'Content-Length': String(info.size) })
        const stream = createReadStream(path)
        stream.on('error', () => response.destroy())
        response.once('close', () => stream.destroy())
        stream.pipe(response)
        return
      }
      return sendJson(response, 404, { error: 'Unknown local media action.' })
    }
    void handle().catch(() => {
      if (!response.headersSent) sendJson(response, 500, { error: 'Local media could not be read.' })
      else response.destroy()
    })
  }
}
