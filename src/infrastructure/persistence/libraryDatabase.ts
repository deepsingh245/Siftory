import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Category, Collection, SavedItem, SourceFileRecord, Tag } from '../../domain/library'
import type { ExtractedContent, ProcessingJob, ProcessingStatus } from '../../domain/processing'
import type { Analysis } from '../../domain/analysis'
import type { AnalysisJob, AnalysisJobStatus } from '../../domain/analysisQueue'

export const databaseName = 'siftory-library'
export const databaseVersion = 5

export interface LibraryDatabase extends DBSchema {
  savedItems: {
    key: string
    value: SavedItem
    indexes: {
      'by-status': SavedItem['status']
      'by-url': string
      'by-updated': string
      'by-last-viewed': string
      'by-source-record': [string, string]
      'by-fingerprint': string
      'by-import-key': string
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
  processingJobs: {
    key: string
    value: ProcessingJob
    indexes: {
      'by-item': string
      'by-status': ProcessingStatus
      'by-job-key': string
      'by-active-key': string
      'by-created': string
    }
  }
  extractedContent: {
    key: string
    value: ExtractedContent
    indexes: {
      'by-item': string
        'by-source-key': IDBValidKey
      'by-created': string
    }
  }
  analyses: {
    key: string
    value: Analysis
    indexes: { 'by-item': string }
  }
  analysisJobs: {
    key: string
    value: AnalysisJob
    indexes: { 'by-item': string; 'by-status': AnalysisJobStatus }
  }
}

export type LibraryDatabaseConnection = IDBPDatabase<LibraryDatabase>

export function openLibraryDatabase(name = databaseName, onBlocked?: () => void): Promise<LibraryDatabaseConnection> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not provide local database storage.'))
  }

  return openDB<LibraryDatabase>(name, databaseVersion, {
    upgrade(db, oldVersion, _newVersion, transaction) {
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
      if (oldVersion < 3) {
        const jobs = db.createObjectStore('processingJobs', { keyPath: 'id' })
        jobs.createIndex('by-item', 'savedItemId')
        jobs.createIndex('by-status', 'status')
        jobs.createIndex('by-job-key', 'jobKey')
        jobs.createIndex('by-active-key', 'activeKey', { unique: true })
        jobs.createIndex('by-created', 'createdAt')

        const extracted = db.createObjectStore('extractedContent', { keyPath: 'id' })
        extracted.createIndex('by-item', 'savedItemId')
        extracted.createIndex('by-source-key', ['savedItemId', 'sourceFingerprint', 'processingVersion'])
        extracted.createIndex('by-created', 'extractedAt')
      }
      if (oldVersion < 4) db.createObjectStore('analyses', { keyPath: 'id' }).createIndex('by-item', 'savedItemId')
      if (oldVersion < 5) {
        const items = transaction.objectStore('savedItems')
        items.createIndex('by-source-record', ['sourceType', 'sourceRecordId'])
        items.createIndex('by-fingerprint', 'sourceFingerprint')
        items.createIndex('by-import-key', 'importRecordKey')
        const jobs = db.createObjectStore('analysisJobs', { keyPath: 'id' })
        jobs.createIndex('by-item', 'savedItemId')
        jobs.createIndex('by-status', 'status')
      }
    },
    blocked() {
      onBlocked?.()
    },
  })
}
