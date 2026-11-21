# Siftory Data Model

This document describes the conceptual model. Phases 2 and 3 implement core library/import entities in `src/domain/` and store them in IndexedDB schema version 2. Extraction, analysis, jobs, and research remain future entities.

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
- `sourceFingerprint`: SHA-256 fingerprint for imported file bytes when applicable.
- `sourceFileId`: optional link to a locally stored original PDF or text file.

## SourceFile

Stores the original user-selected PDF or plain-text file locally for later processing:
- `savedItemId`: associated saved-item ID and object-store key.
- `fileName`, `mediaType`, `size`, and `sha256`.
- `blob`: original file bytes; never uploaded or extracted in Phase 3.
- `createdAt`.

Removing a saved item removes its associated source file in the same transaction.

## ExtractedContent

Stores machine-extracted source content separately from the saved record.

Suggested fields:
- `id`
- `savedItemId`
- `kind`: transcript, article_text, caption, OCR, metadata, document_text.
- `text`
- `language`
- `provider`
- `extractedAt`
- `sourceRange`: optional page/time/range information.
- `confidence`: optional provider-supported confidence.
- `status`
- `error`

Never overwrite original source text with extracted or corrected text.

## Analysis

Structured AI-generated understanding, versioned separately.

Suggested fields:
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

## ProcessingJob

- `id`
- `savedItemId`
- `jobType`
- `status`
- `stage`
- `createdAt`
- `updatedAt`
- `attemptCount`
- `processingVersion`
- `errorCode`
- `errorMessage`
- `startedAt`
- `completedAt`

Statuses: Pending, Queued, Extracting, Transcribing, Analysing, Indexing, Completed, Failed, Needs Attention, Skipped.

## ResearchSession

- `id`
- `question`
- `mode`: library, library_web, deep_research.
- `createdAt`
- `updatedAt`
- `answer`
- `savedItemReferences`
- `externalReferences`
- `limitations`
- `providerMetadata`

## Relationships

- SavedItem has zero or many ExtractedContent records.
- SavedItem has zero or many Analysis versions.
- SavedItem belongs to zero or many Collections.
- SavedItem has zero or many Categories and Tags.
- SavedItem may reference one locally stored `SourceFile` by `sourceFileId`.
- SavedItem has zero or many ProcessingJobs over time.
- ResearchSession references zero or many SavedItems and external sources.

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
