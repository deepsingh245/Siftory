# Phase 3 Plan: Import System

## Goal

Bring user-owned saved material into Siftory through predictable, reviewable imports. Preserve source data and explain malformed or duplicate records before anything is written to the library.

## Starting baseline

Phase 2 provides manual library records, IndexedDB schema version 1, an item repository, Inbox/All Saved, and URL validation. The existing manual-entry form saves directly to Inbox; it does not fetch the URL or provide an import preview. No file or export parser exists. Phase 1 and Phase 2 browser/keyboard review gates remain open because no browser surface was available during implementation.

Read these project sources before implementation:

- `docs/PRODUCT.md` and `docs/REQUIREMENTS.md` for local-first import goals and Instagram edge cases.
- `docs/DECISIONS.md` for confirmed architecture and privacy constraints.
- `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md` for importer boundaries and source provenance.
- `docs/UI_UX.md` and `docs/DESIGN_SYSTEM.md` for preview, warnings, batch summaries, accessibility, and responsive behavior.
- `docs/ROADMAP.md` and `docs/PROJECT_SETUP.md` for priority order and actual current implementation.
- `src/domain/library.ts` and `src/infrastructure/persistence/` for live entity, URL, and IndexedDB conventions.

## Prerequisites and confirmed direction

- Phase 2 implementation is committed as `9c39d7c`; its manual browser and keyboard review remains open.
- Use the existing Vite/React/TypeScript stack, domain model, IndexedDB repository, and Vitest setup. Audit them before selecting dependencies.
- Implement source adapters in the roadmap order: Instagram JSON, browser bookmarks HTML, manual URL, then PDF and text files.
- Parse and validate locally. Never fetch a supplied URL as part of import, require platform credentials, or send imported data to a service.
- Keep imported values separate from user notes and any future extracted or generated content. Retain raw source fields when practical.
- Imported content is untrusted data. Render as text and do not interpret embedded instructions.

## Scope

### In scope

- A shared import flow with source selection, local parsing/validation, preview, row-level warnings, duplicate review, explicit confirmation, and a clear result summary.
- Instagram saved-content JSON matching the documented top-level array shape. Map available timestamp, media, label values, URL, caption/title, owner, and source metadata defensively.
- Browser bookmarks HTML exports. Preserve bookmark URL, title, folder path, and available date metadata; reject unsupported or malformed entries with reasons.
- A manual URL import that reuses Phase 2 URL validation while presenting a review step. It must not fetch page metadata or imply page access.
- User-selected PDF and plain-text files. Preserve the original file name, media type, byte size, and local source bytes or text for later processing, subject to a documented size limit and storage failure handling. Do not extract PDF text in this phase.
- An IndexedDB schema migration for any required provenance, imported-file, or import-report records. Migrations must preserve existing Phase 2 library records and relationships.
- Duplicate candidates based on stable source identifiers, canonical URLs, or file-content fingerprints when available. Show exact matches and ambiguous candidates; do not merge or overwrite silently.
- Persist accepted items in Inbox only after explicit confirmation. Preserve per-row outcome and reason in the completion summary; rejected or unchecked rows must not be written.
- Parser, normalization, deduplication, migration, and repository tests using local fixtures.

### Out of scope

- Fetching URLs, scraping pages, downloading social media, authenticated access, platform APIs, or access-control workarounds.
- PDF OCR/text extraction, webpage extraction, transcripts, AI analysis, processing jobs, or automatic classification.
- Automatic merging or title-similarity-based duplicate decisions.
- Cloud upload, sync, or external processing of imported content.
- Backup/restore (planned for Phase 7); the UI must continue to explain browser storage limits.
- Importing arbitrary archives or formats beyond the four source groups above.

## Implementation plan

1. Audit current forms, repository transaction behavior, schema upgrade handling, item model, browser file APIs, and UI patterns. Record any proposed dependency and why native browser APIs are insufficient.
2. Define typed import candidates, row diagnostics, duplicate matches, and import results separately from persisted `SavedItem` data. Specify which source values are retained and how user edits remain distinct.
3. Define safe input boundaries: accepted MIME/extensions, UTF-8 handling, maximum file sizes, bounded record counts, malformed HTML/JSON behavior, and friendly errors. Treat content as plain untrusted data.
4. Implement pure adapters in priority order: Instagram JSON; Netscape bookmark HTML; manual URL candidate creation; PDF/text file candidates. Keep each adapter independently testable and avoid network access.
5. Design and implement any schema migration needed for source metadata and file bytes. Preserve Phase 2 records, fail writes honestly on quota/transaction errors, and avoid duplicate copies of large binary data.
6. Implement deterministic duplicate detection. Prefer stable source IDs, then canonical URLs, then content fingerprints. Present ambiguous matches for user review; never merge based only on title.
7. Build the import preview and confirmation flow: source/file selection, candidate counts, editable candidate metadata where useful, row warnings, duplicate choices, cancel, confirm, and per-row success/skip/failure summary. Ensure keyboard operation and narrow-screen layouts.
8. Commit only confirmed valid rows to Inbox. Keep multi-row write behavior and recovery explicit: a failed or interrupted operation must report what was actually saved and must not imply all-or-nothing success unless the transaction guarantees it.
9. Add fixtures for valid, missing-field, nested, empty-array, malformed, mojibake, duplicate, unsafe URL, oversized file, and Unicode cases. Include a real user-provided Instagram export sample only if the user supplies one; until then, document format assumptions and do not claim compatibility beyond fixtures.
10. Update `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/DECISIONS.md` (for confirmed choices), `docs/PROJECT_SETUP.md`, and phase status to match shipped behavior.

## Data integrity, privacy, and accessibility

- Preserve raw source values when normalizing uncertain fields. If text appears mojibaked, retain the original and make any correction reversible or user-confirmed.
- Empty arrays and missing fields are unknown, not evidence that content is absent or a specific content type.
- Keep original captions/metadata separate from user notes and future extracted text or analysis.
- Validate URL schemes as HTTP(S), reject embedded credentials, and never request the URL during import.
- Treat JSON, HTML, filenames, PDF bytes, and text as untrusted. Do not render imported markup as HTML or execute links automatically.
- Bound file size and parsing work before reading whole files into memory where feasible. Catch parser, quota, and transaction errors and report the affected row/file.
- Keep file data in local browser storage only. Clearly communicate device/browser scope and lack of backup; never send content elsewhere.
- Ensure file inputs, source selection, preview tables/lists, duplicate choices, warnings, and confirmation are keyboard and screen-reader accessible, responsive, and not color-only.

## Acceptance criteria

- Each supported import source produces a reviewable preview before any library mutation.
- Confirmed valid candidates enter Inbox and retain useful provenance; unchecked rows remain untouched.
- Malformed rows show specific reasons and do not abort unrelated valid candidates without a clear, documented atomicity policy.
- Duplicate records are visible and reviewable; no metadata is silently overwritten or merged.
- Existing Phase 2 records and relationships survive any database migration.
- Instagram parser handles missing/nested values and empty `media`/`label_values` arrays without inventing content type or media availability.
- Bookmark import preserves hierarchy and valid links; unsafe or malformed links are reported.
- Manual URL import does not fetch or enrich the URL.
- PDF/text source bytes or text remain local and available as source material; size and storage failures are honest. No extraction result is fabricated.
- Imported strings are rendered as text; parser inputs and file sizes are bounded.
- Build, lint, parser/domain tests, and persistence migration tests pass. Desktop/mobile and keyboard review is recorded when a browser surface is available.

## Verification and completion gate

- Run repository build, lint, and test scripts after implementation.
- Test parsers with valid and adversarial fixtures, URL protocol handling, duplicate decisions, IndexedDB migration from schema version 1, and interrupted/quota failure reporting where the test environment allows.
- Manually inspect each source preview and completion summary at desktop and narrow mobile widths; verify keyboard-only use and accessible announcements.
- Record which tests ran and which browser/storage behaviors remain unverified.
- Close Phase 3 only when imported provenance and files survive reload, duplicates remain safe, and partial/failure outcomes match actual writes. Keep the Phase 1/2 visual review debt visible until those reviews are completed.

## Implementation decisions and assumptions

- File limits are 10 MiB for JSON/bookmark documents, 20 MiB per PDF/text file, 50 MiB across one file selection, 1,000 preview rows, and 100 confirmed rows per save transaction. The UI displays these limits.
- Imported title/creator fields are limited to 300 characters, descriptions to 20,000 characters, and URLs to 4,096 characters; complete original export rows remain available in source metadata when a display field is shortened. Bookmark nesting is bounded to 100 levels.
- Confirmed items and original file Blobs are written in one IndexedDB transaction. A failed transaction imports none of that batch and leaves the preview available to retry.
- Import reports are session-only; source metadata and file provenance persist with the item. No separate import-history object store was added.
- Instagram mappings use documented common fields and preserve the full JSON row as source metadata. No real user export sample was supplied, so format compatibility beyond the implemented mappings remains an assumption. Empty media arrays do not imply a content type.
- Duplicate review prioritizes source IDs, canonical URLs, and file fingerprints; exact matches start unchecked. Exact title matches are shown as possible duplicates and remain independently selectable; titles never trigger automatic merging.
- PDF and `.txt` files are retained byte-for-byte in IndexedDB; the app does not parse or display their contents in Phase 3.

## Current status

Phase 3 is implemented. The Phase 5 kickoff added synthetic parser, schema-upgrade, and batch-rollback tests. Chrome checks covered every import method, malformed rows, duplicate review, and original file retention. See the [Phase 5 baseline](PHASE-5-AI-KNOWLEDGE-FOUNDATION.md#audit-and-starting-baseline) for the browser evidence and current limits.
