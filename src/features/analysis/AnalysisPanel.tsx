import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { analysisFingerprint, analysisVersion, prepareAnalysisInput } from '../../domain/analysis'
import type { Analysis } from '../../domain/analysis'
import type { SavedItem } from '../../domain/library'
import { TEXT_EXTRACTION_VERSION } from '../../domain/processing'
import type { LibraryData } from '../library/useLibraryData'
import { AnalysisBatchReview } from './AnalysisBatchReview'
import './analysis.css'

export function AnalysisPanel({ item, data }: { item: SavedItem; data: LibraryData }) {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [available, setAvailable] = useState<boolean>()
  const [error, setError] = useState<string>()
  const { getAnalyses, getExtractedContent } = data
  const resultId = data.jobs.find((job) => job.savedItemId === item.id && job.sourceFingerprint === item.sourceFingerprint && job.processingVersion === TEXT_EXTRACTION_VERSION && job.status === 'completed')?.resultId
  const completionMarker = data.analysisJobs.filter((job) => job.savedItemId === item.id && job.status === 'completed').map((job) => job.updatedAt).join('|')

  useEffect(() => {
    let active = true
    void (async () => {
      const extracted = resultId ? await getExtractedContent(resultId) : undefined
      const input = prepareAnalysisInput(item, extracted)
      if (!input) { if (active) { setAvailable(false); setAnalyses([]) }; return }
      const [fingerprint, saved] = await Promise.all([analysisFingerprint(input), getAnalyses(item.id)])
      if (active) { setAvailable(true); setAnalyses(saved.filter((entry) => entry.version === analysisVersion && entry.fingerprint === fingerprint)) }
    })().catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'The local analysis records could not be opened.') })
    return () => { active = false }
  }, [getAnalyses, getExtractedContent, item, resultId, completionMarker])

  const visibleResult = [...analyses].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
  return <section className="processing-panel analysis-panel" aria-labelledby="analysis-heading">
    <h2 id="analysis-heading">AI analysis</h2>
    {error && <p className="library-error" role="alert">{error}</p>}
    {available === undefined && !error && <p role="status" className="processing-capability-reason">Checking available text…</p>}
    {available === false && <p className="processing-capability-reason">{item.sourceType === 'text' ? 'Extract this file’s text first using the Processing panel.' : 'Analysis needs an imported Instagram caption or text from a local .txt file. Saved links and media alone do not provide text.'}</p>}
    {available && <><AnalysisBatchReview itemIds={[item.id]} data={data} />{visibleResult && <ResultView key={visibleResult.id} analysis={visibleResult} data={data} />}</>}
  </section>
}

function ResultView({ analysis, data }: { analysis: Analysis; data: LibraryData }) {
  const { result } = analysis
  return <div className="analysis-result">
    <p className="processing-boundary-note">Generated with {analysis.model} from {analysis.kind === 'caption' ? 'the saved caption' : 'extracted text'}</p>
    <h3>Summary</h3><p>{result.summary.text}</p><blockquote>{result.summary.evidence}</blockquote>
    {result.points.length > 0 && <><h3>Key points</h3><ul>{result.points.map((point, index) => <li key={index}>{point.text}<blockquote>{point.evidence}</blockquote></li>)}</ul></>}
    {analysis.links.length > 0 && <><h3>Links in the text</h3><ul>{analysis.links.map((link) => <li key={link}><a href={link} target="_blank" rel="noreferrer">{link}</a></li>)}</ul></>}
    {result.mentions.length > 0 && <><h3>Mentions</h3><ul>{result.mentions.map((mention, index) => <li key={index}>{mention.text}<blockquote>{mention.evidence}</blockquote></li>)}</ul></>}
    {result.categories.length > 0 && <><h3>Suggested categories</h3>{result.categories.map((category, index) => <CategorySuggestion key={index} name={category.text} evidence={category.evidence} apply={(name) => data.actions.applySuggestedCategory(analysis.savedItemId, name)} />)}</>}
  </div>
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
    <label className="form-field"><span>Category name</span><input value={value} onChange={(event) => { setValue(event.target.value); setStatus(''); setError('') }} maxLength={80} required /></label>
    <button type="submit" className="quiet-button" disabled={busy || !value.trim() || Boolean(status)}>Add category</button><blockquote>{evidence}</blockquote>
    {status && <p role="status">{status}</p>}{error && <p role="alert" className="library-error">{error}</p>}
  </form>
}
