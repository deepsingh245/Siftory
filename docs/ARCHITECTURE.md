# Siftory Architecture

## Architecture status

This document describes the target architecture and current implementation. The Vite + React + TypeScript baseline is in `docs/PROJECT_SETUP.md`. Phase 2 adds domain types and search/filter logic under `src/domain/`, IndexedDB repositories under `src/infrastructure/persistence/`, library views under `src/features/library/`, and hash navigation under `src/app/`. Phase 3 adds local import adapters, preview UI, and original PDF/text storage. Phase 4 adds processing jobs, queue UI, and local `.txt` extraction. Phase 5 adds the session-only ChatGPT connection, validated individual and batch analysis, persistent analysis jobs/results, and resumable Instagram import previews. Phase 6 adds user-provided transcript artifacts and resumable full-text analysis. Phase 7 adds local library retrieval, consented research synthesis, cited answers, and IndexedDB research sessions. A later optional local trial can fetch accessible Instagram media through an external tool and transcribe on-device. Supported general platform transcript access and backup/restore remain future work.

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
Local repository interfaces backed by IndexedDB through the `idb` promise wrapper. Schema version 7 stores saved items, collections, categories, tags, source-file Blobs, processing jobs, extracted content, analyses, analysis jobs, transcript artifacts, and research sessions. Earlier records and relationships are preserved during upgrade. Transcript artifacts are separate from imported captions and notes, retain parser/source provenance, and may keep the original selected subtitle file locally. Deleting an item also deletes its transcript, source file, jobs, extracted text, and analyses while marking research references unavailable and removing their saved excerpts. Analysis claims are serialized in IndexedDB; completion checks the attempt lease and exact current source text before writing a result and completed status together. Long transcript jobs persist validated chunk/reduction results after each request so retries can resume. `SavedItem` holds the many-to-many organization ID lists; deleting a label and cleaning those references occur in one transaction. Item access history is stored as `lastViewedAt`.

### Ingestion adapters
One adapter per supported source format:
- Instagram JSON.
- Browser bookmarks HTML.
- Manual URL.
- PDF/text.
- Future source adapters.

Each adapter returns normalised domain data plus source-specific metadata and warnings.

### Extraction providers
The built-in processing provider extracts strict UTF-8 text from imported local `.txt` files up to 20 MiB. It stores output separately with source fingerprint and extractor version. The optional Python media trial separately attempts accessible Instagram links or local files, extracts WAV with FFmpeg, and transcribes locally with faster-whisper. Its output stays under Git-ignored `.siftory/media/`; a loopback-only Vite middleware exposes completed SRT and audio to the open app. The browser matches source keys to saved Instagram URLs and transactionally attaches only when no transcript exists. PDF, general URL/social/video extraction, and OCR are not implemented.
### AI providers
Provider-independent interface for:
- Summarisation.
- Structured extraction.
- Classification.
- Embeddings.
- Research synthesis.

Do not bind domain logic directly to a vendor SDK.

## Runtime AI boundary

The Vite dev and preview servers host the AI routes on the app origin. `server/chatgpt-middleware.mjs` checks loopback access and the app origin for mutations. An HTTP-only session cookie identifies the browser, and the server holds OAuth credentials in memory. `server/chatgpt-plan.mjs` uses state and PKCE for the loopback callback, verifies the ID token and separate plan-use grant, and calls OpenAI's public Responses API. The terminal diagnostic uses the same provider module.

After explicit confirmation, item detail or the batch review sends only the displayed caption, extracted text, or attached transcript and the selected model. A batch review shows the exact text, account, model, and transcript request count before confirmation and runs one request at a time while the app and local server are open. Transcripts up to 100,000 characters are split into deterministic 14,000-character or subtitle-segment chunks and reduced pairwise. Validated step results persist after each request and remain tied to transcript, parser, chunker, analysis, and model versions. The browser binds consent to an opaque connection ID; a changed or expired connection requires a new review. The server checks size and scope, requests a streamed response, and validates its structure and quoted evidence. The browser saves results and durable queue records in IndexedDB schema version 7. Timed evidence is linked only when its exact quote occurs within a supplied subtitle segment. Machine-generated transcripts require user review; Siftory does not verify spoken words.

Phase 8 replaces the original in-memory-only session on Windows. The local server seals the OAuth session with DPAPI for the current Windows account. The browser keeps only an opaque HttpOnly cookie. The server binds the cookie to the original address, restores the connection after restart, serializes changes to rotating refresh tokens, and requires consent before inference. If protection is unavailable, the session works in memory and the Settings page explains the restart limit. A grant can expire or be revoked. See [OpenAI's session guide](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions).

Core library use without AI remains supported. Optional future providers must be evaluated separately; an API-key provider is not assumed or silently enabled.

Do not select or implement a paid API as a hidden requirement.

## Local persistence

IndexedDB is the legacy store before cutover. The Phase 8 migration saves a consistent local snapshot, selects the seven imports from the original export, and inserts related data in one SQLite transaction. Only a successful read-back check activates SQLite. Runtime writes after cutover use the same repository rules over loopback. See [the migration guide](phases/PHASE-8-LOCAL-PERSISTENCE-AND-WORKSPACE.md).

SQLite uses a rollback journal because ordinary use has one local server and brief serialized writes. Content-addressed attachments live on disk, and WAV files keep their existing media paths. SQLite reconstructs the text of timed transcripts from segments when that exactly preserves the original. Settings reports disk use. The initial cutover leaves IndexedDB and source files available for recovery. A general restore workflow remains planned.

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
