import type { IDBPDatabase } from 'idb'
import type { Category, Collection, SavedItem, Tag } from '../../domain/library'
import { databaseName } from './libraryDatabase'
import { openLibraryDatabase } from './libraryDatabase'
import type { LibraryDatabase } from './libraryDatabase'

export type LibraryRepository = ReturnType<typeof createLibraryRepository>

export function createLibraryRepository(name = databaseName, onBlocked?: () => void) {
  let connectionPromise: Promise<IDBPDatabase<LibraryDatabase>> | undefined

  function connection(): Promise<IDBPDatabase<LibraryDatabase>> {
    if (connectionPromise) return connectionPromise

    let opening!: Promise<IDBPDatabase<LibraryDatabase>>
    opening = openLibraryDatabase(name, onBlocked).then((db) => {
      db.addEventListener('versionchange', () => {
        db.close()
        if (connectionPromise === opening) connectionPromise = undefined
      })
      return db
    })
    connectionPromise = opening
    return opening
  }

  return {
    async close() {
      const db = await connectionPromise
      db?.close()
      connectionPromise = undefined
    },

    async getItems() {
      return (await connection()).getAll('savedItems')
    },

    async getItem(id: string) {
      return (await connection()).get('savedItems', id)
    },

    async findByCanonicalUrl(url: string) {
      return (await connection()).getFromIndex('savedItems', 'by-url', url)
    },

    async saveItem(item: SavedItem) {
      const db = await connection()
      const tx = db.transaction('savedItems', 'readwrite')
      await tx.store.put(item)
      await tx.done
    },

    async markViewed(id: string, viewedAt = new Date().toISOString()) {
      const db = await connection()
      const tx = db.transaction('savedItems', 'readwrite')
      const item = await tx.store.get(id)
      if (item) await tx.store.put({ ...item, lastViewedAt: viewedAt })
      await tx.done
    },

    async deleteItem(id: string) {
      const db = await connection()
      const tx = db.transaction('savedItems', 'readwrite')
      await tx.store.delete(id)
      await tx.done
    },

    async getCollections() {
      return (await connection()).getAll('collections')
    },

    async saveCollection(collection: Collection) {
      const db = await connection()
      const tx = db.transaction('collections', 'readwrite')
      await tx.store.put(collection)
      await tx.done
    },

    async deleteCollection(id: string) {
      return removeLabel('collections', 'collectionIds', id)
    },

    async getCategories() {
      return (await connection()).getAll('categories')
    },

    async saveCategory(category: Category) {
      const db = await connection()
      const tx = db.transaction('categories', 'readwrite')
      await tx.store.put(category)
      await tx.done
    },

    async deleteCategory(id: string) {
      return removeLabel('categories', 'categoryIds', id)
    },

    async getTags() {
      return (await connection()).getAll('tags')
    },

    async saveTag(tag: Tag) {
      const db = await connection()
      const tx = db.transaction('tags', 'readwrite')
      await tx.store.put(tag)
      await tx.done
    },

    async deleteTag(id: string) {
      return removeLabel('tags', 'tagIds', id)
    },
  }

  async function removeLabel(
    storeName: 'collections' | 'categories' | 'tags',
    relation: 'collectionIds' | 'categoryIds' | 'tagIds',
    id: string,
  ) {
    const db = await connection()
    const tx = db.transaction(['savedItems', storeName], 'readwrite')
    const items = await tx.objectStore('savedItems').getAll()
    const related = items.filter((item) => item[relation].includes(id))

    for (const item of related) {
      await tx.objectStore('savedItems').put({
        ...item,
        [relation]: item[relation].filter((relationId) => relationId !== id),
      })
    }

    await tx.objectStore(storeName).delete(id)
    await tx.done
  }
}
