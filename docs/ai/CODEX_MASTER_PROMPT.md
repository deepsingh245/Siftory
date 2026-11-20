# Siftory — Codex Master Prompt

Use this prompt with Codex opened at the Siftory repository root. The current repository status is recorded in `docs/PROJECT_SETUP.md`.

---

## Role

Act as a senior product engineer, software architect, UX designer and technical lead.

You are working on **Siftory**, a local-first personal AI Research Library. First inspect the repository to determine whether an application starter exists. Evolve an existing starter when present; if this repository still contains only the documentation foundation, report that clearly and do not pretend an app is already implemented.

You are running locally through Codex with ChatGPT sign-in. Do not assume an OpenAI API key or another paid AI API is available.

Do not blindly rebuild the starter. Inspect it first and preserve working foundations wherever possible.

## 1. Product vision

Siftory lets users collect, organise, understand, search and research information saved from different platforms.

Sources eventually include:
- Instagram saved posts and Reels through user-provided data exports and links.
- YouTube videos, Shorts and playlists.
- Reddit, X, TikTok and Pinterest.
- Chrome and Firefox bookmarks.
- Articles, websites and web pages.
- PDFs, documents, text, screenshots and images.
- Additional formats through extensible import adapters.

Core capabilities:
1. Import and manage saved content.
2. Automatically organise content when processing is available.
3. Extract transcripts and text.
4. Generate structured summaries and key takeaways.
5. Identify tools, websites, products and concepts mentioned.
6. Capture important timestamps where supported.
7. Search across the library.
8. Research using saved knowledge and optional external sources.
9. Preserve original sources and traceable citations.
10. Export and restore the library manually.

Read `docs/PRODUCT.md` and `docs/REQUIREMENTS.md`.

## 2. Non-negotiable architecture constraints

- Local-first application.
- React and TypeScript, preserving the starter's setup where practical.
- IndexedDB for persistent local application data, using an appropriate existing or lightweight abstraction.
- Manual export and restore.
- No mandatory Firebase, Supabase, paid backend, Docker or paid API.
- No automatic cloud synchronisation in the initial product.
- Provider-independent architecture for future AI and extraction providers.
- Core library remains functional without AI credentials.
- Never assume a ChatGPT subscription provides an application runtime API.
- Never extract or reuse Codex authentication credentials for app features.
- Never put secrets in frontend code.
- Never represent unavailable or failed processing as successful.

Codex is the development agent, not the application's AI runtime.

## 3. Product identity and design direction

Name: **Siftory**

Tagline: **Save less. Understand more.**

Description: **Your personal library for everything worth knowing.**

Design concept: **Quiet Editorial Research Desk**

Initial palette:
- Graphite: `#171B1A`
- Secondary surface: `#252C29`
- Parchment: `#E8E9DF`
- Sage: `#A5B8A0`
- Amber: `#D6A66D`

Use design tokens rather than hardcoded colours throughout the application.

Design principles:
- Dark-first, with a complete light theme.
- Content-first hierarchy and readable typography.
- Subtle borders and restrained shadows.
- Calm, focused, professional interface.
- Responsive desktop and mobile layouts.
- Consistent iconography and spacing.

Avoid generic AI dashboard styling, excessive gradients, neon AI effects, pervasive glassmorphism, oversized dashboard statistics, decorative animations and visual clutter.

Read `docs/DESIGN_SYSTEM.md` and `docs/UI_UX.md`.

## 4. Main application structure

Primary navigation:
- Inbox
- All Saved
- Collections
- Categories
- Recently Viewed
- Research
- Processing Queue
- Insights
- Settings

Include global search in the application header.

### Inbox
Newly imported content, items awaiting review and items awaiting processing. Support process now, queue, retry, remove and import details.

### All Saved
Central library with list/grid layouts, keyword search, source/type/date/category/tag/status filters, sorting, multi-select and bulk actions.

### Collections
User-created groups such as Frontend Development, AI Tools, Business Ideas and Personal Learning. Collections are distinct from automatically suggested categories.

### Categories and tags
AI-suggested classifications must be editable by the user.

### Saved item detail
Show original URL, platform, creator, saved date, preview if available, extracted text, transcript if available, summary, takeaways, mentioned tools/sites/products, concepts, timestamps, categories, tags, collections, related items and processing history.

Do not invent a transcript or claim inaccessible media was analysed.

### Research
Three modes:
1. Library Search — saved content only.
2. Library + Web — saved content plus accessible external sources.
3. Deep Research — broader research and comparisons.

Answers must distinguish saved evidence, external sources, AI interpretation, conflicting information and unverified claims. Cite relevant saved items and external sources. Include timestamps when supported.

### Processing Queue
States:
- Pending
- Queued
- Extracting
- Transcribing
- Analysing
- Indexing
- Completed
- Failed
- Needs Attention
- Skipped

A browser-only queue cannot run continuously after the application is closed. Explain this limitation accurately.

### Settings
Theme, import/export, storage usage, processing preferences, AI permissions/provider configuration, data management and backup/restore.

## 5. Import and content processing

Use extensible source-specific adapters. Normalise successful imports into a common saved-item model.

Initial priority:
1. Instagram JSON export.
2. Chrome bookmarks HTML.
3. Manual URL import.
4. PDF and text documents.
5. Additional adapters later.

Instagram requirements:
- Accept a single array of exported objects.
- Parse available URL, caption, title, timestamp, owner and metadata.
- Preserve original records where practical.
- Repair encoding issues carefully; never silently destroy original text.
- Deduplicate imported records.
- An empty media array does not prove an item is not a Reel.
- An Instagram URL does not guarantee its video is downloadable or accessible.
- Do not require Instagram credentials.
- Do not bypass platform restrictions.

For YouTube and other video sources, check transcript/content availability, retain the source URL and report extraction failures honestly.

Distinguish original content, extracted content, AI-generated analysis and user annotations.

## 6. Data and persistence

Model these domain concepts separately:
- SavedItem
- ExtractedContent
- Category
- Tag
- Collection
- ProcessingJob
- ResearchSession
- SourceMetadata

Implement stable IDs, URL normalisation, content fingerprints, deduplication, processing version tracking, reusable results, safe updates/deletion and manual backup/restore.

Do not rerun expensive processing when valid results already exist.

Read `docs/DATA_MODEL.md` and `docs/ARCHITECTURE.md`.

## 7. UI engineering standards

- Reuse existing working components.
- Create generic components where there is genuine reuse.
- Use accessible semantic HTML.
- Use consistent typography, spacing and component variants.
- Support responsive desktop and mobile layouts.
- Ensure keyboard accessibility.
- Provide useful loading, empty, error and success states.
- Keep business logic out of presentation components.
- Use clear TypeScript types.
- Avoid unnecessary dependencies and duplicated styling.
- Do not create mock functionality that appears operational but does nothing.

If a feature is not implemented, label it honestly.

## 8. Documentation

Maintain:
- `AGENTS.md`
- `docs/PRODUCT.md`
- `docs/REQUIREMENTS.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/UI_UX.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/CODEX_WORKFLOW.md`

Read existing documents before changing them. Do not delete confirmed requirements. Avoid duplicate or contradictory documentation.

## 9. Phased implementation

### Phase 0 — Existing project audit
Inspect project structure, framework, dependencies, routing, state management, styling, reusable components, scripts, build commands and existing functionality. Identify risks and gaps. Document actual architecture. Do not replace infrastructure without a concrete reason.

### Phase 1 — Documentation and design foundation
Create/update docs, design tokens, typography, theme system, application shell, sidebar, header, navigation and reusable UI components. Establish consistent visual quality before building all features.

### Phase 2 — Library foundation
Implement local persistence, saved-item model, Inbox, All Saved, Collections, Categories, Tags, search, filters and item details.

### Phase 3 — Import system
Implement and test initial import adapters.

### Phase 4 — Processing architecture
Implement queue lifecycle, processing interfaces and provider-independent boundaries.

### Phase 5 — Knowledge and research
Implement structured analysis, indexing, retrieval and research workflows when actual providers are available.

### Phase 6 — Reliability
Test data integrity, export/restore, performance, accessibility, error handling and security.

## 10. Codex working agreement

- Inspect before editing.
- Plan before large changes.
- Work in small, reviewable steps.
- Keep the app runnable.
- Run relevant tests and builds.
- Check diffs for accidental changes.
- Avoid unnecessary file movement.
- Do not silently change requirements.
- Ask before significant irreversible architectural decisions.
- Track incomplete tasks and report blockers honestly.
- Update docs when implementation changes behaviour or decisions.

## 11. Starting application development

Do not implement the entire product in one task. The documentation foundation and initial folder map are already in place; do not recreate them. Before application work:

1. Audit the repository and any existing starter. If no starter exists, record the absence and identify what must be supplied or selected before app implementation.
2. Read existing project files and the relevant documentation.
3. Reconcile docs only where the actual starter reveals new information; preserve confirmed requirements.
4. Compare the desired architecture with the actual starter.
5. Identify conflicts, missing decisions and reusable code.
6. Confirm or adapt the empty source scaffold to the starter's conventions.
7. Establish design tokens and screen-level UI plans before broad feature work.
8. Produce a phased implementation plan with dependencies and acceptance criteria.
9. Report what exists, what can be reused, what must change and why.

Do not begin large-scale feature implementation until the audit and foundation are complete. If no critical decision blocks the work, proceed with the design foundation after presenting the audit. Do not choose exact libraries or claim build/test status when no application starter is present.

The objective is not to generate the most code. It is to build a coherent, reliable product that can be maintained and extended over time.
