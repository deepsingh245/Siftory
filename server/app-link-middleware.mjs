import { appLookupNamePattern, appleAppIdPattern, maxAppLookupTargets, playPackagePattern } from '../src/domain/appLinks.ts'

const apple = 'https://itunes.apple.com'
const google = 'https://play.google.com'
const playTitle = /<title(?:\s[^>]{1,100})?>\s*([^<]{1,240}?)\s+[-–—]\s+Apps on Google Play\s*<\/title>/iu

function normalizeName(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function closeName(left, right) {
  if (left === right) return true
  if (left.length < 5 || Math.abs(left.length - right.length) > 1) return false
  if (left.length === right.length) return Array.from(left).filter((character, index) => character !== right[index]).length === 1
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left]
  const firstDifference = Array.from(shorter).findIndex((character, index) => character !== longer[index])
  const position = firstDifference < 0 ? longer.length - 1 : firstDifference
  return shorter === longer.slice(0, position) + longer.slice(position + 1)
}

function matchesTitle(title, term) {
  const searched = normalizeName(term)
  const cleanTitle = normalizeName(title)
  if (!searched) return false
  const words = title.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const prefix = words.slice(0, term.split(/\s+/u).length).join(' ')
  return cleanTitle === searched || closeName(searched, normalizeName(prefix))
}

async function readLimited(response, maxBytes, stopWhen) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty response')
  const decode = new TextDecoder()
  let size = 0
  let text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return text + decode.decode()
      size += value.byteLength
      if (size > maxBytes) throw new Error('Response too large')
      const chunk = decode.decode(value, { stream: true })
      const doneReading = stopWhen?.(text.slice(-512) + chunk)
      text += chunk
      if (doneReading) return text
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

async function searchStore(target, country, fetchStore) {
  const options = { redirect: 'error', signal: AbortSignal.timeout(6000) }
  if (target.kind === 'google') {
    const url = new URL('/store/apps/details', google)
    url.searchParams.set('id', target.value)
    url.searchParams.set('hl', 'en')
    url.searchParams.set('gl', country)
    const response = await fetchStore(url, options)
    if (response.status === 404 || response.status === 410) return []
    if (!response.ok) throw new Error('Store unavailable')
    const page = await readLimited(response, 1_500_000, (text) => playTitle.test(text))
    const title = playTitle.exec(page)?.[1]
    if (!title) return []
    return [{ store: 'google', url: `${google}/store/apps/details?id=${encodeURIComponent(target.value)}`, title: title.replaceAll('&amp;', '&') }]
  }

  const isName = target.kind === 'name'
  const url = new URL(isName ? '/search' : '/lookup', apple)
  const query = isName ? { term: target.value, entity: 'software', limit: '10' } : { id: target.value, entity: 'software' }
  url.search = new URLSearchParams({ ...query, country }).toString()
  const response = await fetchStore(url, options)
  if (!response.ok) throw new Error('Store unavailable')
  const json = JSON.parse(await readLimited(response, 1_000_000))
  if (!Array.isArray(json.results)) throw new Error('Store returned invalid data')
  const listings = new Map()
  for (const listing of json.results) {
    const id = String(listing?.trackId)
    if (listing?.kind !== 'software' || !appleAppIdPattern.test(id) || typeof listing.trackName !== 'string') continue
    if (isName ? !matchesTitle(listing.trackName, target.value) : id !== target.value) continue
    listings.set(id, {
      store: 'apple', url: `https://apps.apple.com/${country.toLowerCase()}/app/id${id}`,
      title: listing.trackName.slice(0, 120),
      publisher: typeof listing.sellerName === 'string' ? listing.sellerName.slice(0, 120) : undefined,
    })
    if (listings.size >= 4) break
  }
  return [...listings.values()]
}

function validTarget(target) {
  if (typeof target?.value !== 'string') return false
  if (target.kind === 'name') return appLookupNamePattern.test(target.value)
  if (target.kind === 'apple') return appleAppIdPattern.test(target.value)
  return target.kind === 'google' && target.value.length <= 150 && playPackagePattern.test(target.value)
}

function respond(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(body))
}

export function createAppLinkMiddleware(scheme = 'http', fetchStore = fetch) {
  let running = false
  return (request, response, next) => {
    if (request.url?.split('?', 1)[0] !== '/api/app-links/lookup') return next()
    const host = request.headers.host ?? ''
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress) ||
        !/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/iu.test(host) ||
        request.headers.origin !== `${scheme}://${host}` || request.headers['x-siftory-request'] !== '1' ||
        (request.headers['sec-fetch-site'] && request.headers['sec-fetch-site'] !== 'same-origin')) {
      return respond(response, 403, { error: 'App lookup is available from the local Siftory app.' })
    }
    if (request.method !== 'POST' || request.headers['content-type']?.split(';', 1)[0] !== 'application/json') {
      return respond(response, 400, { error: 'Use the app lookup controls.' })
    }
    if (running) return respond(response, 429, { error: 'Another app lookup is running. Try again when it finishes.' })
    async function handle() {
      running = true
      const chunks = []
      let length = 0
      try {
        for await (const chunk of request.iterator({ destroyOnReturn: false })) {
          length += chunk.length
          if (length > 4096) {
            request.resume()
            return respond(response, 413, { error: 'App lookup request is too large.' })
          }
          chunks.push(chunk)
        }
        let input
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
        catch { return respond(response, 400, { error: 'App lookup request could not be read.' }) }
        if (input?.consent !== true || !Array.isArray(input.targets) || !input.targets.length ||
            input.targets.length > maxAppLookupTargets || !input.targets.every(validTarget)) {
          return respond(response, 400, { error: 'Review and confirm valid app names or store IDs.' })
        }
        const country = typeof input.country === 'string' && /^[a-z]{2}$/iu.test(input.country) ? input.country.toUpperCase() : 'US'
        const results = await Promise.all(input.targets.map(async ({ kind, value }) => {
          const target = { kind, value }
          try {
            const listings = await searchStore(target, country, fetchStore)
            return { target, listings, state: listings.length ? 'found' : 'unconfirmed' }
          } catch {
            return { target, listings: [], state: 'unavailable' }
          }
        }))
        return respond(response, 200, { results })
      } finally {
        running = false
      }
    }
    void handle().catch(() => respond(response, 500, { error: 'App lookup could not be completed.' }))
  }
}
