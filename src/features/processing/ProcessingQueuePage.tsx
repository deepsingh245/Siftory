import { useState } from 'react'
import type { ProcessingJob } from '../../domain/processing'
import { displayTitle } from '../../domain/library'
import type { LibraryData } from '../library/useLibraryData'

function statusLabel(status: string): string {
  return status.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function ProcessingQueuePage({ data }: { data: LibraryData }) {
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string>()
  const jobs = [...data.jobs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const queuedCount = jobs.filter((job) => job.status === 'queued').length

  async function startQueue() {
    setStarting(true)
    setError(undefined)
    try {
      await data.actions.processQueue()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The queue could not be processed.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <section className="library-page processing-queue-page" aria-labelledby="processing-queue-heading" aria-busy={starting}>
      <div className="library-page-heading">
        <div>
          <p className="library-eyebrow">LOCAL WORK</p>
          <h1 id="processing-queue-heading">Processing queue</h1>
          <p className="library-page-description">Review job status and start supported work while Siftory is open.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => void startQueue()} disabled={starting || queuedCount === 0}>{starting ? 'Processing queue…' : `Start queue (${queuedCount})`}</button>
      </div>

      <p className="processing-queue-boundary">Phase 4 processes local .txt files only. PDF extraction, URLs, video, transcription, and AI analysis are not available. Closing the app pauses work; no background processing is promised.</p>
      {error && <p className="library-error" role="alert">{error}</p>}
      <div className="processing-queue-summary" aria-live="polite">
        <span>{queuedCount} queued</span>
        <span>{jobs.filter((job) => job.status === 'extracting').length} active</span>
        <span>{jobs.filter((job) => job.status === 'needs-attention' || job.status === 'failed').length} need attention</span>
        <span>{jobs.filter((job) => job.status === 'completed').length} completed</span>
      </div>

      {jobs.length ? <ul className="processing-job-list">{jobs.map((job) => (
        <li key={job.id}><ProcessingJobCard job={job} data={data} /></li>
      ))}</ul> : (
        <div className="library-empty-state">
          <span className="empty-state-mark" aria-hidden="true">○</span>
          <h2>Your queue is clear.</h2>
          <p>Open a local plain-text item and add it to the queue to extract its text on this device.</p>
          <a className="quiet-button" href="#/inbox">Go to Inbox</a>
        </div>
      )}
    </section>
  )
}

function ProcessingJobCard({ job, data }: { job: ProcessingJob; data: LibraryData }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const item = data.items.find((candidate) => candidate.id === job.savedItemId)

  async function perform(action: () => Promise<unknown>) {
    setBusy(true)
    setError(undefined)
    try {
      await action()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The processing action could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="processing-job-card">
      <div className="processing-job-heading">
        <div>
          <p className="library-eyebrow">TEXT EXTRACTION</p>
          <h2>{item ? <a href={`#/item/${encodeURIComponent(item.id)}`}>{displayTitle(item)}</a> : 'Saved item removed'}</h2>
        </div>
        <span className={`processing-badge processing-badge--${job.status}`}>{statusLabel(job.status)}</span>
      </div>
      <p className="processing-job-stage">{job.status === 'extracting' ? 'Extracting text…' : job.stage ? statusLabel(job.stage) : 'No active stage'}</p>
      <p className="processing-job-meta">Queued {new Date(job.queuedAt).toLocaleString()} · {job.attemptCount} {job.attemptCount === 1 ? 'attempt' : 'attempts'}</p>
      {job.errorMessage && <p className="processing-job-error">{job.errorMessage}</p>}
      {error && <p className="library-error" role="alert">{error}</p>}
      <div className="processing-actions">
        {job.status === 'queued' && item && <>
          <button className="primary-button" type="button" disabled={busy} onClick={() => void perform(() => data.actions.processNow(item.id))}>Process now</button>
          <button className="quiet-button" type="button" disabled={busy} onClick={() => void perform(() => data.actions.skipProcessing(job.id))}>Skip</button>
        </>}
        {job.status === 'extracting' && <span className="processing-live" role="status">Running while the app is open…</span>}
        {(job.status === 'failed' || job.status === 'needs-attention') && item && <>
          <button className="primary-button" type="button" disabled={busy} onClick={() => void perform(() => data.actions.retryProcessing(job.id))}>Retry</button>
          <button className="quiet-button" type="button" disabled={busy} onClick={() => void perform(() => data.actions.skipProcessing(job.id))}>Skip</button>
        </>}
        {job.status === 'skipped' && item && <button className="quiet-button" type="button" disabled={busy} onClick={() => void perform(() => data.actions.retryProcessing(job.id))}>Add to queue again</button>}
        {job.status === 'completed' && item && <a className="quiet-button" href={`#/item/${encodeURIComponent(item.id)}`}>View extracted text</a>}
      </div>
      <details className="processing-history"><summary>History ({job.events.length} events)</summary>
        <ol>{job.events.slice().reverse().map((event, index) => <li key={`${event.at}-${event.type}-${index}`}><strong>{statusLabel(event.type)}</strong><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>{event.message && <span>{event.message}</span>}</li>)}</ol>
      </details>
    </article>
  )
}
