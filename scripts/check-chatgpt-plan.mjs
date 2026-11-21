import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import { authorize, CheckError, checkResponse, exchangeCode, getHostId, listModels, planPermission, revoke, verifyIdentity } from '../server/chatgpt-plan.mjs'

export { authorize, checkResponse, verifyIdentity } from '../server/chatgpt-plan.mjs'

async function main() {
  if (process.argv.includes('--help')) {
    console.log('npm run ai:check\nCheck ChatGPT plan eligibility with one synthetic text request after sign-in and confirmation. Run in an interactive terminal.')
    return
  }
  if (!process.stdin.isTTY) throw new CheckError('Run this check from an interactive terminal.')
  console.log('Siftory will request permission to use your ChatGPT plan. This check uses a synthetic prompt and may consume plan allowance or enabled credits. Keep any OpenAI authorization link private.')
  const attempt = await authorize(await getHostId())
  const tokens = await exchangeCode(attempt)
  try {
    if (typeof tokens.id_token !== 'string') throw new CheckError('OpenAI did not return a signed ID token.')
    await verifyIdentity(tokens.id_token, attempt.clientId, attempt.nonce)
    if (typeof tokens.scope !== 'string' || !tokens.scope.split(/\s+/).includes(planPermission)) {
      throw new CheckError('Sign-in succeeded without ChatGPT plan permission. No text request was made.')
    }
    if (typeof tokens.access_token !== 'string' || typeof tokens.token_type !== 'string' || tokens.token_type.toLowerCase() !== 'bearer') {
      throw new CheckError('OpenAI did not provide a usable plan session.')
    }
    const models = await listModels(tokens.access_token)
    if (!models.length) throw new CheckError('OpenAI did not list an available model for this connection.')
    const terminal = createInterface({ input: process.stdin, output: process.stdout })
    const cancel = new AbortController()
    terminal.on('SIGINT', () => cancel.abort())
    try {
      for (const [index, model] of models.entries()) console.log(`${index + 1}. ${model.slug}`)
      const number = Number(await terminal.question('Enter a model number to send one synthetic text request, or press Enter to cancel: ', { signal: cancel.signal }))
      if (number === 0) return console.log('Text request cancelled.')
      if (!Number.isInteger(number) || !models[number - 1]) throw new CheckError('Choose a model number from the displayed list.')
      await checkResponse(tokens.access_token, models[number - 1].slug)
      console.log('Passed. The signed-in ChatGPT plan returned a complete response to Siftory’s synthetic text request.')
    } finally {
      terminal.close()
    }
  } finally {
    if (typeof tokens.refresh_token === 'string') {
      try {
        await revoke(tokens.refresh_token, attempt.clientId)
        console.log('The temporary renewable session was revoked.')
      } catch {
        console.error('Remote session revocation could not be confirmed. You can disconnect the registration in ChatGPT Settings.')
        process.exitCode = 1
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof CheckError ? error.message : error?.name === 'AbortError' ? 'Connection check cancelled.' : 'The connection check could not be completed.')
    process.exitCode = 1
  })
}
