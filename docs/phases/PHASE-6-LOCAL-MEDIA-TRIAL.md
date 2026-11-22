# Local media and Instagram link trial

**Status:** Implemented and checked with one public sample and the seven links in this repository's current `data.json` (2026-11-22). Browser interaction review remains open. This is a bounded experiment after Phase 7, not a claim that arbitrary saved Instagram media is accessible.

## Goal

Run one local command over an Instagram saved-links JSON export or a local media file. For each accessible video, produce a local audio file and timed transcript that Siftory can already accept. Report each inaccessible, non-video, or failed source without inventing a transcript.

## Boundaries

- The only network acquisition adapter in this trial is for public Instagram post/Reel URLs through the free `yt-dlp` extractor. No credentials, cookies, browser session, login automation, DRM handling, or rate-limit workarounds.
- Treat Instagram access as an experimental dependency, not a supported guarantee. Stop on access errors; do not retry or route around them. Media use must be permitted for the user and source.
- The local file path works independently of Instagram. Processing is opt-in and runs on the user's computer; source media, audio, transcript, and model cache remain local. No ChatGPT request occurs.
- Keep generated media and personal exports out of Git. Do not modify the original saved item or its caption. An open local Siftory app may automatically attach a generated transcript only when its saved Instagram URL matches exactly and it has no existing transcript.
- Do not make Python or transcription packages mandatory for ordinary Siftory use.

## Implementation

1. Add an optional Python requirements file and a CLI that accepts one local video/audio path, one Instagram URL, or an Instagram JSON export. Preserve the export's row identity in a private result manifest.
2. Validate the URL host and path before network access. Deduplicate links, bound batch size, use one attempt per source, and reject unsupported hosts and input shapes.
3. Use `yt-dlp` only to try accessible video URLs. Extract 16 kHz mono WAV with a local FFmpeg binary supplied by `imageio-ffmpeg`. Produce SRT through local `faster-whisper` when transcription is requested.
4. Write files atomically under `.siftory/media/`, with predictable source keys and per-item statuses. Do not replace completed results without an explicit flag. Keep original source files separate from generated artifacts.
5. Add synthetic tests for URL/JSON validation, deduplication, output naming, failure reporting, and transcript timing. Run a local synthetic media end-to-end check. Do not send the user's saved URLs to a remote service during tests.
6. Add a loopback-only read endpoint for completed local transcripts and an app-side import that matches exact Instagram source keys. Preserve human-attached transcripts, source metadata, and AI consent. Make audio downloadable from item detail without exposing arbitrary files.
7. Update the smallest relevant documentation with the exact command, setup requirements, outcomes, and limits.

## Acceptance

- One command can process a local media file to audio and SRT without per-item UI clicks.
- One command can attempt a bounded Instagram export or URL list and produce an honest manifest, even when Instagram denies access.
- Only the extractor's media request may contact Instagram; transcription stays on-device.
- Generated files and local dependencies are ignored by Git. Original JSON and Siftory library records remain unchanged.
- When the local app is open, completed generated transcripts attach to matching saved Instagram items automatically, without replacing existing user transcripts or sending them to ChatGPT.
- Tests and a synthetic end-to-end run establish the local pipeline. Actual Instagram success is reported only if it is directly observed on an authorized sample.

## Product limit

The CLI still needs to be started manually for each export or source batch. An always-on queue or scheduled worker can be considered after this trial proves access reliability and local transcription quality. A transcript is machine-generated text and must be reviewed before relying on it as evidence. The seven observed links yielded WAV and nonempty SRT files with the base model; no general Instagram reliability is implied. The app handoff has automated integration coverage, while interactive desktop/mobile and keyboard review is still needed.
