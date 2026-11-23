# Phase 8 — Local persistence and workspace redesign

## Goal and current behavior

Make the existing local Siftory library durable across browser and server restarts, keep a renewable ChatGPT connection when the documented provider flow permits it, and make review of imported items, transcripts, and analysis comfortable to use. The live app is Vite/React/TypeScript. Eleven IndexedDB stores hold library records, source files, transcripts, analyses, jobs, and research sessions. Generated WAV/SRT files live in `.siftory/media/`. The ChatGPT server currently holds sessions only in memory. Seven rows in the ignored `data.json` are source input, not proof of the live browser database contents.

## Order of work

1. **Inventory and backup.** Read every existing IndexedDB store from the user's original browser origin, write an internal backup under an ignored local directory, include original Blobs and media references, and verify manifest hashes, record counts, relationships, transcript text and timed segments. Keep the browser store and source files untouched. Identify the seven target records by exact source identity and report any ambiguity or extra records before retention changes.
2. **Authentication.** Retain the documented OAuth plan grant in Windows protected credential storage, use an HTTP-only local session cookie, and refresh through the documented public endpoint. Keep tokens out of SQLite, browser storage, bundles, logs, and backup. On unsupported platforms or provider refusal, show a clear reconnect state; no insecure fallback.
3. **SQLite.** Use one local SQLite file for structured data under `.siftory/`, retain large media as referenced files, migrate from the verified backup idempotently and transactionally, and keep the browser data as rollback until the seven items reopen with matching transcript/analysis content. Use narrow indexes, a schema version, integrity checks, a storage-size view, and bounded WAL maintenance. Avoid duplicate transcript text and binary BLOBs where possible without losing source material.
4. **Security review.** Trace local HTTP boundaries, file paths, imports, consent, and credential handling. Preserve loopback and origin checks, safe path resolution, and explicit AI consent. Remove friction only when a traced risk allows it.
5. **Workspace design.** Set a readable type scale and coherent dark/light tokens. Present the Inbox as scannable rows with search, status and selected states. Present item detail as source → transcript review → AI analysis, with timed reading first and advanced controls disclosed on demand. Preserve editing, attachment, replacement, audio, provenance, consent, and result actions.
6. **Verification.** Run repository tests/build/lint plus browser checks for reload, server restart, migration/recovery, all seven records and their segments/analysis/audio, filtering/navigation, 320px and desktop layouts, keyboard/focus, light/dark contrast, and disk growth. Record every check actually run and any browser/profile-dependent gap.

## Invariants and tradeoffs

- Do not delete or prune the original IndexedDB database or local media during this phase. A later cleanup can be considered only after a verified backup and exact seven-item comparison.
- A new SQLite file does not keep OAuth alive; renewable credentials require OS-protected storage and provider-supported refresh.
- Local SQLite improves durability and inspection. It does not automatically improve large-library rendering; list loading and queries need bounded reads as the library grows.
- Core library and transcript review continue without AI. Sending content to OpenAI still requires the existing per-request review and consent.
- A real browser backup is required before switching the live repository. If the original browser profile is unavailable, implement and test the migration path with fixtures while leaving live data in IndexedDB.

## Completion gate

The original seven items reopen after a restart with matching metadata, transcript text/segments, analysis, and reachable audio; ChatGPT restores without a new sign-in when its renewable grant is valid; disk usage is inspectable; the redesigned workspace passes responsive and keyboard checks. Any unavailable source or provider capability is reported rather than inferred.

## Cutover and recovery

1. Run Siftory with Node 24 or newer. Open the same browser, profile, and local address used for the imports. Confirm that the original items are visible.
2. Open **Settings → Local storage → Move seven imports to SQLite**. The app checks exact Instagram identity from the local `data.json` and refuses ambiguous or missing matches. The browser snapshot, including all eleven stores and their original attachment bytes, is written to `.siftory/backups/`. The server verifies a SHA-256 digest before inserting records. Extra records remain in the preserved browser snapshot.
3. The migration checks transcript fingerprints, timestamps, and local audio references. It reopens and compares every selected record and attachment before committing the cutover marker. A failure leaves the old library active. Resolve the reported missing or mismatched source and retry from the original browser. After success, the app reads and writes SQLite on the same machine, including during a server restart.
4. Keep the verified backup and the IndexedDB source through personal-data validation. If SQLite cannot open after cutover, preserve `.siftory/library.sqlite3`, `.siftory/attachments/`, and `.siftory/backups/` before recovery. IndexedDB reflects the cutover moment. Edits made afterward live in SQLite. A general restore interface is outside this phase.

## Practical security and storage choices

- Run the server on loopback. The browser APIs require the Siftory origin and explicit request headers. Same-origin browser audio requests have a narrow exception for streaming and seek. Reserved media keys select fixed filenames, and the static dev server denies access to private data files.
- Windows DPAPI encrypts tokens for the Windows account. The browser retains an opaque HTTP-only cookie. A valid cookie and grant let the same browser reconnect after restart. Provider expiry or revocation can require another sign-in. The Windows account and normal disk access controls still protect the plaintext library and its backups. Processes running as the same Windows user are outside Siftory's access boundary.
- AI receives the displayed source only after explicit consent. Transcripts, local audio, private notes, and backups otherwise stay on this device. Analysis credentials are outside the library snapshot.
- With one local server and short writes, SQLite uses its rollback journal and reuses or reclaims free pages. Attachment files are stored by hash. WAV files are referenced by key. Source files remain available even after their references change. Settings reports database, attachment, and referenced audio sizes. Larger libraries will require bounded list and search reads.

## Verification

- Build, lint, and 75 automated tests passed. SQLite tests cover backup equality, selecting seven of eight items, reopening after server restart, preserving analysis and attachments, transcript editing, rollback, retry, and cross-origin access. ChatGPT tests use a simulated provider to check session restoration, token rotation, disconnect, and consent.
- An isolated Chrome profile imported the seven original source rows and attached their existing WAV and SRT files. It migrated the test library, reopened all seven timed transcripts, loaded all seven audio tracks, played one track, edited and confirmed a transcript, and filtered Inbox. Chrome passed the skip-link keyboard check. Inbox and detail fit 320 px, Inbox fit 1440 px, and the light theme switched as expected.
- The seven-item browser test used 144 KiB of SQLite, about 6 KiB of attachment files, and 8.55 MiB of referenced audio. No journal remained after the write completed.
- Windows DPAPI passed with a synthetic credential, including protection on disk, reopening, rotation, and deletion.
- The original export and media were backed up and verified separately. The accessible Chrome profile had no Siftory records. The live library still needs a cutover from its populated browser profile, and live OpenAI authorization still needs a restart check.
