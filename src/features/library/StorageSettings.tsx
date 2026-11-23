import { useEffect, useState } from 'react'
import { backupBrowserLibrary, getStorageStatus, type StorageStatus } from '../../infrastructure/persistence/localLibrary'
import type { LibraryData } from './useLibraryData'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

export function StorageSettings({ refresh }: { refresh: LibraryData['refresh'] }) {
  const [storage, setStorage] = useState<StorageStatus>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    void getStorageStatus().then((status) => { if (active) setStorage(status) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Storage status is unavailable.') })
    return () => { active = false }
  }, [])

  async function moveLibrary() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const backup = await backupBrowserLibrary(true)
      setMessage(`The seven imports moved to SQLite. Verified browser backup saved as ${backup.fileName}.`)
      await refresh()
      setStorage(await getStorageStatus())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The library could not be moved.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="storage-settings processing-panel" aria-labelledby="storage-heading" aria-busy={busy}>
    <h2 id="storage-heading">Local storage</h2>
    {error && <p className="library-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!storage && !error && <p role="status">Checking library storage…</p>}
    {storage?.active && <>
      <p>{storage.counts.savedItems} saved items in SQLite</p>
      <dl className="storage-breakdown">
        <div><dt>Database</dt><dd>{formatBytes(storage.databaseBytes + storage.journalBytes)}</dd></div>
        <div><dt>Attachments on disk</dt><dd>{formatBytes(storage.attachmentDiskBytes)}</dd></div>
        <div><dt>Referenced audio</dt><dd>{formatBytes(storage.audioBytes ?? 0)}</dd></div>
        <div><dt>Reusable space in database</dt><dd>{formatBytes(storage.freePageBytes)}</dd></div>
      </dl>
    </>}
    {storage && !storage.active && <>
      <p>Open this page in the browser where the seven imports are visible. Siftory saves a verified backup of that browser library before moving the seven items and their related records to SQLite.</p>
      <button className="primary-button" disabled={busy} type="button" onClick={() => void moveLibrary()}>{busy ? 'Backing up and checking records…' : 'Move seven imports to SQLite'}</button>
    </>}
  </section>
}
