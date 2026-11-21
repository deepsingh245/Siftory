import { useState } from 'react'
import type { AnalysisJob } from '../../domain/analysisQueue'
import { displayTitle } from '../../domain/library'
import type { LibraryData } from '../library/useLibraryData'
import { AnalysisBatchReview } from './AnalysisBatchReview'

function statusLabel(status: string) { return status.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }

export function AnalysisQueuePanel({ data }: { data: LibraryData }) {
  const [reviewJobs, setReviewJobs] = useState<AnalysisJob[]>()
  const [error, setError] = useState('')
  const jobs = [...data.analysisJobs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const queued = jobs.filter((job) => job.status === 'queued')
  const inProgress = jobs.filter((job) => job.status === 'analyzing')
  const attention = jobs.filter((job) => job.status === 'needs-attention' || job.status === 'failed')

  async function changeState(job: AnalysisJob, status: 'queued' | 'skipped') {
    setError('')
    try { await data.actions.setAnalysisJobQueueState(job.id, status) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The analysis job could not be updated.') }
  }

  return <section className="analysis-queue" aria-labelledby="analysis-queue-heading">
    <div className="library-page-heading"><div><p className="library-eyebrow">OPTIONAL CHATGPT WORK</p><h2 id="analysis-queue-heading">AI analysis queue</h2><p className="library-page-description">Jobs stay on this device. Review the exact text and confirm before sending each batch.</p></div>
      <button className="primary-button" type="button" disabled={!queued.length || data.analysisRunning} onClick={() => setReviewJobs(queued.slice(0, 25))}>{data.analysisRunning ? 'Analysis running…' : `Review queued (${queued.length})`}</button>
    </div>
    <p className="processing-queue-boundary">Siftory does not run analysis in the background. Your signed-in ChatGPT connection is checked before each request; reconnecting requires a fresh review and confirmation.</p>
    {data.analysisMessage && <p className="processing-capability-reason" role="status">{data.analysisMessage}</p>}
    {error && <p className="library-error" role="alert">{error}</p>}
    <div className="processing-queue-summary" aria-live="polite"><span>{queued.length} queued</span><span>{inProgress.length} active</span><span>{attention.length} need attention</span><span>{jobs.filter((job) => job.status === 'completed').length} completed</span></div>
    {reviewJobs && <AnalysisBatchReview key={reviewJobs.map((job) => job.id).join('|')} itemIds={reviewJobs.map((job) => job.savedItemId)} queuedJobs={reviewJobs} data={data} onClose={() => setReviewJobs(undefined)} />}
    {jobs.length ? <ul className="processing-job-list">{jobs.map((job) => {
      const item = data.items.find((candidate) => candidate.id === job.savedItemId)
      return <li key={job.id}><article className="processing-job-card">
        <div className="processing-job-heading"><div><p className="library-eyebrow">{job.model} · {job.kind === 'caption' ? 'CAPTION' : 'EXTRACTED TEXT'}</p><h3>{item ? <a href={`#/item/${encodeURIComponent(item.id)}`}>{displayTitle(item)}</a> : 'Saved item removed'}</h3></div><span className={`processing-badge processing-badge--${job.status}`}>{statusLabel(job.status)}</span></div>
        <p className="processing-job-meta">{job.attempts} {job.attempts === 1 ? 'attempt' : 'attempts'} · Updated {new Date(job.updatedAt).toLocaleString()}</p>
        {job.message && <p className="processing-job-error">{job.message}</p>}
        <div className="processing-actions">
          {job.status === 'queued' && <button className="quiet-button" type="button" disabled={data.analysisRunning} onClick={() => setReviewJobs([job])}>Review this item</button>}
          {(job.status === 'needs-attention' || job.status === 'failed') && <><button className="quiet-button" type="button" onClick={() => void changeState(job, 'queued')}>Retry after review</button><button className="quiet-button" type="button" onClick={() => void changeState(job, 'skipped')}>Skip</button></>}
          {job.status === 'queued' && <button className="quiet-button" type="button" onClick={() => void changeState(job, 'skipped')}>Skip</button>}
          {job.status === 'skipped' && <button className="quiet-button" type="button" onClick={() => void changeState(job, 'queued')}>Queue again</button>}
          {job.status === 'completed' && item && <a className="quiet-button" href={`#/item/${encodeURIComponent(item.id)}`}>View saved analysis</a>}
        </div>
      </article></li>
    })}</ul> : <div className="library-empty-state"><h3>No AI analysis jobs yet.</h3><p>Select items from Inbox or All saved to review text and start an optional analysis.</p><a className="quiet-button" href="#/inbox">Go to Inbox</a></div>}
  </section>
}
