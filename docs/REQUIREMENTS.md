# Product Requirements

This document is the consolidated requirements source. Requirements should not be silently removed. Where implementation constraints prevent a requirement, record the limitation and proposed alternative in `DECISIONS.md`.

## 1. Import and ingestion

- Import supported platform exports and user-selected files.
- Import individual URLs.
- Import browser bookmarks from exported HTML.
- Import Instagram saved-content JSON represented as one array of objects.
- Preserve source platform, original URL, creator/owner metadata, captions/titles and timestamps when present.
- Preserve raw source metadata where practical for future parser improvements.
- Validate malformed records and report skipped rows with reasons.
- Deduplicate imports without discarding useful metadata.
- Allow user review before or after import.
- Queue imported items for later processing or allow processing immediately.
- Never require social account credentials for the core import workflow.

## 2. Instagram JSON

- Expect a top-level array of records in the supplied export format.
- Parse `timestamp`, `media` and `label_values` where available.
- Extract URL, caption, title, owner name/username and other available fields.
- Handle nested `dict` structures defensively.
- Handle empty arrays and missing values.
- Preserve the original caption and metadata.
- Detect likely mojibake and offer safe correction while retaining the raw original.
- Do not assume `media: []` means the item is not a Reel.
- Do not promise video download, playback or transcription based only on an Instagram URL.
- Clearly report when media is unavailable or access is restricted.

## 3. Library

- All Saved view with list and grid modes.
- Search by title, URL, creator, extracted text and available analysis.
- Filters for platform, type, date, category, tag, collection and processing status.
- Sorting by saved date, title and update date.
- Bulk selection and actions.
- Recently viewed items.
- Duplicate detection and merge-safe behaviour.
- User can edit title, notes, tags and categories.
- User can remove an item from the local library.
- Deleting a local item must not attempt to delete content from the original platform.

## 4. Collections, categories and tags

- User-created collections can contain multiple saved items.
- An item may belong to multiple collections.
- Categories represent subjects/topics and are distinct from collections.
- Tags provide flexible labels.
- AI-generated categories/tags are suggestions and remain editable.
- Renaming or deleting a category/tag must not corrupt saved items.

## 5. Saved item details

Display, when available:
- Original source URL.
- Platform and creator.
- Saved date.
- Content type.
- Media or page preview.
- Extracted text.
- Transcript.
- Summary.
- Key takeaways.
- Mentioned tools, products and websites.
- Concepts and topics.
- Important timestamps.
- Categories, tags and collections.
- Related items.
- Processing state and history.
- User notes.

Unavailable fields should be omitted or clearly marked unavailable, not fabricated.

## 6. AI/content analysis

Detailed analysis target:
- Transcript or extracted text.
- Concise overview.
- Detailed summary.
- Key takeaways.
- Tools and websites mentioned.
- Products and services mentioned.
- Concepts and topics.
- Important timestamps where source timing exists.
- Actionable steps where appropriate.
- Content date/context where known.
- Confidence/availability indicators.

AI output must be stored separately from original source data and be reproducible/versioned. User must be able to edit classifications and notes.

### ChatGPT-plan connection and consent

- Prefer a documented Sign in with ChatGPT plan-use flow for an eligible, locally hosted/open-source app; ordinary account sign-in alone does not authorize AI requests.
- Clearly distinguish identity sign-in from permission to use ChatGPT plan allowance. Ask before sending selected source content for analysis and explain what leaves the device.
- Do not require an API key or silently switch to API billing or another paid provider. Respect current account/model eligibility, app usage limits, workspace permissions, revocation, and plan-use failures.
- Use only documented public integration endpoints and supported request settings. Never use ChatGPT private endpoints, read Codex CLI credential files, or expose OAuth tokens to frontend code/browser storage.
- Keep the library useful when AI is disconnected, unavailable, out of allowance, or declined.
- AI analysis may only use content Siftory actually possesses or is permitted to obtain. Instagram metadata-only records and YouTube URLs must not be represented as analyzed media.
- The current plan-use inference flow does not support audio/video or transcription requests; YouTube processing requires a separately supported transcript source or user-provided transcript.

## 7. Processing queue

- Queue survives page refresh through local persistence.
- User can process now, defer, retry or skip.
- Show clear stage and status.
- Preserve errors and actionable failure reasons.
- Avoid duplicate concurrent processing for the same item/version.
- Reuse valid extraction and analysis results.
- Browser-only processing runs only while the app is active; communicate this limitation.

Statuses:
Pending, Queued, Extracting, Transcribing, Analysing, Indexing, Completed, Failed, Needs Attention, Skipped.

## 8. Search and research

Search modes:
1. Library Search: saved library only.
2. Library + Web: saved library plus accessible external web sources.
3. Deep Research: broader research and comparisons.

Research requirements:
- Retrieve relevant saved captions, user-provided transcripts, and locally extracted text on-device. Exclude user notes.
- Before each provider request, show the exact question, model, account, selected excerpts, source count, and request count; require explicit consent.
- Bound the initial request to six sources, 1,500 characters per excerpt, 10,000 source characters, and one request.
- Cite original saved items.
- Cite external sources when used.
- Include timestamps when supported.
- Distinguish evidence from interpretation.
- A supported answer must cite its summary and each claim with exact reviewed quotes. An insufficient answer has no claims or summary citations and explains the evidence gap.
- Identify conflicting or outdated information where evidence supports it.
- State when evidence is insufficient.
- Save research sessions and references in IndexedDB. Preserve historical quote snapshots when sources change; remove saved excerpt and quote text when a source is deleted.
- Never present fabricated citations or unsupported freshness claims.

## 9. Data portability

- Manual full export.
- Manual restore/import.
- Include saved-item metadata, collections, tags, categories, notes, processing results and research sessions where feasible.
- Include schema/version metadata.
- Validate backup before applying restore.
- Provide clear conflict strategy.
- Do not silently overwrite current data.
- Explain that browser storage is device/browser-specific and may be cleared or evicted.

## 10. Privacy and security

- Local-first by default.
- No automatic cloud sync.
- Before sending content to a cloud AI provider, disclose what is sent and obtain user consent.
- API keys must never be embedded in client bundles.
- Use a secure local gateway or backend if protected credentials are required.
- Do not collect social platform passwords.
- Do not bypass platform restrictions.
- Keep logs free of secrets and unnecessary personal content.
- Provide data deletion and backup controls.

## 11. UI and accessibility

- Dark-first theme with a complete light theme.
- Responsive desktop and mobile.
- Keyboard-accessible navigation and controls.
- Semantic HTML and appropriate labels.
- Consistent focus states and contrast.
- Useful loading, empty, error and success states.
- Content-first layout.
- Avoid fake controls and inert buttons.

## 12. Quality attributes

- Modular, typed and maintainable code.
- Preserve starter conventions where practical.
- Unit tests for parsers, normalisation, deduplication and domain logic.
- Integration tests for persistence and backup/restore.
- Build/type checks.
- Graceful handling of unsupported formats and network failures.
- Avoid unnecessary dependencies and large local models.
