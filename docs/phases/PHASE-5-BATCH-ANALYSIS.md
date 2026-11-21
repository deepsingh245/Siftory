# Phase 5 follow-up for large imports and batch analysis

## Goal

Import a large Instagram saved-post export, select the items with usable text, and process a consented analysis queue sequentially while Siftory and its local server are open. The user can see which items finished, which were skipped, and what needs attention. The library and saved results remain available without a ChatGPT connection.

## Starting point

The account holder confirmed that the Settings connection and individual item analysis work. The implementation is in `f03096f`. IndexedDB v4 stores individual analysis results keyed by item, analyzed text fingerprint, model, and analysis version. The existing `/api/ai/analyze` endpoint requires consent and uses the signed-in ChatGPT plan. The local server holds the session in memory.

At planning time, import previews accepted up to 1,000 records and saved up to 100 selected records per transaction. After one save, the preview was read-only. The Processing Queue tracked local `.txt` extraction, while AI analysis started from a single item and had no persisted job history.

## Implementation order

1. **Continue imports in the same preview.** After confirming a batch, keep unselected and failed rows available for review. Show saved rows and precise totals. Keep transactions bounded and preserve the original source fields, captions, timestamps, URLs, and extracted files. Recheck exact IDs, canonical URLs, and file fingerprints before each write. If the user resumes after reload, reopen the export and use persisted identities to distinguish completed records from remaining ones. Preserve the current rule that a title match is only a warning.
2. **Validate larger exports.** Measure parser time and exercise preview/storage with synthetic exports. Render a bounded set of rows at a time. Keep the 10 MiB file limit and cap Instagram JSON at 5,000 rows, with 100 selected records per transaction. If a file exceeds the supported bounds, explain how to split it and resume safely. Keep real export contents out of committed fixtures.
3. **Persist analysis jobs.** Add an additive IndexedDB migration for analysis jobs. Reuse the current text preparation, fingerprint, model call, and result validator. Key active work by item, exact analyzed text fingerprint, model, and analysis version. Claim each job atomically, allow one active claim for that key across tabs, and bind completion to the current attempt so an expired attempt cannot commit later. Write validated output and the completed state together. Save reference IDs and outcomes in the job record and read the text from its existing source record.
4. **Add batch selection and consent.** From Inbox or All Saved, allow selection of eligible items and show counts for ready items, existing results, and missing text. Before starting, show the selected model, account, which text will be sent, and any truncation. Importing or selecting items creates no model call. The user can start one item or a selected batch. Apply suggested categories only after review, using the same category controls as single-item analysis.
5. **Run and recover the queue.** Process one AI request at a time while Siftory and its local server are open. Surface queued, analyzing, completed, failed, needs attention, and skipped states in the Processing Queue alongside extraction jobs. Reuse an existing result for an unchanged input. On account changes, expiration, or a plan limit, pause queued work and wait for an explicit resume. If source text changes before a job starts, require review of the new text. Recover an interrupted attempt with its reason and wait for the user to retry. Removing an item removes its jobs and results through the same local data flow.
6. **Evaluate connection persistence.** Decide whether to keep the current reconnect-and-resume workflow or add credential renewal and protected account storage. An in-memory session can support the first release of the durable queue because the jobs survive independently. Any persistent OAuth credentials belong in OS-protected server storage. Keep account credentials out of the library, backup data, browser storage, and logs.

## Completion checks

- One generated export with more than 100 selected records can be saved over multiple transactions without resubmitting the file in the same session. Reopening the same export after reload makes exact duplicates visible and leaves remaining records available. Test a larger fixture above the current preview cap to establish the supported bounds.
- Starting work on three selected items with one cached result sends only the two eligible uncached inputs after consent. Each result remains linked to the original source and persists across reload.
- Simulated network failure, validation failure, authorization expiry, and plan limit preserve completed results and give each affected job an actionable next step. Reconnecting restores queue controls and waits for explicit resume.
- Two open tabs cannot claim the same job at the same time. Changed or deleted sources and expired attempts cannot create incorrect completion records.
- Run build, lint, and focused parser, migration, queue, and consent tests. Exercise the flow at desktop and mobile widths with keyboard controls and synthetic source text. Record the scope of a small live batch after the account holder explicitly starts it.

## Phase 6 handoff

After the batch flow works for Instagram captions and extracted `.txt` text, extend the inputs to Instagram content the user can provide and YouTube transcripts. Start with user-supplied text or caption files associated with the saved source. Preserve any supplied timestamps for evidence and identify records with only a URL or metadata. Evaluate permitted automatic transcript sources separately and reuse the verified analysis pipeline once usable text is present.

## Status

Implemented on 2026-11-22. Build, lint, all 55 automated tests, and a synthetic browser flow passed. The account holder has not started a live AI batch from this flow; browser checks mock the provider so they do not use plan allowance.

### Verification record

- A synthetic 5,000-row Instagram JSON payload (about 200 KiB) parses within the unit suite; the run log records parser time. The UI shows 50 rows per page, retains edits between saves, and saves selected rows in transactions of up to 100.
- Headless Chrome imported 160 synthetic captions as 100 + 60, reopened the same export after reload and recognized all 160 as exact matches (50 visible on page one), then selected two items with keyboard controls and confirmed a mocked AI batch. IndexedDB contained 160 items, two analyses, and two completed jobs.
- The browser check reported no JavaScript errors and no horizontal overflow at 390 px. It used a fresh temporary browser context and synthetic source text; it did not connect to OpenAI.
- Integration tests cover persisted results, a cached analysis, one active cross-tab claim, expired attempt fencing, changed source text, plan-limit pause, session binding, and schema migration. Build and lint pass.

The 5,000-row cap is for Instagram JSON only. The 10 MiB file limit remains in place. The browser test exercised 160-row preview/write behavior; storage quota behavior for a real full-size export still depends on the user's browser. Phase 6 is the next implementation phase. A live account can authorize a small batch separately when the account holder chooses; no live request is part of these checks.
