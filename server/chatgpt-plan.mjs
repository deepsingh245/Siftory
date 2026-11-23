import { createHash, createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'

const issuer = 'https://auth.openai.com'
const resource = 'https://api.openai.com/v1'
const localHost = '127.0.0.1'
const callbackPath = '/auth/callback'
const registrationClient = 'dynamic_agent_client'
export const planPermission = 'chatgpt.tokens.use.direct'
const syntheticPrompt = 'Return exactly SIFTORY_OK. This is a text-only Siftory connection check.'
const modelCatalogLimit = { maxBytes: 8 * 1024 * 1024, description: 'The ChatGPT model list' }

export class CheckError extends Error {
  status = 502
  code = 'provider-error'
}

export async function getHostId() {
  const path = '.siftory/chatgpt-plan-check-host-id'
  await mkdir('.siftory', { recursive: true })
  try {
    await writeFile(path, `urn:uuid:${randomUUID()}\n`, { flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
  const hostId = (await readFile(path, 'utf8')).trim()
  if (!/^urn:uuid:[0-9a-f-]{36}$/.test(hostId)) throw new CheckError('The saved Siftory host ID is invalid.')
  return hostId
}

function respond(response, status, message) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(message)
}

export async function authorize(hostId, showLink = (url) => {
  console.log(`Open this OpenAI sign-in link in your browser within five minutes.\n${url}\n`)
}, signal) {
  const state = randomBytes(32).toString('base64url')
  const nonce = randomBytes(32).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, localHost, resolve)
  })
  const host = `${localHost}:${server.address().port}`
  const redirectUri = `http://${host}${callbackPath}`
  const authorization = new URL(`${issuer}/api/accounts/authorize`)
  authorization.search = new URLSearchParams({
    client_id: registrationClient, agent_name_hint: 'Siftory', ext_agent_host_id: hostId,
    response_type: 'code', redirect_uri: redirectUri, resource,
    scope: `openid profile email offline_access resource.invoke ${planPermission}`,
    state, nonce, code_challenge_method: 'S256', code_challenge: challenge,
  }).toString()

  let timer
  let cancel
  let consumed = false
  try {
    return await new Promise((resolve, reject) => {
      cancel = () => reject(new CheckError('Sign-in was cancelled.'))
      if (signal?.aborted) return cancel()
      signal?.addEventListener('abort', cancel, { once: true })
      timer = setTimeout(() => reject(new CheckError('Sign-in timed out. Run the check again to start a fresh attempt.')), 5 * 60_000)
      server.on('request', (request, response) => {
        if (request.method !== 'GET' || request.headers.host !== host || !request.url?.startsWith('/')) {
          return respond(response, 404, 'Unknown request.')
        }
        let callback
        try { callback = new URL(`http://${host}${request.url}`) } catch { return respond(response, 400, 'Invalid callback.') }
        if (callback.pathname !== callbackPath) return respond(response, 404, 'Unknown request.')
        const params = callback.searchParams
        if (consumed || params.getAll('state').length !== 1 || params.get('state') !== state) {
          return respond(response, 400, 'Invalid or expired Siftory sign-in attempt.')
        }
        consumed = true
        if (params.has('error')) {
          respond(response, 400, 'Sign-in was declined or could not be completed. Return to Siftory.')
          return reject(new CheckError('OpenAI did not grant this sign-in request.'))
        }
        const code = params.get('code')
        const clientId = params.get('client_id')
        if (!code || !/^[a-zA-Z0-9_.-]{1,256}$/.test(clientId ?? '') || clientId === registrationClient || params.getAll('code').length !== 1 || params.getAll('client_id').length !== 1) {
          respond(response, 400, 'OpenAI returned an incomplete Siftory registration.')
          return reject(new CheckError('OpenAI did not return an authorization code and an issued client ID.'))
        }
        respond(response, 200, 'Siftory received the sign-in response. You can close this tab and return to Siftory.')
        resolve({ code, clientId, nonce, verifier, redirectUri })
      })
      showLink(authorization.href)
    })
  } finally {
    signal?.removeEventListener('abort', cancel)
    clearTimeout(timer)
    server.close()
  }
}

async function request(url, init = {}, timeout = 15_000) {
  const deadline = AbortSignal.timeout(timeout)
  const signal = init.signal ? AbortSignal.any([deadline, init.signal]) : deadline
  try {
    return await fetch(url, { ...init, redirect: 'error', signal })
  } catch {
    throw new CheckError('Could not reach OpenAI or the request timed out.')
  }
}

function responseFormat(response) {
  const type = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  return type && /^[a-z0-9!#$&^_.+-]{1,48}\/[a-z0-9!#$&^_.+-]{1,48}$/.test(type) ? type : undefined
}

function responseError(response, message, code) {
  const details = [`HTTP ${response.status}`, responseFormat(response) ?? 'no recognized content type']
  const requestId = response.headers.get('x-request-id') ?? response.headers.get('openai-request-id')
  if (requestId && /^req_[a-zA-Z0-9_-]{1,80}$/.test(requestId)) details.push(`request ${requestId}`)
  switch (code) {
    case 'subscription_sharing_usage_limit_exceeded':
      message = 'The ChatGPT plan limit for this connection has been reached. Check ChatGPT Settings → Usage.'
      break
    case 'subscription_sharing_usage_unavailable':
      message = 'OpenAI could not check your ChatGPT plan usage. Try again later.'
      break
    case 'subscription_sharing_user_not_eligible':
      message = 'ChatGPT plan usage is unavailable for this account or workspace.'
      break
    case 'subscription_sharing_unsupported_capability':
      message = 'The selected model or request capability is unavailable through this connection.'
      break
  }
  const error = new CheckError(`${message} (${details.join(', ')})`)
  error.providerCode = code
  error.providerStatus = response.status
  if (requestId && /^req_[a-zA-Z0-9_-]{1,80}$/.test(requestId)) error.providerRequestId = requestId
  if (response.status === 401) error.status = 401
  if (response.status === 429 || code === 'subscription_sharing_usage_limit_exceeded') {
    error.status = 429
    error.code = 'plan-limit'
  }
  return error
}

async function* responseTextChunks(response, { maxBytes = 256_000, description = 'The OpenAI response' } = {}) {
  if (!response.body) return
  const decoder = new TextDecoder()
  let received = 0
  try {
    for await (const bytes of response.body) {
      received += bytes.byteLength
      if (received > maxBytes) throw responseError(response, `${description} exceeded its size limit.`)
      yield decoder.decode(bytes, { stream: true })
    }
  } catch (error) {
    if (error instanceof CheckError) throw error
    throw responseError(response, 'The connection ended or timed out while reading the response body.')
  }
  yield decoder.decode()
}

async function readResponseText(response, limit) {
  let text = ''
  for await (const chunk of responseTextChunks(response, limit)) text += chunk
  return text
}

function parseJson(text) {
  try { return JSON.parse(text) } catch { return undefined }
}

async function readJsonResponse(response) {
  const format = responseFormat(response)
  if (format !== 'application/json' && !format?.endsWith('+json')) {
    await response.body?.cancel().catch(() => undefined)
    return undefined
  }
  return parseJson(await readResponseText(response))
}

async function requireSuccess(response, step) {
  if (response.ok) return response
  const error = await readJsonResponse(response)
  throw responseError(response, `${step} failed.`, error?.error?.code)
}

export async function verifyIdentity(token, clientId, nonce) {
  const [header, payload, signature, extra] = token.split('.')
  if (!header || !payload || !signature || extra !== undefined || token.length > 32_768) throw new CheckError('OpenAI returned an invalid ID token.')
  const metadata = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))
  if (metadata.alg !== 'RS256' || typeof metadata.kid !== 'string') throw new CheckError('The ID token uses an unsupported signature algorithm.')
  const keys = await (await requireSuccess(await request(`${issuer}/.well-known/jwks.json`), 'Signing key lookup')).json()
  const key = keys.keys.find((candidate) => candidate.kid === metadata.kid && candidate.kty === 'RSA' && (!candidate.alg || candidate.alg === 'RS256'))
  if (!key || !verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), createPublicKey({ key, format: 'jwk' }), Buffer.from(signature, 'base64url'))) {
    throw new CheckError('OpenAI’s ID token signature could not be verified.')
  }
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  const now = Date.now() / 1000
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (claims.iss !== issuer || !audience.includes(clientId) || (audience.length > 1 && claims.azp !== clientId) ||
    !Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 5 ||
    (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now + 5)) ||
    claims.nonce !== nonce || typeof claims.sub !== 'string' || !claims.sub.trim()) {
    throw new CheckError('OpenAI’s ID token did not match this sign-in attempt.')
  }
  return { email: claims.email_verified === true && typeof claims.email === 'string' ? claims.email.slice(0, 320) : undefined }
}

export async function exchangeCode(attempt) {
  return (await requireSuccess(await request(`${issuer}/api/accounts/oauth/token`, {
    method: 'POST', body: new URLSearchParams({
      grant_type: 'authorization_code', client_id: attempt.clientId, code: attempt.code,
      code_verifier: attempt.verifier, redirect_uri: attempt.redirectUri, resource,
    }),
  }), 'Sign-in exchange')).json()
}

export async function refreshSession(clientId, refreshToken) {
  return (await requireSuccess(await request(`${issuer}/api/accounts/oauth/token`, {
    method: 'POST', body: new URLSearchParams({
      grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken, resource,
    }),
  }), 'Session renewal')).json()
}

export async function listModels(accessToken) {
  const response = await requireSuccess(await request(`${resource}/models`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }), 'Model listing')
  const catalog = parseJson(await readResponseText(response, modelCatalogLimit))
  if (!Array.isArray(catalog?.models)) throw responseError(response, 'OpenAI returned an unreadable model list.')
  return catalog.models.filter((model) => model?.visibility === 'list' && typeof model.slug === 'string' && /^[a-zA-Z0-9._-]{1,100}$/.test(model.slug))
    .map((model) => ({ slug: model.slug, label: typeof model.display_name === 'string' ? model.display_name.slice(0, 100) : model.slug }))
}

export async function checkResponse(accessToken, model) {
  const text = await generatePlanText(accessToken, model, syntheticPrompt)
  if (text.trim() !== 'SIFTORY_OK') throw new CheckError('OpenAI completed the request but returned unexpected text.')
}

export async function generatePlanText(accessToken, model, input, instructions, signal) {
  const response = await requireSuccess(await request(`${resource}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ model, instructions, input: [{ role: 'user', content: input }], store: false, stream: true }),
    signal,
  }, 60_000), 'Text request')
  const format = responseFormat(response)
  if (!response.body) throw responseError(response, 'OpenAI returned an empty body for the text request.')
  if (format === 'text/event-stream') return requireCompletion(response, responseTextChunks(response))

  let json
  let bodyDescription
  if (!format || format === 'text/plain' || format === 'application/octet-stream') {
    const body = await readResponseText(response)
    if (!body.trim()) throw responseError(response, 'OpenAI returned an empty body for the text request.')
    if (/^(?::|(?:data|event|id|retry):)/.test(body.trimStart())) {
      return requireCompletion(response, [body])
    }
    json = parseJson(body)
    bodyDescription = json === undefined ? 'unrecognized body format' : 'JSON body'
  } else {
    json = await readJsonResponse(response)
  }

  const code = json?.error?.code ?? json?.response?.error?.code
  const message = json?.object === 'response' && json.status === 'completed'
    ? 'OpenAI returned a completed JSON response. This plan check requires a streamed completion event.'
    : `OpenAI did not return the expected response stream${bodyDescription ? ` (${bodyDescription})` : ''}.`
  throw responseError(response, message, code)
}

async function requireCompletion(response, chunks) {
  let buffer = ''
  for await (const chunk of chunks) {
    buffer += chunk
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop()
    for (const frame of events) {
      const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
      if (!data || data === '[DONE]') continue
      let event
      try { event = JSON.parse(data) } catch { throw responseError(response, 'OpenAI sent an unreadable stream event.') }
      if (!event || typeof event.type !== 'string') throw responseError(response, 'OpenAI sent an unreadable stream event.')
      if (['error', 'response.failed', 'response.incomplete'].includes(event.type)) {
        throw responseError(response, 'OpenAI reported a failed or incomplete text request.', event.response?.error?.code ?? event.code)
      }
      if (event.type !== 'response.completed') continue
      const output = event.response?.output
      if (!Array.isArray(output)) throw responseError(response, 'OpenAI completed the request without a usable result.')
      const text = output.flatMap((item) => item?.type === 'message' && Array.isArray(item.content) ? item.content : [])
        .filter((part) => part?.type === 'output_text' && typeof part.text === 'string').map((part) => part.text).join('')
      if (!text.trim()) throw responseError(response, 'OpenAI completed the request without usable text.')
      return text
    }
  }
  throw responseError(response, 'The response stream ended before completion.')
}

export async function revoke(refreshToken, clientId) {
  const discovery = await (await requireSuccess(await request(`${issuer}/.well-known/openid-configuration`), 'Revocation discovery')).json()
  const url = new URL(discovery.revocation_endpoint)
  if (discovery.issuer !== issuer || url.origin !== issuer || url.username || url.password) throw new CheckError('Invalid revocation endpoint.')
  await requireSuccess(await request(url, {
    method: 'POST', body: new URLSearchParams({ token: refreshToken, token_type_hint: 'refresh_token', client_id: clientId }),
  }), 'Session revocation')
}
