import { useEffect, useState } from 'react'
import type { ExtractedContent, ProcessingCapability } from '../../domain/processing'
import type { SavedItem } from '../../domain/library'
import type { LibraryData } from '../library/useLibraryData'

const previewLimit = 20_000

export function ProcessingPanel({ item, data }: { item: SavedItem; data: LibraryData }) {
  const [capability, setCapability] = useState<ProcessingCapability>()
  const [content, setContent] = useState<ExtractedContent>()
  const [showContent, setShowContent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    void data.getProcessingCapability(item).then((next) => {
      if (active) setCapability(next)
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Processing capability could not be checked.')
    })
    return () => { active = false }
  }, [data, item])

  async function refreshCapability() {
    const next = await data.getProcessingCapability(item)
    setCapability(next)
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(undefined)
    try {
      await action()
      await refreshCapability()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The processing action could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleContent() {
    if (showContent) {
      setShowContent(false)
      return
    }
    const resultId = capability?.job?.resultId
    if (!resultId) return
    setBusy(true)
    setError(undefined)
    try {
      const result = await data.getExtractedContent(resultId)
      if (!result) throw new Error('The extracted text result is no longer available.')
      setContent(result)
      setShowContent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The extracted text could not be opened.')
    } finally {
      setBusy(false)
    }
  }

  function downloadContent() {
    if (!content) return
    const blob = new Blob([content.text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${content.sourceFileName.replace(/\.txt$/i, '')}-extracted.txt`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const state = capability?.state
  const job = capability?.job
  const retryable = Boolean(job && ['failed', 'needs-attention', 'skipped'].includes(job.status))

  return (
    <section className="processing-panel" aria-labelledby={`processing-heading-${item.id}`} aria-busy={busy}>
      <div className="processing-panel-heading">
        <div><p className="library-eyebrow">LOCAL ONLY</p><h2 id={`processing-heading-${item.id}`}>Processing</h2></div>
        {state && <span className={`processing-badge processing-badge--${state}`}>{statusLabel(state)}</span>}
      </div>
      <p className="processing-capability-reason">{capability?.reason ?? 'Checking whether this source can be processed…'}</p>
      <p className="processing-boundary-note">Only local .txt files can be extracted in this phase. Processing runs while Siftory is open; links are never fetched.</p>

      {job?.attemptCount ? <p className="processing-attempt-note">Attempt {job.attemptCount} · updated {new Date(job.updatedAt).toLocaleString()}</p> : null}
      {error && <p className="library-error" role="alert">{error}</p>}

      <div className="processing-actions">
        {state === 'available' && <>
          <button className="quiet-button" type="button" disabled={busy} onClick={() => void run(() => data.actions.queueProcessing(item.id))}>Add to queue</button>
          <button className="primary-button" type="button" disabled={busy} onClick={() => void run(() => data.actions.processNow(item.id))}>Process now</button>
        </>}
        {state === 'queued' && job && <>
          <a className="quiet-button" href="#/queue">Open queue</a>
          <button className="primary-button" type="button" disabled={busy} onClick={() => void run(() => data.actions.processNow(item.id))}>Process now</button>
          <button className="quiet-button" type="button" disabled={busy} onClick={() => void run(() => data.actions.skipProcessing(job.id))}>Skip</button>
        </>}
        {state === 'processing' && <span className="processing-live" role="status">Extracting text…</span>}
        {retryable && job && <>
          <button className="primary-button" type="button" disabled={busy} onClick={() => void run(() => data.actions.retryProcessing(job.id))}>{state === 'skipped' ? 'Add to queue again' : 'Retry'}</button>
          {state !== 'skipped' && <button className="quiet-button" type="button" disabled={busy} onClick={() => void run(() => data.actions.skipProcessing(job.id))}>Skip</button>}
          <a className="quiet-button" href="#/queue">Open queue</a>
        </>}
        {state === 'completed' && job && <button className="quiet-button" type="button" disabled={busy} onClick={() => void toggleContent()}>{showContent ? 'Hide extracted text' : 'Read extracted text'}</button>}
      </div>

      {showContent && content && <div className="extracted-text-view">
        <div className="extracted-text-heading"><strong>Extracted from {content.sourceFileName}</strong><button className="quiet-button" type="button" onClick={downloadContent}>Download full text</button></div>
        <pre>{content.text.slice(0, previewLimit)}</pre>
        {content.text.length > previewLimit && <p>Showing the first {previewLimit.toLocaleString()} characters. Download the file to read the full text.</p>}
      </div>}

      {job?.events.length ? <details className="processing-history"><summary>Job history ({job.events.length} events)</summary><ol>{job.events.slice(-8).reverse().map((event, index) => <li key={`${event.at}-${event.type}-${index}`}><strong>{eventLabel(event.type)}</strong><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>{event.message && <span>{event.message}</span>}</li>)}</ol></details> : null}
    </section>
  )
}

export function ProcessingCardAction({ item, data }: { item: SavedItem; data: LibraryData }) {
  const [error, setError] = useState<string>()
  if (item.sourceType !== 'text' || item.contentType !== 'text' || !item.sourceFileId) return null

  const job = data.jobs
    .filter((candidate) => candidate.savedItemId === item.id && candidate.processingVersion === 'local-text-v1')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]

  async function queue() {
    setError(undefined)
    try {
      if (job && ['failed', 'needs-attention', 'skipped'].includes(job.status)) {
        await data.actions.retryProcessing(job.id)
      } else {
        await data.actions.queueProcessing(item.id)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This text file could not be queued.')
    }
  }

  if (job?.status === 'completed') return <a className="processing-card-status" href="#/queue">Text extracted · View queue</a>
  if (job?.status === 'queued') return <a className="processing-card-status" href="#/queue">Waiting in queue</a>
  if (job?.status === 'extracting') return <span className="processing-card-status" role="status">Extracting text…</span>

  return <span className="processing-card-action">
    <button className="quiet-button" type="button" onClick={() => void queue()}>{job?.status === 'failed' || job?.status === 'needs-attention' || job?.status === 'skipped' ? 'Retry text extraction' : 'Queue text extraction'}</button>
    {error && <span className="processing-card-error" role="alert">{error}</span>}
  </span>
}

function statusLabel(status: string): string {
  return status.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function eventLabel(event: string): string {
  if (event === 'needs-attention') return 'Needs attention'
  if (event === 'requeued') return 'Added to queue again'
  return event.charAt(0).toUpperCase() + event.slice(1)
}
