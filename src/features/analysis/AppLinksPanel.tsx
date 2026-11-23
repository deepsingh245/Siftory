import { useId, useState } from 'react'
import { Link2, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Disclosure } from '@/components/ui/disclosure'
import { Label } from '@/components/ui/label'
import type { Analysis } from '../../domain/analysis'
import { appLookupTargets } from '../../domain/appLinks'
import type { AppLookupResult, AppLookupTarget } from '../../domain/appLinks'

function countryCode() {
  return navigator.language.split('-').find((part, index) => index > 0 && /^[A-Z]{2}$/u.test(part)) ?? 'US'
}

function targetLabel({ kind, value }: AppLookupTarget) {
  if (kind === 'apple') return `App Store · ${value}`
  if (kind === 'google') return `Google Play · ${value}`
  return value
}

export function AppLinksPanel({ analysis }: { analysis: Analysis }) {
  const id = useId()
  const targets = appLookupTargets(analysis)
  const [unselected, setUnselected] = useState<string[]>([])
  const [results, setResults] = useState<AppLookupResult[]>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!targets.length) return null

  const country = countryCode()
  const keyFor = ({ kind, value }: AppLookupTarget) => `${kind}:${value}`
  const selected = targets.filter((target) => !unselected.includes(keyFor(target)))

  async function checkStores() {
    setBusy(true)
    setError('')
    setResults(undefined)
    try {
      const response = await fetch('/api/app-links/lookup', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Siftory-Request': '1' },
        body: JSON.stringify({ targets: selected, country, consent: true }),
      })
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error()
      const body = await response.json() as { results?: AppLookupResult[]; error?: string }
      if (!response.ok || !body.results) {
        setError(body.error ?? 'App lookup could not be completed.')
        return
      }
      setResults(body.results)
    } catch {
      setError('App lookup is unavailable. Check that the local server is running and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="app-links-panel" aria-labelledby={`${id}-heading`} aria-busy={busy}>
    <h3 id={`${id}-heading`} className="flex items-center gap-2">
      <Link2 className="size-4 text-muted-foreground" aria-hidden="true" /> App links
    </h3>
    <Disclosure className="mt-3 rounded-lg border bg-card p-2"
      label={<>Find official app links <Badge variant="secondary" className="ms-1">{targets.length}</Badge></>}
      triggerClassName="w-full justify-between">
      <div className="space-y-3 px-2 pt-2 pb-1">
        <p className="max-w-prose text-sm text-muted-foreground">Only your selections are sent to the App Store or Google Play. Store region <strong className="font-medium text-foreground">{country}</strong>.</p>
        <fieldset className="min-w-0 space-y-1">
          <legend className="mb-1 text-sm font-medium">Names and listing IDs to check</legend>
          {targets.map((target, index) => {
            const key = keyFor(target)
            const checkboxId = `${id}-choice-${index}`
            return <Label key={key} htmlFor={checkboxId} className="min-h-10 cursor-pointer gap-2.5 rounded-md px-2 py-2 leading-snug hover:bg-accent">
              <Checkbox id={checkboxId} disabled={busy} checked={!unselected.includes(key)} onCheckedChange={(checked) => {
                setUnselected((previous) => checked ? previous.filter((entry) => entry !== key) : [...previous, key])
              }} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{targetLabel(target)}</span>
            </Label>
          })}
        </fieldset>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3">
          <Button type="button" disabled={busy || !selected.length} onClick={() => void checkStores()}>
            <Search aria-hidden="true" /> {busy ? 'Checking stores…' : 'Find app links'}
          </Button>
          <span className="text-sm text-muted-foreground">{selected.length} selected</span>
        </div>
      </div>
    </Disclosure>
    {busy && <p role="status">Checking app listings…</p>}
    {error && <p className="library-error" role="alert">{error}</p>}
    {results && <ul className="mt-3 divide-y text-sm">{results.map(({ target, state, listings }) => <li className="space-y-1 py-3 [overflow-wrap:anywhere]" key={keyFor(target)}>
      <strong>{targetLabel(target)}</strong>
      {state === 'unavailable' && <p>The store could not be checked. Try again later.</p>}
      {state === 'unconfirmed' && <p>No matching listing was confirmed for this region.</p>}
      {state === 'found' && <>
        {target.kind === 'name' && <p>Possible App Store matches. Check the title and publisher against the source.</p>}
        <ul>{listings.map(({ store, url, title, publisher }) => <li key={url}>
          <a href={url} target="_blank" rel="noreferrer">{title}</a>
          <span> · {store === 'apple' ? 'App Store' : 'Google Play'}{publisher ? ` · ${publisher}` : ''}</span>
        </li>)}</ul>
      </>}
      {target.kind === 'name' && <a href={`https://play.google.com/store/search?${new URLSearchParams({ q: target.value, c: 'apps' })}`} target="_blank" rel="noreferrer">Search Google Play for {target.value}</a>}
    </li>)}</ul>}
  </section>
}
