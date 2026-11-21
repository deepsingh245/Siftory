import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Category, Collection, SavedItem, SourceFileRecord, Tag } from '../../domain/library'
import { createLibraryRepository } from '../../infrastructure/persistence/libraryRepository'

const repository = createLibraryRepository(undefined, () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('siftory:database-blocked'))
})

export type LibraryData = {
  items: SavedItem[]
  collections: Collection[]
  categories: Category[]
  tags: Tag[]
  loading: boolean
  error: string | undefined
  refresh: () => Promise<void>
  perform: <T>(task: () => Promise<T>) => Promise<T>
  findDuplicate: (canonicalUrl: string) => Promise<SavedItem | undefined>
  getSourceFile: (savedItemId: string) => Promise<SourceFileRecord | undefined>
  actions: {
    saveItem: (item: SavedItem) => Promise<void>
    saveImportedBatch: (items: SavedItem[], files: SourceFileRecord[]) => Promise<void>
    deleteItem: (id: string) => Promise<void>
    markViewed: (id: string) => Promise<void>
    saveCollection: (collection: Collection) => Promise<void>
    deleteCollection: (id: string) => Promise<void>
    saveCategory: (category: Category) => Promise<void>
    deleteCategory: (id: string) => Promise<void>
    saveTag: (tag: Tag) => Promise<void>
    deleteTag: (id: string) => Promise<void>
  }
}

export function useLibraryData(): LibraryData {
  const [items, setItems] = useState<SavedItem[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const refresh = useCallback(async () => {
    try {
      const [nextItems, nextCollections, nextCategories, nextTags] = await Promise.all([
        repository.getItems(),
        repository.getCollections(),
        repository.getCategories(),
        repository.getTags(),
      ])
      setItems(nextItems)
      setCollections(nextCollections)
      setCategories(nextCategories)
      setTags(nextTags)
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The local library could not be opened.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const showBlockedMessage = () => {
      setError('Another Siftory tab is holding an older library connection. Close that tab, then retry.')
      setLoading(false)
    }
    window.addEventListener('siftory:database-blocked', showBlockedMessage)
    // oxlint-disable-next-line react/set-state-in-effect -- Load IndexedDB state after the component mounts.
    void refresh()
    return () => window.removeEventListener('siftory:database-blocked', showBlockedMessage)
  }, [refresh])

  const perform = useCallback(async <T,>(task: () => Promise<T>) => {
    const result = await task()
    await refresh()
    return result
  }, [refresh])

  const findDuplicate = useCallback((canonicalUrl: string) => repository.findByCanonicalUrl(canonicalUrl), [])
  const getSourceFile = useCallback((savedItemId: string) => repository.getSourceFile(savedItemId), [])
  const actions = useMemo(() => ({
    saveItem: (item: SavedItem) => perform(() => repository.saveItem(item)),
    saveImportedBatch: (items: SavedItem[], files: SourceFileRecord[]) => perform(() => repository.saveImportedBatch(items, files)),
    deleteItem: (id: string) => perform(() => repository.deleteItem(id)),
    markViewed: (id: string) => perform(() => repository.markViewed(id)),
    saveCollection: (collection: Collection) => perform(() => repository.saveCollection(collection)),
    deleteCollection: (id: string) => perform(() => repository.deleteCollection(id)),
    saveCategory: (category: Category) => perform(() => repository.saveCategory(category)),
    deleteCategory: (id: string) => perform(() => repository.deleteCategory(id)),
    saveTag: (tag: Tag) => perform(() => repository.saveTag(tag)),
    deleteTag: (id: string) => perform(() => repository.deleteTag(id)),
  }), [perform])

  return { items, collections, categories, tags, loading, error, refresh, perform, findDuplicate, getSourceFile, actions }
}
