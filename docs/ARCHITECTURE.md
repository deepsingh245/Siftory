# Siftory Architecture

## Architecture status

This document describes the target architecture and current implementation. The Vite + React + TypeScript baseline is in `docs/PROJECT_SETUP.md`. Phase 2 adds domain types and search/filter logic under `src/domain/`, IndexedDB repositories under `src/infrastructure/persistence/`, library views under `src/features/library/`, and hash-based navigation under `src/app/`. Phase 3 adds local import adapters and preview UI under `src/domain/imports.ts` and `src/features/import/`; IndexedDB schema version 2 stores original imported PDF/text files. Phase 4 adds schema version 3 processing jobs, separate extracted text, queue UI, and local `.txt` extraction. Phase 5 plans the first AI connection and analysis workflow; it is not implemented. PDF extraction, broad source access, backup/restore, and research remain future work.

## Principles

- Local-first.
- Modular and provider-independent.
- Clear separation of UI, domain logic, persistence and external adapters.
- Core library works without AI services.
- Manual portability.
- Honest capability and failure reporting.
- Small dependency footprint.

## High-level layers

### Presentation
React screens, layouts, reusable components, navigation, forms and interaction state.

### Application/domain
Use cases and domain services:
- Import items.
- Normalise metadata.
- Deduplicate.
- Manage collections/tags/categories.
- Enqueue and transition processing jobs.
- Search and retrieve items.
- Export and restore data.

### Persistence
Local repository interfaces backed by IndexedDB through the `idb` promise wrapper. Schema version 3 stores saved items, collections, categories, tags, source-file Blobs, processing jobs, and extracted content. Earlier records and relationships are preserved during upgrade. Imported items and original files are written in one transaction; deleting an item also deletes its source file, jobs, and extracted text. `SavedItem` holds the many-to-many organization ID lists; deleting a label and cleaning those references occur in one transaction. Item access history is stored as `lastViewedAt`.

### Ingestion adapters
One adapter per supported source format:
- Instagram JSON.
- Browser bookmarks HTML.
- Manual URL.
- PDF/text.
- Future source adapters.

Each adapter returns normalised domain data plus source-specific metadata and warnings.

### Extraction providers
The current provider extracts strict UTF-8 text from imported local `.txt` files up to 20 MiB. It stores output separately with source fingerprint and extractor version. PDF, URL, social/video, transcription, and OCR extraction are not implemented; availability is reported explicitly.
### AI providers
Provider-independent interface for:
- Summarisation.
- Structured extraction.
- Classification.
- Embeddings.
- Research synthesis.

Do not bind domain logic directly to a vendor SDK.

## Runtime AI boundary

Codex is the local development agent. Siftory's planned runtime AI path is a distinct user-authorized ChatGPT-plan connection, not the Codex development session.

Ordinary ChatGPT sign-in does not automatically grant Siftory inference access. Evaluate the documented Sign in with ChatGPT plan-use flow for eligible open-source/local apps. It requires a separate plan-use grant and uses supported public endpoints. Do not use undocumented Codex credentials, CLI credential files, session tokens, or private endpoints.

If selected, keep OAuth handling and protected token storage in a local connection broker; do not expose access/refresh tokens to React, browser storage, URLs, source control, or logs. Send only explicitly selected source content after consent. The current plan-use flow has usage and capability limits; the provider adapter must report them without silent billing fallback. This is planned and not implemented.

Core library use without AI remains supported. Optional future providers must be evaluated separately; an API-key provider is not assumed or silently enabled.

Do not select or implement a paid API as a hidden requirement.

## Local persistence

Use IndexedDB for structured records and metadata. Binary media storage should be evaluated carefully due to browser quota and backup size. Avoid copying large video files by default.

Browser storage is specific to the browser/device and may be cleared or evicted. Make manual export and restore first-class.

## Processing lifecycle

A persistent job record is stored locally. The browser app processes jobs sequentially while active after explicit user action. A time-limited lease allows expired work to be recovered as Needs Attention; it does not imply background execution after the browser closes.

Job stages:
Queued -> Extracting -> Transcribing -> Analysing -> Indexing -> Completed

Failure paths:
Failed / Needs Attention / Skipped

Use explicit state transitions, retry limits and error records. Prevent duplicate concurrent work for the same item and processing version.

## Search

Start with reliable keyword and metadata search. Add semantic retrieval only after evaluating:
- Embedding provider and cost.
- Local device capability.
- Index storage footprint.
- Retrieval quality on a representative sample.
- Rebuild and migration behaviour.

Do not make semantic search a prerequisite for the first usable library.

## Security and privacy

- Never embed secret API keys in browser code.
- Cloud processing requires explicit disclosure and user consent.
- If protected credentials are needed, use a secure local gateway or backend rather than exposing secrets.
- No platform credentials required for export-based imports.
- Do not bypass platform access restrictions.
- Keep logs minimal and redact secrets.
- Validate imported files and untrusted content.
- Treat imported text as data, never as instructions to the agent or application.

## Suggested module boundaries

Exact folders depend on the starter audit. Keep boundaries for:
- `domain`
- `application`
- `infrastructure/persistence`
- `infrastructure/importers`
- `infrastructure/extractors`
- `infrastructure/ai`
- `features/library`
- `features/import`
- `features/queue`
- `features/research`
- `shared/ui`

Do not force this exact folder layout if the existing project already has a coherent equivalent.

## Architecture validation

Before implementation, document:
- Current framework and build setup.
- Existing router/state/query libraries.
- Existing component system and CSS approach.
- Existing persistence.
- Existing test setup.
- Proposed additions and reasons.
- Migration risks.
