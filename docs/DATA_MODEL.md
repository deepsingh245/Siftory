# Siftory Data Model

This document describes the conceptual model and current implementation. The library, imports, jobs, extracted text, transcript artifacts, individual analyses, research sessions, and analysis queue are implemented in `src/domain/` and IndexedDB schema version 7.

## SavedItem

Represents one saved reference/content record.

Suggested fields:
- `id`: stable application ID.
- `sourceType`: instagram, youtube, reddit, x, tiktok, pinterest, bookmark, website, pdf, document, image, text, other.
- `contentType`: video, short, post, article, bookmark, pdf, document, image, text, unknown.
- `url`: original URL when available.
- `canonicalUrl`: normalised URL used for deduplication.
- `title`: user/source title.
- `description`: source description or caption.
- `creatorName`: creator/owner name when available.
- `creatorHandle`: username/handle when available.
- `savedAt`: source/user saved timestamp when available.
- `importedAt`: local import timestamp.
- `updatedAt`: last local update.
- `lastViewedAt`: last time the user opened the detail view.
- `thumbnailRef`: optional local/remote thumbnail reference.
- `rawMetadata`: preserved source metadata where practical.
- `status`: inbox, saved, archived or other documented lifecycle.
- `userNotes`: user-authored notes.
- `sourceMetadata`: original source fields retained separately from editable title/description and user notes.
- `sourceRecordId`: stable source-provided identifier where present, used for duplicate review.
- `importRecordKey`: stable key derived from the exact Instagram JSON file fingerprint and row index, used to recognize an already imported record when reopening the same export.
- `sourceFingerprint`: SHA-256 fingerprint for imported file bytes when applicable.
- `sourceFileId`: optional link to a locally stored original PDF or text file.
- `transcriptId`: optional link to a separately stored user-provided transcript artifact.

## SourceFile

Stores the original user-selected PDF or plain-text file locally for later processing:
- `savedItemId`: associated saved-item ID and object-store key.
- `fileName`, `mediaType`, `size`, and `sha256`.
- `blob`: original file bytes; never uploaded or extracted in Phase 3.
- `createdAt`.

Removing a saved item removes its associated source file in the same transaction.

## TranscriptContent (implemented for user-provided Instagram/YouTube text)

Stored separately in the `transcripts` object store and linked to one saved item. It contains normalized text, optional timed subtitle segments, parser version, content fingerprint, import time and origin, and optional filename/media type/original Blob or pasted source text. File input is bounded to 20 MiB and normalized transcript text to 100,000 characters. Replacing or removing a transcript also removes its transcript-specific analyses and jobs. It does not replace the saved URL, source metadata, caption, or notes.

## ExtractedContent (implemented for local text extraction)

Stores machine-extracted source content separately from the saved record.

Implemented fields: `id`, `savedItemId`, `kind` (`document_text`), `text`, `provider` (`local-text-file`), `processingVersion`, `sourceFingerprint`, `sourceFileName`, and `extractedAt`.

Never overwrite original source text with extracted or corrected text.

## Analysis

Structured AI-generated understanding stored separately in the `analyses` object store. The current record keeps `savedItemId`, analyzed-text fingerprint, source kind, requested model, analysis version, time, and result. Results include a summary, key points, suggested categories, and mentioned entities with source quotes, plus literal links from the analyzed text.

The result key combines item ID, the exact text/provenance fingerprint, model, and analysis version. Transcript provenance additionally binds the parser and deterministic chunker versions. This lets Siftory reuse an unchanged result. Transcript evidence can include a timestamp only when the exact quote appears inside one supplied timed segment. Item deletion also deletes its analysis records. Applying an edited category adds a normal item/category association and preserves the generated suggestion.

## AnalysisJob (implemented)

Stored in the `analysisJobs` object store and keyed by the same item, analyzed-text fingerprint, model, and analysis version as its result. Jobs retain status, attempt count, update time, a time-limited active attempt identifier, and validated completed transcript steps. They do not store OAuth credentials. Claim and completion operations verify the current source text in IndexedDB. Completion writes the validated `Analysis` and job status together. Jobs are sequential and require the app and local server to remain open; an expired attempt becomes Needs Attention for review and explicit retry, preserving completed transcript steps.

Fields proposed for broader coverage and future versions:
- `id`
- `savedItemId`
- `version`
- `provider`
- `model`
- `createdAt`
- `summary`
- `detailedSummary`
- `keyTakeaways`
- `mentionedTools`
- `mentionedWebsites`
- `mentionedProducts`
- `concepts`
- `topics`
- `actionItems`
- `importantTimestamps`
- `limitations`
- `sourceContentFingerprint`

Each result must retain enough provenance to know what content was analysed.

## Category

Subject/topic classification:
- `id`
- `name`
- `description`
- `origin`: user or suggested.
- `createdAt`
- `updatedAt`

## Tag

Flexible label:
- `id`
- `name`
- `origin`: user or suggested.
- `createdAt`

## Collection

User-defined grouping:
- `id`
- `name`
- `description`
- `createdAt`
- `updatedAt`

In the current schema, a saved item stores ID lists for its collections, categories, and tags. Removing a label clears its ID from affected saved items in the same IndexedDB transaction.

## ProcessingJob (implemented)

- `id`
- `savedItemId`
- `jobType`
- `jobKey` and optional unique `activeKey`
- `status`
- `stage`
- `createdAt`
- `updatedAt`
- `attemptCount`
- `attempts` and `events`
- `processingVersion`
- `sourceFingerprint`
- optional `leaseExpiresAt` and `resultId`
- `errorCode`
- `errorMessage`
- `startedAt`
- `completedAt`

Statuses: Queued, Extracting, Completed, Failed, Needs Attention, Skipped. The Phase 4 runner processes only local `.txt` files, sequentially while the app is open.

## ResearchSession

Implemented in IndexedDB schema version 7 for library-only research. The session stores the question, model/provider, timestamps, structured answer (including supported/insufficient evidence status), and reviewed source snapshots. Each snapshot includes source ID, saved item ID, source kind, content fingerprint, excerpt, source update timestamp, optional transcript/extraction record ID, and lifecycle status (`current`, `changed`, or `deleted`). User notes and provider credentials are not stored in the session. On source edit, the quote snapshot remains and is marked historical; on source deletion, the excerpt and citation quote are removed.

- `id`
- `question`
- `createdAt`
- `updatedAt`
- `answer`
- `model`, `provider` (`chatgpt-plan`), `answer`, and `sources`

## Relationships

- SavedItem has zero or many ExtractedContent records.
- SavedItem has zero or many Analysis versions.
- SavedItem belongs to zero or many Collections.
- SavedItem has zero or many Categories and Tags.
- SavedItem may reference one locally stored `SourceFile` by `sourceFileId`.
- SavedItem has zero or many ProcessingJobs over time.
- ResearchSession references zero or many SavedItems through source snapshots. External sources are not part of the initial implementation.

## Deduplication

Use a layered strategy:
1. Stable source identifier if available.
2. Canonicalised URL.
3. Content fingerprint when actual content exists.

Do not merge records solely because their titles match. When duplicates are found, preserve richer metadata and provide a safe merge/review strategy.

## Schema evolution

- Version the local database schema.
- Provide migrations.
- Never assume all records are from the newest schema.
- Validate imported backups before writing.
- Keep backup schema version explicit.
