import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorize, checkResponse, verifyIdentity } from '../../scripts/check-chatgpt-plan.mjs'
import { listModels } from '../../server/chatgpt-plan.mjs'

afterEach(() => vi.unstubAllGlobals())

describe('ChatGPT plan connection check', () => {
  it('loads a model catalog larger than the text response limit during connection', async () => {
    const models = [
      { slug: 'gpt-6-sol', display_name: 'GPT-6 Sol', visibility: 'list', metadata: 'x'.repeat(300_000) },
      { slug: 'internal-model', visibility: 'hidden' },
    ]
    const request = vi.fn(async () => Response.json({ models }))
    vi.stubGlobal('fetch', request)

    await expect(listModels('fake-token')).resolves.toEqual([{ slug: 'gpt-6-sol', label: 'GPT-6 Sol' }])
    expect(request).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.objectContaining({ headers: { Authorization: 'Bearer fake-token' } }))
  })

  it('keeps separate size limits for the model catalog and text responses', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array(8 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(new Uint8Array(256_001), { headers: { 'Content-Type': 'text/event-stream' } }))
    vi.stubGlobal('fetch', request)

    await expect(listModels('fake-token')).rejects.toThrow('The ChatGPT model list exceeded its size limit.')
    await expect(checkResponse('fake-token', 'gpt-6-sol')).rejects.toThrow('The OpenAI response exceeded its size limit.')
  })

  it('accepts the issued registration only after verifying loopback state', async () => {
    const link = Promise.withResolvers<string>()
    const authorization = authorize('urn:uuid:00000000-0000-4000-8000-000000000001', link.resolve)
    const url = new URL(await link.promise)
    const callback = new URL(url.searchParams.get('redirect_uri')!)
    callback.searchParams.set('client_id', 'oaiapp_example')
    callback.searchParams.set('code', 'synthetic-code')
    callback.searchParams.set('state', 'wrong-state')
    expect((await fetch(callback)).status).toBe(400)

    callback.searchParams.set('state', url.searchParams.get('state')!)
    expect((await fetch(callback)).status).toBe(200)
    const result = await authorization
    expect(result).toMatchObject({ clientId: 'oaiapp_example', code: 'synthetic-code', nonce: url.searchParams.get('nonce') })
    expect(callback.hostname).toBe('127.0.0.1')
    expect(url.origin).toBe('https://auth.openai.com')
    expect(url.searchParams.get('scope')?.split(' ')).toContain('chatgpt.tokens.use.direct')
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(result.verifier).digest('base64url'))
  })

  it('verifies the signed identity and rejects an unexpected nonce or client', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const now = Math.floor(Date.now() / 1000)
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'example' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ iss: 'https://auth.openai.com', aud: 'oaiapp_example', nonce: 'expected-nonce', sub: 'example-user', iat: now, exp: now + 60 })).toString('base64url')
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url')
    const token = `${header}.${payload}.${signature}`
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'example' }] })))

    await expect(verifyIdentity(token, 'oaiapp_example', 'expected-nonce')).resolves.toEqual({ email: undefined })
    await expect(verifyIdentity(token, 'oaiapp_example', 'another-nonce')).rejects.toThrow('did not match')
    await expect(verifyIdentity(token, 'oaiapp_other', 'expected-nonce')).rejects.toThrow('did not match')
    await expect(verifyIdentity(`${header}.${payload}.eA`, 'oaiapp_example', 'expected-nonce')).rejects.toThrow('signature')
  })

  it('uses the documented public endpoint and requires a complete synthetic response', async () => {
    const sse = { headers: { 'Content-Type': 'text/event-stream' } }
    const output = [{ type: 'message', content: [{ type: 'output_text', text: 'SIFTORY_OK' }] }]
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { output } })}\n\n`, sse))
      .mockResolvedValueOnce(new Response('data: {"type":"response.output_text.delta","delta":"SIFTORY_OK"}\n\n', sse))
    vi.stubGlobal('fetch', request)

    await expect(checkResponse('fake-token', 'example-model')).resolves.toBeUndefined()
    const [url, options] = request.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(options).toMatchObject({ method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer fake-token', Accept: 'text/event-stream' } })
    expect(JSON.parse(options.body)).toMatchObject({ model: 'example-model', store: false, stream: true, input: [expect.objectContaining({ content: expect.stringContaining('SIFTORY_OK') })] })
    await expect(checkResponse('fake-token', 'example-model')).rejects.toThrow('ended before completion')
  })

  it('reports a usage limit without exposing the provider’s response message', async () => {
    const request = vi.fn(async () => Response.json({ error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'private diagnostic' } }, { status: 429 }))
    vi.stubGlobal('fetch', request)
    await expect(checkResponse('fake-token', 'example-model')).rejects.toThrow('plan limit')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('reports safe diagnostics when the provider sends JSON or an unexpected web page', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json({ object: 'response', status: 'completed', output: 'private diagnostic' }, { headers: { 'X-Request-Id': 'req_example123' } }))
      .mockResolvedValueOnce(new Response('<html>private diagnostic</html>', { headers: { 'Content-Type': 'text/html' } }))
      .mockResolvedValueOnce(Response.json({ error: { code: 'subscription_sharing_usage_unavailable', message: 'private diagnostic' } }))
    vi.stubGlobal('fetch', request)

    await expect(checkResponse('fake-token', 'example-model')).rejects.toThrow('streamed completion event. (HTTP 200, application/json, request req_example123)')
    await expect(checkResponse('fake-token', 'example-model')).rejects.toThrow('expected response stream. (HTTP 200, text/html)')
    await expect(checkResponse('fake-token', 'example-model')).rejects.toThrow('could not check your ChatGPT plan usage')
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('recognizes a plan limit reported inside the stream', async () => {
    const event = { type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }
    const request = vi.fn(async () => new Response(`data: ${JSON.stringify(event)}\n\n`, { headers: { 'Content-Type': 'Text/Event-Stream; charset=utf-8' } }))
    vi.stubGlobal('fetch', request)

    await expect(checkResponse('fake-token', 'example-model')).rejects.toThrow('plan limit')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('reads a completed response stream without a content type header', async () => {
    const event = {
      type: 'response.completed',
      response: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'SIFTORY_OK' }] }] },
    }
    const response = new Response(Buffer.from(`event: response.completed\ndata: ${JSON.stringify(event)}\n\n`))
    expect(response.headers.get('content-type')).toBeNull()
    const request = vi.fn(async () => response)
    vi.stubGlobal('fetch', request)

    await expect(checkResponse('fake-token', 'example-model')).resolves.toBeUndefined()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('distinguishes an empty body, an incomplete stream, and unrelated output without a content type header', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(null))
      .mockResolvedValueOnce(new Response(Buffer.from('data: {"type":"response.output_text.delta","delta":"SIFTORY_OK"}\n\n')))
      .mockResolvedValueOnce(new Response(Buffer.from('private fixture body')))
    vi.stubGlobal('fetch', request)

    await expect(checkResponse('fake-token', 'example-model')).rejects.toThrow('empty body for the text request. (HTTP 200, no recognized content type)')
    await expect(checkResponse('fake-token', 'example-model')).rejects.toThrow('ended before completion')
    await expect(checkResponse('fake-token', 'example-model')).rejects.toThrow('(unrecognized body format). (HTTP 200, no recognized content type)')
  })
})
