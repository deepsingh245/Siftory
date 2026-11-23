import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { MAX_CONFIRMED_ROWS, MAX_IMPORT_DOCUMENT_BYTES, MAX_IMPORT_ROWS, MAX_IMPORT_TOTAL_BYTES, MAX_SOURCE_FILE_BYTES, fingerprintBlob, formatBytes, parseBookmarksHtml, parseInstagramJson, parseManualUrl, parseSourceFile, toImportedItems } from '../../domain/imports'
import type { ImportKind, ImportParseResult, ImportRow } from '../../domain/imports'
import { displayTitle } from '../../domain/library'
import type { LibraryData } from '../library/useLibraryData'

const rowsPerPage = 50

const sources: { id: ImportKind; label: string; description: string }[] = [
  { id: 'instagram', label: 'Instagram JSON', description: 'Review saved records from a JSON export.' },
  { id: 'bookmarks', label: 'Bookmarks HTML', description: 'Import browser bookmarks and their folder paths.' },
  { id: 'url', label: 'A web link', description: 'Add one HTTP or HTTPS link without opening it.' },
  { id: 'file', label: 'PDF or text files', description: 'Keep original files on this device and extract text from .txt files.' },
]

function candidateTitle(row: ImportRow): string {
  if (!row.draft) return 'Could not read this record'
  return displayTitle({
    ...row.draft,
    id: row.id,
    title: row.draft.title,
    sourceType: row.draft.sourceType,
    contentType: row.draft.contentType,
    createdAt: '', updatedAt: '', status: 'inbox',
    collectionIds: [], categoryIds: [], tagIds: [],
  })
}

function identifyDuplicates(rows: ImportRow[], items: LibraryData['items']): ImportRow[] {
  const titles = new Map<string, { id: string; title: string }>()
  for (const item of items) {
    const key = item.title.trim().toLocaleLowerCase()
    if (key) titles.set(key, { id: item.id, title: displayTitle(item) })
  }
  const sourceRecords = new Map<string, { id: string; title: string }>(items.flatMap((item) => item.sourceRecordId ? [[`${item.sourceType}:${item.sourceRecordId}`, { id: item.id, title: displayTitle(item) }] as const] : []))
  const urls = new Map(items.flatMap((item) => item.canonicalUrl ? [[item.canonicalUrl, { id: item.id, title: displayTitle(item) }] as const] : []))
  const fingerprints = new Map(items.flatMap((item) => item.sourceFingerprint ? [[item.sourceFingerprint, { id: item.id, title: displayTitle(item) }] as const] : []))
  const importKeys = new Map(items.flatMap((item) => item.importRecordKey ? [[item.importRecordKey, { id: item.id, title: displayTitle(item) }] as const] : []))
  const seenUrls = new Map<string, { id: string; title: string }>()
  const seenFingerprints = new Map<string, { id: string; title: string }>()
  const seenSourceRecords = new Map<string, { id: string; title: string }>()
  const seenTitles = new Map<string, { id: string; title: string }>()
  let selectedCount = 0
  return rows.map((row) => {
    const canonical = row.draft?.url ? new URL(row.draft.url).href.replace(/#.*$/, '') : undefined
    const sourceRecordKey = row.draft && row.sourceRecordId ? `${row.draft.sourceType}:${row.sourceRecordId}` : undefined
    const titleKey = row.draft?.title.trim().toLocaleLowerCase()
    const exactDuplicate = (sourceRecordKey && (sourceRecords.get(sourceRecordKey) || seenSourceRecords.get(sourceRecordKey)))
      || (canonical && (urls.get(canonical) || seenUrls.get(canonical)))
      || (row.sourceFingerprint && (fingerprints.get(row.sourceFingerprint) || seenFingerprints.get(row.sourceFingerprint)))
      || (row.importRecordKey && importKeys.get(row.importRecordKey))
    const possibleDuplicate = !exactDuplicate && titleKey ? titles.get(titleKey) || seenTitles.get(titleKey) : undefined
    const duplicate = exactDuplicate || possibleDuplicate
    if (canonical) seenUrls.set(canonical, { id: row.id, title: candidateTitle(row) })
    if (row.sourceFingerprint) seenFingerprints.set(row.sourceFingerprint, { id: row.id, title: candidateTitle(row) })
    if (sourceRecordKey) seenSourceRecords.set(sourceRecordKey, { id: row.id, title: candidateTitle(row) })
    if (titleKey) seenTitles.set(titleKey, { id: row.id, title: candidateTitle(row) })
    if (!duplicate) {
      const selected = row.selected && selectedCount < MAX_CONFIRMED_ROWS
      if (selected) selectedCount += 1
      return { ...row, selected }
    }
    const exact = Boolean(exactDuplicate)
    const selected = exact ? false : row.selected && selectedCount < MAX_CONFIRMED_ROWS
    if (selected) selectedCount += 1
    return {
      ...row,
      duplicateOf: { ...duplicate, kind: exact ? 'exact' : 'possible' },
      selected,
      warnings: row.warnings,
    }
  })
}

export function ImportPage({ data }: { data: LibraryData }) {
  const [kind, setKind] = useState<ImportKind>('instagram')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [working, setWorking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedRowIds, setSavedRowIds] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(0)
  const [saveStatus, setSaveStatus] = useState<string>()
  const [saveError, setSaveError] = useState<string>()

  function changeKind(next: ImportKind) {
    setKind(next)
    clearPreview()
  }

  function clearPreview() {
    setRows([])
    setParseErrors([])
    setSavedRowIds(new Set())
    setPage(0)
    setSaveStatus(undefined)
    setSaveError(undefined)
  }

  function acceptResult(result: ImportParseResult) {
    setRows(identifyDuplicates(result.rows, data.items))
    setParseErrors(result.errors)
    setSavedRowIds(new Set())
    setPage(0)
    setSaveStatus(undefined)
    setSaveError(undefined)
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    clearPreview()
    setWorking(true)
    try {
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
      if (totalBytes > MAX_IMPORT_TOTAL_BYTES) {
        setParseErrors([`Selected files total more than ${formatBytes(MAX_IMPORT_TOTAL_BYTES)}. Choose fewer or smaller files.`])
        return
      }
      if (files.length > MAX_IMPORT_ROWS) {
        setParseErrors([`Choose no more than ${MAX_IMPORT_ROWS} files at once.`])
        return
      }
      if (kind === 'instagram' || kind === 'bookmarks') {
        if (files.length !== 1) {
          setParseErrors(['Choose one export file at a time.'])
          return
        }
        const file = files[0]
        if (file.size > MAX_IMPORT_DOCUMENT_BYTES) {
          setParseErrors([`${file.name} exceeds the ${formatBytes(MAX_IMPORT_DOCUMENT_BYTES)} import-document limit.`])
          return
        }
        const ext = file.name.toLowerCase().split('.').pop()
        if (kind === 'instagram' && ext !== 'json') {
          setParseErrors(['Choose an Instagram JSON export (.json).'])
          return
        }
        if (kind === 'bookmarks' && ext !== 'html' && ext !== 'htm') {
          setParseErrors(['Choose a browser bookmarks HTML export (.html or .htm).'])
          return
        }
        const text = await file.text()
        if (kind === 'instagram') {
          const result = parseInstagramJson(text)
          if (result.rows.length) {
            const fingerprint = await fingerprintBlob(file)
            result.rows.forEach((row, index) => { row.importRecordKey = `${fingerprint}:${index}` })
          }
          acceptResult(result)
        } else {
          acceptResult(parseBookmarksHtml(text))
        }
        return
      }

      const results = await Promise.all(files.map(parseSourceFile))
      const combined = results.flatMap((result) => result.rows)
      const errors = results.flatMap((result) => result.errors)
      if (combined.length > MAX_IMPORT_ROWS) {
        setParseErrors([`This selection contains more than ${MAX_IMPORT_ROWS} records.`])
        return
      }
      acceptResult({ rows: combined, errors })
    } catch (cause) {
      setParseErrors([cause instanceof Error ? cause.message : 'The selected file could not be read.'])
    } finally {
      setWorking(false)
    }
  }

  function previewUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    acceptResult(parseManualUrl(url, title))
  }

  function toggleRow(id: string, selected: boolean) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, selected } : row))
  }

  function updateDraft(id: string, field: 'title' | 'description', value: string) {
    setRows((current) => current.map((row) => row.id === id && row.draft
      ? { ...row, draft: { ...row.draft, [field]: value } }
      : row))
  }

  function selectNextBatch() {
    const alreadySelected = rows.filter((row) => row.selected).length
    const next = rows.filter((row) => !row.selected && selectAutomatically(row)).slice(0, MAX_CONFIRMED_ROWS - alreadySelected)
    const selected = new Set(next.map((row) => row.id))
    if (!next.length) return
    setRows((current) => current.map((row) => selected.has(row.id) ? { ...row, selected: true } : row))
    setPage(Math.floor(rows.indexOf(next[0]) / rowsPerPage))
  }

  function selectAutomatically(row: ImportRow) {
    return row.draft && !row.errors.length && !savedRowIds.has(row.id) && row.duplicateOf?.kind !== 'exact'
  }

  async function saveSelected() {
    const selected = rows.filter((row) => row.selected && row.draft && row.errors.length === 0)
    if (!selected.length) return
    if (selected.length > MAX_CONFIRMED_ROWS) {
      setSaveError(`Select no more than ${MAX_CONFIRMED_ROWS} records per import batch.`)
      return
    }
    setSaving(true)
    setSaveError(undefined)
    setSaveStatus(undefined)
    try {
      const { items, files } = toImportedItems(selected)
      const rowByItem = new Map(items.map((item, index) => [item.id, selected[index]]))
      const explicitlyKept = new Set(items.filter((item) => rowByItem.get(item.id)?.duplicateOf?.kind === 'exact').map((item) => item.id))
      const { savedIds, duplicates } = await data.actions.saveImportedBatch(items, files, explicitlyKept)
      const savedRows = savedIds.flatMap((id) => rowByItem.get(id)?.id ?? [])
      const skipped = new Map(duplicates.map(({ itemId, existing }) => [rowByItem.get(itemId)?.id, existing]))
      setSavedRowIds((current) => new Set([...current, ...savedRows]))
      const saved = new Set(savedRows)
      setRows((current) => current.map((row) => {
        const duplicate = skipped.get(row.id)
        if (duplicate) return { ...row, selected: false, duplicateOf: { id: duplicate.id, title: displayTitle(duplicate), kind: 'exact' } }
        return saved.has(row.id) ? { ...row, selected: false } : row
      }))
      setSaveStatus(`Saved ${savedIds.length} ${savedIds.length === 1 ? 'item' : 'items'} to your Inbox.${duplicates.length ? ` ${duplicates.length} already in the library and ready for duplicate review.` : ''}`)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'The import was not saved. Your selected records are still available to retry.')
    } finally {
      setSaving(false)
    }
  }

  const validCount = rows.filter((row) => row.draft && row.errors.length === 0).length
  const duplicateCount = rows.filter((row) => row.duplicateOf?.kind === 'exact' && !savedRowIds.has(row.id)).length
  const selectedCount = rows.filter((row) => row.selected && row.draft && row.errors.length === 0).length
  const pageCount = Math.ceil(rows.length / rowsPerPage)
  const pageRows = rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage)
  const fileAccept = kind === 'instagram' ? '.json,application/json' : kind === 'bookmarks' ? '.html,.htm,text/html' : '.pdf,.txt,application/pdf,text/plain'

  return (
    <PageLayout title="Bring things in" description="Review every record before it enters your Inbox. Your files stay on this device." aria-busy={working || saving}>

      <fieldset className="import-source-picker" disabled={working || saving}>
        <legend>Choose what to import</legend>
        {sources.map((source) => (
          <label className={`import-source-option${kind === source.id ? ' import-source-option--active' : ''}`} key={source.id}>
            <input type="radio" name="import-source" checked={kind === source.id} onChange={() => changeKind(source.id)} />
            <span><strong>{source.label}</strong><small>{source.description}</small></span>
          </label>
        ))}
      </fieldset>

      <div className="import-input-panel">
        {kind === 'url' ? (
          <form className="import-url-form" onSubmit={previewUrl}>
            <label className="form-field"><span>Web link</span><input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/..." required /></label>
            <label className="form-field"><span>Title <small>(optional)</small></span><input value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} placeholder="A name you'll recognize" /></label>
            <p className="form-explainer">Siftory will not open this link or fetch page information.</p>
            <button className="primary-button" type="submit" disabled={working || saving}>Preview link</button>
          </form>
        ) : (
          <label className="import-file-picker">
            <span className="import-file-icon" aria-hidden="true">↑</span>
            <strong aria-live="polite">{working ? 'Reading locally…' : kind === 'instagram' ? 'Choose Instagram JSON export' : kind === 'bookmarks' ? 'Choose bookmarks HTML export' : 'Choose PDF or text files'}</strong>
            <small>{kind === 'file' ? `Up to ${formatBytes(MAX_SOURCE_FILE_BYTES)} per file and ${formatBytes(MAX_IMPORT_TOTAL_BYTES)} total.` : `One file up to ${formatBytes(MAX_IMPORT_DOCUMENT_BYTES)}.`}</small>
            <input type="file" accept={fileAccept} multiple={kind === 'file'} onChange={(event) => void handleFiles(event)} disabled={working || saving} />
          </label>
        )}
      </div>

      <p className="import-privacy-note">Importing only reads the file you choose. Links are stored as references and are never fetched. Browser storage is local to this device and is not a backup.</p>
      {parseErrors.length > 0 && <div className="import-errors" role="alert"><strong>Could not prepare this import</strong><ul>{parseErrors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>}

      {rows.length > 0 && (
        <section className="import-preview" aria-labelledby="import-preview-heading">
          <div className="import-preview-heading">
            <div><p className="library-eyebrow">REVIEW BEFORE SAVING</p><h2 id="import-preview-heading">Import preview</h2></div>
            <span>{savedRowIds.size} saved · {validCount - savedRowIds.size - duplicateCount} ready · {duplicateCount} exact matches · {rows.length - validCount} need attention</span>
          </div>
          {rows.length > MAX_CONFIRMED_ROWS && <p className="import-limit-note">Save up to {MAX_CONFIRMED_ROWS} records per batch. Remaining rows stay in this preview. If you leave or reload, reopen the same export to continue. Unsaved edits stay in this preview.</p>}
          {pageCount > 1 && <nav className="processing-actions" aria-label="Import preview pages">
            <button type="button" className="quiet-button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</button>
            <span role="status">Page {page + 1} of {pageCount} · {selectedCount} selected across pages</span>
            <button type="button" className="quiet-button" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Next page</button>
          </nav>}
          <ul className="import-row-list">
            {pageRows.map((row) => (
              <li className={`import-row${row.errors.length ? ' import-row--invalid' : ''}`} key={row.id}>
                <label className="import-row-select">
                  <input type="checkbox" aria-label={`Select ${candidateTitle(row)}`} checked={row.selected} disabled={!row.draft || row.errors.length > 0 || saving || savedRowIds.has(row.id) || (selectedCount >= MAX_CONFIRMED_ROWS && !row.selected)} onChange={(event) => toggleRow(row.id, event.target.checked)} />
                  <span className="import-row-content">
                    {row.draft?.url && <span className="import-row-url">{row.draft.url}</span>}
                    {row.draft?.creatorName && <span>By {row.draft.creatorName}</span>}
                    {row.sourceFileName && <span>{row.sourceFileName} · {formatBytes(row.sourceSize ?? 0)}</span>}
                  </span>
                </label>
                {row.draft && <div className="import-row-edit">
                  <label className="import-edit-field"><span>Title</span><input value={row.draft.title} maxLength={300} onChange={(event) => updateDraft(row.id, 'title', event.target.value)} disabled={saving || savedRowIds.has(row.id) || row.errors.length > 0} /></label>
                  <label className="import-edit-field"><span>Description or caption <small>· original source values are retained</small></span><textarea value={row.draft.description ?? ''} rows={2} onChange={(event) => updateDraft(row.id, 'description', event.target.value)} disabled={saving || savedRowIds.has(row.id) || row.errors.length > 0} /></label>
                </div>}
                {(row.errors.length > 0 || row.warnings.length > 0) && (
                  <div className={row.errors.length ? 'import-row-diagnostics import-row-diagnostics--error' : 'import-row-diagnostics'}>
                    {[...row.errors, ...row.warnings].map((message, index) => <p key={`${index}-${message}`}>{message}</p>)}
                  </div>
                )}
                {row.duplicateOf?.kind === 'exact' && <p className="import-duplicate-note">This exact source identifier, URL, or file also exists as <strong>{row.duplicateOf.title}</strong>. It will be kept as a separate item only if selected.</p>}
                {row.duplicateOf?.kind === 'possible' && <p className="import-duplicate-note">The title matches <strong>{row.duplicateOf.title}</strong>. Review the source details; title matches are never merged automatically.</p>}
                {savedRowIds.has(row.id) && <p className="import-row-result import-row-result--saved">Saved to Inbox</p>}
              </li>
            ))}
          </ul>
          {saveError && <p className="library-error" role="alert">{saveError}</p>}
          {saveStatus && <p className="import-success" role="status">{saveStatus}</p>}
          <div className="form-actions import-actions">
              <button className="primary-button" type="button" onClick={() => void saveSelected()} disabled={saving || selectedCount === 0}>{saving ? 'Saving selected records…' : `Save ${selectedCount} to Inbox`}</button>
              {rows.some((row) => !row.selected && selectAutomatically(row)) && <button className="quiet-button" type="button" onClick={selectNextBatch} disabled={saving || selectedCount >= MAX_CONFIRMED_ROWS}>Select next batch</button>}
              <button className="quiet-button" type="button" onClick={clearPreview} disabled={saving}>Clear preview</button>
          </div>
          <p className="import-atomicity-note">Selected records and source files save together. A storage error rolls back the current batch, leaving it available to retry.</p>
        </section>
      )}
    </PageLayout>
  )
}
