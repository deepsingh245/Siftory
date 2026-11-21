import { createServer } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChatGptMiddleware } from '../../server/chatgpt-middleware.mjs'
import { generatePlanText } from '../../server/chatgpt-plan.mjs'

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
  generatePlanText: vi.fn(async () => JSON.stringify(result)),
}))

let server: ReturnType<typeof createServer>
let origin: string

beforeEach(async () => {
  vi.clearAllMocks()
  const middleware = createChatGptMiddleware()
  server = createServer((request, response) => middleware(request, response, () => response.end()))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const listening = server.address()
  if (!listening || typeof listening === 'string') throw new Error('Test server did not start.')
  origin = `http://127.0.0.1:${listening.port}`
})

afterEach(async () => new Promise<void>((resolve) => server.close(() => resolve())))

function post(action: string, cookie?: string, input?: object, requestOrigin = origin) {
  return fetch(`${origin}/api/ai/${action}`, {
    method: 'POST',
    headers: { 'X-Siftory-Request': '1', Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}), ...(input ? { 'Content-Type': 'application/json' } : {}) },
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

    const status = await fetch(`${origin}/api/ai/status`, { headers: { 'X-Siftory-Request': '1', Cookie: cookie } })
    expect(await status.json()).toEqual({ state: 'connected', email: 'person@example.com', models: [{ slug: 'gpt-6-sol', label: 'Example' }] })
    expect((await post('analyze', cookie, { text: caption, model: 'gpt-6-sol', consent: false })).status).toBe(400)
    expect(generatePlanText).not.toHaveBeenCalled()

    const analyzed = await post('analyze', cookie, { text: caption, model: 'gpt-6-sol', consent: true, notes: 'private notes' })
    expect(await analyzed.json()).toEqual({ result })
    expect(generatePlanText).toHaveBeenCalledOnce()
    expect(generatePlanText).toHaveBeenCalledWith('synthetic-secret', 'gpt-6-sol', caption, expect.any(String), expect.any(AbortSignal))

    expect(await (await post('disconnect', cookie)).json()).toEqual({ state: 'disconnected' })
    expect((await post('analyze', cookie, { text: caption, model: 'gpt-6-sol', consent: true })).status).toBe(401)
  })
})
