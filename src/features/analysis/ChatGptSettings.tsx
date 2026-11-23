import { useEffect, useState } from 'react'
import { chatgpt } from './chatgptClient'
import type { ChatGptStatus } from './chatgptClient'

export function ChatGptSettings() {
  const [status, setStatus] = useState<ChatGptStatus>()
  const [authorizationUrl, setAuthorizationUrl] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const pending = status?.state === 'pending'

  useEffect(() => {
    const controller = new AbortController()
    const refresh = () => {
      void chatgpt.status(controller.signal).then((next) => {
        if (!controller.signal.aborted) setStatus(next)
      }).catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The connection status could not be checked.')
      })
    }
    refresh()
    window.addEventListener('focus', refresh)
    const timer = pending ? window.setInterval(refresh, 1500) : undefined
    return () => {
      controller.abort()
      window.removeEventListener('focus', refresh)
      window.clearInterval(timer)
    }
  }, [pending])

  async function changeConnection(connecting: boolean) {
    setBusy(true)
    setError(undefined)
    try {
      if (connecting) {
        const { authorizationUrl: url } = await chatgpt.connect()
        const target = new URL(url)
        if (target.origin !== 'https://auth.openai.com') throw new Error('The ChatGPT sign-in link was invalid.')
        setAuthorizationUrl(target.href)
        setStatus({ state: 'pending' })
      } else {
        setStatus(await chatgpt.disconnect())
        setAuthorizationUrl(undefined)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The ChatGPT connection could not be changed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="library-page" aria-labelledby="settings-heading">
      <div className="library-page-heading">
        <div><h1 id="settings-heading">Settings</h1><p className="library-page-description">Connect your ChatGPT plan for saved item analysis.</p></div>
      </div>
      <section className="processing-panel" aria-labelledby="chatgpt-heading">
        <h2 id="chatgpt-heading">ChatGPT connection</h2>
        <p className="processing-boundary-note">Use your ChatGPT plan to analyze selected text. Siftory asks before sending text to OpenAI. On Windows, a renewable connection can reopen in this browser after a restart.</p>
        <p role="status" className="processing-capability-reason">
          {status?.state === 'connected' ? `Connected${status.email ? ` as ${status.email}` : ''}. ${status.models.length} models available.`
            : pending ? 'Waiting for ChatGPT sign-in. Return here when it finishes.'
              : status?.message ?? (status ? 'Disconnected' : error ? '' : 'Checking connection…')}
        </p>
        {status?.state === 'connected' && status.message && <p role="status">{status.message}</p>}
        {error && <p className="library-error" role="alert">{error}</p>}
        <div className="processing-actions">
          {pending && authorizationUrl && <a href={authorizationUrl} className="primary-button" target="_blank" rel="noreferrer" data-oai-siwc-button>Continue with ChatGPT (opens in a new tab)</a>}
          {pending && <button type="button" className="quiet-button" disabled={busy} onClick={() => void changeConnection(false)}>Cancel sign-in</button>}
          {status?.state === 'connected' && <button type="button" className="quiet-button" disabled={busy} onClick={() => void changeConnection(false)}>Disconnect ChatGPT</button>}
          {(status?.state === 'disconnected' || status?.state === 'error') && <button type="button" className="primary-button" disabled={busy} onClick={() => void changeConnection(true)}>{busy ? 'Preparing sign-in…' : 'Connect ChatGPT'}</button>}
        </div>
      </section>
    </section>
  )
}
