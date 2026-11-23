import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { backupBrowserLibrary, getStorageStatus, type StorageStatus } from '../../infrastructure/persistence/localLibrary'
import type { LibraryData } from './useLibraryData'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

export function StorageSettings({ refresh, libraryError }: { refresh: LibraryData['refresh']; libraryError?: string }) {
  const [storage, setStorage] = useState<StorageStatus>()
  const [operation, setOperation] = useState<'retry' | 'move'>()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    void getStorageStatus().then((status) => { if (active) setStorage(status) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Storage status is unavailable.') })
    return () => { active = false }
  }, [])

  async function retryStorage() {
    setOperation('retry')
    try {
      const [status] = await Promise.all([getStorageStatus(), refresh()])
      setStorage(status)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Storage status is unavailable.')
    } finally {
      setOperation(undefined)
    }
  }

  async function moveLibrary() {
    setOperation('move')
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
      setOperation(undefined)
    }
  }

  const storageError = libraryError || error
  const metrics = storage?.active ? [
    ['Database', storage.databaseBytes + storage.journalBytes],
    ['Attachments on disk', storage.attachmentDiskBytes],
    ['Referenced audio', storage.audioBytes ?? 0],
    ['Reusable space in database', storage.freePageBytes],
  ] as const : []

  return <Card role="region" aria-labelledby="storage-heading" aria-busy={Boolean(operation)} className="min-w-0 gap-4 py-4">
    <CardHeader className="gap-2 px-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="storage-heading" className="text-base font-semibold">Local storage</h2>
        {storage && <Badge variant="outline">{storage.active ? 'SQLite' : 'Browser library'}</Badge>}
      </div>
      {storage?.active && <p className="text-sm text-muted-foreground">{storage.counts.savedItems} saved items in SQLite</p>}
    </CardHeader>
    <CardContent className="space-y-3 px-4 text-sm sm:px-5">
      {storageError && <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <div role="alert">
          <p className="font-medium text-destructive">Local library unavailable</p>
          <p className="mt-1 [overflow-wrap:anywhere]">{storageError === 'Failed to fetch' ? 'Check that the local Siftory server is running.' : storageError}</p>
        </div>
        <Button variant="outline" disabled={Boolean(operation)} type="button" onClick={() => void retryStorage()}>{operation === 'retry' ? 'Retrying…' : 'Retry local storage'}</Button>
      </div>}
      {message && <p className="text-success [overflow-wrap:anywhere]" role="status">{message}</p>}
      {!storage && !storageError && <p className="text-muted-foreground" role="status">Checking library storage…</p>}
      {storage?.active && <dl className="divide-y border-y">
        {metrics.map(([label, bytes]) => <div key={label} className="flex items-center justify-between gap-3 py-2">
          <dt className="text-muted-foreground">{label}</dt><dd className="shrink-0 font-medium tabular-nums">{formatBytes(bytes)}</dd>
        </div>)}
      </dl>}
      {storage && !storage.active && <>
        <p className="text-muted-foreground">Open this page in the browser where the seven imports are visible. Siftory saves a verified backup of that browser library before moving the seven items and their related records to SQLite.</p>
        <Button className="h-auto min-h-control whitespace-normal" disabled={Boolean(operation)} type="button" onClick={() => void moveLibrary()}>
          {operation === 'move' ? 'Backing up and checking records…' : 'Move seven imports to SQLite'}
        </Button>
      </>}
    </CardContent>
  </Card>
}
