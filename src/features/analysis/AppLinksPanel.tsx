import { useState } from 'react'
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

  return <section className="app-links-panel" aria-label="App links" aria-busy={busy}>
    <h3>App links</h3>
    <ul className="app-link-targets" aria-label="First names and listings found">
      {targets.slice(0, 3).map((target) => <li key={keyFor(target)}>{targetLabel(target)}</li>)}
      {targets.length > 3 && <li>+{targets.length - 3} more</li>}
    </ul>
    <details>
      <summary>Find official app links</summary>
      <p>Only the selected names and listing IDs are sent to Apple or Google Play. Store region: {country}.</p>
      <fieldset>
        <legend>Names and listing IDs to check</legend>
        {targets.map((target) => {
          const key = keyFor(target)
          return <label key={key}>
            <input type="checkbox" disabled={busy} checked={!unselected.includes(key)} onChange={(event) => {
              const checked = event.target.checked
              setUnselected((previous) => checked ? previous.filter((entry) => entry !== key) : [...previous, key])
            }} />
            {targetLabel(target)}
          </label>
        })}
      </fieldset>
      <button className="quiet-button" type="button" disabled={busy || !selected.length} onClick={() => void checkStores()}>
        {busy ? 'Checking stores…' : 'Find app links'}
      </button>
    </details>
    {busy && <p role="status">Checking app listings…</p>}
    {error && <p className="library-error" role="alert">{error}</p>}
    {results && <ul className="app-link-results">{results.map(({ target, state, listings }) => <li key={keyFor(target)}>
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
