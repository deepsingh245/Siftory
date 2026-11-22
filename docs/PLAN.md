# Siftory Phase Plan

## Purpose

This document is the project-level overview for building Siftory. It sets the phase order, the outcome each phase must establish, and the gate for moving forward. Detailed coding plans will be written for one phase at a time from this overview; this document is not a feature-by-feature implementation specification.

Use it alongside:

- `docs/PRODUCT.md` and `docs/REQUIREMENTS.md` for product intent and required behavior.
- `docs/DECISIONS.md` for confirmed choices and unresolved questions.
- `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md` for technical boundaries and domain concepts.
- `docs/DESIGN_SYSTEM.md` and `docs/UI_UX.md` for product presentation and interaction.
- `docs/ROADMAP.md` for the existing phase task lists and acceptance details.

## Destination

Deliver a calm, responsive, local-first research library where a person can import saved material, find it, organize it, understand it with AI they explicitly connect through their ChatGPT plan, and use traceable evidence in research. AI is a core product capability, while the library remains useful without AI. Users retain control of their data through manual backup and restore.

## Project boundaries

- The audited baseline is Vite + React + TypeScript with npm.
- Preserve the working starter stack and conventions; choose additional libraries only when a phase requires them.
- Keep source records, extracted content, generated analysis, and user notes distinct.
- Make processing capability and failure states honest. A URL does not guarantee access to media or transcripts.
- Keep AI providers modular. The preferred runtime path is explicit Sign in with ChatGPT plan-use consent for an eligible, locally hosted/open-source app; never infer access from ordinary ChatGPT sign-in.
- Never reuse undocumented Codex credentials or private endpoints. The ApplyDock Codex CLI approach is a documented local reference to evaluate, not permission to read CLI credential files.
- Do not introduce mandatory cloud sync, backend services, paid APIs, or platform access workarounds.
- Keep each phase runnable and reviewable before beginning the next phase.

## Phases at a glance

| Phase | Outcome | Depends on |
|---|---|---|
| 0. Starter audit | Verified application baseline and recorded technical unknowns | Starter selection |
| 1. Product and design foundation | A coherent, accessible shell and design system | Phase 0 |
| 2. Library foundation | Useful local library, organization, and keyword search | Phase 1 |
| 3. Import system | Validated, reviewable imports into the library | Phase 2 |
| 4. Processing foundation | Persistent, recoverable jobs and honest extraction boundaries | Phase 3 |
| 5. AI-powered knowledge | ChatGPT-plan connection and traceable summaries, takeaways, categories, and mentioned links from available text | Phases 1–4 review gates |
| 6. Source coverage | Reliable content and transcript inputs for Instagram and YouTube, with honest availability limits | Phase 5 |
| 7. Research workspace | Evidence-led research over saved knowledge and optional web sources | Phases 5–6 |
| 8. Reliability and release readiness | Portable, secure, accessible, and supportable product | Phases 2–7 |

## Phase details

### Phase 0 — Starter audit and technical baseline

**Goal:** Understand the application that will actually be developed before choosing implementation details.

**Work:** Inspect the starter tree, scripts, dependencies, routing, state, styling, persistence, tests, assets, and current behavior. Record what can be reused, existing gaps, build/test status, migration risk, and open decisions. Reconcile the proposed `src/` scaffold with the real starter.

**Gate:** The app-specific audit is documented; the app can be built or known failures are recorded; no infrastructure replacement is proposed without evidence.

**Current status:** Complete. The repository has a Vite + React + TypeScript starter, npm lockfile, and documented audit in `docs/PROJECT_SETUP.md`. `npm run build` and `npm run lint` passed during the audit. No test runner, router, persistence, or backend is configured.

### Phase 1 — Product and design foundation

**Goal:** Establish Siftory's visual language and navigation before building the full set of features.

**Work:** Adapt or create semantic design tokens, dark and light themes, responsive application shell, navigation, global search entry point, and shared interface primitives. Apply the Quiet Editorial Research Desk direction and the accessibility requirements.

**Gate:** The shell works at desktop and mobile sizes in both themes; focus and keyboard behavior are clear; shared components use the design tokens; visible controls have real behavior or are clearly marked as unavailable.

**Current status:** Implemented. Chrome checks at desktop and mobile widths covered theme switching, visible keyboard focus, and navigation during the Phase 5 kickoff.

### Phase 2 — Library foundation

**Goal:** Make Siftory useful as a local library before adding AI processing.

**Work:** Define the core domain types and repository boundary, implement local persistence using the audited stack, and build Inbox, All Saved, item details, collections, categories, tags, recently viewed, keyword search, filters, and sorting.

**Gate:** Real local records can be created, viewed, edited, organized, searched, and removed; relationships survive reloads; no AI setup is required for core library use.

**Current status:** Implemented. The Phase 5 kickoff verified manual entry, Inbox review, category assignment, search, and reload persistence at desktop and mobile widths.

### Phase 3 — Import system

**Goal:** Bring user-owned saved material into the library safely and transparently.

**Work:** Build source adapters in the confirmed priority order: Instagram JSON, browser bookmarks HTML, manual URL, then PDF and text. Add import preview, normalization, deduplication, row-level warnings, and Inbox handoff.

**Gate:** Valid records import with source metadata preserved; malformed rows have reasons; ambiguous duplicates remain reviewable; unsupported or inaccessible content is reported honestly. No platform credentials or access-control bypass is introduced.

**Current status:** Implemented. The Phase 5 kickoff added parser, migration, and rollback coverage and exercised all import sources with synthetic fixtures in Chrome.

### Phase 4 — Processing foundation

**Goal:** Make supported local text extraction visible, persistent, and recoverable as groundwork for the AI analysis phase.

**Work:** Add persisted jobs, explicit state transitions, retry and skip behavior, processing history, provider-independent interfaces, and extraction capability reporting. Use workers only where they fit the audited app.

**Gate:** Queue state survives refresh; failures can be understood and retried; duplicate concurrent work is prevented; unsupported sources are identified; the UI explains that browser-only processing runs while the app is open.

**Current status:** Implemented. The Phase 5 kickoff verified queue persistence, skip and requeue, local `.txt` extraction, and result display in Chrome. The Phase 4 plan records the supported sources and processing limits.

### Phase 5 — AI-powered knowledge (priority)

**Goal:** Deliver Siftory's central promise: use an explicitly connected ChatGPT plan to turn available imported captions and text into useful, traceable understanding.

**Work:** Validate the official Sign in with ChatGPT plan-use flow for an open-source/local app; compare it with ApplyDock's local Codex CLI helper; implement the selected safe local connection; disclose exactly what leaves local storage and require explicit consent. Build a durable analysis queue and versioned results for available Instagram export captions/metadata and extracted text: summaries, key points, editable categories/tags, mentioned links/sites/tools/products, and source evidence. Revisit import size and batching so large exports can be processed incrementally. Never fetch arbitrary URLs or imply unavailable media was analyzed.

**Gate:** The user can connect the intended ChatGPT account and explicitly allow plan usage; submit an imported text-bearing item; see validated, stored summaries, key points, categories, and mentioned links with provenance; edit or reject classifications; retry safely; and see clear usage/failure limits. No API key or hidden Codex credential is required. Phase 3 parser/migration tests and Phase 1–4 manual review debt must be closed before implementation starts.

**Current status:** Implemented for Instagram captions and extracted `.txt` text. ChatGPT sign-in remains in local server memory. The app supports resumable 100-row import transactions, previews 50 rows at a time, recognizes the same Instagram export after reload, and persists consented analysis jobs/results. Phase 6 adds user-provided transcripts separately; automatic platform media/transcript retrieval and persistent account storage remain open. See the Phase 5 follow-up plan for its test and browser evidence.

### Phase 6 — Source coverage: Instagram and YouTube

**Goal:** Supply the AI pipeline with actual content needed to understand supported saved media.

**Work:** Validate Instagram export content coverage and add user-controlled import for media/transcripts actually included or legitimately obtained. Add YouTube transcript availability and ingestion only through a documented, permitted source path; offer user-provided transcript import when automatic captions are unavailable. Keep URLs and transcripts distinct, preserve timestamps when available, and pass transcript text through the Phase 5 analysis pipeline. Do not bypass login, access controls, or platform restrictions; do not claim media analysis without usable content.

**Gate:** Instagram and YouTube items clearly distinguish metadata-only, transcript available, unsupported, and analyzed states. Available transcript text can be summarized and traced to its source; inaccessible media has an actionable explanation.

**Focused plan:** [Phase 6 source coverage](phases/PHASE-6-SOURCE-COVERAGE.md) prioritizes user-provided transcripts, timed subtitle evidence, full-text chunking, and a review of official platform access before any API integration.

**Implementation status:** User-provided `.txt`, SRT, and WebVTT transcript attach/replace/remove, local provenance, YouTube URL recognition, schema version 6, timed evidence, and resumable chunk/reduction analysis are implemented. Automatic transcript access remains excluded. Automated checks pass; interactive desktop/mobile and keyboard review remains to be completed before closing the phase gate.

### Phase 7 — Research workspace

**Goal:** Answer questions from saved knowledge first, then expand to external sources only when explicitly supported.

**Work:** Start with library-only retrieval and answers, saved-item citations, and locally persisted research sessions. Add Library + Web and Deep Research only after the provider, consent, sourcing, and freshness behavior are decided.

**Gate:** Saved evidence, external evidence, and model interpretation are distinguishable; citations resolve to actual sources; insufficient or conflicting evidence is represented honestly.

**Implementation status:** Library-only local retrieval, reviewed ChatGPT-plan requests, cited answers, IndexedDB research sessions, and source lifecycle handling are implemented. Build, lint, and automated tests pass. Manual browser, narrow-screen, keyboard, and screen-reader review remains open; Phase 6's manual review is also still open.

**Focused plan:** [Phase 7 research workspace](phases/PHASE-7-RESEARCH-WORKSPACE.md). External web research remains out of scope.

### Phase 8 — Reliability and release readiness

**Goal:** Confirm that the product protects user data and communicates its limits before release.

**Work:** Review backup/restore round trips, migrations, storage quotas, interrupted operations, accessibility, responsive behavior, performance, privacy, security, error recovery, and user-facing help. Run the checks supported by the actual project setup.

**Gate:** Core flows and data portability meet their acceptance criteria; no secrets are exposed; known limits are documented; release evidence reflects checks actually performed.
## How phase plans will be written

Before coding a phase, create a focused plan under `docs/phases/` using the phase number and name. Each detailed plan should include:

1. Goal, current behavior, and links to requirements.
2. Prerequisites, confirmed decisions, and unresolved questions.
3. In-scope and out-of-scope work.
4. Small implementation steps and affected areas, based on the actual starter.
5. Data, privacy, accessibility, and migration risks relevant to that phase.
6. Acceptance criteria and the verification available in the repository.
7. Documentation updates and the phase completion gate.

Review and agree on that focused plan before substantial implementation. Complete and review one phase before planning the next; revise this overview only when product scope, dependencies, or confirmed decisions change.

## Current milestone

Phase 6 transcript support is committed as `d414c7f`. Its automated checks pass; manual desktop/mobile and keyboard review remains before its gate closes. Phase 7 planning is documented in [the Phase 7 focused plan](phases/PHASE-7-RESEARCH-WORKSPACE.md); implementation must wait for the Phase 6 review and the listed research decisions.
