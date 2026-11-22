import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createTranscriptContent, parseTranscript, parseTranscriptFile, type TranscriptContent } from '../../domain/transcripts'
import type { SavedItem } from '../../domain/library'
import type { LibraryData } from './useLibraryData'

export function TranscriptPanel({ item, data }: { item: SavedItem; data: LibraryData }) {
  const [transcriptState, setTranscriptState] = useState<{ id: string; value: TranscriptContent }>()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File>()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const getTranscript = data.getTranscript
  const attachTranscript = data.actions.attachTranscript
  const removeTranscript = data.actions.removeTranscript
  const transcript = transcriptState && transcriptState.id === item.transcriptId ? transcriptState.value : undefined

  useEffect(() => {
    let active = true
    if (item.transcriptId) void getTranscript(item.transcriptId).then((value) => { if (active && value) setTranscriptState({ id: item.transcriptId!, value }) }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'The saved transcript could not be opened.') })
    return () => { active = false }
  }, [getTranscript, item.transcriptId])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setStatus('')
    try {
      if (transcript && !window.confirm('Replace the transcript attached to this item? Its transcript analysis will also be removed.')) return
      let parsed
      let origin: 'pasted' | 'text-file' | 'srt-file' | 'vtt-file'
      let options: Parameters<typeof createTranscriptContent>[3] = {}
      if (file) {
        const imported = await parseTranscriptFile(file)
        parsed = imported.parsed; origin = imported.origin
        options = { fileName: file.name, mediaType: file.type || 'text/plain', sourceFingerprint: imported.fingerprint, sourceBlob: file }
      } else {
        parsed = parseTranscript(text, 'text'); origin = 'pasted'; options = { pastedText: text }
      }
      const record = await createTranscriptContent(item.id, parsed, origin, options)
      await attachTranscript(record)
      setTranscriptState({ id: record.id, value: record }); setText(''); setFile(undefined); setStatus('Transcript saved locally and attached to this item.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The transcript could not be saved.') }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!window.confirm('Remove this transcript and its transcript analysis from the local library? The original saved item and its description will remain.')) return
    setBusy(true); setError(''); setStatus('')
    try { await removeTranscript(item.id); setTranscriptState(undefined); setStatus('Transcript removed from this item.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The transcript could not be removed.') }
    finally { setBusy(false) }
  }

  if (!['youtube', 'instagram'].includes(item.sourceType)) return null
  return <section className="processing-panel" aria-labelledby="transcript-heading" aria-busy={busy}>
    <h2 id="transcript-heading">User-provided transcript</h2>
    <p className="processing-boundary-note">Siftory does not fetch or verify media transcripts. Attach text you provide; it stays local until you separately review and consent to AI analysis.</p>
    {error && <p className="library-error" role="alert">{error}</p>}{status && <p role="status">{status}</p>}
    {transcript ? <>
      <p>Attached {new Date(transcript.importedAt).toLocaleString()} · {transcript.origin.replace('-', ' ')}{transcript.fileName ? ` · ${transcript.fileName}` : ''} · {transcript.text.length.toLocaleString()} characters · {transcript.segments.length.toLocaleString()} timed segments</p>
      <details><summary>View saved transcript</summary><pre className="analysis-source">{transcript.text}</pre></details>
      <button className="quiet-button danger-button" type="button" disabled={busy} onClick={() => void remove()}>Remove transcript</button>
    </> : <p className="processing-capability-reason">No transcript is attached. The saved description or caption remains separate.</p>}
    <form className="record-form" onSubmit={(event) => void save(event)}>
      <label className="form-field"><span>{transcript ? 'Replace with pasted transcript' : 'Paste transcript text'}</span><textarea value={text} onChange={(event) => { setText(event.target.value); setFile(undefined) }} maxLength={100_000} rows={7} placeholder="Paste text copied or transcribed by you" /></label>
      <label className="form-field"><span>{transcript ? 'Or replace with transcript file' : 'Or choose a transcript file'}</span><input type="file" accept=".txt,.srt,.vtt,text/plain,text/vtt,application/x-subrip" onChange={(event) => { setFile(event.target.files?.[0]); if (event.target.files?.[0]) setText('') }} /></label>
      <p className="processing-boundary-note">Supported: .txt, .srt, .vtt · up to 20 MiB per file and 100,000 transcript characters.</p>
      <button className="primary-button" type="submit" disabled={busy || (!file && !text.trim())}>{busy ? 'Saving transcript…' : transcript ? 'Replace transcript' : 'Attach transcript'}</button>
    </form>
  </section>
}
