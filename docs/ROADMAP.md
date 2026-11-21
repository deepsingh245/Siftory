# Siftory Delivery Roadmap

## Delivery approach

Build a useful, reliable library and deliver its AI understanding capability as the next product priority. Each phase should leave the application runnable and have explicit acceptance criteria.

## Phase 0 — Starter audit

Tasks:
- Inspect source tree and scripts.
- Identify framework, routing, state, styling and component library.
- Identify persistence and test setup.
- Inventory existing functionality and assets.
- Check current build and type-check status.
- Record architecture, reusable pieces, risks and gaps.
- Reconcile docs with actual code.

Exit criteria:
- Audit report exists.
- Existing application builds or known failures are documented.
- No unnecessary infrastructure replacement is proposed.
- Critical unknowns are listed.

## Phase 1 — Product/design foundation

Tasks:
- Establish semantic design tokens.
- Implement dark and light theme foundations.
- Build/adapt app shell, sidebar, header and navigation.
- Create reusable controls, badges, menus, dialogs and content primitives.
- Establish responsive layout and accessibility conventions.

Exit criteria:
- Main shell is coherent on desktop and mobile.
- Theme switching works; preference persistence is deferred until settings/storage behavior is decided.
- Components use shared tokens.
- No feature is represented as functional when it is not.

## Phase 2 — Library foundation

Tasks:
- Domain types and repository abstraction.
- Local persistence.
- Inbox and All Saved.
- Collections, categories and tags.
- Saved item details.
- Keyword search, filters and sorting.
- Recently viewed.
- Unit and persistence tests.

Exit criteria:
- User can create/read/update/delete local saved records.
- Search and filters work on actual stored data.
- Collections and metadata relationships persist across refresh.
- Core library works without AI.
- Domain and IndexedDB repository tests cover validation, persistence, and relationship integrity.

## Phase 3 — Import system

Priority:
1. Instagram JSON.
2. Chrome bookmarks HTML.
3. Manual URL.
4. PDF/text.

Exit criteria:
- Import preview and validation.
- Row-level error reporting.
- Deduplication.
- Raw metadata preservation where practical.
- Imported items appear in Inbox.
- Test fixtures cover valid, malformed and edge-case records.

Current status: Core import UI and persistence are implemented. Automated parser/migration fixtures and manual browser/keyboard review remain outstanding; keep the Phase 3 exit gate open.

## Phase 4 — Processing foundation

Tasks:
- Persistent processing jobs.
- State transitions and retries.
- Provider interfaces.
- Extraction capability reporting.
- Worker-based processing where appropriate.
- Processing history and error display.

Exit criteria:
- Queue survives refresh.
- Failed work is recoverable.
- Unsupported sources are clearly identified.
- No false completion states.

Current status: Implementation is complete and build, lint, and automated tests pass. Schema v3, explicit queue controls, local strict UTF-8 `.txt` extraction, capability reporting, retry/skip history, and expired-job recovery are implemented. Manual desktop/mobile and keyboard review remains outstanding; see `docs/phases/PHASE-4-PROCESSING-FOUNDATION.md`.

## Phase 5 — AI-powered knowledge (priority)

Tasks:
- Close Phase 3 parser/migration tests and Phase 1–4 manual browser, responsive, and keyboard review gates before implementation.
- Evaluate official Sign in with ChatGPT plan-use for an open-source/local app; compare it with ApplyDock's local Codex CLI helper.
- Implement the selected authorized ChatGPT-plan connection without API keys, private endpoints, or browser-exposed credentials.
- Analyze available Instagram export captions/metadata and extracted text into summaries, key points, editable categories, mentioned links/tools/sites/products, and traceable evidence.
- Add consent, model/connection status, plan-limit handling, durable queued jobs, retries, provenance, and cache keys.
- Revisit large-export handling: current JSON/file and row/batch limits must support incremental import without losing records.

Exit criteria:
- User explicitly connects ChatGPT and consents to plan usage and content transfer for selected analysis.
- A text-bearing Instagram item and `.txt` item produce validated, provenance-linked summaries, key points, editable categories, and mentioned links.
- Analysis queue survives refresh; retries are safe and results reuse only when fingerprints, prompt/schema, and model versions match.
- Usage/auth failures pause work with clear reasons and never fall back to paid billing without consent.
- Unsupported/missing media is labeled honestly; no arbitrary URL fetch or invented analysis.

Current status: Planned; AI integration and analysis have not started. Phase 4 supplies only local `.txt` extraction and processing-job infrastructure. Phase 3 parser/migration tests and Phase 1–4 manual reviews remain open.

## Phase 6 — Source coverage: Instagram and YouTube

Tasks:
- Validate which Instagram export fields and user-provided media/transcripts are actually available.
- Add YouTube transcript availability and ingestion only through a documented, permitted source path.
- Allow user-provided transcripts when automatic captions are unavailable.
- Preserve transcript timestamps, source links, and extraction provenance; pass transcript text through the Phase 5 analysis flow.
- Make metadata-only, transcript-available, unsupported, and analyzed states distinct.

Exit criteria:
- Available Instagram/YouTube text can be analyzed by Phase 5 with traceable source evidence.
- No login-wall bypass, arbitrary video download, or fabricated transcript is used.
- Source access failures are understandable and retryable only when a legitimate route exists.

## Phase 7 — Research workspace

Tasks:
- Library-only retrieval and answers.
- Citation links to saved items.
- Optional external web research adapter.
- Research session persistence.
- Comparison and outdated-information handling.

Exit criteria:
- Each claim is traceable where possible.
- Library evidence and external evidence are distinguishable.
- Insufficient evidence is reported honestly.
- No fabricated citations.

## Phase 8 — Reliability and release readiness

Tasks:
- Backup/restore validation.
- Storage quota and failure handling.
- Accessibility review.
- Performance profiling.
- Security review.
- Regression tests.
- User-facing limitations and help text.

Exit criteria:
- Export and restore round-trip tests pass.
- No secrets in client bundle.
- Core flows have tests.
- Known limitations are documented.
## Scope discipline

Do not implement all sources and all AI providers at once. Prioritise a small end-to-end path that is reliable, then expand through adapters.
