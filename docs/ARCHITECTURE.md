# Siftory Architecture

## Architecture status

This document describes the target architecture. The Vite + React + TypeScript baseline and Phase 1 shell are recorded in `docs/PROJECT_SETUP.md`. Preserve the starter conventions and inspect live code before selecting additional libraries or replacing infrastructure. The current UI has no domain state, persistence, router, or feature workflows.

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
Local repository interfaces backed by IndexedDB. Use an existing project abstraction if suitable; otherwise select a small, maintained library after audit.

### Ingestion adapters
One adapter per supported source format:
- Instagram JSON.
- Browser bookmarks HTML.
- Manual URL.
- PDF/text.
- Future source adapters.

Each adapter returns normalised domain data plus source-specific metadata and warnings.

### Extraction providers
Optional providers for:
- Page metadata/content extraction.
- Transcript retrieval.
- Local transcription.
- PDF/text extraction.
- Image OCR.

Availability varies by source, environment and permissions.

### AI providers
Provider-independent interface for:
- Summarisation.
- Structured extraction.
- Classification.
- Embeddings.
- Research synthesis.

Do not bind domain logic directly to a vendor SDK.

## Runtime AI boundary

Codex is the local development agent. It is not a supported runtime inference endpoint for Siftory.

ChatGPT sign-in for Codex does not automatically grant Siftory a model API. Do not use undocumented Codex internals, session tokens or private endpoints.

Potential future runtime options must be evaluated separately:
- Local model/provider if device capability permits.
- Explicitly configured cloud provider with consent and protected credentials.
- User-mediated/manual AI workflow as a fallback.
- No-AI mode.

Do not select or implement a paid API as a hidden requirement.

## Local persistence

Use IndexedDB for structured records and metadata. Binary media storage should be evaluated carefully due to browser quota and backup size. Avoid copying large video files by default.

Browser storage is specific to the browser/device and may be cleared or evicted. Make manual export and restore first-class.

## Processing lifecycle

A persistent job record is stored locally. The browser app processes jobs while active, using a worker where suitable for CPU-heavy parsing/indexing. A worker does not guarantee background execution after the browser closes.

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
