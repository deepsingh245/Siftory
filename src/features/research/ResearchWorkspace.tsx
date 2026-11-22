import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { maxResearchQuestionLength, maxResearchSources } from '../../domain/research'
import type { ResearchCitation, ResearchReview, ResearchSession } from '../../domain/research'
import type { SavedItem } from '../../domain/library'
import type { LibraryData } from '../library/useLibraryData'
import { chatgpt } from '../analysis/chatgptClient'
import './research.css'

export function ResearchWorkspace({ sessionId, data }: { sessionId?: string; data: LibraryData }) {
  const [connection, setConnection] = useState<Awaited<ReturnType<typeof chatgpt.status>>>()
  const [sessions, setSessions] = useState<ResearchSession[]>([])
  const [loadedSession, setLoadedSession] = useState<ResearchSession>()
  const [question, setQuestion] = useState('')
  const [model, setModel] = useState('')
  const [review, setReview] = useState<ResearchReview>()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [reviewConnectionId, setReviewConnectionId] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const getSessions = data.getResearchSessions
  const getSession = data.getResearchSession
  const selectedModel = connection?.state === 'connected'
    ? connection.models.some((entry) => entry.slug === model) ? model : connection.models.find((entry) => entry.slug === 'gpt-6-sol')?.slug ?? connection.models[0]?.slug ?? ''
    : ''
  const activeSession = sessionId && loadedSession?.id === sessionId ? loadedSession : undefined
  const selectedTotal = useMemo(() => review?.candidates.filter((source) => selectedIds.includes(source.id)).reduce((sum, source) => sum + source.excerpt.length, 0) ?? 0, [review, selectedIds])

  useEffect(() => {
    const controller = new AbortController()
    const refreshStatus = () => {
      void chatgpt.status(controller.signal).then((status) => { if (!controller.signal.aborted) setConnection(status) })
        .catch(() => { if (!controller.signal.aborted) setConnection({ state: 'disconnected' }) })
    }
    refreshStatus()
    window.addEventListener('focus', refreshStatus)
    return () => { controller.abort(); window.removeEventListener('focus', refreshStatus) }
  }, [])

  useEffect(() => { void getSessions().then(setSessions).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Saved research sessions could not be opened.')) }, [getSessions])
  useEffect(() => {
    if (sessionId) void getSession(sessionId).then((session) => { if (session) setLoadedSession(session) }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'This research session could not be opened.'))
  }, [getSession, sessionId])

  async function findSources(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage(''); setReview(undefined); setConsent(false)
    try {
      const next = await data.prepareResearchReview(question, selectedModel)
      setReview(next)
      setSelectedIds(next.candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.id))
      if (!next.candidates.length) setMessage('No saved source text matched that question. Try different words or add a transcript or extracted text first.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Local source search failed.') }
    finally { setBusy(false) }
  }

  function toggleSource(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (!checked) return current.filter((value) => value !== id)
      if (current.length >= maxResearchSources || current.includes(id)) return current
      return [...current, id]
    })
    setConsent(false); setReviewConnectionId('')
  }

  function changeModel(next: string) {
    setModel(next); setConsent(false); setReviewConnectionId('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!review || !consent || connection?.state !== 'connected' || !selectedIds.length || !selectedModel || connection.connectionId !== reviewConnectionId) return
    setBusy(true); setError(''); setMessage('')
    try {
      const session = await data.actions.saveResearch({ ...review, model: selectedModel }, selectedIds, reviewConnectionId)
      setLoadedSession(session)
      setSessions(await getSessions())
      setQuestion(''); setReview(undefined); setConsent(false)
      window.location.hash = `#/research/${encodeURIComponent(session.id)}`
      setMessage('Research session saved locally.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Research could not be completed.') }
    finally { setBusy(false); setConsent(false) }
  }

  async function deleteSession(session: ResearchSession) {
    if (!window.confirm('Delete this saved research session from this browser?')) return
    setBusy(true); setError('')
    try {
      await data.actions.deleteResearchSession(session.id)
      setSessions(await getSessions()); setLoadedSession(undefined)
      window.location.hash = '#/research'
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The research session could not be deleted.') }
    finally { setBusy(false) }
  }

  return <section className="research-page" aria-labelledby="research-heading" aria-busy={busy}>
    <div className="library-page-heading">
      <div><p className="library-eyebrow">SAVED KNOWLEDGE</p><h1 id="research-heading">Research</h1><p className="library-page-description">Ask a question across saved captions, transcripts, and extracted text. Source retrieval stays on this device.</p></div>
      {sessionId && <a className="quiet-button" href="#/research">New research</a>}
    </div>
    {error && <p className="library-error" role="alert">{error}</p>}
    {message && <p className="processing-capability-reason" role="status">{message}</p>}
    {sessionId ? activeSession
      ? <ResearchSessionView session={activeSession} items={data.items} onDelete={() => void deleteSession(activeSession)} busy={busy} />
      : <p role="status" className="processing-capability-reason">{error ? 'This saved session is unavailable.' : 'Opening saved research session…'}</p>
      : <>
        <form className="research-question-form" onSubmit={(event) => void findSources(event)}>
          <label className="form-field"><span>What do you want to learn from your library?</span><textarea value={question} onChange={(event) => { setQuestion(event.target.value); setReview(undefined); setConsent(false) }} maxLength={maxResearchQuestionLength} rows={3} placeholder="For example: What do my saved sources say about local-first search?" required /></label>
          <div className="research-question-actions"><span>{question.length.toLocaleString()} / {maxResearchQuestionLength}</span><button className="primary-button" type="submit" disabled={busy || !question.trim()}>{busy ? 'Searching saved text…' : 'Find relevant saved sources'}</button></div>
        </form>
        {review && <form className="research-review" onSubmit={(event) => void submit(event)}>
          <div className="research-review-heading"><div><h2>Review sources</h2><p>Search and ranking happened locally. Only checked excerpts are included if you consent below.</p></div></div>
          <blockquote className="research-question-preview">{review.question}</blockquote>
          <p className="research-coverage">{review.totalCandidateCount} matching source{review.totalCandidateCount === 1 ? '' : 's'} found · showing up to {review.candidates.length} · select up to {maxResearchSources}. User notes are excluded.</p>
          {review.totalCandidateCount > review.candidates.length && <p className="research-coverage">{review.totalCandidateCount - review.candidates.length} lower-ranked matches are not shown in this review.</p>}
          <ul className="research-source-list">{review.candidates.map((source) => {
            const selected = selectedIds.includes(source.id)
            const disabled = !selected && selectedIds.length >= maxResearchSources
            return <li key={source.id}>
              <label className="research-source-toggle"><input type="checkbox" checked={selected} disabled={disabled || busy} onChange={(event) => toggleSource(source.id, event.target.checked)} /><span><strong>{source.title || 'Untitled source'}</strong><small>{sourceKindLabel(source.kind)} · {source.excerpt.length.toLocaleString()} characters</small></span></label>
              <details><summary>Review exact excerpt</summary><pre className="analysis-source">{source.excerpt}</pre></details>
            </li>
          })}</ul>
          {selectedIds.length > 0 && <p className="research-coverage">Selected context: {selectedIds.length} source{selectedIds.length === 1 ? '' : 's'} · {selectedTotal.toLocaleString()} / 10,000 source characters · 1 request</p>}
          {connection?.state === 'connected' ? <>
          {connection.email && <p className="processing-boundary-note">Connected as {connection.email}. After you confirm, OpenAI receives the question, selected source titles and types, excerpts, and citation references. Saved item IDs and user notes stay on this device.</p>}
          <label className="form-field"><span>ChatGPT model</span><select value={selectedModel} disabled={busy || consent} onChange={(event) => changeModel(event.target.value)}>{connection.models.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.label}</option>)}</select></label>
            <label className="analysis-consent"><input type="checkbox" checked={consent} disabled={busy || !selectedIds.length || data.analysisRunning || selectedTotal > 10_000} onChange={(event) => { setConsent(event.target.checked); setReviewConnectionId(event.target.checked ? connection.connectionId : '') }} /><span>Send the question, selected source titles and types, excerpts, and citation references to OpenAI using {selectedModel} in 1 request. This may use ChatGPT plan allowance or enabled credits.</span></label>
            <button className="primary-button" type="submit" disabled={!consent || busy || data.analysisRunning || connection.connectionId !== reviewConnectionId}>{busy ? 'Researching…' : 'Confirm and research'}</button>
            {connection.connectionId !== reviewConnectionId && consent && <p role="alert" className="library-error">The ChatGPT connection changed. Review the sources again before continuing.</p>}
          </> : <p className="processing-capability-reason"><a href="#/settings">Connect ChatGPT in Settings</a> to answer from the selected sources. Local source search remains available while disconnected.</p>}
        </form>}
      </>}
    <ResearchSessionList sessions={sessions} currentId={sessionId} />
  </section>
}

function ResearchSessionList({ sessions, currentId }: { sessions: ResearchSession[]; currentId?: string }) {
  if (!sessions.length) return null
  return <section className="research-history" aria-labelledby="research-history-heading">
    <h2 id="research-history-heading">Saved research</h2>
    <ul>{sessions.map((session) => <li key={session.id}><a href={`#/research/${encodeURIComponent(session.id)}`} aria-current={session.id === currentId ? 'page' : undefined}><strong>{session.question}</strong><span>{new Date(session.updatedAt).toLocaleDateString()} · {session.model}</span></a></li>)}</ul>
  </section>
}

function ResearchSessionView({ session, items, onDelete, busy }: { session: ResearchSession; items: SavedItem[]; onDelete: () => void; busy: boolean }) {
  const sources = new Map(session.sources.map((source) => [source.id, source]))
  return <article className="research-session" aria-labelledby="research-session-question">
    <div className="research-session-heading"><div><p className="library-eyebrow">SAVED RESEARCH · {session.model}</p><h2 id="research-session-question">{session.question}</h2><p className="processing-boundary-note">Created {new Date(session.createdAt).toLocaleString()} · Source excerpts and answer are saved in this browser.</p></div><button className="quiet-button danger-button" type="button" disabled={busy} onClick={onDelete}>Delete session</button></div>
    <section aria-labelledby="research-answer-heading"><h3 id="research-answer-heading">Answer</h3>{session.answer.evidenceStatus === 'insufficient' && <p className="research-coverage" role="note">The selected sources did not provide enough evidence for a supported answer.</p>}<p>{session.answer.summary.text}</p><CitationList citations={session.answer.summary.citations} sources={sources} items={items} />
      {session.answer.claims.length > 0 && <ol className="research-claims">{session.answer.claims.map((claim, index) => <li key={index}><p>{claim.text}</p><CitationList citations={claim.citations} sources={sources} items={items} /></li>)}</ol>}
    </section>
    {session.answer.limitations.length > 0 && <section><h3>Limits and conflicts</h3><ul>{session.answer.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></section>}
    <section><h3>Sources included</h3><ul className="research-session-sources">{session.sources.map((source) => <li key={source.id}>
      <strong>{source.title}</strong> · {sourceKindLabel(source.kind)}
      {source.status === 'deleted' ? <p className="research-source-status">Source deleted; its saved excerpt was removed.</p> : <><p className="research-source-status">{source.status === 'changed' ? 'Source changed since this session; saved quotes are historical.' : 'Source matches the saved version used for this answer.'}</p><details><summary>View reviewed excerpt</summary><pre className="analysis-source">{source.excerpt}</pre></details></>}
    </li>)}</ul></section>
  </article>
}

function CitationList({ citations, sources, items }: { citations: ResearchCitation[]; sources: Map<string, ResearchSession['sources'][number]>; items: SavedItem[] }) {
  if (!citations.length) return <p className="research-coverage">No source quote was strong enough to cite.</p>
  return <ul className="research-citations">{citations.map((citation, index) => {
    const source = sources.get(citation.sourceId)
    const item = source ? items.find((candidate) => candidate.id === source.savedItemId) : undefined
    const unavailable = citation.status === 'deleted' || !item
    const target = item ? citationUrl(item, citation.timestampMs) : undefined
    return <li key={`${citation.sourceId}-${index}`}>
      {citation.quote && <blockquote>{citation.quote}</blockquote>}
      {unavailable ? <span className="research-source-status">Source unavailable</span> : target ? <a href={target}>{source?.title || 'Open saved source'}{citation.timestampMs !== undefined ? ` · ${formatTimestamp(citation.timestampMs)}` : ''}</a> : <a href={`#/item/${encodeURIComponent(item!.id)}`}>{source?.title || 'Open saved source'}</a>}
      {citation.status === 'changed' && <small className="research-source-status"> Historical source version</small>}
    </li>
  })}</ul>
}

function citationUrl(item: SavedItem, timestampMs?: number) {
  if (item.url && item.sourceType === 'youtube' && timestampMs !== undefined) {
    try {
      const url = new URL(item.url)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        url.searchParams.set('t', String(Math.floor(timestampMs / 1000)))
        return url.href
      }
    } catch { /* Invalid stored URLs stay local-only. */ }
  }
  return `#/item/${encodeURIComponent(item.id)}`
}

function sourceKindLabel(kind: string) {
  return kind === 'caption' ? 'Saved caption' : kind === 'transcript' ? 'User-provided transcript' : 'Extracted text'
}

function formatTimestamp(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
