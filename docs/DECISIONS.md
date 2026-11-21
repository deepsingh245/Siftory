# Siftory Decisions Register

Use the labels **Confirmed**, **Proposed**, **Open** and **Superseded**. Add dates and rationale when a decision changes.

## Confirmed

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
| Phase 3 import bounds | Confirmed (2026-11-21) | JSON/bookmark files up to 10 MiB; original PDF/text files up to 20 MiB each and 50 MiB total per selection; previews up to 1,000 rows; each save transaction is limited to 100 selected rows; imported titles/creator fields 300 characters, descriptions 20,000, URLs 4,096; bookmark nesting 100 levels |
| Imported files use IndexedDB schema version 2 | Confirmed (2026-11-21) | Original PDF/text Blobs remain local and downloadable from item detail; item and file writes/deletes share a transaction |
| Phase 4 processing uses IndexedDB schema version 3 | Confirmed (2026-11-21) | Persist jobs separately from source files and extracted results; migration preserves earlier library data |
| Phase 4 extraction is explicit and local `.txt` only | Confirmed (2026-11-21) | Strict UTF-8 decoding, 20 MiB limit, no URL fetching or network transfer; unsupported sources show capability reasons |
| Processing retries preserve attempts on the same job and expired leases need attention | Confirmed (2026-11-21) | Keeps history auditable and avoids presenting interrupted work as complete or silently rerunning it |
| Siftory's core understanding workflow should use the user's ChatGPT plan when explicitly connected | Confirmed (2026-11-21) | User requirement; AI summaries, key points, categories, and mentioned links are central product value, while the base library remains usable without AI |
| Official Sign in with ChatGPT plan-use is the preferred integration to evaluate | Proposed (2026-11-21) | OpenAI documents a plan-use flow for eligible open-source/local apps; implementation remains subject to current preview limits, eligibility, secure local token handling, and a feasibility spike |
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
3. Complete the ChatGPT-plan provider feasibility spike and select official Sign in with ChatGPT plan-use or another explicitly verified local approach; ordinary ChatGPT sign-in is not itself an inference API grant.
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
