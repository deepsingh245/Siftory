# Siftory UI/UX Blueprint

## Application shell

Desktop structure:
- Left navigation sidebar.
- Top header with global search, quick add/import and user/settings actions.
- Main content region.
- Optional right contextual detail panel on screens where it adds value.

Mobile structure:
- Compact top bar.
- Drawer or bottom navigation based on existing starter conventions.
- Detail screens become full-screen pages.
- Filters use a drawer/sheet rather than a permanently visible panel.

## Primary navigation

1. Inbox
2. All Saved
3. Collections
4. Categories
5. Recently Viewed
6. Research
7. Processing Queue
8. Insights
9. Settings

Global search should be accessible from every main screen.

## Screen specifications

### Inbox

Purpose: review newly imported items and decide what happens next.

Content:
- New imports.
- Items needing attention.
- Import batch summary.
- Source and import date.
- Process now / queue / skip actions.
- Validation warnings.

States:
- Empty inbox with clear import action.
- Import in progress.
- Partial import with row-level errors.
- Items waiting for review.

### All Saved

Purpose: main library and rediscovery surface.

Content:
- Page title and item count.
- Search.
- Filters and sorting.
- List/grid toggle.
- Multi-select actions.
- Saved item cards or rows.

Filters:
- Platform/source.
- Content type.
- Saved date.
- Category.
- Tag.
- Collection.
- Processing state.

### Collections

Purpose: user-defined groupings.

Content:
- Collection list/grid.
- Name, description and item count.
- Create, rename and delete.
- Collection detail with saved items.

### Categories

Purpose: browse topics across the library.

Content:
- Category list and counts.
- AI-suggested versus user-defined distinction.
- Rename, merge or remove where safe.
- Category detail.

### Saved item detail

Suggested layout:
- Header: title, source, creator, saved date and original link.
- Main column: preview, transcript/extracted content, summary and key takeaways.
- Secondary panel: categories, tags, collections, processing state and related items.
- Timeline/timestamp section when timing data exists.

The detail page must work even when only a URL and metadata are available.

### Research

Purpose: investigate questions using saved knowledge and optionally external sources.

Elements:
- Research question input.
- Mode selector: Library Search, Library + Web, Deep Research.
- Evidence/result area.
- Source citations.
- Saved-item references.
- Research session history.

Clearly identify which statements come from saved content versus external sources or model interpretation.

### Processing Queue

Purpose: make asynchronous work visible and controllable.

Elements:
- Status tabs or filters.
- Item title/source.
- Current stage.
- Progress only when measurable.
- Error reason.
- Retry, pause/defer or skip actions as supported.

Do not show fabricated percentage progress.

### Insights

Purpose: reveal useful patterns in the saved library.

Potential content:
- Frequent topics.
- Frequently mentioned tools/websites.
- Recently active subjects.
- Related items.
- Content distribution by source/type.

Do not prioritise vanity charts. Only show insights supported by actual indexed data.

### Settings

Sections:
- Appearance.
- Import and export.
- Storage.
- Processing preferences.
- AI providers and permissions.
- Privacy and data controls.
- About/version.

## Key user journeys

### Import journey
1. User chooses an import source.
2. User selects a file or enters a URL.
3. App validates the source.
4. App previews the import and warnings.
5. App normalises and deduplicates records.
6. User confirms import.
7. Items appear in Inbox.
8. User processes now or queues for later.

### Rediscovery journey
1. User opens global search.
2. Enters a natural-language phrase or keyword.
3. Results show matching saved items.
4. User applies filters if necessary.
5. User opens an item and sees its source and available analysis.

### Research journey
1. User asks a question.
2. Chooses the research scope.
3. App retrieves relevant library records.
4. External research is used only in modes that permit it.
5. Answer includes traceable citations and limitations.
6. User can save the session.

## Interaction principles

- Prefer clear direct actions over hidden gestures.
- Confirm destructive actions.
- Support undo where practical.
- Keep filters visible and removable.
- Preserve search/filter state when navigating back.
- Use clear status language.
- Do not force AI processing to import or browse saved items.
- Do not hide source links behind AI summaries.
