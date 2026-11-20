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

Deliver a calm, responsive, local-first research library where a person can import saved material, find it, organize it, understand available content, and use traceable evidence in research. The core library must remain useful without AI credentials or a paid service. Users retain control of their data through manual backup and restore.

## Project boundaries

- The audited baseline is Vite + React + TypeScript with npm.
- Preserve the working starter stack and conventions; choose additional libraries only when a phase requires them.
- Keep source records, extracted content, generated analysis, and user notes distinct.
- Make processing capability and failure states honest. A URL does not guarantee access to media or transcripts.
- Keep AI providers optional and replaceable. Codex is a development agent, not Siftory's runtime model.
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
| 5. Knowledge layer | Traceable extracted content, structured analysis, and indexing | Phase 4 |
| 6. Research workspace | Evidence-led research over saved knowledge and optional web sources | Phase 5 and explicit provider decisions |
| 7. Reliability and release readiness | Portable, secure, accessible, and supportable product | Phases 2–6 |

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

**Current status:** Implementation complete; review gate pending. The responsive shell, theme switch, planned navigation states, and honest library empty state are implemented. Build and lint pass. Manual desktop/mobile browser review remains outstanding because no browser surface was available in the implementation environment.

### Phase 2 — Library foundation

**Goal:** Make Siftory useful as a local library before adding AI processing.

**Work:** Define the core domain types and repository boundary, implement local persistence using the audited stack, and build Inbox, All Saved, item details, collections, categories, tags, recently viewed, keyword search, filters, and sorting.

**Gate:** Real local records can be created, viewed, edited, organized, searched, and removed; relationships survive reloads; no AI setup is required for core library use.

### Phase 3 — Import system

**Goal:** Bring user-owned saved material into the library safely and transparently.

**Work:** Build source adapters in the confirmed priority order: Instagram JSON, browser bookmarks HTML, manual URL, then PDF and text. Add import preview, normalization, deduplication, row-level warnings, and Inbox handoff.

**Gate:** Valid records import with source metadata preserved; malformed rows have reasons; ambiguous duplicates remain reviewable; unsupported or inaccessible content is reported honestly. No platform credentials or access-control bypass is introduced.

### Phase 4 — Processing foundation

**Goal:** Make optional extraction and analysis work visible, persistent, and recoverable.

**Work:** Add persisted jobs, explicit state transitions, retry and skip behavior, processing history, provider-independent interfaces, and extraction capability reporting. Use workers only where they fit the audited app.

**Gate:** Queue state survives refresh; failures can be understood and retried; duplicate concurrent work is prevented; unsupported sources are identified; the UI explains that browser-only processing runs while the app is open.

### Phase 5 — Knowledge layer

**Goal:** Store useful understanding with clear provenance and versioning.

**Work:** Represent extracted text and transcripts separately from originals. Add versioned analyses for summaries, takeaways, mentioned tools/sites/products, concepts, topics, and timestamps where supported. Begin with keyword indexing; evaluate semantic retrieval only when there is evidence it improves retrieval enough to justify its cost and complexity.

**Gate:** Every analysis can be tied to the source content and processing version; user-editable classifications remain editable; unavailable content is not fabricated; search results can be traced to stored material.

### Phase 6 — Research workspace

**Goal:** Answer questions from saved knowledge first, then expand to external sources only when explicitly supported.

**Work:** Build Library Search with saved-item references and citations. Add Library + Web and Deep Research only after the required provider, consent, sourcing, and freshness behavior is decided. Persist research sessions and their references.

**Gate:** Saved evidence, external evidence, and model interpretation are distinguishable; citations resolve to actual sources; insufficient or conflicting evidence is represented honestly; no runtime API or paid provider is assumed.

### Phase 7 — Reliability and release readiness

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

## First milestone

Complete the Phase 1 manual viewport review. Then write and review a focused Phase 2 plan before implementing library behavior.
