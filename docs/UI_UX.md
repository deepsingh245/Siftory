# Siftory UI/UX Blueprint

## Application shell

Desktop structure:
- Left navigation sidebar.
- Global toolbar with the sidebar toggle, library search, import where useful, and the theme switcher. Each page has one main heading and a shared position for its actions.
- Main content region.
- Optional right contextual detail panel on screens where it adds value.

Mobile structure:
- Compact top bar.
- Drawer or bottom navigation based on existing starter conventions.
- Detail screens become full-screen pages.
- Filters use a drawer/sheet rather than a permanently visible panel.

## Primary navigation

1. Dashboard
2. All Saved
3. Inbox
4. Import
5. Collections
6. Categories
7. Tags
8. Recently Viewed
9. Research
10. Processing Queue
11. Settings

Global search should be accessible from every main screen.

## Screen specifications

### Dashboard

The default view adapts shadcn's free `dashboard-01` block. Summary cards show the local library size, Inbox, attached transcripts, and items with jobs that need attention. Activity uses actual dates when items were added, with a table of daily counts available under the chart. The recent items table links to each item. The dashboard shares search, navigation, and the theme switch with the rest of Siftory.

### Inbox

Purpose: review newly imported items and decide what happens next.

The default list pairs each title and creator with the saved date and a short review status. Use the stage filter to find transcripts, completed analyses, or items that need attention. Row actions reveal the original link, processing, filing, and removal. Bulk AI selection shows checkboxes and highlights selected rows.

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

- Keep the saved title, source, and original link in one compact header.
- Open on Overview for the saved summary, key points, and app links. Put source quotes behind named disclosures, with a direct jump to the transcript when a quote has a verified timestamp.
- Give Transcript and Item details dedicated keyboard navigable tabs. Keep the transcript player and edit controls together. Put source metadata, notes, labels, and item removal in Item details.
- Keep the GPT review and consent controls available after a result is saved through a "Run another analysis" disclosure. Keep them visible when no result exists.
- Use one column at small widths and check the layout at 320 CSS pixels. Preserve the item URL while navigating the views.

This follows the [WAI tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) and [GOV.UK guidance on revealing secondary detail](https://design-system.service.gov.uk/components/details/).

The detail page must work even when only a URL and metadata are available.

The transcript reads as one continuous document with optional timestamp controls and local audio. A confirmation is visible on the transcript and in Inbox. Text editing preserves timings and audio references for the same source. Replacement and removal sit under Manage transcript. OpenAI receives the selected text only after separate consent.

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

The Settings page groups the ChatGPT connection and local storage into separate cards. The cards sit side by side on wide workspaces and stack on narrow ones. Show library connection errors and retry actions in Local storage. Appearance is available in the workspace header.

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
