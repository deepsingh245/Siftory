import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { analysisFingerprint, analysisVersion, prepareAnalysisInput } from '../../domain/analysis'
import type { Analysis } from '../../domain/analysis'
import type { SavedItem } from '../../domain/library'
import { TEXT_EXTRACTION_VERSION } from '../../domain/processing'
import { transcriptAnalysisProvenance } from '../../domain/transcriptAnalysis'
import type { LibraryData } from '../library/useLibraryData'
import type { TranscriptCue } from '../library/TranscriptPanel'
import { AnalysisBatchReview } from './AnalysisBatchReview'
import { AppLinksPanel } from './AppLinksPanel'
import './analysis.css'

export function AnalysisPanel({ item, data, onTranscriptCue }: { item: SavedItem; data: LibraryData; onTranscriptCue?: (cue: TranscriptCue) => void }) {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [available, setAvailable] = useState<boolean>()
  const [error, setError] = useState<string>()
  const { getAnalyses, getExtractedContent, getTranscript } = data
  const resultId = data.jobs.find((job) => job.savedItemId === item.id && job.sourceFingerprint === item.sourceFingerprint && job.processingVersion === TEXT_EXTRACTION_VERSION && job.status === 'completed')?.resultId
  const completionMarker = data.analysisJobs.filter((job) => job.savedItemId === item.id && job.status === 'completed').map((job) => job.updatedAt).join('|')

  useEffect(() => {
    let active = true
    void (async () => {
      const extracted = resultId ? await getExtractedContent(resultId) : undefined
      const transcript = item.transcriptId ? await getTranscript(item.transcriptId) : undefined
      const input = transcript?.savedItemId === item.id
        ? { kind: 'transcript' as const, text: transcript.text, truncated: false, provenance: transcriptAnalysisProvenance(transcript) }
        : prepareAnalysisInput(item, extracted)
      if (!input) { if (active) { setAvailable(false); setAnalyses([]) }; return }
      const [fingerprint, saved] = await Promise.all([analysisFingerprint(input), getAnalyses(item.id)])
      if (active) { setAvailable(true); setAnalyses(saved.filter((entry) => entry.version === analysisVersion && entry.fingerprint === fingerprint)) }
    })().catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'The local analysis records could not be opened.') })
    return () => { active = false }
  }, [getAnalyses, getExtractedContent, getTranscript, item, resultId, completionMarker])

  const visibleResult = [...analyses].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
  const latestJob = data.analysisJobs.filter((job) => job.savedItemId === item.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
  const needsAttention = latestJob?.status === 'failed' || latestJob?.status === 'needs-attention'
  const running = latestJob?.status === 'analyzing'
  const status = running ? 'Analyzing' : needsAttention ? 'Needs attention' : visibleResult ? 'Result saved'
    : latestJob?.status === 'queued' ? 'Queued' : available === undefined ? 'Checking source' : available ? 'Ready to review' : 'Waiting for source text'
  const review = <AnalysisBatchReview key={`${item.transcriptId ?? item.updatedAt}-review`} itemIds={[item.id]} data={data} inline readyToReview={available === true} />
  return <section className="processing-panel analysis-panel" aria-labelledby="analysis-heading">
    <div className="reading-section-heading"><h2 id="analysis-heading">AI analysis</h2><span className={`reading-status ${visibleResult ? 'reading-status--ready' : ''}`} role="status">{status}</span></div>
    {error && <p className="library-error" role="alert">{error}</p>}
    {available === undefined && !error && <p role="status" className="processing-capability-reason">Checking available text…</p>}
    {available === false && <p className="processing-capability-reason">{item.sourceType === 'text'
      ? 'Extract the file text above before continuing.'
      : ['youtube', 'instagram'].includes(item.sourceType)
        ? 'Open the Transcript tab to attach spoken text.'
        : 'This item has no text available for analysis.'}</p>}
    {needsAttention && latestJob?.message && <p className="library-error" role="status">{latestJob.message}</p>}
    {visibleResult ? <>
      <ResultView key={visibleResult.id} analysis={visibleResult} data={data} item={item} onTranscriptCue={onTranscriptCue} />
      <details className="analysis-repeat"><summary>Run another analysis</summary>{review}</details>
    </> : review}
  </section>
}

function ResultView({ analysis, data, item, onTranscriptCue }: { analysis: Analysis; data: LibraryData; item: SavedItem; onTranscriptCue?: (cue: TranscriptCue) => void }) {
  const { result } = analysis
  const source = analysis.kind === 'caption' ? 'Saved caption' : analysis.kind === 'transcript' ? 'Transcript' : 'Extracted text'
  const jump = analysis.kind === 'transcript' ? onTranscriptCue : undefined
  const hasReferences = analysis.links.length > 0 || result.mentions.length > 0 || result.categories.length > 0
  return <div className={`analysis-result${hasReferences ? ' analysis-result--with-reference' : ''}`}>
    <div className="analysis-reading">
      <section className="analysis-summary" aria-labelledby="analysis-summary-heading">
        <h3 id="analysis-summary-heading">Summary</h3>
        <p className="analysis-summary-text">{result.summary.text}</p>
        <Evidence note={result.summary} item={item} onTranscriptCue={jump} />
        <p className="analysis-attribution">{source} · {analysis.model}</p>
        {analysis.hasOmittedFindings && <p className="analysis-attribution">Some findings were omitted because their quotes did not match the source exactly.</p>}
      </section>
      <AppLinksPanel analysis={analysis} />
      {result.points.length > 0 && <section className="analysis-key-points" aria-labelledby="analysis-points-heading">
        <h3 id="analysis-points-heading">Key points</h3>
        <ol>{result.points.map((point, index) => <li key={index}><p>{point.text}</p><Evidence note={point} item={item} onTranscriptCue={jump} /></li>)}</ol>
      </section>}
    </div>
    {hasReferences && <aside className="analysis-reference" aria-label="References and categories">
      {analysis.links.length > 0 && <section className="analysis-source-links" aria-labelledby="source-links-heading">
        <h3 id="source-links-heading">Links in the source</h3>
        <ul>{analysis.links.map((link) => <li key={link}><a href={link} target="_blank" rel="noreferrer">{link}</a></li>)}</ul>
      </section>}
      {result.mentions.length > 0 && <details className="analysis-more">
        <summary>Mentions <span>{result.mentions.length}</span></summary>
        <ul className="analysis-mentions">{result.mentions.map((mention, index) => <li key={index}>
          <span>{mention.text}</span>
          {(mention.evidence.trim().toLowerCase() !== mention.text.trim().toLowerCase() || mention.timestampMs !== undefined)
            && <Evidence note={mention} item={item} onTranscriptCue={jump} />}
        </li>)}</ul>
      </details>}
      {result.categories.length > 0 && <details className="analysis-more"><summary>Suggested categories <span>{result.categories.length}</span></summary>
        {result.categories.map((category, index) => <CategorySuggestion key={index} name={category.text} evidence={category.evidence} apply={(name) => data.actions.applySuggestedCategory(analysis.savedItemId, name)} />)}
      </details>}
    </aside>}
  </div>
}

function Evidence({ note, item, onTranscriptCue }: { note: { evidence: string; timestampMs?: number }; item: SavedItem; onTranscriptCue?: (cue: TranscriptCue) => void }) {
  const { timestampMs, evidence } = note
  const hasTime = timestampMs !== undefined && Number.isFinite(timestampMs)
  let timestampUrl: string | undefined
  if (item.url && hasTime && item.sourceType === 'youtube') {
    try { const url = new URL(item.url); url.searchParams.set('t', String(Math.floor(timestampMs / 1000))); timestampUrl = url.href }
    catch { /* Invalid stored URLs are not made clickable. */ }
  }
  return <div className="analysis-evidence">
    <details><summary>Source quote</summary><blockquote>{evidence}</blockquote>
      {timestampUrl && hasTime && <a href={timestampUrl} target="_blank" rel="noreferrer">Open video at {formatTimestamp(timestampMs)}</a>}
    </details>
    {hasTime && onTranscriptCue && <button type="button" className="analysis-cue-link" onClick={() => onTranscriptCue({ time: timestampMs, quote: evidence })}>
      Transcript at {formatTimestamp(timestampMs)}
    </button>}
  </div>
}

function formatTimestamp(milliseconds: number) {
  const total = Math.floor(milliseconds / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function CategorySuggestion({ name, evidence, apply }: { name: string; evidence: string; apply: (name: string) => Promise<void> }) {
  const [value, setValue] = useState(name)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus(''); setError(''); setBusy(true)
    try { await apply(value); setStatus('Category added to this item.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'This category could not be added.') }
    finally { setBusy(false) }
  }
  return <form className="analysis-category" onSubmit={(event) => void add(event)}>
    <label className="form-field"><span className="visually-hidden">Category name for {name}</span><input value={value} onChange={(event) => { setValue(event.target.value); setStatus(''); setError('') }} maxLength={80} required /></label>
    <button type="submit" className="quiet-button" disabled={busy || !value.trim() || Boolean(status)}>{status ? 'Added' : 'Add category'}</button>
    <details className="category-evidence"><summary>Source quote</summary><blockquote>{evidence}</blockquote></details>
    {status && <p role="status">{status}</p>}{error && <p role="alert" className="library-error">{error}</p>}
  </form>
}
