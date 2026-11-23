import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Archive, Ellipsis, ExternalLink, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Disclosure } from '@/components/ui/disclosure'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FieldSelect } from '@/components/ui/field-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  ItemDraft,
  ItemFilters,
  SavedItem,
  SourceFileRecord,
  Tag,
} from '../../domain/library'
import type { LibraryData } from './useLibraryData'
import { routeHref } from '../../app/routes'
import { ImportPage } from '../import/ImportPage'
import { AnalysisPanel } from '../analysis/AnalysisPanel'
import { AnalysisBatchReview } from '../analysis/AnalysisBatchReview'
import { maxAnalysisBatchSize } from '../../domain/analysisQueue'
import { ChatGptSettings } from '../analysis/ChatGptSettings'
import { StorageSettings } from './StorageSettings'
import { ProcessingQueuePage } from '../processing/ProcessingQueuePage'
import { ProcessingCardAction, ProcessingPanel } from '../processing/ProcessingPanel'
import { TranscriptPanel } from './TranscriptPanel'
import type { TranscriptCue } from './TranscriptPanel'
import { identifyYouTubeUrl } from '../../domain/youtube'
import { ResearchWorkspace } from '../research/ResearchWorkspace'
import './library.css'
import './item-detail.css'

type Props = {
  route: AppRoute
  data: LibraryData
  query: string
}

export function LibraryWorkspace({ route, data, query }: Props) {
  const [filters, setFilters] = useState<Omit<ItemFilters, 'query' | 'status'>>({ sort: 'recent' })

  if (route.page === 'settings') return <section className="max-w-5xl space-y-5" aria-labelledby="settings-heading">
    <div>
      <h1 id="settings-heading" className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your ChatGPT connection and local library storage.</p>
    </div>
    <div className="grid items-start gap-4 @min-[54rem]:grid-cols-2">
      <ChatGptSettings />
      <StorageSettings refresh={data.refresh} libraryError={data.loading ? undefined : data.error} />
    </div>
  </section>
  if (route.page === 'research') return <ResearchWorkspace sessionId={route.id} data={data} />

  if (data.loading) {
    return <div className="library-state" role="status">Opening your local library...</div>
  }

  if (route.page === 'import') {
    return <ImportPage data={data} />
  }

  if (route.page === 'queue') {
    return <ProcessingQueuePage data={data} />
  }

  if (route.page === 'item') {
    const item = data.items.find((candidate) => candidate.id === route.id)
    if (!item) return <NotFound kind="saved item" href="#/library" />
    return <ItemDetail key={item.id} item={item} data={data} />
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
  const [selectingAnalysis, setSelectingAnalysis] = useState(false)
  const [analysisSelection, setAnalysisSelection] = useState<string[]>([])
  const [showAnalysisReview, setShowAnalysisReview] = useState(false)
  const [reviewFilter, setReviewFilter] = useState('all')
  const inbox = route.page === 'inbox'
  const activeFilterCount = [filters.sourceType, filters.contentType, filters.collectionId, filters.categoryId, filters.tagId, filters.fromDate, filters.toDate].filter(Boolean).length
  const hasSearchOrFilters = Boolean(query || activeFilterCount || (inbox && reviewFilter !== 'all'))
  const latestAnalysis = new Map<string, LibraryData['analysisJobs'][number]>()
  for (const job of data.analysisJobs) {
    const current = latestAnalysis.get(job.savedItemId)
    if (!current || current.updatedAt < job.updatedAt) latestAnalysis.set(job.savedItemId, job)
  }
  const visibleItems = !inbox || reviewFilter === 'all' ? items : items.filter((item) => {
    const job = latestAnalysis.get(item.id)
    if (reviewFilter === 'transcript') return Boolean(item.transcriptId)
    if (reviewFilter === 'analyzed') return job?.status === 'completed'
    return ((!item.transcriptId && ['instagram', 'youtube'].includes(item.sourceType)) || job?.status === 'failed' || job?.status === 'needs-attention')
  })

  async function handleCreate(draft: ItemDraft) {
    const item = createSavedItem(draft)
    const youtube = item.url ? identifyYouTubeUrl(item.url) : undefined
    if (youtube && item.sourceType === 'website') {
      item.sourceType = 'youtube'
      item.contentType = youtube.contentType
      item.sourceMetadata = { ...(item.sourceMetadata ?? {}), youtubeVideoId: youtube.videoId }
    }
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

  return (
    <section className="library-page" aria-labelledby="library-heading">
      <div className="library-page-heading">
        <div>
          <h1 id="library-heading">{title}</h1>
          <p className="library-page-description">{description}</p>
        </div>
        {canAdd && (
          <Button type="button" onClick={() => setShowForm((visible) => !visible)}>
            <span aria-hidden="true">+</span> Add item
          </Button>
        )}
      </div>

      {actionError && <p className="library-error" role="alert">{actionError}</p>}

      {showForm && <ManualItemForm onSave={handleCreate} onCancel={() => setShowForm(false)} />}

      <div className="library-toolbar">
        {inbox && <FieldSelect label="Filter by review status" hideLabel className="sort-field" value={reviewFilter}
          onValueChange={setReviewFilter} options={[
            ['all', 'All review stages'], ['attention', 'Needs attention'], ['transcript', 'Has transcript'], ['analyzed', 'Analyzed'],
          ]} />}
        <FieldSelect<NonNullable<ItemFilters['sort']>> label="Sort items" hideLabel className="sort-field" value={filters.sort ?? 'recent'}
          onValueChange={(sort) => onFiltersChange({ ...filters, sort })} options={[
            ['recent', 'Newest first'], ['oldest', 'Oldest first'], ['title', 'Title A to Z'], ['updated', 'Recently updated'],
          ]} />
        <div className="view-toggle" role="group" aria-label="Item view">
          <Button type="button" variant={view === 'list' ? 'secondary' : 'ghost'} aria-pressed={view === 'list'} onClick={() => setView('list')}>List</Button>
          <Button type="button" variant={view === 'grid' ? 'secondary' : 'ghost'} aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</Button>
        </div>
        {canAdd && <Button className="library-analysis-toggle" variant={selectingAnalysis ? 'secondary' : 'outline'} type="button"
          aria-pressed={selectingAnalysis} onClick={() => { setSelectingAnalysis((active) => !active); setAnalysisSelection([]); setShowAnalysisReview(false) }}>
          {selectingAnalysis ? 'Cancel AI selection' : 'Select items for AI analysis'}
        </Button>}
      </div>

      {selectingAnalysis && <div className="analysis-selection-tools">
        <span>{analysisSelection.length ? `${analysisSelection.length} of ${maxAnalysisBatchSize} selected` : `Select up to ${maxAnalysisBatchSize} items`}</span>
        {analysisSelection.length > 0 && <Button type="button" disabled={showAnalysisReview} onClick={() => setShowAnalysisReview(true)}>Review selected text</Button>}
      </div>}
      {showAnalysisReview && analysisSelection.length > 0 && <AnalysisBatchReview itemIds={analysisSelection} data={data} onClose={() => setShowAnalysisReview(false)} />}

      <FilterPanel data={data} filters={filters} activeCount={activeFilterCount} onChange={onFiltersChange} />

      <div className="result-summary" aria-live="polite">
        <span>{visibleItems.length} {visibleItems.length === 1 ? 'item' : 'items'}</span>
        {query && <span>matching “{query}”</span>}
      </div>

      {visibleItems.length ? (
        <ul className={`saved-items saved-items--${view}${inbox && view === 'list' ? ' inbox-list' : ''}`}>
          {visibleItems.map((item) => (
            <li key={item.id} data-selected={analysisSelection.includes(item.id) || undefined}>
              {canAdd && selectingAnalysis ? <label className="analysis-item-select"><input type="checkbox" checked={analysisSelection.includes(item.id)} disabled={!analysisSelection.includes(item.id) && analysisSelection.length >= maxAnalysisBatchSize} onChange={(event) => setAnalysisSelection((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span className="visually-hidden">Select {displayTitle(item)} for AI analysis</span></label> : null}
              {inbox && view === 'list' ? <InboxRow item={item} data={data} job={latestAnalysis.get(item.id)} onSave={() => setItemStatus(item, 'saved')} onDelete={() => deleteItem(item)} onProcessingError={setActionError} /> : <SavedItemCard
                item={item}
                data={data}
                collections={data.collections}
                categories={data.categories}
                tags={data.tags}
                onSaveToLibrary={item.status === 'inbox' ? () => setItemStatus(item, 'saved') : undefined}
                onDelete={() => deleteItem(item)}
              />}
            </li>
          ))}
        </ul>
      ) : (
        <div className="library-empty-state">
          <span className="empty-state-mark" aria-hidden="true">{route.page === 'inbox' ? '○' : '✳'}</span>
          <h2>{hasSearchOrFilters ? 'No matching items' : emptyHeading(route, canAdd)}</h2>
          <p>{hasSearchOrFilters ? 'Try another phrase or change the filters.' : emptyDescription(route, canAdd)}</p>
          {canAdd && !showForm && (
            <button className="quiet-button" type="button" onClick={() => setShowForm(true)}>Add your first item</button>
          )}
        </div>
      )}
    </section>
  )
}

function InboxRow({ item, data, job, onSave, onDelete, onProcessingError }: {
  item: SavedItem
  data: LibraryData
  job?: LibraryData['analysisJobs'][number]
  onSave: () => void
  onDelete: () => void
  onProcessingError: (message: string | undefined) => void
}) {
  const date = item.savedAt ?? item.createdAt
  const sourceUrl = item.url ? safeExternalUrl(item.url) : undefined
  const transcript = item.transcriptId
    ? item.transcriptConfirmedAt ? 'Transcript confirmed' : item.transcriptReviewedAt ? 'Transcript reviewed' : 'Transcript to review'
    : ['youtube', 'instagram'].includes(item.sourceType) ? 'No transcript' : undefined
  const analysis = job?.status === 'completed' ? 'Analyzed' : job?.status === 'analyzing' ? 'Analyzing' : job?.status === 'queued' ? 'Queued for AI'
    : job?.status === 'failed' || job?.status === 'needs-attention' ? 'Analysis needs attention' : undefined
  return <article className="inbox-row">
    <div className="inbox-row-main">
      <h2><a href={routeHref({ page: 'item', id: item.id })}>{displayTitle(item)}</a></h2>
      <p>{humanize(item.sourceType)}{item.creatorName && ` · ${item.creatorName}`}</p>
    </div>
    <div className="inbox-row-status">
      {transcript && <span>{transcript}</span>}
      {analysis && <span className="inbox-ai-status">{analysis}</span>}
      <time dateTime={date}>{new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Actions for ${displayTitle(item)}`}>
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 max-w-(--radix-dropdown-menu-content-available-width)">
        {sourceUrl && <DropdownMenuItem asChild className="min-h-9">
          <a href={sourceUrl} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" /> Open source</a>
        </DropdownMenuItem>}
        <ProcessingCardAction item={item} data={data} onMenuError={onProcessingError} />
        <DropdownMenuItem className="min-h-9" onSelect={onSave}><Archive aria-hidden="true" /> Move to All Saved</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-9" variant="destructive" onSelect={onDelete}><Trash2 aria-hidden="true" /> Remove</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </article>
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
        <FieldSelect label="Source" value={draft.sourceType} onValueChange={(source) => update('sourceType', source)}
          options={sourceTypes.map((source) => [source, humanize(source)])} />
        <FieldSelect label="Content type" value={draft.contentType} onValueChange={(contentType) => update('contentType', contentType)}
          options={contentTypes.map((contentType) => [contentType, humanize(contentType)])} />
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
  const id = useId()
  return <div className="form-field">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
  </div>
}

function FilterPanel({ data, filters, activeCount, onChange }: {
  data: LibraryData
  filters: Omit<ItemFilters, 'query' | 'status'>
  activeCount: number
  onChange: (filters: Omit<ItemFilters, 'query' | 'status'>) => void
}) {
  return (
    <Disclosure className="library-filter-disclosure" variant="outline" label={
      <>Source and labels{activeCount > 0 && <Badge className="ms-2" variant="secondary" aria-label={`${activeCount} active filters`}>{activeCount}</Badge>}</>
    }>
      <div className="filter-panel">
        <div className="filter-grid">
        <FieldSelect label="Source" value={filters.sourceType ?? ''} onValueChange={(sourceType) => onChange({ ...filters, sourceType })}
          options={[['', 'Any'], ...sourceTypes.map((value) => [value, humanize(value)] as const)]} />
        <FieldSelect label="Content type" value={filters.contentType ?? ''} onValueChange={(contentType) => onChange({ ...filters, contentType })}
          options={[['', 'Any'], ...contentTypes.map((value) => [value, humanize(value)] as const)]} />
        <FieldSelect label="Collection" value={filters.collectionId ?? ''} onValueChange={(collectionId) => onChange({ ...filters, collectionId })}
          options={[['', 'Any'], ...data.collections.map(({ id, name }) => [id, name] as const)]} />
        <FieldSelect label="Category" value={filters.categoryId ?? ''} onValueChange={(categoryId) => onChange({ ...filters, categoryId })}
          options={[['', 'Any'], ...data.categories.map(({ id, name }) => [id, name] as const)]} />
        <FieldSelect label="Tag" value={filters.tagId ?? ''} onValueChange={(tagId) => onChange({ ...filters, tagId })}
          options={[['', 'Any'], ...data.tags.map(({ id, name }) => [id, `#${name}`] as const)]} />
        <TextField label="From date" value={filters.fromDate ?? ''} onChange={(value) => onChange({ ...filters, fromDate: value })} type="date" />
        <TextField label="To date" value={filters.toDate ?? ''} onChange={(value) => onChange({ ...filters, toDate: value })} type="date" />
        </div>
        {activeCount > 0 && <Button className="mt-2" variant="ghost" type="button" onClick={() => onChange({ sort: filters.sort })}>Clear filters</Button>}
      </div>
    </Disclosure>
  )
}

function SavedItemCard({ item, data, collections, categories, tags, onSaveToLibrary, onDelete }: {
  item: SavedItem
  data: LibraryData
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
        {item.status === 'inbox' && <ProcessingCardAction item={item} data={data} />}
        {onSaveToLibrary && <button className="quiet-button" type="button" onClick={onSaveToLibrary}>Move to All Saved</button>}
        <button className="quiet-button danger-button" type="button" onClick={onDelete}>Remove</button>
      </div>
    </article>
  )
}

const itemTabs = [
  { id: 'overview', title: 'Overview' },
  { id: 'transcript', title: 'Transcript' },
  { id: 'details', title: 'Item details' },
] as const
type ItemTab = (typeof itemTabs)[number]['id']

function ItemDetail({ item, data }: { item: SavedItem; data: LibraryData }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string>()
  const [tab, setTab] = useState<ItemTab>('overview')
  const [cue, setCue] = useState<TranscriptCue>()
  const tabList = useRef<HTMLDivElement>(null)
  const [sourceFile, setSourceFile] = useState<SourceFileRecord>()
  const [sourceFileLookupId, setSourceFileLookupId] = useState<string>()
  const markViewed = data.actions.markViewed
  const getSourceFile = data.getSourceFile
  const storedVideoId = item.sourceMetadata?.youtubeVideoId
  const youtubeVideoId = typeof storedVideoId === 'string' ? storedVideoId : item.url ? identifyYouTubeUrl(item.url)?.videoId : undefined
  const hasTranscriptView = item.sourceType === 'youtube' || item.sourceType === 'instagram'
  const activeTab = tab === 'transcript' && !hasTranscriptView ? 'overview' : tab
  const tabs = hasTranscriptView ? itemTabs : itemTabs.filter(({ id }) => id !== 'transcript')
  const originalUrl = item.url ? safeExternalUrl(item.url) : undefined
  const creator = item.creatorName || (item.creatorHandle ? `@${item.creatorHandle}` : undefined)

  useEffect(() => {
    void markViewed(item.id).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not update recent history.'))
  }, [markViewed, item.id])

  useEffect(() => {
    let active = true
    if (item.sourceFileId) {
      void getSourceFile(item.sourceFileId).then((file) => {
        if (active) {
          setSourceFile(file)
          setSourceFileLookupId(item.sourceFileId)
        }
      }).catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'The imported file could not be opened.')
      })
    }
    return () => { active = false }
  }, [getSourceFile, item.sourceFileId])

  function downloadSourceFile() {
    if (!sourceFile) return
    const objectUrl = URL.createObjectURL(sourceFile.blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = sourceFile.fileName
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }

  async function save(draft: ItemDraft) {
    setError(undefined)
    try {
      const updated = updateSavedItem(item, draft)
      const youtube = updated.url ? identifyYouTubeUrl(updated.url) : undefined
      if (youtube && updated.sourceType === 'website') {
        updated.sourceType = 'youtube'
        updated.contentType = youtube.contentType
        updated.sourceMetadata = { ...(updated.sourceMetadata ?? {}), youtubeVideoId: youtube.videoId }
      }
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
    try {
      await data.actions.deleteItem(item.id)
      window.location.hash = '#/library'
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The saved item could not be removed.')
    }
  }

  function selectTab(id: ItemTab) {
    setCue(undefined)
    setTab(id)
  }

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    const current = tabs.findIndex(({ id }) => id === activeTab)
    const last = tabs.length - 1
    let next: number
    if (event.key === 'ArrowRight') next = current === last ? 0 : current + 1
    else if (event.key === 'ArrowLeft') next = current === 0 ? last : current - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else return
    event.preventDefault()
    selectTab(tabs[next].id)
    tabList.current?.querySelector<HTMLButtonElement>(`#item-tab-${tabs[next].id}`)?.focus()
  }

  function openCue(next: TranscriptCue) {
    setCue(next)
    setTab('transcript')
  }

  return (
    <section className="item-detail" aria-labelledby="item-heading">
      <a className="back-link" href={item.status === 'inbox' ? '#/inbox' : '#/library'}>← Back to {item.status === 'inbox' ? 'Inbox' : 'All Saved'}</a>
      <header className="item-detail-heading">
        <div>
          <p className="item-source-kicker"><span>{humanize(item.sourceType)}</span><span>{humanize(item.status)}</span></p>
          <h1 id="item-heading">{displayTitle(item)}</h1>
          {creator && <p className="item-source-creator">{creator}</p>}
        </div>
        <div className="detail-header-actions">
          {originalUrl && <a className="quiet-button item-open-source" href={originalUrl} target="_blank" rel="noreferrer">Open source <span aria-hidden="true">↗</span></a>}
          <button className="quiet-button" type="button" aria-expanded={editing} onClick={() => setEditing((value) => !value)}>{editing ? 'Stop editing' : 'Edit item'}</button>
        </div>
      </header>
      {error && <p className="library-error" role="alert">{error}</p>}
      {editing && <ManualItemForm initialItem={item} onCancel={() => setEditing(false)} onSave={save} />}
      <div hidden={editing}>
        <div className="item-view-tabs" ref={tabList} role="tablist" aria-label="Saved item views" onKeyDown={navigateTabs}>
          {tabs.map(({ id, title }) => <Button
            key={id} type="button" role="tab" id={`item-tab-${id}`} aria-controls={`item-view-${id}`}
            variant="ghost"
            aria-selected={activeTab === id} tabIndex={activeTab === id ? 0 : -1} onClick={() => selectTab(id)}
          >{title}</Button>)}
        </div>
        <div className="item-view-panel" hidden={activeTab !== 'overview'} id="item-view-overview" role="tabpanel" aria-labelledby="item-tab-overview" tabIndex={0}>
          {item.sourceType === 'text' && <ProcessingPanel item={item} data={data} />}
          <AnalysisPanel item={item} data={data} onTranscriptCue={hasTranscriptView && item.transcriptId ? openCue : undefined} />
        </div>
        {hasTranscriptView && <div className="item-view-panel item-view-transcript" hidden={activeTab !== 'transcript'} id="item-view-transcript" role="tabpanel" aria-labelledby="item-tab-transcript" tabIndex={0}>
          <TranscriptPanel item={item} data={data} active={activeTab === 'transcript' && !editing} cue={activeTab === 'transcript' && !editing ? cue : undefined} />
        </div>}
        <div className="item-view-panel item-metadata-layout" hidden={activeTab !== 'details'} id="item-view-details" role="tabpanel" aria-labelledby="item-tab-details" tabIndex={0}>
          <div className="detail-main">
            <DetailCard title="Source details">
              <dl className="detail-list">
                <DetailRow label="Original link">{item.url && safeExternalUrl(item.url) ? <a href={safeExternalUrl(item.url)} target="_blank" rel="noreferrer">{item.url}</a> : <span>{item.url ? 'Unavailable: invalid web address' : 'Not added'}</span>}</DetailRow>
                <DetailRow label="Content type">{humanize(item.contentType)}</DetailRow>
                {item.sourceType === 'youtube' && <DetailRow label="YouTube video ID">{youtubeVideoId || 'Not recognized from this link'}</DetailRow>}
                <DetailRow label="Creator">{item.creatorName || 'Not added'}</DetailRow>
                <DetailRow label="Creator handle">{item.creatorHandle ? `@${item.creatorHandle}` : 'Not added'}</DetailRow>
                <DetailRow label="Date saved">{item.savedAt || 'Not added'}</DetailRow>
                <DetailRow label="Added to Siftory">{new Date(item.createdAt).toLocaleDateString()}</DetailRow>
                {item.sourceFileId && <DetailRow label="Original file">{sourceFileLookupId !== item.sourceFileId ? 'Loading local file…' : sourceFile?.savedItemId === item.sourceFileId ? <button className="text-link-button" type="button" onClick={downloadSourceFile}>Download {sourceFile.fileName} ({Math.ceil(sourceFile.size / 1024)} KB)</button> : 'The original local file is unavailable.'}</DetailRow>}
              </dl>
            </DetailCard>
            {!hasTranscriptView && item.sourceType !== 'text' && <ProcessingPanel item={item} data={data} />}
            {item.description && <DetailCard title="Description or caption"><p className="detail-copy">{item.description}</p></DetailCard>}
            <DetailCard title="Your notes"><p className="detail-copy">{item.userNotes || 'No notes yet.'}</p></DetailCard>
          </div>
          <aside className="min-w-0" aria-label="Organize item">
            <DetailCard title="Organization">
              <div className="divide-y">
                <RelationPicker title="Collections" items={data.collections} selected={item.collectionIds} onToggle={(id, checked) => toggleRelation('collectionIds', id, checked)} />
                <RelationPicker title="Categories" items={data.categories} selected={item.categoryIds} onToggle={(id, checked) => toggleRelation('categoryIds', id, checked)} />
                <RelationPicker title="Tags" items={data.tags} selected={item.tagIds} onToggle={(id, checked) => toggleRelation('tagIds', id, checked)} />
              </div>
            </DetailCard>
          </aside>
          <Button className="item-remove text-destructive hover:text-destructive" variant="ghost" type="button" onClick={() => void remove()}><Trash2 aria-hidden="true" />Remove from library</Button>
        </div>
      </div>
    </section>
  )
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return <Card role="region" aria-labelledby={id} className="min-w-0 gap-0 py-0">
    <CardHeader className="px-4 py-3 sm:px-5">
      <h2 id={id} className="text-sm font-semibold">{title}</h2>
    </CardHeader>
    <CardContent className="border-t px-4 py-2 sm:px-5">{children}</CardContent>
  </Card>
}

function RelationPicker<T extends { id: string; name: string }>({ title, items, selected, onToggle }: {
  title: string
  items: T[]
  selected: string[]
  onToggle: (id: string, checked: boolean) => void
}) {
  const groupId = useId()
  return (
    <div className="py-2" role="group" aria-labelledby={groupId}>
      <h3 id={groupId} className="mb-1 text-sm font-medium">{title}</h3>
      {items.length ? items.map(({ id, name }, index) => {
        const checkboxId = `${groupId}-${index}`
        return <Label key={id} htmlFor={checkboxId} className="min-h-control gap-2 font-normal">
          <Checkbox id={checkboxId} checked={selected.includes(id)} onCheckedChange={(checked) => onToggle(id, checked === true)} />
          <span className="min-w-0">{name}</span>
        </Label>
      }) : <p className="text-sm text-muted-foreground">No {title.toLocaleLowerCase()} created yet.</p>}
    </div>
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
      {items.length ? <ul className="saved-items saved-items--list">{filterAndSortItems(items).map((item) => <li key={item.id}><SavedItemCard item={item} data={data} collections={data.collections} categories={data.categories} tags={data.tags} onDelete={() => { if (window.confirm(`Remove “${displayTitle(item)}” from this library?`)) void data.actions.deleteItem(item.id).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'The item could not be removed.')) }} /></li>)}</ul> : <div className="library-empty-state"><h2>This collection is empty.</h2><p>Add it to an item from that item's detail page.</p></div>}
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
