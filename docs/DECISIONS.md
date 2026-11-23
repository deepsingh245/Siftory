# Siftory Decisions Register

Use the labels **Confirmed**, **Proposed**, **Open** and **Superseded**. Add dates and rationale when a decision changes.

## Confirmed

| Decision | Status | Rationale |
|---|---|---|
| Use Node SQLite for the local library after verified migration | Confirmed (2026-11-22) | The Vite server opens a single file on disk. Preserve the browser source and private backup, migrate exactly the seven selected imports, and keep attachment and audio bytes outside SQLite. |
| Persist ChatGPT grants in Windows DPAPI | Confirmed (2026-11-22) | An origin-bound, persistent HttpOnly cookie identifies the local session. OAuth credentials stay in the Windows-protected record. Rotate on supported OpenAI refresh and keep per-request consent. Supersedes the session-only Phase 5 decision. |
| Offer reviewed app listing lookup alongside analysis | Confirmed (2026-11-23) | Check selected evidence-based names or store listing IDs using Apple's public catalog and direct Google Play listing pages. Keep possible name matches separate from quoted source URLs. |
| Organize saved material around reading and review | Confirmed (2026-11-22) | Use readable text, compact Inbox rows, transcript confirmation and timed audio, and explicit analysis readiness. Keep the dark and light palettes grounded in the Quiet Editorial Research Desk. |

| Decision | Status | Rationale |
|---|---|---|
| Product name is Siftory | Confirmed | Chosen product identity |
| Tagline is “Save less. Understand more.” | Confirmed | Communicates the product promise |
| Local-first application | Confirmed | User ownership and low operating cost |
| React + TypeScript direction | Confirmed | Existing starter and intended workflow |
| Vite + React + TypeScript as the initial app scaffold | Confirmed | A client-side starter fits the local-first browser product and was created during Phase 0 |
| npm as the package manager | Confirmed | Selected for the initial scaffold; `package-lock.json` is the dependency lockfile |
| `idb` as the IndexedDB wrapper | Confirmed (2026-11-21) | Promise-based API keeps transaction and schema code small while using browser-native IndexedDB |
| IndexedDB schema version 1 for library records | Confirmed (2026-11-21) | Local persistence for saved items and user organization; browser/device-specific, with no cloud service |
| Vitest and fake-indexeddb for automated tests | Confirmed (2026-11-21) | Vite-aligned test runner and deterministic IndexedDB tests; avoids requiring a browser UI for core repository tests |
| Native hash routes for app screens | Confirmed (2026-11-21) | Browser back/forward and item links work without a routing dependency |
| Import previews are local and require explicit confirmation | Confirmed (2026-11-21) | Parsing must not mutate the library; users review warnings and duplicates before adding Inbox records |
| Phase 3 and 5 import bounds | Confirmed (2026-11-22) | Instagram JSON up to 10 MiB and 5,000 rows, previewed 50 at a time; browser bookmark HTML remains capped at 10 MiB and 1,000 rows; original PDF/text files up to 20 MiB each and 50 MiB total per selection; each save transaction is limited to 100 selected rows; imported titles/creator fields 300 characters, descriptions 20,000, URLs 4,096; bookmark nesting 100 levels. Synthetic browser verification exercised 160 rows; browser quota at the full cap is device-dependent. |
| Imported files use IndexedDB schema version 2 | Confirmed (2026-11-21) | Original PDF/text Blobs remain local and downloadable from item detail; item and file writes/deletes share a transaction |
| Phase 4 processing uses IndexedDB schema version 3 | Confirmed (2026-11-21) | Persist jobs separately from source files and extracted results; migration preserves earlier library data |
| Phase 4 extraction is explicit and local `.txt` only | Confirmed (2026-11-21) | Strict UTF-8 decoding, 20 MiB limit, no URL fetching or network transfer; unsupported sources show capability reasons |
| Processing retries preserve attempts on the same job and expired leases need attention | Confirmed (2026-11-21) | Keeps history auditable and avoids presenting interrupted work as complete or silently rerunning it |
| Siftory's core understanding workflow should use the user's ChatGPT plan when explicitly connected | Confirmed (2026-11-21) | User requirement; AI summaries, key points, categories, and mentioned links are central product value, while the base library remains usable without AI |
| Official Sign in with ChatGPT is the first AI provider | Confirmed (2026-11-21) | The user verified a live completed `gpt-6-sol` response and session revocation. The first in-app slice uses the documented loopback OAuth flow and public Responses API. |
| The first in-app ChatGPT session lives in the local server's memory | Confirmed (2026-11-21) | Use the existing Vite dev or preview origin to keep access to the same local library. Restrict AI routes to loopback requests from the app origin. An HTTP-only cookie identifies the browser session. OpenAI receives only the selected text after the user confirms analysis. Store validated results in IndexedDB with source and model versions. |
| Analysis jobs persist independently from the ChatGPT session | Confirmed (2026-11-22) | Store only item, text fingerprint, model/version, attempt state, and outcome in IndexedDB. Reconnect and review again after session changes; never persist renewable credentials in the library or browser storage. Process sequentially in the foreground. |
| Phase 6 transcript inputs are user-provided and local-first | Confirmed (2026-11-22) | Attach `.txt`, SRT, or WebVTT transcript artifacts to existing Instagram/YouTube items; preserve captions, notes, source metadata, original file, parser version, fingerprint, and timed segments separately. The original Phase 6 implementation does not fetch platform media; the later optional local trial is recorded separately below. |
| Optional local media trial | Trial (2026-11-22) | A separate Python command makes one unauthenticated `yt-dlp` attempt per direct Instagram link, extracts local WAV audio, and generates local SRT with `faster-whisper`. An open local app attaches only to an exact saved Instagram link with no transcript; AI consent remains separate. This is unofficial access and can fail or be restricted. Never use credentials, cookies, login automation, DRM or rate-limit workarounds. Generated files and dependencies stay Git-ignored. |
| Phase 7 research is library-only with explicit reviewed consent | Confirmed (2026-11-22) | Local lexical retrieval covers saved captions, user-provided transcripts, and extracted text; user notes stay excluded. Each request includes at most six sources, 1,500 characters per excerpt, 10,000 source characters, and one ChatGPT-plan request after the exact question, model, account, and excerpts are reviewed. |
| Research citations preserve source lifecycle honestly | Confirmed (2026-11-22) | Require exact quotes from reviewed excerpts. Changed sources retain a clearly marked historical snapshot; deleted sources lose their saved excerpts and quote text. New research opens a blank question and lists saved sessions. |
| Long transcripts use versioned 14,000-character or subtitle-segment chunks | Confirmed (2026-11-22) | Analyze all text up to 100,000 normalized characters, then reduce adjacent results pairwise. Preview exact text/model/request count and require consent; persist completed steps for retry. Add timestamps only when exact evidence occurs in one supplied timed segment. |
| Reopening an Instagram export resumes by exact file row identity | Confirmed (2026-11-22) | Derive an import key from the selected JSON file fingerprint and row index. Recheck exact IDs, URLs, fingerprints, and import keys within each 100-row write transaction; keep title matches as review warnings. |
| Import result reports are session-only | Confirmed (2026-11-21) | Avoids another persistent history store; provenance remains on each imported item and row outcomes are shown after confirmation |
| Phase 3 file formats | Confirmed (2026-11-21) | Instagram JSON top-level arrays, Netscape bookmark HTML, HTTP(S) URLs, PDF, and `.txt`; no URL fetch or PDF extraction |
| Phase 3 duplicate review | Confirmed (2026-11-21) | Prefer source record ID, canonical URL, then SHA-256 file fingerprint; exact matches start unchecked; title matches are warnings only and never merge automatically |
| Web application | Confirmed | Primary product surface |
| Manual backup/restore | Confirmed | No automatic cross-device sync |
| No mandatory cloud backend | Confirmed | Keep cost and operational complexity low |
| No mandatory paid AI API | Confirmed | Preserve core utility without API billing |
| Queue with process-now option | Confirmed | User controls processing timing |
| Detailed analysis target | Confirmed | Transcript/text, summary, tools, sites, concepts, timestamps and takeaways when available |
| Broad source ambition | Confirmed | Multiple social, video, browser and file sources over time |
| Hybrid AI/privacy direction | Confirmed | Local storage with explicit control over cloud processing |
| Codex is the development agent | Confirmed | Local development through ChatGPT sign-in |

## Proposed design decisions

| Decision | Status | Notes |
|---|---|---|
| Quiet Editorial Research Desk | Proposed | Dark-first, calm, content-first visual direction |
| Graphite / sage / amber palette | Proposed | Initial tokens; validate against actual screens |
| Sidebar + central content + optional detail panel | Proposed | Desktop workspace structure |
| Inter or Geist typography | Proposed | Reuse existing project font if suitable |

## Open technical decisions

1. Long-term database migration and backup/restore format.
2. Local transcription feasibility on the user's hardware.
3. Evaluate native credential storage on other operating systems if support is needed.
4. Semantic search/embedding provider and storage cost.
5. Which source adapters can reliably extract actual content under legitimate access conditions.
6. Whether any local helper process is justified for protected credentials or local model execution.

## Explicit constraints and cautions

- Empty Instagram `media` arrays do not establish content type.
- A saved Instagram URL does not guarantee accessible media or transcript.
- Platform restrictions must not be bypassed.
- Browser-only processing does not continue while the browser is closed.
- Browser IndexedDB is device/browser-specific and may be cleared or evicted.
- Do not treat ordinary ChatGPT sign-in as runtime access. Use only a documented plan-use grant with explicit consent; never extract Codex CLI credentials or call private endpoints.
- ChatGPT-plan usage has eligibility and usage limits. Never add an API-key or paid-provider fallback without an explicit product decision and user consent.
- Do not add cloud sync unless the product decision is explicitly revisited.
