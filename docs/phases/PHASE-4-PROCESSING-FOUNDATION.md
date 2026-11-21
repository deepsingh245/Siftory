# Phase 4 Plan: Processing Foundation

## Goal

Make local processing work visible, persistent, and recoverable. A user must know which sources Siftory can process, what stage a supported job reached, and what failed. Processing stays optional; the library and imports remain useful without AI or network access.

## Starting baseline

Phase 3 provides IndexedDB schema version 2, `SavedItem` provenance, and locally stored original PDF/text Blobs. Imports can create Inbox items, but there is no processing queue, job store, extraction output, or capability report. URLs are not fetched. The current product has no runtime AI provider or credentials. Phase 1–3 manual browser and keyboard review gates remain open; Phase 3 parser/migration tests are also outstanding.

Read these project sources before implementation:

- `docs/PRODUCT.md` and `docs/REQUIREMENTS.md`, especially the processing queue and privacy requirements.
- `docs/DECISIONS.md` for the local-first, no-mandatory-AI, and no-platform-bypass constraints.
- `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md` for provider boundaries, job states, and provenance.
- `docs/UI_UX.md` and `docs/DESIGN_SYSTEM.md` for queue controls, honest progress, accessible status, and responsive layout.
- `docs/ROADMAP.md`, `docs/PROJECT_SETUP.md`, and the Phase 3 plan for actual capabilities and review debt.
- `src/domain/library.ts`, `src/infrastructure/persistence/libraryDatabase.ts`, and `libraryRepository.ts` for current entities, schema version 2, and transaction patterns.
- `src/features/import/ImportPage.tsx` and `src/domain/imports.ts` for current file limits and locally persisted source data.

## Prerequisites and boundaries

- Phase 3 implementation is committed as `3e69cf9`. Its import tests and manual review are still open; retain those gates while planning Phase 4.
- Use the existing Vite, React, TypeScript, IndexedDB, `idb`, and Vitest setup. Do not add a queue or worker dependency without evidence it is needed.
- No runtime AI provider, cloud service, API key, login credential, or server is required or assumed.
- Never fetch a saved URL or bypass platform access controls. A URL alone does not establish extraction capability.
- Keep original `SourceFile` bytes, extracted content, analysis, and user notes separate. Extracted content must identify its source item, source fingerprint, method, and version.
- Browser-only processing runs while Siftory is open. Never show fabricated percent progress or imply work continues after the tab closes.

## Proposed Phase 4 scope

### In scope

- IndexedDB schema version 3 with a persistent `ProcessingJob` store and a separate `ExtractedContent` store. Upgrade from schema version 2 without changing or losing saved items, source files, or their relationships.
- A typed job state machine with validated transitions, timestamps, attempts, processing version, source fingerprint, stage, and actionable error code/message.
- Add-to-queue, process-now, retry, and skip actions. Queued jobs survive refresh. A user starts queued work explicitly; the app does not silently process the whole library.
- A sequential in-page runner for currently supported local work. Do not claim background execution or add a worker unless profiling establishes a need.
- A capability report for each source/item that says available, unsupported, or missing source, with a clear reason.
- One concrete provider to make the lifecycle real: extract text from an imported `.txt` `SourceFile` using strict UTF-8 decoding. Persist the extracted text separately with source fingerprint and extractor version.
- Honest handling for other sources in this phase: PDF extraction, URLs, social/video sources, transcription, OCR, and AI analysis are unsupported. Explain why in the capability UI and do not create fake completed results.
- Processing Queue navigation and screen with status/stage, source, timestamps, error reason, and supported actions. Item detail and Inbox expose capability and queue actions where applicable.
- Retry history and interrupted-job recovery. On startup, jobs left in an active state become `Needs Attention` with an interruption reason; never silently mark them complete or automatically rerun them.
- Duplicate-active-job prevention across tabs for the same item, source fingerprint, and processing version. Reuse a valid completed text extraction for an unchanged source/version.
- Focused tests for migration, transitions, concurrent enqueue, retries, skip, interruption recovery, text decoding, result provenance, and capability reporting.

### Out of scope

- PDF text extraction/OCR, web page fetching or parsing, social media access, video/audio downloading, transcripts, or platform APIs.
- Summaries, classification, embeddings, semantic search, or any runtime AI provider.
- Cloud jobs, remote queues, background processing after the browser closes, or cross-device work coordination.
- Automatic scheduling, invented completion percentages, silent retries, or unsupported jobs represented as successful.
- Backup and restore of job history and extracted content are planned for Phase 8.

## Proposed job and extraction invariants

- Only jobs whose capability is available may enter a runnable state. Unsupported sources can show a capability explanation, but must not be queued as if work can run.
- A job belongs to one saved item, captures the source fingerprint and processing version at enqueue time, and has one explicit state/stage at a time.
- State changes and output persistence are transactional where they must agree. A job cannot become `Completed` unless its extracted result is committed successfully.
- A job can be active only once per item/fingerprint/type/version. Use an IndexedDB uniqueness constraint or equivalent transaction-safe claim; a UI-only check is insufficient across tabs.
- On completion, the job references a distinct `ExtractedContent` record. Never overwrite the original Blob, source metadata, description, or notes.
- Retry starts a new attempt on the same job or a linked retry record, with the choice documented and history retained. Attempt count and failure details must survive refresh.
- Skipping is a recorded terminal user action, not deletion. A skipped job can be re-queued through an explicit user action.
- If the source file is missing, malformed UTF-8, changed since enqueue, or too large, report a specific failure/attention state and do not write partial extracted content.
- A browser/tab interruption leaves a recoverable state. A database failure cannot produce a false success state.

## Implementation plan

1. Audit actual v2 schema/open/blocked behavior and repository transactions; define migration and transaction boundaries before editing storage.
2. Define `ProcessingJob`, `ExtractedContent`, capability, and transition types in the existing domain conventions. Add a pure transition validator and explicit allowed transitions.
3. Add schema v3 stores and indexes. Include a unique active-job key that is absent on terminal jobs, plus indexes for item, status, and creation time. Migrate v2 safely and test preservation of `savedItems` and `sourceFiles`.
4. Implement repository operations for enqueue/claim/transition/retry/skip/list and saving extraction output. Serialize competing claims through IndexedDB transactions and report duplicate active jobs clearly.
5. Implement local `.txt` capability and strict UTF-8 extraction. Check source existence, media type, byte limit, and captured fingerprint before reading. Do not add third-party code for this adapter.
6. Add a sequential runner that only starts on explicit user action and while the app is active. Persist stage and timestamps, catch failures into actionable states, and recover interrupted jobs on startup.
7. Implement the capability display, queue controls, processing history, and queue screen. Keep status readable without color; announce state changes to assistive technology; show no percentage unless measured.
8. Add migration, domain transition, repository concurrency, restart/recovery, capability, and local-text extractor tests. Use controlled IndexedDB fixtures and do not claim browser multi-tab behavior from unit tests alone.
9. Update architecture/data model, decisions, project setup, roadmap, and this phase status only to describe behavior that exists. Keep Phase 3 review debt visible.

## Privacy, data integrity, and accessibility

- All Phase 4 processing is local. No file contents, notes, URLs, or metadata leave the browser.
- Treat source files and extracted text as untrusted data. Render text as text; never execute or interpret content as instructions.
- Store extracted output separately and record source item, SHA-256 fingerprint, extraction method/version, and timestamp so the origin is auditable.
- Keep file and result sizes bounded. Handle browser quota, transaction abort, missing source files, and database upgrades without reporting success prematurely.
- Show capability limitations before enqueueing. For URLs and social content, explain that saving a URL does not make its media or transcript accessible.
- Use semantic status labels and live announcements for queue changes; support keyboard operation, visible focus, reduced motion, and narrow-screen layouts.
- Do not expose file content in logs or errors. Avoid copying original binary data into job records.

## Acceptance criteria

- Queue state survives refresh, and job status/history match persisted IndexedDB records.
- Only local `.txt` files are reported processable in Phase 4; unsupported sources show a reason and cannot appear successfully processed.
- Process-now and queued processing work explicitly while the app is open; closing the browser is never represented as continued execution.
- A valid UTF-8 text file creates a separate traceable extracted-content record and completed job without changing source bytes or user fields.
- Malformed UTF-8, missing files, changed fingerprints, transaction failures, and interrupted jobs produce recoverable failure/attention states and no false completion.
- Duplicate concurrent jobs for the same item/source/version are prevented transactionally across tabs.
- Retry and skip actions preserve history and are keyboard accessible.
- Migration from v2 preserves every saved item, source file, and relationship.
- Build, lint, and focused tests pass; desktop/mobile and keyboard review is recorded.

## Decisions implemented

- Implemented local `.txt` extraction only; all other sources are explicitly unsupported.
- Queued jobs wait for an explicit start; process-now runs the selected item immediately.
- Retry history stays on the same job; skipped jobs can be re-queued in place.
- Results remain associated with their source fingerprint and extractor version; unchanged completed work is reused.
- Expired leases are recovered at startup and while the visible tab is open, without implying background execution.

## Current status

Implementation complete. IndexedDB v3 stores durable jobs and separate extracted content. Queue and item detail expose capability, queue/process-now, retry, skip, result preview, and download. The runner only extracts local `.txt` files up to 20 MiB with strict UTF-8 decoding and records the source fingerprint and extractor version. An IndexedDB unique index protects active job uniqueness. Expired leases recover to Needs Attention. Retry preserves attempt history and unchanged completed work is reused.

Automated tests cover v2 upgrade, duplicate enqueue, result provenance, lease recovery, UTF-8 success and failure, and capability/state transitions. The Phase 5 kickoff checked queue persistence, skip/requeue, and extraction at desktop and mobile widths in Chrome. Multi-tab interaction still needs a browser check. See the [Phase 5 baseline](PHASE-5-AI-KNOWLEDGE-FOUNDATION.md#audit-and-starting-baseline).
