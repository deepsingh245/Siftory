import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Disclosure } from '@/components/ui/disclosure'
import { createTranscriptContent, parseTranscript, parseTranscriptFile, type TranscriptContent, type TranscriptOrigin } from '../../domain/transcripts'
import type { SavedItem } from '../../domain/library'
import type { LibraryData } from './useLibraryData'
import { downloadLocalAudio, localAudioUrl } from '../media/localMedia'

function formatTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function subtitleTime(milliseconds: number) {
  const hours = String(Math.floor(milliseconds / 3_600_000)).padStart(2, '0')
  return hours + new Date(milliseconds).toISOString().slice(13, 23).replace('.', ',')
}

export type TranscriptCue = { time: number; quote: string }

export function TranscriptPanel({ item, data, cue, active }: { item: SavedItem; data: LibraryData; cue?: TranscriptCue; active: boolean }) {
  const [transcriptState, setTranscriptState] = useState<{ id: string; value: TranscriptContent }>()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File>()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [editText, setEditText] = useState<string>()
  const audio = useRef<HTMLAudioElement>(null)
  const cueRow = useRef<HTMLLIElement>(null)
  const getTranscript = data.getTranscript
  const transcript = transcriptState && transcriptState.id === item.transcriptId ? transcriptState.value : undefined
  const cueIndex = cue && transcript ? transcript.segments.findIndex((segment) => segment.startMs === cue.time && segment.text.includes(cue.quote.trim())) : -1

  useEffect(() => {
    if (!cue || !cueRow.current) return
    cueRow.current.focus({ preventScroll: true })
    cueRow.current.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [cue, cueIndex])

  useEffect(() => {
    if (!active && audio.current && !audio.current.paused) audio.current.pause()
  }, [active])

  useEffect(() => {
    let active = true
    const id = item.transcriptId
    if (id) void getTranscript(id).then((value) => {
      if (!active) return
      if (value) setTranscriptState({ id, value })
      else setError('The saved transcript is missing.')
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'The saved transcript could not be opened.') })
    return () => { active = false }
  }, [getTranscript, item.transcriptId])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setStatus('')
    try {
      if (transcript && !window.confirm('Replace the transcript attached to this item? Its transcript analysis will also be removed.')) return
      let parsed
      let origin: TranscriptOrigin
      let options: Parameters<typeof createTranscriptContent>[3] = {}
      if (file) {
        const imported = await parseTranscriptFile(file)
        parsed = imported.parsed; origin = imported.origin
        options = { fileName: file.name, mediaType: file.type || 'text/plain', sourceFingerprint: imported.fingerprint, sourceBlob: file }
      } else {
        parsed = parseTranscript(text, 'text'); origin = 'pasted'; options = { pastedText: text }
      }
      const record = await createTranscriptContent(item.id, parsed, origin, options)
      await data.actions.attachTranscript(record)
      setTranscriptState({ id: record.id, value: record }); setText(''); setFile(undefined); setStatus('Transcript saved locally and attached to this item.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The transcript could not be saved.') }
    finally { setBusy(false) }
  }

  async function remove() {
    if (!window.confirm('Remove this transcript and its transcript analysis from the local library? The original saved item and its description will remain.')) return
    setBusy(true); setError(''); setStatus('')
    try { await data.actions.removeTranscript(item.id); setTranscriptState(undefined); setStatus('Transcript removed from this item.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The transcript could not be removed.') }
    finally { setBusy(false) }
  }

  async function downloadAudio() {
    if (!transcript?.audioSourceKey) return
    setError('')
    try { await downloadLocalAudio(transcript.audioSourceKey) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The local audio could not be downloaded.') }
  }

  async function confirmTranscript() {
    if (!transcript) return
    setBusy(true)
    setError('')
    try {
      const confirmedAt = new Date().toISOString()
      const reviewed = { ...transcript, reviewedAt: transcript.reviewedAt ?? confirmedAt, confirmedAt }
      await data.actions.attachTranscript(reviewed)
      setTranscriptState({ id: reviewed.id, value: reviewed })
      setStatus('Transcript marked as confirmed.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The review could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function saveEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!transcript || editText === undefined) return
    setBusy(true)
    setError('')
    try {
      const parsed = parseTranscript(editText, transcript.segments.length ? 'srt' : 'text')
      const next = await createTranscriptContent(item.id, { ...parsed, format: transcript.format }, transcript.origin, {
        fileName: transcript.fileName, mediaType: transcript.mediaType, sourceFingerprint: transcript.sourceFingerprint,
        sourceBlob: transcript.sourceBlob, pastedText: transcript.pastedText, asrModel: transcript.asrModel, audioSourceKey: transcript.audioSourceKey,
      }, new Date(transcript.importedAt))
      const edited = { ...next, reviewedAt: new Date().toISOString() }
      if (edited.id !== transcript.id && !window.confirm('Save these edits? Previous analysis of this transcript will be removed.')) return
      if (edited.id !== transcript.id) await data.actions.attachTranscript(edited)
      setTranscriptState({ id: edited.id, value: edited.id === transcript.id ? transcript : edited })
      setEditText(undefined)
      setStatus('Transcript edits saved.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The transcript edits could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  if (!['youtube', 'instagram'].includes(item.sourceType)) return null
  const generated = transcript?.origin === 'local-asr'
  const audioUrl = transcript?.audioSourceKey && localAudioUrl(transcript.audioSourceKey)
  const transcriptStatus = transcript?.confirmedAt ? 'Confirmed' : transcript?.reviewedAt ? 'Reviewed · edited' : generated ? 'Generated · needs review' : 'Provided by you'
  const loading = Boolean(item.transcriptId && !transcript && !error)
  return <section className="processing-panel transcript-panel" aria-labelledby="transcript-heading" aria-busy={busy}>
    <div className="reading-section-heading">
      <h2 id="transcript-heading">Transcript</h2>
      <span className={`reading-status ${transcript?.confirmedAt ? 'reading-status--ready' : ''}`}>{transcript ? transcriptStatus : loading ? 'Opening transcript…' : item.transcriptId ? 'Unavailable' : 'No transcript'}</span>
    </div>
    {error && <p className="library-error" role="alert">{error}</p>}{status && <p className="inline-success" role="status">{status}</p>}
    {transcript ? <>
      <p className="transcript-provenance">{generated ? 'Created by local speech recognition' : 'Added by you'} · {new Date(transcript.importedAt).toLocaleDateString()}{transcript.fileName ? ` · ${transcript.fileName}` : ''}{transcript.segments.length ? ` · ${transcript.segments.length.toLocaleString()} timed segments` : ''}</p>
      {generated && !transcript.confirmedAt && <p className="transcript-review-note">Check the words against the audio before using them as evidence.</p>}
      {audioUrl && <div className="transcript-audio">
        <strong>Source audio</strong>
        <audio key={audioUrl} ref={audio} controls preload={active ? 'metadata' : 'none'} src={audioUrl} aria-label="Source audio" onError={() => setError('The local audio could not be played.')}>Your browser cannot play this audio.</audio>
        <button className="text-link-button" type="button" onClick={() => void downloadAudio()}>Download audio</button>
      </div>}
      <div className="transcript-reading" aria-label="Saved transcript">
        {transcript.segments.length ? <ol className="transcript-segments">{transcript.segments.map((segment, index) => <li key={`${segment.startMs}-${index}`} ref={index === cueIndex ? cueRow : undefined} tabIndex={index === cueIndex ? -1 : undefined} data-evidence-match={index === cueIndex || undefined}>
          {audioUrl ? <button className="timestamp-button" type="button" aria-label={`Seek to ${formatTime(segment.startMs)}`} onClick={() => { if (audio.current) audio.current.currentTime = segment.startMs / 1000 }}>{formatTime(segment.startMs)}</button> : <time>{formatTime(segment.startMs)}</time>}
          <p>{segment.text}</p>
        </li>)}</ol> : <div className="transcript-plain">{transcript.text}</div>}
      </div>
      {!transcript.confirmedAt && <button className="quiet-button transcript-confirm" type="button" disabled={busy} onClick={() => void confirmTranscript()}>Confirm transcript</button>}
    </> : !loading && <div className="transcript-empty"><p>Attach spoken text to read it here and use it in analysis.</p>{item.autoTranscriptDismissed && <button className="quiet-button" type="button" onClick={() => { void data.actions.allowAutoTranscript(item.id).then(() => setStatus('Automatic local transcript attachment is enabled again.')).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not enable automatic attachment.')) }}>Allow automatic local transcript again</button>}</div>}
    {!loading && <Disclosure key={transcript ? 'manage' : 'attach'} className="transcript-edit" defaultOpen={!transcript}
      label={transcript ? 'Manage transcript' : 'Attach a transcript'}>
      {transcript && editText === undefined && <button className="quiet-button" type="button" onClick={() => setEditText(transcript.segments.length
        ? transcript.segments.map((segment, index) => `${index + 1}\n${subtitleTime(segment.startMs)} --> ${subtitleTime(segment.endMs)}\n${segment.text}`).join('\n\n') : transcript.text)}>Edit saved text</button>}
      {editText !== undefined && <form onSubmit={(event) => void saveEdits(event)}>
        <label className="form-field"><span>{transcript?.segments.length ? 'Timed subtitle text (SRT)' : 'Transcript text'}</span><textarea rows={9} value={editText} onChange={(event) => setEditText(event.target.value)} /></label>
        <div className="transcript-edit-actions">
          <button className="primary-button" type="submit" disabled={busy || !editText.trim()}>Save edits</button>
          <button className="quiet-button" type="button" onClick={() => setEditText(undefined)}>Cancel</button>
        </div>
      </form>}
      {editText === undefined && <>
      <p className="processing-boundary-note">Use your own text or a .txt, .srt, or .vtt file. Text stays local until you separately review and consent to AI analysis.</p>
      <form onSubmit={(event) => void save(event)}>
        <label className="form-field"><span>Paste transcript text</span><textarea value={text} onChange={(event) => { setText(event.target.value); setFile(undefined) }} maxLength={100_000} rows={5} placeholder="Paste text copied or transcribed by you" /></label>
        <label className="form-field"><span>Or choose a transcript file</span><input type="file" accept=".txt,.srt,.vtt,text/plain,text/vtt,application/x-subrip" onChange={(event) => { setFile(event.target.files?.[0]); if (event.target.files?.[0]) setText('') }} /></label>
        <p className="processing-boundary-note">Maximum 20 MiB per file and 100,000 transcript characters. Replacing text removes its previous AI analysis.</p>
        <div className="transcript-edit-actions"><button className="primary-button" type="submit" disabled={busy || (!file && !text.trim())}>{busy ? 'Saving transcript…' : transcript ? 'Replace transcript' : 'Attach transcript'}</button>{transcript && <button className="quiet-button danger-button" type="button" disabled={busy} onClick={() => void remove()}>Remove transcript</button>}</div>
      </form>
      </>}
    </Disclosure>}
  </section>
}
