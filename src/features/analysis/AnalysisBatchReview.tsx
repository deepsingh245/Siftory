import { useEffect, useState } from 'react'
import type { AnalysisJob, AnalysisReview } from '../../domain/analysisQueue'
import type { LibraryData } from '../library/useLibraryData'
import { chatgpt } from './chatgptClient'

export function AnalysisBatchReview({ itemIds, queuedJobs, data, onClose }: {
  itemIds: string[]
  queuedJobs?: AnalysisJob[]
  data: LibraryData
  onClose?: () => void
}) {
  const [connection, setConnection] = useState<Awaited<ReturnType<typeof chatgpt.status>>>()
  const [model, setModel] = useState(queuedJobs?.[0]?.model ?? '')
  const [review, setReview] = useState<AnalysisReview>()
  const [reviewConnectionId, setReviewConnectionId] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const refresh = () => {
      void chatgpt.status(controller.signal).then((status) => { if (!controller.signal.aborted) setConnection(status) })
        .catch(() => { if (!controller.signal.aborted) setConnection({ state: 'disconnected' }) })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { controller.abort(); window.removeEventListener('focus', refresh) }
  }, [])

  const connected = connection?.state === 'connected' ? connection : undefined
  const selectedModel = queuedJobs?.[0]?.model ?? (connected?.models.some((entry) => entry.slug === model) ? model : connected?.models.find((entry) => entry.slug === 'gpt-6-sol')?.slug ?? connected?.models[0]?.slug ?? '')
  const ready = review?.items.filter((entry) => entry.state === 'ready').length ?? 0

  async function prepare() {
    if (!selectedModel) return
    setBusy(true); setError(''); setMessage(''); setConsent(false)
    try {
      const next = await data.prepareAnalysisReview(itemIds, selectedModel, queuedJobs)
      setReview(next)
      setReviewConnectionId(connected?.connectionId ?? '')
      if (!next.items.some((entry) => entry.state === 'ready')) setMessage('There is no current uncached text to analyze in this selection.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The review could not be prepared.') }
    finally { setBusy(false) }
  }

  async function queue() {
    if (!review) return
    setBusy(true); setError(''); setMessage('')
    try {
      const count = await data.actions.queueAnalysis(review)
      setMessage(`${count} ${count === 1 ? 'item is' : 'items are'} in the analysis queue. Start them from this review when you are ready.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The reviewed items could not be queued.') }
    finally { setBusy(false) }
  }

  async function start() {
    if (!review || !consent || !reviewConnectionId || !connected) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await data.actions.startAnalysis(review, reviewConnectionId, !queuedJobs)
      setMessage(result.message ?? `${result.completed.length} ${result.completed.length === 1 ? 'analysis' : 'analyses'} saved.`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The analysis queue stopped.') }
    finally { setBusy(false); setConsent(false) }
  }

  return <section className="processing-panel analysis-batch" aria-labelledby="analysis-batch-heading" aria-busy={busy}>
    <div className="analysis-batch-heading"><div><h2 id="analysis-batch-heading">{queuedJobs ? 'Review queued analysis' : 'Analyze selected items'}</h2><p>Text is sent only after you review it and confirm. Analysis runs one item at a time while Siftory is open.</p></div>{onClose && <button className="quiet-button" type="button" onClick={onClose}>Close review</button>}</div>
    {error && <p className="library-error" role="alert">{error}</p>}
    {message && <p className="processing-capability-reason" role="status">{message}</p>}
    {!connected && <p className="processing-capability-reason"><a href="#/settings">Connect ChatGPT in Settings</a> to review and start analysis.</p>}
    {connected && <>
      {!queuedJobs && <label className="form-field"><span>ChatGPT model</span><select value={selectedModel} disabled={busy || Boolean(review)} onChange={(event) => { setModel(event.target.value); setReview(undefined); setConsent(false) }}>{connected.models.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.label}</option>)}</select></label>}
      {connected.email && <p className="processing-boundary-note">Connected as {connected.email}. Review applies to this ChatGPT connection.</p>}
      {!review && <button className="primary-button" type="button" disabled={busy || !selectedModel || data.analysisRunning} onClick={() => void prepare()}>{busy ? 'Preparing review…' : `Review ${queuedJobs ? Math.min(queuedJobs.length, 25) : itemIds.length} item${(queuedJobs ? queuedJobs.length : itemIds.length) === 1 ? '' : 's'}`}</button>}
    </>}
    {review && <>
      <div className="analysis-review-summary" aria-live="polite"><span>{ready} ready</span><span>{review.items.filter((entry) => entry.state === 'cached').length} already analyzed</span><span>{review.items.filter((entry) => entry.state === 'unavailable').length} unavailable</span><span>{review.items.filter((entry) => entry.state === 'changed').length} changed since queued</span></div>
      <ol className="analysis-review-list">{review.items.map((entry) => <li key={entry.itemId}>
        <strong>{entry.title}</strong><span className={`processing-badge processing-badge--${entry.state}`}>{entry.state === 'ready' ? 'Ready' : entry.state === 'cached' ? 'Already analyzed' : entry.state === 'changed' ? 'Text changed' : 'No usable text'}</span>
        {entry.input && <details><summary>Review text to send ({entry.input.kind === 'caption' ? 'caption' : 'extracted text'})</summary><pre className="analysis-source">{entry.input.text}</pre>{entry.input.truncated && <p>Only the first {entry.input.text.length.toLocaleString()} characters will be analyzed.</p>}</details>}
      </li>)}</ol>
      {ready > 0 && <>
        {!queuedJobs && <button className="quiet-button" type="button" disabled={busy} onClick={() => void queue()}>Add reviewed items to queue</button>}
        <label className="analysis-consent"><input type="checkbox" checked={consent} disabled={busy || !connected || !reviewConnectionId || data.analysisRunning} onChange={(event) => setConsent(event.target.checked)} /><span>Send the reviewed text above to OpenAI using {review.model}. This may use ChatGPT plan allowance or enabled credits.</span></label>
        <button className="primary-button" type="button" disabled={!consent || busy || data.analysisRunning || !connected || connected.connectionId !== reviewConnectionId} onClick={() => void start()}>{data.analysisRunning ? 'Analysis running…' : 'Confirm and start analysis'}</button>
        {connected?.connectionId !== reviewConnectionId && <p role="alert" className="processing-capability-reason">The ChatGPT connection changed. Prepare a new review before starting.</p>}
      </>}
    </>}
  </section>
}
