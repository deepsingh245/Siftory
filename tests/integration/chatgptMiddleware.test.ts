import { createServer } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChatGptMiddleware } from '../../server/chatgpt-middleware.mjs'
import { generatePlanText, refreshSession } from '../../server/chatgpt-plan.mjs'

const caption = 'Try the example toolkit at https://example.com/toolkit.'
const result = {
  summary: { text: 'The caption recommends a toolkit.', evidence: 'Try the example toolkit' },
  points: [], categories: [], mentions: [],
}

vi.mock('../../server/chatgpt-plan.mjs', async (original) => ({
  ...await original<typeof import('../../server/chatgpt-plan.mjs')>(),
  getHostId: vi.fn(async () => 'synthetic-host'),
  authorize: vi.fn(async (_host, offerLink) => {
    offerLink('https://auth.openai.com/api/accounts/authorize')
    return { clientId: 'oaiapp_example' }
  }),
  exchangeCode: vi.fn(async () => ({ id_token: 'synthetic-id', access_token: 'synthetic-secret', refresh_token: 'synthetic-refresh', token_type: 'Bearer', scope: 'chatgpt.tokens.use.direct' })),
  verifyIdentity: vi.fn(async () => ({ email: 'person@example.com' })),
  listModels: vi.fn(async () => [{ slug: 'gpt-6-sol', label: 'Example' }]),
  revoke: vi.fn(async () => undefined),
  refreshSession: vi.fn(async () => ({ access_token: 'renewed-access', refresh_token: 'rotated-refresh', token_type: 'Bearer', scope: 'chatgpt.tokens.use.direct', expires_in: 3600 })),
  generatePlanText: vi.fn(async () => JSON.stringify(result)),
}))

let server: ReturnType<typeof createServer>
let origin: string
type Credential = Record<string, unknown>
let saved: Credential | undefined
const credentialStore = {
  load: async () => saved && structuredClone(saved),
  save: async (record: Credential) => { saved = structuredClone(record) },
  clear: async () => { saved = undefined },
}

async function startServer(port = 0) {
  const middleware = createChatGptMiddleware('http', credentialStore)
  server = createServer((request, response) => middleware(request, response, () => response.end()))
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  const listening = server.address()
  if (!listening || typeof listening === 'string') throw new Error('Test server did not start.')
  origin = `http://127.0.0.1:${listening.port}`
}

beforeEach(async () => {
  vi.clearAllMocks()
  saved = undefined
  vi.mocked(generatePlanText).mockResolvedValue(JSON.stringify(result))
  await startServer()
})

afterEach(async () => new Promise<void>((resolve) => server.close(() => resolve())))

function post(action: string, cookie?: string, input?: object, requestOrigin = origin) {
  return fetch(`${origin}/api/ai/${action}`, {
    method: 'POST',
    headers: { 'X-Siftory-Request': '1', Origin: requestOrigin, Connection: 'close', ...(cookie ? { Cookie: cookie } : {}), ...(input ? { 'Content-Type': 'application/json' } : {}) },
    body: input ? JSON.stringify(input) : undefined,
  })
}

describe('local ChatGPT routes', () => {
  it('rejects cross-origin mutations and analysis without a session', async () => {
    expect((await post('connect', undefined, undefined, 'https://example.com')).status).toBe(403)
    expect((await post('analyze', undefined, { consent: true, model: 'gpt-6-sol', text: caption })).status).toBe(401)
    expect(generatePlanText).not.toHaveBeenCalled()
  })

  it('keeps credentials on the server and sends only explicitly confirmed text', async () => {
    const connection = await post('connect')
    expect(connection.status).toBe(200)
    expect(connection.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict')
    const cookie = connection.headers.get('set-cookie')!.split(';', 1)[0]
    expect(await connection.json()).toEqual({ authorizationUrl: 'https://auth.openai.com/api/accounts/authorize' })

    const connectionState = await waitForConnection(cookie)
    expect(connectionState).toMatchObject({ state: 'connected', connectionId: expect.any(String), email: 'person@example.com', models: [{ slug: 'gpt-6-sol', label: 'Example' }] })
    expect((await post('analyze', cookie, { text: caption, model: 'gpt-6-sol', consent: false, connectionId: connectionState.connectionId })).status).toBe(400)
    expect(generatePlanText).not.toHaveBeenCalled()

    const analyzed = await post('analyze', cookie, { text: caption, model: 'gpt-6-sol', consent: true, connectionId: connectionState.connectionId, notes: 'private notes' })
    expect(await analyzed.json()).toEqual({ result })
    expect(generatePlanText).toHaveBeenCalledOnce()
    expect(generatePlanText).toHaveBeenCalledWith('synthetic-secret', 'gpt-6-sol', caption, expect.any(String), expect.any(AbortSignal))
    expect((await post('analyze', cookie, { text: caption, model: 'gpt-6-sol', consent: true, connectionId: 'stale-connection' })).status).toBe(409)
    expect(generatePlanText).toHaveBeenCalledOnce()

    expect(await (await post('disconnect', cookie)).json()).toEqual({ state: 'disconnected' })
    expect((await post('analyze', cookie, { text: caption, model: 'gpt-6-sol', consent: true, connectionId: connectionState.connectionId })).status).toBe(401)
  })

  it('logs distinct result failures without disclosing the source or model output', async () => {
    const connection = await post('connect')
    const cookie = connection.headers.get('set-cookie')!.split(';', 1)[0]
    const { connectionId } = await waitForConnection(cookie)
    const request = { model: 'gpt-6-sol', consent: true, connectionId, text: caption }
    const privateOutput = 'private-response-for-test'
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      vi.mocked(generatePlanText).mockResolvedValueOnce(`not JSON: ${privateOutput}`)
      const malformed = await post('analyze', cookie, request)
      expect(malformed.status).toBe(502)
      const invalidJson = await malformed.json()
      expect(invalidJson.diagnostic).toMatchObject({ stage: 'json', status: 502 })

      vi.mocked(generatePlanText).mockResolvedValueOnce(JSON.stringify({
        ...result, summary: { ...result.summary, evidence: privateOutput },
      }))
      const unmatched = await post('analyze', cookie, request)
      expect(unmatched.status).toBe(502)
      const invalidQuote = await unmatched.json()
      expect(invalidQuote.diagnostic).toMatchObject({
        stage: 'validation', field: 'summary.evidence', reason: 'Quote is not an exact match in the supplied text.',
      })
      const supportedPoint = { text: 'The toolkit was mentioned.', evidence: 'Try the example toolkit' }
      vi.mocked(generatePlanText).mockResolvedValueOnce(JSON.stringify({
        ...result, points: [{ text: 'An unsupported point', evidence: privateOutput }, supportedPoint],
      }))
      const partial = await post('analyze', cookie, request)
      expect(partial.status).toBe(200)
      const partialResult = await partial.json()
      expect(partialResult).toEqual({ result: { ...result, points: [supportedPoint] }, hasOmittedFindings: true })
      const logged = JSON.stringify(log.mock.calls)
      expect(log).toHaveBeenCalledTimes(3)
      expect(logged).toContain(invalidJson.diagnostic.requestId)
      expect(logged).toContain(invalidQuote.diagnostic.requestId)
      expect(logged).toContain('points[0].evidence')
      const surfaced = JSON.stringify([logged, invalidJson, invalidQuote])
      expect(JSON.stringify(partialResult)).not.toContain(privateOutput)
      for (const privateValue of [caption, privateOutput, cookie, connectionId, 'synthetic-secret']) {
        expect(surfaced).not.toContain(privateValue)
      }
    } finally {
      log.mockRestore()
    }
  })

  it('sends only reviewed library excerpts and rejects fabricated research quotes', async () => {
    const connection = await post('connect')
    const cookie = connection.headers.get('set-cookie')!.split(';', 1)[0]
    const connected = await waitForConnection(cookie)
    const id = 'a'.repeat(64)
    const excerpt = 'A saved source describes local search.'
    vi.mocked(generatePlanText).mockResolvedValue(JSON.stringify({
      evidenceStatus: 'supported',
      summary: { text: 'The saved source describes local search.', citations: [{ sourceId: id, quote: 'describes local search' }] },
      claims: [{ text: 'Local search is described.', citations: [{ sourceId: id, quote: 'A saved source describes local search.' }] }],
      limitations: [],
    }))
    const answer = await post('research', cookie, {
      model: 'gpt-6-sol', consent: true, connectionId: connected.connectionId, question: 'What does the source say?',
      sources: [{ id, title: 'Saved note', kind: 'caption', excerpt }], notes: 'must never be sent',
    })
    expect(answer.status).toBe(200)
    expect(await answer.json()).toMatchObject({ answer: { claims: [{ citations: [{ sourceId: id }] }] } })
    expect(generatePlanText).toHaveBeenCalledWith('synthetic-secret', 'gpt-6-sol', expect.stringContaining(excerpt), expect.any(String), expect.any(AbortSignal))
    expect(generatePlanText.mock.calls.at(-1)?.[2]).not.toContain('must never be sent')

    vi.mocked(generatePlanText).mockResolvedValue(JSON.stringify({
      evidenceStatus: 'supported',
      summary: { text: 'Unsupported quote.', citations: [{ sourceId: id, quote: 'invented evidence' }] }, claims: [], limitations: [],
    }))
    const invalid = await post('research', cookie, {
      model: 'gpt-6-sol', consent: true, connectionId: connected.connectionId, question: 'What does the source say?',
      sources: [{ id, title: 'Saved note', kind: 'caption', excerpt }],
    })
    expect(invalid.status).toBe(502)
  })

  it('restores the same browser session after server restart and persists the rotated credential before analysis', async () => {
    const connection = await post('connect')
    const cookie = connection.headers.get('set-cookie')!.split(';', 1)[0]
    const state = await waitForConnection(cookie)
    expect(saved?.refreshToken).toBe('synthetic-refresh')
    saved!.accessExpiresAt = Date.now() - 1000
    const port = Number(new URL(origin).port)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await startServer(port)
    expect((await waitForConnection(cookie)).connectionId).toBe(state.connectionId)
    expect((await post('analyze', cookie, { text: caption, model: 'gpt-6-sol', consent: true, connectionId: state.connectionId })).status).toBe(200)
    expect(refreshSession).toHaveBeenCalledExactlyOnceWith('oaiapp_example', 'synthetic-refresh')
    expect(saved?.refreshToken).toBe('rotated-refresh')
    expect(generatePlanText).toHaveBeenCalledWith('renewed-access', 'gpt-6-sol', caption, expect.any(String), expect.any(AbortSignal))
    await post('disconnect', cookie)
    expect(saved).toBeUndefined()
  })
})

async function waitForConnection(cookie: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await fetch(`${origin}/api/ai/status`, { headers: { 'X-Siftory-Request': '1', Cookie: cookie, Connection: 'close' } })
    const status = await response.json() as { state: string; connectionId: string }
    if (status.state === 'connected') return status
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Test connection did not complete.')
}
