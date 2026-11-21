# Phase 2 Plan: Library Foundation

## Goal

Make Siftory useful as a local library before adding extraction or AI. A user should be able to create and maintain saved records, organize them, find them through keyword search and filters, and return to recently viewed items. Records and their relationships must survive a reload.

## Starting baseline

When this plan was drafted, the app had the Phase 1 responsive shell and a first-use library state. There was no router, library domain model, persistence, or test runner. The Phase 2 implementation now provides those library foundations; its review status is recorded at the end of this plan.

Use these project sources:

- `docs/PRODUCT.md` for library goals and local-first constraints.
- `docs/REQUIREMENTS.md` for library, collections, categories, tags, details, and data portability requirements.
- `docs/DATA_MODEL.md` for proposed domain entities and relationships.
- `docs/ARCHITECTURE.md` for repository boundaries and IndexedDB direction.
- `docs/UI_UX.md` for Inbox, All Saved, collection, and item-detail behavior.
- `docs/DESIGN_SYSTEM.md` for interaction and visual conventions.
- `docs/DECISIONS.md` and `docs/PLAN.md` for confirmed choices and phase gates.
- `docs/PROJECT_SETUP.md` for the audited runtime, scripts, and current limitations.

## Prerequisites and decisions

- Phase 0 is complete.
- Phase 1 implementation is committed. Its desktop/mobile review remains open because no browser surface was available. The user explicitly directed work to continue with Phase 2; retain the Phase 1 review as an outstanding quality check.
- Preserve Vite + React + TypeScript, npm, Oxlint, and the existing CSS conventions.
- Use IndexedDB for user library records through the selected `idb` promise wrapper; schema version 1 is documented in `docs/DECISIONS.md`.
- Use Vitest with fake-indexeddb for domain and repository tests; the selection is recorded in `docs/DECISIONS.md`.
- Use native hash routes for screen and item navigation; no routing dependency is needed for the current scope.
- Manual entry of one saved record is in scope so core library CRUD can be used and verified before the Phase 3 batch/import adapters. It must not fetch the URL or imply that page contents were extracted.
- Keep AI, external services, cloud sync, and API credentials out of this phase.

## Scope

### In scope

- Define typed library entities and repository boundaries for saved items, collections, user-created categories and tags, and recently viewed history.
- Add versioned local database creation and migration handling, with recoverable user-facing errors for unsupported storage, quota, or transaction failures.
- Add a small manual record form for a title and/or `http`/`https` URL, with optional source/content type, creator, and user notes. New records enter Inbox; no network request is made.
- Implement Inbox review and transition to All Saved, plus All Saved list and grid views.
- Implement item detail and editing for available metadata and user notes, and local deletion with confirmation.
- Create, rename, and delete collections, categories, and tags; support many-to-many item relationships where required.
- Implement keyword search over available local fields (title, URL, creator, description, and user notes), filters, sorting, and recently viewed.
- Add focused domain and persistence tests using the selected test runner.
- Replace the Phase 1 empty state and planned navigation labels for the views delivered in this phase.

### Out of scope

- Parsing Instagram exports, bookmark files, PDFs, text files, or import batches.
- Fetching URLs, scraping pages, downloading media, extracting transcripts, or loading remote thumbnails.
- AI analysis, generated categories/tags, semantic search, processing jobs, and research sessions.
- Backup/restore workflows (planned for release readiness) and cloud synchronization.
- Automatic metadata enrichment, merge automation, or destructive duplicate merging.
- User accounts, server APIs, or cross-device storage.

## Implementation steps

1. Preserve the outstanding Phase 1 visual-review note. Confirm its impact when a browser surface is available; the user has directed Phase 2 to proceed. The persistence, test-runner, and navigation choices are recorded in `docs/DECISIONS.md`.
2. Define the minimum typed entity shape and runtime validation. Keep original source metadata, extracted content, analysis, and user notes as separate concepts; only implement fields needed by this phase.
3. Create a versioned IndexedDB schema and repository interfaces/implementations. Handle database open failures, blocked upgrades, version changes, aborted transactions, and quota errors without reporting a write as successful when it failed.
4. Add create, read, update, and delete operations for saved records, with safe `http`/`https` URL validation and Inbox-to-All-Saved transitions.
5. Add collection, category, and tag operations and their item relationships. Deleting an organizational label must not delete saved items or leave broken references.
6. Implement Inbox, All Saved, item detail/edit, collection/category browsing, and recently viewed views using the least-complex navigation decision selected in step 1.
7. Add list/grid presentation, keyword search, filters, and sorting over fields actually stored in this phase. Keep filters removable and preserve them when navigating back where practical.
8. Add domain and repository tests for validation, CRUD, persistence across reload/reopen, migrations, relationships, search, filters, and deletion behavior.
9. Update `docs/PROJECT_SETUP.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and phase status in `docs/PLAN.md` to match the code that exists.

## Data, privacy, accessibility, and migration considerations

- Library content stays in the browser's local IndexedDB. Do not send URLs, notes, or metadata to a remote service.
- Treat all user text as untrusted data. Render it as text, validate URL protocols, and never automatically fetch a user-provided URL.
- Store user notes and original/source metadata separately from extracted or generated content added in future phases.
- Version the database from its first release. Migration code must preserve records and relationships; this phase starts with no production database to migrate.
- Handle browser storage being unavailable or full. Explain that local browser data can be cleared or evicted; do not claim backup protection before export/restore exists.
- Use semantic forms and landmarks, labelled inputs, keyboard-operable actions, visible focus, appropriate confirmation for destructive local deletion, and clear empty/error states.
- Ensure list/grid, filters, and item detail reflow on narrow screens; do not use color alone for selection or processing/status states.

## Acceptance criteria

- A user can create a local saved record without any network request, view it, edit it, organize it, search/filter it, and remove it.
- New manual records appear in Inbox and can be moved to All Saved; these states remain correct after reload.
- Saved records and their collection/category/tag relationships persist through reload and database reopen.
- A record may belong to multiple collections and have multiple tags/categories; deleting a collection, category, or tag does not delete the record.
- All Saved supports list/grid, keyword search over the fields available in this phase, documented filters, and sorting.
- Recently Viewed reflects actual opened records and survives reload.
- Invalid or unsafe URL schemes are rejected; the app never fetches user-entered URLs in this phase.
- Storage and transaction errors are surfaced honestly; failed writes are not shown as saved.
- The delivered navigation destinations are usable, and unfinished destinations remain visibly unavailable.
- No AI, backend, cloud service, extraction, or backup behavior is represented as implemented.
- Build, lint, and focused domain/repository tests pass; desktop/mobile and keyboard review is recorded.

## Verification

- Run `npm run build`, `npm run lint`, and the selected test command.
- Test database create/reopen, CRUD, relationship preservation, migration behavior, and failed transaction handling in the available browser environment.
- Manually review Inbox, All Saved, item detail, organization, list/grid, search/filter, empty/error states, and narrow-screen layouts.
- Verify keyboard-only form entry, navigation, filters, dialogs/confirmation, and focus restoration.
- Do not claim browser persistence or accessibility behavior was verified if no compatible browser is available.

## Completion gate

Review the implemented library against the acceptance criteria and record actual verification evidence. Resolve or document migration and storage limitations before starting Phase 3. Update `docs/PLAN.md`, `docs/PROJECT_SETUP.md`, and the affected architecture/data-model documents only to reflect behavior that is present in the repository.

## Current status

Implementation is complete. Build, lint, and automated domain/repository tests pass. Manual browser review of responsive layouts and keyboard flows remains pending because no browser surface was available; do not mark the review gate complete until that check is recorded.
