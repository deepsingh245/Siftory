# Siftory Delivery Roadmap

## Delivery approach

Build a useful, reliable library before advanced AI. Each phase should leave the application runnable and have explicit acceptance criteria.

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

## Phase 5 — Knowledge layer

Tasks:
- Structured summary model.
- Transcript/extracted-text storage.
- Mentioned tools/sites/products.
- Concepts and topics.
- Timestamp representation.
- Keyword indexing.
- Optional semantic retrieval evaluation.

Exit criteria:
- Analysis is traceable to source content and version.
- User can edit classifications.
- Search returns relevant indexed content.
- Unavailable analysis is clearly labelled.

## Phase 6 — Research workspace

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

## Phase 7 — Reliability and release readiness

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
