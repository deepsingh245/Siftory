import { describe, expect, it } from 'vitest'
import {
  canonicalizeUrl,
  createSavedItem,
  filterAndSortItems,
  normalizeHttpUrl,
  updateSavedItem,
} from '../../src/domain/library'

describe('library record validation', () => {
  it('normalizes safe web links and ignores the fragment for duplicate matching', () => {
    const url = normalizeHttpUrl(' https://Example.com/notes#section ')
    expect(url).toBe('https://example.com/notes#section')
    expect(new URL(url!).hash).toBe('#section')
    expect(canonicalizeUrl(url)).toBe('https://example.com/notes')
  })

  it.each(['javascript:alert(1)', 'file:///private/data', 'https://user:secret@example.com'])('rejects unsafe URL %s', (url) => {
    expect(() => normalizeHttpUrl(url)).toThrow()
  })

  it('requires a title or a valid URL and keeps user notes separate', () => {
    expect(() => createSavedItem({ title: '', sourceType: 'website', contentType: 'unknown' })).toThrow('Add a title or a link')
    const item = createSavedItem({
      title: '',
      url: 'https://example.com/article',
      sourceType: 'website',
      contentType: 'article',
      userNotes: 'Read this next week',
    }, new Date('2026-11-21T10:00:00.000Z'), 'item-1')
    expect(item.title).toBe('')
    expect(item.userNotes).toBe('Read this next week')
    expect(item.status).toBe('inbox')
    expect(item.collectionIds).toEqual([])
  })

  it('clears a removed URL and optional fields when updating an item', () => {
    const item = createSavedItem({ title: 'A note', url: 'https://example.com', sourceType: 'website', contentType: 'article', creatorName: 'Ada' }, new Date('2026-11-20T00:00:00.000Z'), 'item-2')
    const updated = updateSavedItem(item, { title: 'A note', url: '', sourceType: 'website', contentType: 'unknown' }, new Date('2026-11-21T00:00:00.000Z'))
    expect(updated.url).toBeUndefined()
    expect(updated.canonicalUrl).toBeUndefined()
    expect(updated.creatorName).toBeUndefined()
    expect(updated.updatedAt).toBe('2026-11-21T00:00:00.000Z')
  })
})

describe('library search and filters', () => {
  const itemOne = createSavedItem({ title: 'Field notes', sourceType: 'website', contentType: 'article', userNotes: 'remember this for cooking' }, new Date('2026-11-20T00:00:00.000Z'), 'one')
  const itemTwo = {
    ...createSavedItem({ title: 'Long form interview', sourceType: 'youtube', contentType: 'video' }, new Date('2026-11-21T00:00:00.000Z'), 'two'),
    status: 'saved' as const,
    collectionIds: ['research'],
    categoryIds: ['culture'],
    tagIds: ['listen'],
  }

  it('searches titles and user notes case-insensitively', () => {
    expect(filterAndSortItems([itemOne, itemTwo], { query: 'COOKING' }).map(({ id }) => id)).toEqual(['one'])
    expect(filterAndSortItems([itemOne, itemTwo], { query: 'interview' }).map(({ id }) => id)).toEqual(['two'])
  })

  it('combines status, relationship, and date filters', () => {
    expect(filterAndSortItems([itemOne, itemTwo], {
      status: 'saved',
      collectionId: 'research',
      categoryId: 'culture',
      tagId: 'listen',
      fromDate: '2026-11-21',
    }).map(({ id }) => id)).toEqual(['two'])
  })

  it('sorts by title or creation date', () => {
    expect(filterAndSortItems([itemOne, itemTwo], { sort: 'title' }).map(({ id }) => id)).toEqual(['one', 'two'])
    expect(filterAndSortItems([itemOne, itemTwo], { sort: 'oldest' }).map(({ id }) => id)).toEqual(['one', 'two'])
    expect(filterAndSortItems([itemOne, itemTwo], { sort: 'updated' }).map(({ id }) => id)).toEqual(['two', 'one'])
  })
})
