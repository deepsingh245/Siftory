import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { analysisFingerprint, analysisId, analysisVersion, getMentionedLinks, prepareAnalysisInput, validateAnalysis } from '../../domain/analysis'
import type { Analysis, AnalysisInput } from '../../domain/analysis'
import type { SavedItem } from '../../domain/library'
import { TEXT_EXTRACTION_VERSION } from '../../domain/processing'
import type { LibraryData } from '../library/useLibraryData'
import { chatgpt } from './chatgptClient'
import type { ChatGptStatus } from './chatgptClient'
import './analysis.css'

type Prepared = { input: AnalysisInput; fingerprint: string; analyses: Analysis[] }

export function AnalysisPanel({ item, data }: { item: SavedItem; data: LibraryData }) {
  const [prepared, setPrepared] = useState<Prepared | null>()
  const [status, setStatus] = useState<ChatGptStatus>()
  const [model, setModel] = useState('')
  const [consentKey, setConsentKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [error, setError] = useState<string>()
  const { getAnalyses, getExtractedContent } = data
  const resultId = data.jobs.find((job) => job.savedItemId === item.id && job.sourceFingerprint === item.sourceFingerprint && job.processingVersion === TEXT_EXTRACTION_VERSION && job.status === 'completed')?.resultId

  useEffect(() => {
    let active = true
    void (async () => {
      const extracted = resultId ? await getExtractedContent(resultId) : undefined
      const input = prepareAnalysisInput(item, extracted)
      if (!input) {
        if (active) setPrepared(null)
        return
      }
      const [fingerprint, analyses] = await Promise.all([analysisFingerprint(input), getAnalyses(item.id)])
      if (active) setPrepared({ input, fingerprint, analyses: analyses.filter((result) => result.version === analysisVersion && result.fingerprint === fingerprint) })
    })().catch(() => { if (active) setError('The local analysis records could not be opened.') })
    return () => { active = false }
  }, [getAnalyses, getExtractedContent, item, resultId])

  const eligible = Boolean(prepared)
  useEffect(() => {
    if (!eligible) return
    const controller = new AbortController()
    const refresh = () => {
      void chatgpt.status(controller.signal).then((next) => {
        if (!controller.signal.aborted) setStatus(next)
      }).catch(() => {
        if (!controller.signal.aborted) setStatus({ state: 'disconnected' })
      })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      controller.abort()
      window.removeEventListener('focus', refresh)
    }
  }, [eligible])

  const connected = status?.state === 'connected' ? status : undefined
  const selectedModel = connected?.models.find(({ slug }) => slug === model)?.slug
    ?? connected?.models.find(({ slug }) => slug === 'gpt-6-sol')?.slug ?? connected?.models[0]?.slug ?? ''
  const results = prepared?.analyses ?? []
  const latest = [...results].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
  const visibleResult = results.find((entry) => entry.model === selectedModel) ?? latest
  const hasCachedResult = results.some((entry) => entry.model === selectedModel)
  const requiredConsent = prepared && selectedModel ? analysisId(item.id, prepared.fingerprint, selectedModel) : undefined
  const consented = Boolean(requiredConsent && consentKey === requiredConsent)

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!prepared || !consented || !selectedModel || busy || hasCachedResult) return
    const { input, fingerprint } = prepared
    try {
      setBusy(true)
      setError(undefined)
      setNotice(undefined)
      const { result } = await chatgpt.analyze(selectedModel, input.text)
      const analysis: Analysis = {
        id: analysisId(item.id, fingerprint, selectedModel), savedItemId: item.id, fingerprint,
        version: analysisVersion, provider: 'chatgpt-plan', model: selectedModel, kind: input.kind, createdAt: new Date().toISOString(),
        result: validateAnalysis(result, input.text), links: getMentionedLinks(input.text, input.truncated),
      }
      await data.actions.saveAnalysis(analysis)
      setPrepared((current) => current?.fingerprint === fingerprint
        ? { ...current, analyses: [...current.analyses.filter((entry) => entry.id !== analysis.id), analysis] }
        : current)
      setNotice('Analysis saved to this item.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This item could not be analyzed.')
    } finally {
      setConsentKey('')
      setBusy(false)
    }
  }

  return (
    <section className="processing-panel analysis-panel" aria-labelledby="analysis-heading" aria-busy={busy}>
      <h2 id="analysis-heading">AI analysis</h2>
      {error && <p className="library-error" role="alert">{error}</p>}
      {notice && <p role="status" className="processing-capability-reason">{notice}</p>}
      {prepared === undefined && !error && <p role="status" className="processing-capability-reason">Checking available text…</p>}
      {prepared === null && <p className="processing-capability-reason">{item.sourceType === 'text' ? 'Extract this file’s text first using the Processing panel.' : 'Analysis needs an imported Instagram caption or text from a local .txt file. Saved links and media alone do not provide text.'}</p>}
      {prepared && <>
        {!connected && <p className="processing-capability-reason"><a href="#/settings">Connect ChatGPT in Settings</a> to analyze this text.</p>}
        {connected && <form className="analysis-options" onSubmit={(event) => void analyze(event)}>
          <label className="form-field"><span>ChatGPT model</span><select value={selectedModel} disabled={busy} onChange={(event) => { setModel(event.target.value); setConsentKey(''); setError(undefined) }}>
            {connected.models.map(({ slug, label }) => <option value={slug} key={slug}>{label}</option>)}
          </select></label>
          {hasCachedResult ? <p className="processing-boundary-note">Showing the saved result for this text and model.</p> : <>
            <details className="processing-history"><summary>Review text to be sent</summary>
              <pre className="analysis-source">{prepared.input.text}</pre>
              {prepared.input.truncated && <p>Only the first {prepared.input.text.length.toLocaleString()} characters will be analyzed.</p>}
            </details>
            <label className="analysis-consent"><input type="checkbox" checked={consented} disabled={busy} onChange={(event) => setConsentKey(event.target.checked ? requiredConsent ?? '' : '')} /><span>Send this {prepared.input.kind === 'caption' ? 'caption' : 'extracted text'} to OpenAI. This may use ChatGPT plan allowance or enabled credits.</span></label>
            <button type="submit" className="primary-button" disabled={!consented || busy}>{busy ? 'Analyzing…' : 'Analyze with ChatGPT'}</button>
          </>}
        </form>}
        {visibleResult && <ResultView key={visibleResult.id} analysis={visibleResult} data={data} />}
      </>}
    </section>
  )
}

function ResultView({ analysis, data }: { analysis: Analysis; data: LibraryData }) {
  const { result } = analysis
  return (
    <div className="analysis-result">
      <p className="processing-boundary-note">Generated with {analysis.model} from {analysis.kind === 'caption' ? 'the saved caption' : 'extracted text'}</p>
      <h3>Summary</h3><p>{result.summary.text}</p><blockquote>{result.summary.evidence}</blockquote>
      {result.points.length > 0 && <><h3>Key points</h3><ul>{result.points.map((point, index) => <li key={index}>{point.text}<blockquote>{point.evidence}</blockquote></li>)}</ul></>}
      {analysis.links.length > 0 && <><h3>Links in the text</h3><ul>{analysis.links.map((link) => <li key={link}><a href={link} target="_blank" rel="noreferrer">{link}</a></li>)}</ul></>}
      {result.mentions.length > 0 && <><h3>Mentions</h3><ul>{result.mentions.map((mention, index) => <li key={index}>{mention.text}<blockquote>{mention.evidence}</blockquote></li>)}</ul></>}
      {result.categories.length > 0 && <><h3>Suggested categories</h3>{result.categories.map((category, index) => <CategorySuggestion key={index} name={category.text} evidence={category.evidence} apply={(name) => data.actions.applySuggestedCategory(analysis.savedItemId, name)} />)}</>}
    </div>
  )
}

function CategorySuggestion({ name, evidence, apply }: { name: string; evidence: string; apply: (name: string) => Promise<void> }) {
  const [value, setValue] = useState(name)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('')
    setError('')
    setBusy(true)
    try {
      await apply(value)
      setStatus('Category added to this item.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This category could not be added.')
    } finally { setBusy(false) }
  }

  return <form className="analysis-category" onSubmit={(event) => void add(event)}>
    <label className="form-field"><span>Category name</span><input value={value} onChange={(event) => { setValue(event.target.value); setStatus(''); setError('') }} maxLength={80} required /></label>
    <button type="submit" className="quiet-button" disabled={busy || !value.trim() || Boolean(status)}>Add category</button>
    <blockquote>{evidence}</blockquote>
    {status && <p role="status">{status}</p>}
    {error && <p role="alert" className="library-error">{error}</p>}
  </form>
}
