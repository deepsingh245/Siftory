import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  contentTypes,
  createSavedItem,
  displayTitle,
  filterAndSortItems,
  normalizeHttpUrl,
  sourceTypes,
  updateSavedItem,
} from '../../domain/library'
import type { ReactNode } from 'react'
import type { AppRoute } from '../../app/routes'
import type {
  Category,
  Collection,
  ContentType,
  ItemDraft,
  ItemFilters,
  SavedItem,
  SourceType,
  Tag,
} from '../../domain/library'
import type { LibraryData } from './useLibraryData'
import { routeHref } from '../../app/routes'
import './library.css'

type Props = {
  route: AppRoute
  data: LibraryData
  query: string
}

export function LibraryWorkspace({ route, data, query }: Props) {
  const [filters, setFilters] = useState<Omit<ItemFilters, 'query' | 'status'>>({ sort: 'recent' })

  if (data.loading) {
    return <div className="library-state" role="status">Opening your local library...</div>
  }

  if (route.page === 'item') {
    const item = data.items.find((candidate) => candidate.id === route.id)
    if (!item) return <NotFound kind="saved item" href="#/library" />
    return <ItemDetail item={item} data={data} />
  }

  if (route.page === 'collections' || route.page === 'categories' || route.page === 'tags') {
    return <OrganizerPage kind={route.page} data={data} />
  }

  if (route.page === 'collection') {
    const collection = data.collections.find((candidate) => candidate.id === route.id)
    if (!collection) return <NotFound kind="collection" href="#/collections" />
    return <CollectionDetail collection={collection} data={data} />
  }

  if (route.page === 'category') {
    const category = data.categories.find((candidate) => candidate.id === route.id)
    if (!category) return <NotFound kind="category" href="#/categories" />
  }

  if (route.page === 'tag') {
    const tag = data.tags.find((candidate) => candidate.id === route.id)
    if (!tag) return <NotFound kind="tag" href="#/tags" />
  }

  const status = route.page === 'inbox' ? 'inbox' : route.page === 'library' ? 'saved' : undefined
  let baseItems = data.items
  let title = 'All saved'
  let description = 'Everything you have chosen to keep, in one place.'
  let filterOverrides: Partial<ItemFilters> = {}

  if (route.page === 'inbox') {
    title = 'Inbox'
    description = 'Review new items and decide what belongs in your library.'
  } else if (route.page === 'recent') {
    title = 'Recently viewed'
    description = 'Pick up where you left off.'
    baseItems = data.items.filter((item) => item.lastViewedAt)
  } else if (route.page === 'category') {
    const category = data.categories.find((candidate) => candidate.id === route.id)!
    title = category.name
    description = category.description || 'Items in this category.'
    filterOverrides = { categoryId: category.id }
  } else if (route.page === 'tag') {
    const tag = data.tags.find((candidate) => candidate.id === route.id)!
    title = `#${tag.name}`
    description = 'Items with this tag.'
    filterOverrides = { tagId: tag.id }
  }

  const items = filterAndSortItems(baseItems, {
    ...filters,
    ...filterOverrides,
    query,
    ...(status ? { status } : {}),
  })
  if (route.page === 'recent' && (filters.sort ?? 'recent') === 'recent') {
    items.sort((a, b) => (b.lastViewedAt ?? '').localeCompare(a.lastViewedAt ?? ''))
  }

  const canAdd = route.page === 'library' || route.page === 'inbox'
  return (
    <LibraryListing
      route={route}
      data={data}
      items={items}
      title={title}
      description={description}
      query={query}
      filters={filters}
      onFiltersChange={setFilters}
      canAdd={canAdd}
    />
  )
}

function LibraryListing({
  route,
  data,
  items,
  title,
  description,
  query,
  filters,
  onFiltersChange,
  canAdd,
}: {
  route: AppRoute
  data: LibraryData
  items: SavedItem[]
  title: string
  description: string
  query: string
  filters: Omit<ItemFilters, 'query' | 'status'>
  onFiltersChange: (filters: Omit<ItemFilters, 'query' | 'status'>) => void
  canAdd: boolean
}) {
  const [showForm, setShowForm] = useState(false)
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [actionError, setActionError] = useState<string>()

  async function handleCreate(draft: ItemDraft) {
    const item = createSavedItem(draft)
    if (item.canonicalUrl) {
      const duplicate = await data.findDuplicate(item.canonicalUrl)
      if (duplicate && !window.confirm(`This link is already in your library as “${displayTitle(duplicate)}”. Add another copy?`)) return
    }
    await data.actions.saveItem(item)
    setShowForm(false)
    if (route.page === 'library') window.location.hash = '#/inbox'
  }

  async function setItemStatus(item: SavedItem, status: SavedItem['status']) {
    try {
      const nextItem = { ...item, status, updatedAt: new Date().toISOString() }
      await data.actions.saveItem(nextItem)
      setActionError(undefined)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The item status could not be changed.')
    }
  }

  async function deleteItem(item: SavedItem) {
    if (!window.confirm(`Remove “${displayTitle(item)}” from this library? This will not affect its original source.`)) return
    try {
      await data.actions.deleteItem(item.id)
      setActionError(undefined)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'The item could not be removed.')
    }
  }

  const headingLabel = route.page === 'inbox' ? 'INBOX' : route.page === 'recent' ? 'HISTORY' : 'YOUR LIBRARY'

  return (
    <section className="library-page" aria-labelledby="library-heading">
      <div className="library-page-heading">
        <div>
          <p className="library-eyebrow">{headingLabel}</p>
          <h1 id="library-heading">{title}</h1>
          <p className="library-page-description">{description}</p>
        </div>
        {canAdd && (
          <button className="primary-button" type="button" onClick={() => setShowForm((visible) => !visible)}>
            <span aria-hidden="true">+</span> Add item
          </button>
        )}
      </div>

      {actionError && <p className="library-error" role="alert">{actionError}</p>}

      {showForm && <ManualItemForm onSave={handleCreate} onCancel={() => setShowForm(false)} />}

      <div className="library-toolbar">
        <label className="sort-field">
          <span className="visually-hidden">Sort items</span>
          <select value={filters.sort ?? 'recent'} onChange={(event) => onFiltersChange({ ...filters, sort: event.target.value as ItemFilters['sort'] })}>
            <option value="recent">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A to Z</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
        <div className="view-toggle" role="group" aria-label="Item view">
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
          <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
        </div>
      </div>

      <FilterPanel data={data} filters={filters} onChange={onFiltersChange} />

      <div className="result-summary" aria-live="polite">
        <span>{items.length} {items.length === 1 ? 'item' : 'items'}</span>
        {query && <span>matching “{query}”</span>}
      </div>

      {items.length ? (
        <ul className={`saved-items saved-items--${view}`}>
          {items.map((item) => (
            <li key={item.id}>
              <SavedItemCard
                item={item}
                collections={data.collections}
                categories={data.categories}
                tags={data.tags}
                onSaveToLibrary={item.status === 'inbox' ? () => setItemStatus(item, 'saved') : undefined}
                onDelete={() => deleteItem(item)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="library-empty-state">
          <span className="empty-state-mark" aria-hidden="true">{route.page === 'inbox' ? '○' : '✳'}</span>
          <h2>{query ? 'No matches found.' : emptyHeading(route, canAdd)}</h2>
          <p>{query ? 'Try another phrase or adjust the filters.' : emptyDescription(route, canAdd)}</p>
          {canAdd && !showForm && (
            <button className="quiet-button" type="button" onClick={() => setShowForm(true)}>Add your first item</button>
          )}
        </div>
      )}
    </section>
  )
}

function emptyHeading(route: AppRoute, canAdd: boolean) {
  if (canAdd) return route.page === 'inbox' ? 'Your inbox is clear.' : 'Your library is ready.'
  if (route.page === 'recent') return 'Nothing viewed yet.'
  return 'Nothing here yet.'
}

function emptyDescription(route: AppRoute, canAdd: boolean) {
  if (canAdd) return route.page === 'inbox' ? 'New items you add will wait here until you move them into All Saved.' : 'Add a link or a note to start collecting things worth coming back to.'
  if (route.page === 'recent') return 'Open a saved item and it will appear here.'
  return 'Items that match this view will appear here.'
}

function ManualItemForm({ onSave, onCancel, initialItem }: {
  onSave: (draft: ItemDraft) => Promise<void>
  onCancel: () => void
  initialItem?: SavedItem
}) {
  const [draft, setDraft] = useState<ItemDraft>(() => initialItem ? {
    title: initialItem.title,
    url: initialItem.url,
    sourceType: initialItem.sourceType,
    contentType: initialItem.contentType,
    creatorName: initialItem.creatorName,
    creatorHandle: initialItem.creatorHandle,
    description: initialItem.description,
    userNotes: initialItem.userNotes,
    savedAt: initialItem.savedAt,
  } : { title: '', url: '', sourceType: 'website', contentType: 'unknown' })
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  function update<K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(undefined)
    setSaving(true)
    try {
      await onSave(draft)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The item could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="record-form" onSubmit={submit}>
      <div className="record-form-heading">
        <div><p className="library-eyebrow">MANUAL ENTRY</p><h2>{initialItem ? 'Edit saved item' : 'Add to your library'}</h2></div>
        <button className="quiet-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <p className="form-explainer">Siftory stores the details you enter on this device. It will not open or fetch the link.</p>
      <div className="form-grid">
        <TextField label="Title" value={draft.title} onChange={(value) => update('title', value)} placeholder="A name you'll recognize" />
        <TextField label="Link" value={draft.url ?? ''} onChange={(value) => update('url', value)} placeholder="https://example.com/..." type="url" />
        <label className="form-field"><span>Source</span><select value={draft.sourceType} onChange={(event) => update('sourceType', event.target.value as SourceType)}>{sourceTypes.map((source) => <option key={source} value={source}>{humanize(source)}</option>)}</select></label>
        <label className="form-field"><span>Content type</span><select value={draft.contentType} onChange={(event) => update('contentType', event.target.value as ContentType)}>{contentTypes.map((contentType) => <option key={contentType} value={contentType}>{humanize(contentType)}</option>)}</select></label>
        <TextField label="Creator" value={draft.creatorName ?? ''} onChange={(value) => update('creatorName', value)} placeholder="Optional" />
        <TextField label="Creator handle" value={draft.creatorHandle ?? ''} onChange={(value) => update('creatorHandle', value)} placeholder="Optional" />
        <TextField label="Description or caption" value={draft.description ?? ''} onChange={(value) => update('description', value)} placeholder="Optional" />
        <TextField label="Date saved" value={draft.savedAt ?? ''} onChange={(value) => update('savedAt', value)} type="date" />
        <label className="form-field form-field--wide"><span>Your notes</span><textarea value={draft.userNotes ?? ''} onChange={(event) => update('userNotes', event.target.value)} rows={3} placeholder="Why do you want to keep this?" /></label>
      </div>
      {error && <p className="library-error" role="alert">{error}</p>}
      <p className="field-note">Add a title or a valid web link. No page content is fetched or extracted.</p>
      <div className="form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : initialItem ? 'Save changes' : 'Add to Inbox'}</button><button className="quiet-button" type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  )
}

function TextField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return <label className="form-field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

function FilterPanel({ data, filters, onChange }: {
  data: LibraryData
  filters: Omit<ItemFilters, 'query' | 'status'>
  onChange: (filters: Omit<ItemFilters, 'query' | 'status'>) => void
}) {
  const activeCount = [filters.sourceType, filters.contentType, filters.collectionId, filters.categoryId, filters.tagId, filters.fromDate, filters.toDate].filter(Boolean).length
  return (
    <details className="filter-panel">
      <summary>Filters{activeCount ? <span className="filter-count">{activeCount}</span> : null}</summary>
      <div className="filter-grid">
        <SelectField label="Source" value={filters.sourceType ?? ''} onChange={(value) => onChange({ ...filters, sourceType: value as SourceType | '' })} options={sourceTypes.map((value) => [value, humanize(value)])} />
        <SelectField label="Content type" value={filters.contentType ?? ''} onChange={(value) => onChange({ ...filters, contentType: value as ContentType | '' })} options={contentTypes.map((value) => [value, humanize(value)])} />
        <SelectField label="Collection" value={filters.collectionId ?? ''} onChange={(value) => onChange({ ...filters, collectionId: value })} options={data.collections.map(({ id, name }) => [id, name])} />
        <SelectField label="Category" value={filters.categoryId ?? ''} onChange={(value) => onChange({ ...filters, categoryId: value })} options={data.categories.map(({ id, name }) => [id, name])} />
        <SelectField label="Tag" value={filters.tagId ?? ''} onChange={(value) => onChange({ ...filters, tagId: value })} options={data.tags.map(({ id, name }) => [id, `#${name}`])} />
        <TextField label="From date" value={filters.fromDate ?? ''} onChange={(value) => onChange({ ...filters, fromDate: value })} type="date" />
        <TextField label="To date" value={filters.toDate ?? ''} onChange={(value) => onChange({ ...filters, toDate: value })} type="date" />
        <button className="quiet-button filter-reset" type="button" onClick={() => onChange({ sort: filters.sort })}>Clear filters</button>
      </div>
    </details>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly (readonly [string, string])[]
}) {
  return (
    <label className="form-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Any</option>{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
    </select></label>
  )
}

function SavedItemCard({ item, collections, categories, tags, onSaveToLibrary, onDelete }: {
  item: SavedItem
  collections: Collection[]
  categories: Category[]
  tags: Tag[]
  onSaveToLibrary?: () => void
  onDelete: () => void
}) {
  const itemCollections = collections.filter(({ id }) => item.collectionIds.includes(id))
  const itemCategories = categories.filter(({ id }) => item.categoryIds.includes(id))
  const itemTags = tags.filter(({ id }) => item.tagIds.includes(id))
  return (
    <article className="saved-item-card">
      <div className="saved-item-meta"><span className={`status-badge status-badge--${item.status}`}>{humanize(item.status)}</span><span>{humanize(item.sourceType)}</span><span>{humanize(item.contentType)}</span></div>
      <h2><a href={routeHref({ page: 'item', id: item.id })}>{displayTitle(item)}</a></h2>
      {item.url && (safeExternalUrl(item.url) ? <a className="item-url" href={safeExternalUrl(item.url)} target="_blank" rel="noreferrer">{item.url}</a> : <p className="item-description">This stored link is unavailable because it is not a valid web address.</p>)}
      {!item.url && item.description && <p className="item-description">{item.description}</p>}
      {item.creatorName && <p className="item-creator">By {item.creatorName}{item.creatorHandle ? ` · @${item.creatorHandle}` : ''}</p>}
      {item.userNotes && <p className="item-notes-preview">{item.userNotes}</p>}
      <div className="item-chip-row" aria-label="Organization labels">
        {itemCollections.map(({ id, name }) => <a key={id} className="item-chip" href={routeHref({ page: 'collection', id })}>{name}</a>)}
        {itemCategories.map(({ id, name }) => <a key={id} className="item-chip" href={routeHref({ page: 'category', id })}>{name}</a>)}
        {itemTags.map(({ id, name }) => <a key={id} className="item-chip" href={routeHref({ page: 'tag', id })}>#{name}</a>)}
      </div>
      <div className="saved-item-actions">
        <a href={routeHref({ page: 'item', id: item.id })}>Open item</a>
        {onSaveToLibrary && <button className="quiet-button" type="button" onClick={onSaveToLibrary}>Move to All Saved</button>}
        <button className="quiet-button danger-button" type="button" onClick={onDelete}>Remove</button>
      </div>
    </article>
  )
}

function ItemDetail({ item, data }: { item: SavedItem; data: LibraryData }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    void data.actions.markViewed(item.id).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update recent history.'))
  }, [data.actions, item.id])

  async function save(draft: ItemDraft) {
    setError(undefined)
    try {
      const updated = updateSavedItem(item, draft)
      if (updated.canonicalUrl && updated.canonicalUrl !== item.canonicalUrl) {
        const duplicate = await data.findDuplicate(updated.canonicalUrl)
        if (duplicate && duplicate.id !== item.id && !window.confirm(`This link is already saved as “${displayTitle(duplicate)}”. Keep both items?`)) return
      }
      await data.actions.saveItem(updated)
      setEditing(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Changes could not be saved.')
      throw cause
    }
  }

  async function toggleRelation(key: 'collectionIds' | 'categoryIds' | 'tagIds', id: string, checked: boolean) {
    const values = new Set(item[key])
    if (checked) values.add(id)
    else values.delete(id)
    try {
      await data.actions.saveItem({ ...item, [key]: [...values], updatedAt: new Date().toISOString() })
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The organization label could not be updated.')
    }
  }

  async function remove() {
    if (!window.confirm(`Remove “${displayTitle(item)}” from this library? The original source will not be changed.`)) return
    await data.actions.deleteItem(item.id)
    window.location.hash = '#/library'
  }

  return (
    <section className="item-detail" aria-labelledby="item-heading">
      <a className="back-link" href={item.status === 'inbox' ? '#/inbox' : '#/library'}>← Back to {item.status === 'inbox' ? 'Inbox' : 'All Saved'}</a>
      <div className="item-detail-heading">
        <div><p className="library-eyebrow">{humanize(item.status)} · {humanize(item.sourceType)}</p><h1 id="item-heading">{displayTitle(item)}</h1></div>
        <div className="detail-header-actions"><button className="quiet-button" type="button" onClick={() => setEditing((value) => !value)}>{editing ? 'Stop editing' : 'Edit item'}</button><button className="quiet-button danger-button" type="button" onClick={remove}>Remove</button></div>
      </div>
      {error && <p className="library-error" role="alert">{error}</p>}
      {editing ? <ManualItemForm initialItem={item} onCancel={() => setEditing(false)} onSave={save} /> : (
        <div className="detail-layout">
          <div className="detail-main">
            <section className="detail-panel"><h2>Source details</h2>
              <dl className="detail-list">
                <DetailRow label="Original link">{item.url && safeExternalUrl(item.url) ? <a href={safeExternalUrl(item.url)} target="_blank" rel="noreferrer">{item.url}</a> : <span>{item.url ? 'Unavailable: invalid web address' : 'Not added'}</span>}</DetailRow>
                <DetailRow label="Content type">{humanize(item.contentType)}</DetailRow>
                <DetailRow label="Creator">{item.creatorName || 'Not added'}</DetailRow>
                <DetailRow label="Creator handle">{item.creatorHandle ? `@${item.creatorHandle}` : 'Not added'}</DetailRow>
                <DetailRow label="Date saved">{item.savedAt || 'Not added'}</DetailRow>
                <DetailRow label="Added to Siftory">{new Date(item.createdAt).toLocaleDateString()}</DetailRow>
              </dl>
            </section>
            <section className="detail-panel"><h2>Description or caption</h2><p>{item.description || 'No description has been added.'}</p></section>
            <section className="detail-panel"><h2>Your notes</h2><p className="detail-notes">{item.userNotes || 'No notes yet.'}</p></section>
          </div>
          <aside className="detail-aside" aria-label="Organize item">
            <RelationPicker title="Collections" items={data.collections} selected={item.collectionIds} onToggle={(id, checked) => toggleRelation('collectionIds', id, checked)} />
            <RelationPicker title="Categories" items={data.categories} selected={item.categoryIds} onToggle={(id, checked) => toggleRelation('categoryIds', id, checked)} />
            <RelationPicker title="Tags" items={data.tags} selected={item.tagIds} onToggle={(id, checked) => toggleRelation('tagIds', id, checked)} />
            <p className="local-data-note">Stored in this browser only. This device's browser data may be cleared or evicted.</p>
          </aside>
        </div>
      )}
    </section>
  )
}

function RelationPicker<T extends { id: string; name: string }>({ title, items, selected, onToggle }: {
  title: string
  items: T[]
  selected: string[]
  onToggle: (id: string, checked: boolean) => void
}) {
  return (
    <fieldset className="relation-picker"><legend>{title}</legend>
      {items.length ? items.map(({ id, name }) => <label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={(event) => onToggle(id, event.target.checked)} /><span>{name}</span></label>) : <p>No {title.toLocaleLowerCase()} created yet.</p>}
    </fieldset>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="detail-row"><dt>{label}</dt><dd>{children}</dd></div>
}

type OrganizerKind = 'collections' | 'categories' | 'tags'
type OrganizerRecord = Collection | Category | Tag

function OrganizerPage({ kind, data }: { kind: OrganizerKind; data: LibraryData }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string>()
  const config = {
    collections: { title: 'Collections', noun: 'collection', records: data.collections },
    categories: { title: 'Categories', noun: 'category', records: data.categories },
    tags: { title: 'Tags', noun: 'tag', records: data.tags },
  }[kind]

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError(`Enter a name for this ${config.noun}.`)
      return
    }
    const now = new Date().toISOString()
    const common = { id: crypto.randomUUID(), name: trimmed, createdAt: now, updatedAt: now }
    try {
      if (kind === 'collections') await data.actions.saveCollection({ ...common, ...(description.trim() ? { description: description.trim() } : {}) })
      else if (kind === 'categories') await data.actions.saveCategory({ ...common, ...(description.trim() ? { description: description.trim() } : {}) })
      else await data.actions.saveTag(common)
      setName('')
      setDescription('')
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `The ${config.noun} could not be created.`)
    }
  }

  return (
    <section className="organizer-page" aria-labelledby="organizer-heading">
      <div className="library-page-heading"><div><p className="library-eyebrow">ORGANIZE YOUR LIBRARY</p><h1 id="organizer-heading">{config.title}</h1><p className="library-page-description">Group saved items in a way that makes sense to you.</p></div></div>
      <form className="organizer-create" onSubmit={create}>
        <div><h2>Create a {config.noun}</h2><p>These labels are yours to name and change.</p></div>
        <div className="organizer-create-fields"><TextField label={`${humanize(config.noun)} name`} value={name} onChange={setName} placeholder={`Name this ${config.noun}`} />{kind !== 'tags' && <TextField label="Description" value={description} onChange={setDescription} placeholder="Optional" />}</div>
        <button className="primary-button" type="submit">Create {config.noun}</button>
        {error && <p className="library-error" role="alert">{error}</p>}
      </form>
      <div className="organizer-list">
        {config.records.length ? config.records.map((record) => (
          <OrganizerRecordRow key={record.id} kind={kind} record={record} count={data.items.filter((item) => item[relationKey(kind)].includes(record.id)).length} data={data} />
        )) : <div className="library-empty-state"><span className="empty-state-mark" aria-hidden="true">✳</span><h2>No {config.title.toLocaleLowerCase()} yet.</h2><p>Create one to organize related items.</p></div>}
      </div>
    </section>
  )
}

function OrganizerRecordRow({ kind, record, count, data }: { kind: OrganizerKind; record: OrganizerRecord; count: number; data: LibraryData }) {
  const [name, setName] = useState(record.name)
  const [description, setDescription] = useState('description' in record ? record.description ?? '' : '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string>()
  const href = kind === 'collections' ? routeHref({ page: 'collection', id: record.id }) : kind === 'categories' ? routeHref({ page: 'category', id: record.id }) : routeHref({ page: 'tag', id: record.id })
  const noun = kind === 'collections' ? 'collection' : kind === 'categories' ? 'category' : 'tag'

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) {
      setError('A name is required.')
      return
    }
    try {
      const next = { ...record, name: name.trim(), updatedAt: new Date().toISOString() }
      if (kind === 'collections') await data.actions.saveCollection({ ...next, description: description.trim() || undefined } as Collection)
      else if (kind === 'categories') await data.actions.saveCategory({ ...next, description: description.trim() || undefined } as Category)
      else await data.actions.saveTag(next as Tag)
      setSaved(true)
      setError(undefined)
      window.setTimeout(() => setSaved(false), 1600)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `The ${noun} could not be saved.`)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete this ${noun}? Saved items will remain in your library, with this label removed.`)) return
    try {
      if (kind === 'collections') await data.actions.deleteCollection(record.id)
      else if (kind === 'categories') await data.actions.deleteCategory(record.id)
      else await data.actions.deleteTag(record.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `The ${noun} could not be removed.`)
    }
  }

  return (
    <article className="organizer-record">
      <a className="organizer-record-link" href={href}><strong>{kind === 'tags' ? `#${record.name}` : record.name}</strong><span>{count} {count === 1 ? 'item' : 'items'}</span></a>
      <form className="organizer-rename" onSubmit={save}>
        <TextField label={`Rename ${noun}`} value={name} onChange={setName} />
        {kind !== 'tags' && <TextField label={`${humanize(noun)} description`} value={description} onChange={setDescription} />}
        <button className="quiet-button" type="submit">{saved ? 'Saved' : 'Save'}</button>
        <button className="quiet-button danger-button" type="button" onClick={remove}>Delete</button>
      </form>
      {error && <p className="library-error" role="alert">{error}</p>}
    </article>
  )
}

function CollectionDetail({ collection, data }: { collection: Collection; data: LibraryData }) {
  const [name, setName] = useState(collection.name)
  const [description, setDescription] = useState(collection.description ?? '')
  const [error, setError] = useState<string>()
  const items = data.items.filter((item) => item.collectionIds.includes(collection.id))
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim()) return
    try {
      await data.actions.saveCollection({ ...collection, name: name.trim(), description: description.trim() || undefined, updatedAt: new Date().toISOString() })
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The collection could not be saved.')
    }
  }
  async function remove() {
    if (!window.confirm('Delete this collection? Saved items will remain in your library.')) return
    try {
      await data.actions.deleteCollection(collection.id)
      window.location.hash = '#/collections'
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The collection could not be deleted.')
    }
  }
  return (
    <section className="organizer-page" aria-labelledby="collection-heading">
      <a className="back-link" href="#/collections">← All collections</a>
      <div className="library-page-heading"><div><p className="library-eyebrow">COLLECTION</p><h1 id="collection-heading">{collection.name}</h1><p className="library-page-description">{items.length} {items.length === 1 ? 'saved item' : 'saved items'}</p></div><button className="quiet-button danger-button" type="button" onClick={remove}>Delete collection</button></div>
      {error && <p className="library-error" role="alert">{error}</p>}
      <form className="collection-edit" onSubmit={save}><TextField label="Collection name" value={name} onChange={setName} /><TextField label="Description" value={description} onChange={setDescription} /><button className="primary-button" type="submit">Save collection</button></form>
      {items.length ? <ul className="saved-items saved-items--list">{filterAndSortItems(items).map((item) => <li key={item.id}><SavedItemCard item={item} collections={data.collections} categories={data.categories} tags={data.tags} onDelete={() => { if (window.confirm(`Remove “${displayTitle(item)}” from this library?`)) void data.actions.deleteItem(item.id).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'The item could not be removed.')) }} /></li>)}</ul> : <div className="library-empty-state"><h2>This collection is empty.</h2><p>Add it to an item from that item's detail page.</p></div>}
    </section>
  )
}

function NotFound({ kind, href }: { kind: string; href: string }) {
  return <div className="library-empty-state"><h1>This {kind} is not available.</h1><a className="primary-button" href={href}>Return to the library</a></div>
}

function relationKey(kind: OrganizerKind): 'collectionIds' | 'categoryIds' | 'tagIds' {
  if (kind === 'collections') return 'collectionIds'
  if (kind === 'categories') return 'categoryIds'
  return 'tagIds'
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase())
}

function safeExternalUrl(value: string): string | undefined {
  try {
    return normalizeHttpUrl(value)
  } catch {
    return undefined
  }
}
