import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteDB } from 'idb'
import type { Category, Collection, SavedItem, Tag } from '../../src/domain/library'
import { createSavedItem } from '../../src/domain/library'
import { createLibraryRepository } from '../../src/infrastructure/persistence/libraryRepository'
import { databaseName, databaseVersion, openLibraryDatabase } from '../../src/infrastructure/persistence/libraryDatabase'

let name: string
let repository: ReturnType<typeof createLibraryRepository>

beforeEach(() => {
  name = `${databaseName}-test-${crypto.randomUUID()}`
  repository = createLibraryRepository(name)
})

afterEach(async () => {
  await repository.close()
  await deleteDB(name)
})

function newItem(id: string): SavedItem {
  return createSavedItem({ title: `Item ${id}`, sourceType: 'website', contentType: 'article' }, new Date('2026-11-21T09:00:00.000Z'), id)
}

describe('local library database', () => {
  it('creates the versioned schema and keeps items after closing and reopening', async () => {
    const item = newItem('persisted')
    await repository.saveItem(item)
    await repository.close()

    const reopened = createLibraryRepository(name)
    expect(await reopened.getItem(item.id)).toEqual(item)
    await reopened.close()

    const db = await openLibraryDatabase(name)
    expect(db.version).toBe(databaseVersion)
    expect([...db.objectStoreNames]).toEqual(['categories', 'collections', 'savedItems', 'tags'])
    db.close()
  })

  it("records recent views without changing the item's content update timestamp", async () => {
    const item = newItem('viewed')
    await repository.saveItem(item)
    await repository.markViewed(item.id, '2026-11-21T11:00:00.000Z')
    const updated = await repository.getItem(item.id)

    expect(updated?.lastViewedAt).toBe('2026-11-21T11:00:00.000Z')
    expect(updated?.updatedAt).toBe(item.updatedAt)
  })

  it('removes a category, tag, or collection association without deleting the saved item', async () => {
    const item: SavedItem = {
      ...newItem('organized'),
      collectionIds: ['collection-1'],
      categoryIds: ['category-1'],
      tagIds: ['tag-1'],
    }
    const now = '2026-11-21T10:00:00.000Z'
    const collection: Collection = { id: 'collection-1', name: 'Ideas', createdAt: now, updatedAt: now }
    const category: Category = { id: 'category-1', name: 'Design', createdAt: now, updatedAt: now }
    const tag: Tag = { id: 'tag-1', name: 'Read later', createdAt: now, updatedAt: now }
    await repository.saveItem(item)
    await repository.saveCollection(collection)
    await repository.saveCategory(category)
    await repository.saveTag(tag)

    await repository.deleteCollection(collection.id)
    await repository.deleteCategory(category.id)
    await repository.deleteTag(tag.id)

    expect(await repository.getItem(item.id)).toMatchObject({
      collectionIds: [],
      categoryIds: [],
      tagIds: [],
    })
    expect(await repository.getCollections()).toEqual([])
    expect(await repository.getCategories()).toEqual([])
    expect(await repository.getTags()).toEqual([])
  })

  it('deletes only the local record', async () => {
    await repository.saveItem(newItem('remove-me'))
    await repository.deleteItem('remove-me')
    expect(await repository.getItem('remove-me')).toBeUndefined()
    expect(await repository.getItems()).toEqual([])
  })
})
