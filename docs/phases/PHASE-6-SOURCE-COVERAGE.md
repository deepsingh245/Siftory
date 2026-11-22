# Phase 6 Plan: Instagram and YouTube Source Coverage

**Status (2026-11-22):** Initial implementation is in place for user-provided transcripts and YouTube URL recognition. Automated parser, storage, retry, and build checks pass. Manual desktop/mobile and keyboard review is still open. Platform fetching is not implemented.

## Goal

Let Siftory understand YouTube videos and Instagram posts when the user supplies a transcript or other usable text. Preserve the source link and transcript provenance, support long transcripts without silently analyzing only their opening, and report honestly when an item has metadata but no usable text.

## Current behavior

- Instagram JSON imports captions and source metadata. The Phase 5 pipeline can analyze captions or extracted local `.txt` text, with a 16,000-character per-request limit.
- YouTube watch, short, and `youtu.be` links are identified locally. Siftory does not fetch those links or retrieve captions.
- Users can attach or replace pasted text and `.txt`, SRT, or WebVTT transcripts on existing Instagram and YouTube items. The original source metadata, caption, notes, and selected transcript file remain separate local records.
- Transcript inputs are limited to 100,000 normalized characters. Analysis uses deterministic chunks up to 14,000 characters and pairwise reduction; validated results persist after each request. The batch review shows the full transcript, selected account/model, and remaining request count before consent.
- IndexedDB schema version 6 stores transcript artifacts and jobs. ChatGPT credentials remain in local server memory; each AI request requires explicit text review and consent.

## Source-path research and guardrails

The official YouTube Data API documents `captions.download`, but it requires OAuth authorization and permission to edit the video. Its documented caption download is therefore not a general transcript source for a library of videos by other creators. Recheck the current docs before implementation; do not assume the API supplies public captions for any saved URL. [YouTube captions download](https://developers.google.com/youtube/data/reference/rest/v3/captions/download) · [YouTube caption implementation guide](https://developers.google.com/youtube/data/guides/implementation/captions)

The YouTube API also has developer policy and data handling requirements. Any future API feature must be reviewed against the current [YouTube API Services policies](https://developers.google.com/youtube/terms/developer-policies) and [Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service) before credentials or API data are added. Do not use undocumented transcript endpoints, scrape watch pages, or download audiovisual content.

Instagram API access must be checked against the exact account type and content in scope. Do not assume an API can list a person's general saved-post collection or retrieve arbitrary creators' media. Use the existing export as the starting source and allow the user to supply transcript text for an item. Recheck the current [Instagram Media API reference](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/) during the feasibility step.

**Planning recommendation:** make user-provided transcript text the reliable path in this phase. Treat official API access as a separate feasibility decision. If a supported route cannot serve ordinary saved items with acceptable permissions and policy obligations, report that limit and keep user-provided transcripts as the implemented path.

## Decisions to confirm in the phase review

1. Support transcript paste and local `.txt`, `.srt`, and `.vtt` uploads. Attach them to an existing saved item; do not create duplicate video records.
2. Preserve the original caption/description, transcript source, and original subtitle file separately. A transcript is user-provided text, not proof that Siftory accessed or verified the video.
3. Recognize common YouTube URL forms locally, without fetching the URL. Preserve the original URL and identify the video ID only for display, association, and duplicate review.
4. Use timed transcript segments from SRT/WebVTT as the provenance for timestamp references. Plain-text transcripts have no timestamps and must not receive invented ones.
5. Because Phase 5 sends at most 16,000 characters per request, design chunked analysis for long transcripts. Show the full transcript, selected account/model, total text size, and number of planned requests before consent. Never imply a whole video was summarized if only a prefix or subset was processed.
6. Continue processing sequentially while the app is open. Make chunks resumable and bind their result to the transcript fingerprint, parser/chunker version, analysis version, and model.

## Scope

### Included

- A focused source-feasibility review of Instagram export contents and permitted YouTube transcript routes. Record what is available, required permissions, storage obligations, and unsupported cases before adding network access.
- Local parsing and validation for YouTube URL forms (`youtube.com/watch`, `youtu.be`, and `/shorts/`) with no network request. Preserve existing URL safety and duplicate behavior.
- User-provided transcript paste and `.txt`, `.srt`, or `.vtt` import associated with an existing YouTube or Instagram item.
- A separate, versioned transcript/source-text record with item ID, input origin, original filename when present, content fingerprint, import time, parser version, and timed segments when present. Keep the user's original media metadata and caption unchanged.
- Bounded subtitle parsing with malformed timestamp and format errors. Treat all transcript contents as untrusted data. Preserve the original selected file locally when supported by the existing IndexedDB storage limits.
- A saved-item detail view that distinguishes metadata-only, transcript available, analysis queued, analyzed, unsupported, and failed states. Let the user replace or remove an attached transcript with clear confirmation.
- Full-transcript analysis through deterministic, bounded chunks under the Phase 5 per-request input limit. Preserve quote evidence and attach timestamps only when they point to timed source segments. Make partial progress, retries, model use, and any unprocessed remainder visible.
- Queue integration with the existing explicit review and consent flow. Consent must cover the transcript contents and number of requests for the selected account/model. Preserve already completed chunks if a later request fails or reaches a plan limit.
- Local persistence, migrations, source deletion cleanup, deduplication, accessibility, and privacy/security review.

### Excluded

- Downloading or recording Instagram/YouTube audiovisual media.
- Scraping platform pages, undocumented caption endpoints, using cookies, or bypassing access controls, login walls, rate limits, or terms.
- Claiming that user-supplied text is a verified transcript or that a video was watched by Siftory.
- Automatic speech recognition or a bundled local transcription model. Evaluate this separately after transcript import works and hardware, privacy, and quality constraints are known.
- Persistent Google or Meta tokens, cloud transcript storage, paid API fallback, or background work after Siftory closes.
- Research chat, external web search, and multi-source synthesis (Phase 7).

## Implementation sequence

1. **Audit sample formats and platform boundaries.** Review the current parser and requirements. Use synthetic fixtures; do not add real personal exports or transcripts to the repository. Recheck official platform docs and record the allowed source path and data retention requirements. Stop before API integration if eligibility or policy fit is unclear.
2. **Design the transcript artifact and migration.** Specify immutable original content, normalized text, optional timed segments, source fingerprint, parser version, source item relationship, file size limits, and cleanup behavior. Add an additive IndexedDB migration and recovery tests.
3. **Add item association and local import.** Implement YouTube URL identification and transcript paste/file selection. Validate `.txt`, SRT, and WebVTT with limits, useful row/file errors, and user confirmation before attaching or replacing text.
4. **Review transcript availability.** Add detail-page transcript and source status, visible provenance, timestamps when supplied, remove/replace controls, and keyboard/mobile behavior. Keep the original URL, export caption, transcript, and user notes distinct.
5. **Extend analysis for long text.** Define deterministic chunk boundaries at sentence or subtitle-segment boundaries. Version the chunker and analysis output. Persist chunk progress, validate evidence against each original chunk, preserve timestamp references, reuse matching results, and ensure full transcript coverage before showing the item as fully analyzed.
6. **Connect the existing consented queue.** Preview the complete text, account, model, and request count before consent. Run one request at a time, recover expired work, and preserve partial successes. On account or plan errors, pause and require an explicit reviewed resume.
7. **Verify.** Add parser, fingerprint, migration, chunking, timestamp evidence, cache, deletion, resume, consent, and failure tests. Use synthetic transcripts only. Run build, lint, and tests. Exercise desktop/mobile and keyboard flows. Do not use the user's ChatGPT plan for verification unless the user separately initiates a live batch.
8. **Update docs and close the phase gate.** Update `docs/PLAN.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, architecture, data model, setup, and `AGENTS.md` to reflect only implemented and verified behavior.

## Initial implementation delivered

- Additive schema v6 migration for separately stored transcript artifacts; item deletion and transcript replace/remove clean related data transactionally.
- Local YouTube URL recognition for watch, short, live, and short-link forms, without network access.
- Pasted and `.txt`/SRT/WebVTT transcript attachment for existing Instagram and YouTube items; bounded parsing and provenance; original files stay local.
- Full transcript analysis with bounded versioned chunks, pairwise reduction, per-step persistence, retry resume, exact evidence validation, and timestamps only for quotes found in one timed cue.
- Review disclosure includes full text, model/account, and exact remaining request count. No text is sent during import or preview.
- Synthetic tests cover parsers, URL recognition, schema upgrade, transcript preservation/removal, and partial analysis recovery. Manual browser/accessibility review remains before the phase gate closes.

## Acceptance criteria

- A user can attach a transcript to an existing YouTube or Instagram item without losing its URL, imported caption, raw metadata, or notes.
- YouTube watch, short, and short-link URLs are identified without a network request. Unsupported or malformed URLs remain honest and safe.
- Plain text, SRT, and WebVTT are bounded, validated, and traceable to the selected text/file. Timed transcript evidence links to real source timestamps; untimed content has none.
- Long transcript processing either covers the full transcript through persisted, versioned chunks or clearly reports which sections were not processed. No implicit 16,000-character prefix is presented as a complete video summary.
- The exact transcript, account/model, and request count are shown before user consent. Nothing is transmitted on import or preview alone.
- Each stored summary/evidence item can be traced to the item and transcript fingerprint. Completed chunks survive later request failures, and retries do not duplicate or overwrite good results.
- Unsupported source access, missing transcripts, API permission limits, and plan limits have actionable states. No scraping, audiovisual downloading, or fabricated transcript is used.
- Tests and browser checks cover migrations, subtitle edge cases, data retention, chunk recovery, consent, deletion, and accessible desktop/mobile use with synthetic content.

## Open questions

- Do the user's Instagram export files contain companion media/transcript files, or only JSON references and captions? Inspect a redacted or synthetic representation before promising a media input path.
- Should transcript paste and file upload share the same artifact and deduplication identity, or remain separate transcript revisions?
- What maximum transcript file size and total local storage budget fit the expected use? Start from current local-file limits, then measure before raising them.
- How should chunk progress be summarized in the UI: one overall transcript job with child chunks, or separate jobs per chunk? Choose after the schema and retry behavior are prototyped.
- Does any current official YouTube route support captions for videos the user merely watches/saves? The documented download route requires edit permission; verify before considering an API integration.

## Phase 7 handoff

After user-supplied and supported transcript text can be analyzed completely with source/timestamp evidence, Phase 7 can build library-grounded search and research over those saved records. Research must cite the saved item and transcript segment actually used.
