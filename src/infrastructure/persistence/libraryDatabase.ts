import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Category, Collection, SavedItem, SourceFileRecord, Tag } from '../../domain/library'

export const databaseName = 'siftory-library'
export const databaseVersion = 2

export interface LibraryDatabase extends DBSchema {
  savedItems: {
    key: string
    value: SavedItem
    indexes: {
      'by-status': SavedItem['status']
      'by-url': string
      'by-updated': string
      'by-last-viewed': string
    }
  }
  collections: {
    key: string
    value: Collection
    indexes: { 'by-name': string }
  }
  categories: {
    key: string
    value: Category
    indexes: { 'by-name': string }
  }
  tags: {
    key: string
    value: Tag
    indexes: { 'by-name': string }
  }
  sourceFiles: {
    key: string
    value: SourceFileRecord
    indexes: { 'by-created': string }
  }
}

export type LibraryDatabaseConnection = IDBPDatabase<LibraryDatabase>

export function openLibraryDatabase(name = databaseName, onBlocked?: () => void): Promise<LibraryDatabaseConnection> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not provide local database storage.'))
  }

  return openDB<LibraryDatabase>(name, databaseVersion, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const items = db.createObjectStore('savedItems', { keyPath: 'id' })
        items.createIndex('by-status', 'status')
        items.createIndex('by-url', 'canonicalUrl')
        items.createIndex('by-updated', 'updatedAt')
        items.createIndex('by-last-viewed', 'lastViewedAt')

        const collections = db.createObjectStore('collections', { keyPath: 'id' })
        collections.createIndex('by-name', 'name')

        const categories = db.createObjectStore('categories', { keyPath: 'id' })
        categories.createIndex('by-name', 'name')

        const tags = db.createObjectStore('tags', { keyPath: 'id' })
        tags.createIndex('by-name', 'name')
      }
      if (oldVersion < 2) {
        const files = db.createObjectStore('sourceFiles', { keyPath: 'savedItemId' })
        files.createIndex('by-created', 'createdAt')
      }
    },
    blocked() {
      onBlocked?.()
    },
  })
}
