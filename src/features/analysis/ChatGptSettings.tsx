import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
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
    <Card role="region" aria-labelledby="chatgpt-heading" aria-busy={busy} className="min-w-0 gap-4 py-4">
      <CardHeader className="gap-2 px-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="chatgpt-heading" className="text-base font-semibold">ChatGPT connection</h2>
          <Badge role="status" variant="outline" className={status?.state === 'connected' ? 'text-success' : 'text-muted-foreground'}>
            {status?.state === 'connected' ? 'Connected' : pending ? 'Sign-in pending' : status?.state === 'disconnected' ? 'Disconnected'
              : error || status?.state === 'error' ? 'Unavailable' : 'Checking…'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Use your ChatGPT plan to analyze selected text. Siftory asks before sending text to OpenAI.</p>
      </CardHeader>
      <CardContent className="space-y-3 px-4 text-sm sm:px-5">
        {status?.state === 'connected' && <dl className="divide-y border-y">
          {status.email && <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
            <dt className="text-muted-foreground">Account</dt>
            <dd className="min-w-0 font-medium [overflow-wrap:anywhere]">{status.email}</dd>
          </div>}
          <div className="flex items-center justify-between gap-4 py-2"><dt className="text-muted-foreground">Models available</dt><dd className="font-medium tabular-nums">{status.models.length}</dd></div>
        </dl>}
        {pending && <p role="status" className="text-muted-foreground">Waiting for ChatGPT sign-in. Return here when it finishes.</p>}
        {status?.message && <p role="status" className="text-muted-foreground">{status.message}</p>}
        {error && <p className="text-destructive" role="alert">{error}</p>}
        <p className="text-muted-foreground">On Windows, a renewable connection can reopen in this browser after a restart.</p>
      </CardContent>
      {(pending || status) && <CardFooter className="flex-wrap gap-2 px-4 sm:px-5">
        {pending && authorizationUrl && <Button asChild className="h-auto min-h-control whitespace-normal">
          <a href={authorizationUrl} target="_blank" rel="noreferrer" data-oai-siwc-button>Continue with ChatGPT (opens in a new tab)</a>
        </Button>}
        {pending && <Button type="button" variant="outline" disabled={busy} onClick={() => void changeConnection(false)}>Cancel sign-in</Button>}
        {status?.state === 'connected' && <Button type="button" variant="outline" disabled={busy} onClick={() => void changeConnection(false)}>Disconnect ChatGPT</Button>}
        {(status?.state === 'disconnected' || status?.state === 'error') && <Button type="button" disabled={busy} onClick={() => void changeConnection(true)}>{busy ? 'Preparing sign-in…' : 'Connect ChatGPT'}</Button>}
      </CardFooter>}
    </Card>
  )
}
