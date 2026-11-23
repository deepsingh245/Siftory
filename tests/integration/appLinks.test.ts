import { createServer } from 'node:http'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createAppLinkMiddleware } from '../../server/app-link-middleware.mjs'
import { appLookupTargets } from '../../src/domain/appLinks'

let server: ReturnType<typeof createServer>
let origin: string
const fetchStore = vi.fn(async (url: URL) => {
  if (url.hostname === 'play.google.com') return new Response(new ReadableStream({
    start(controller) {
      const encode = new TextEncoder()
      controller.enqueue(encode.encode('<head>' + 'x'.repeat(1_050_000)))
      controller.enqueue(encode.encode('<title id="main-title">SocialLite - Apps on Google Play</title>'))
      controller.enqueue(encode.encode('x'.repeat(600_000)))
      controller.close()
    },
  }))
  if (url.searchParams.get('term') === 'Offline App') return new Response(null, { status: 503 })
  return Response.json({ results: [
    { kind: 'software', trackId: 6757661674, trackName: 'SocialLite-Block Reels&Shorts', sellerName: 'Sociallite LLC' },
    { kind: 'software', trackId: 6471198543, trackName: 'Socialite: Stay Connected', sellerName: 'Different Publisher' },
    { kind: 'software', trackId: 389801252, trackName: 'Instagram' },
  ] })
})

beforeEach(async () => {
  fetchStore.mockClear()
  const middleware = createAppLinkMiddleware('http', fetchStore)
  server = createServer((request, response) => middleware(request, response, () => response.end()))
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not start test server.')
  origin = `http://127.0.0.1:${address.port}`
})

afterEach(async () => new Promise<void>((done) => server.close(() => done())))

function post(body: unknown, requestOrigin = origin) {
  return fetch(`${origin}/api/app-links/lookup`, {
    method: 'POST', body: JSON.stringify(body),
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json', 'X-Siftory-Request': '1' },
  })
}

it('derives an explicitly named app from older analysis evidence and discards non-store URLs from lookup', () => {
  expect(appLookupTargets({
    links: ['https://play.google.com/store/apps/details?id=com.sociallite.android&ref=private', 'https://example.test', 'https://apps.apple.com.example.test/app/id6757661674'],
    result: { summary: { text: 'An app is recommended.', evidence: "It's called Socialite, and you can get it now on iOS and Android." }, points: [], categories: [], mentions: [] },
  })).toEqual([{ kind: 'google', value: 'com.sociallite.android' }, { kind: 'name', value: 'Socialite' }])
})

it('returns separately identified official listings and keeps similar-name results distinct', async () => {
  const response = await post({ consent: true, country: 'IN', targets: [
    { kind: 'name', value: 'Socialite' }, { kind: 'google', value: 'com.sociallite.android' }, { kind: 'name', value: 'Offline App' },
  ] })
  expect(response.status).toBe(200)
  const { results } = await response.json()
  expect(results[0].listings).toEqual([
    { store: 'apple', url: 'https://apps.apple.com/in/app/id6757661674', title: 'SocialLite-Block Reels&Shorts', publisher: 'Sociallite LLC' },
    { store: 'apple', url: 'https://apps.apple.com/in/app/id6471198543', title: 'Socialite: Stay Connected', publisher: 'Different Publisher' },
  ])
  expect(results[1].listings[0].url).toBe('https://play.google.com/store/apps/details?id=com.sociallite.android')
  expect(results[2].state).toBe('unavailable')
  expect(fetchStore.mock.calls.map(([url]) => url.origin)).toEqual(['https://itunes.apple.com', 'https://play.google.com', 'https://itunes.apple.com'])
})

it('requires consent and rejects foreign origins and invalid targets before network access', async () => {
  const input = { consent: true, targets: [{ kind: 'name', value: 'Socialite' }] }
  expect((await post(input, 'https://example.test')).status).toBe(403)
  expect((await post({ ...input, consent: false })).status).toBe(400)
  expect((await post({ ...input, targets: [{ kind: 'google', value: 'https://example.test' }] })).status).toBe(400)
  expect(fetchStore).not.toHaveBeenCalled()
})
