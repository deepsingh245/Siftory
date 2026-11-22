# Project Setup and Phase 0 Audit

## Current state

Audited on 2026-11-20 and updated for Phase 6 on 2026-11-22. Siftory runs on Vite, React, and TypeScript with npm. It provides a local library, resumable imports, local text extraction, optional ChatGPT analysis, user-provided transcript attachment for saved Instagram and YouTube items, and resumable chunked transcript analysis. Platform transcript fetching is not implemented. The starter pack supplied product and implementation guidance but no application source.

The repository was initialized with Git before this task. No remote push or commit was performed for this setup work.

## What is set up

- Product, requirements, design, UX, architecture, data model, roadmap, decisions, workflow, and AI implementation guidance are organized under `docs/`.
- `AGENTS.md` contains project-wide development instructions.
- `.agents/skills/siftory-project-context/SKILL.md` provides reusable Siftory context. The personal skills collection is local-only and Git-ignored.
- A Vite React + TypeScript starter is configured at the repository root, with npm scripts and a lockfile.
- The HTML metadata and favicon use Siftory's name, palette, and documented tagline.
- The app shell uses semantic CSS tokens, dark and light themes, responsive navigation, and an empty-state illustration built with CSS.
- Product code is organized under `src/app`, `src/domain`, `src/features/library`, and `src/infrastructure/persistence`.
- `tests/unit` and `tests/integration` cover domain rules and the IndexedDB repository. The test runner is Vitest.
- `src/domain/imports.ts` parses and validates import candidates locally; `src/features/import/` provides preview, duplicate review, and explicit confirmation.
- IndexedDB schema version 6 stores the local library, source files, processing and analysis jobs, extracted text, user-provided transcripts, and versioned AI results.

## Phase 0 audit results

| Area | Observed baseline |
|---|---|
| Runtime | Node.js 24.13.0; npm 11.6.2 |
| Framework | React 19.3.1, TypeScript 7.0.2, Vite 8.3.8 |
| Package manager | npm; `package-lock.json` is present |
| Scripts | `npm run dev`, `npm run build`, `npm run lint`, `npm run preview` |
| Build | `npm run build` passed (`tsc -b` and `vite build`) |
| Lint | `npm run lint` passed (Oxlint) |
| Dependencies | `npm install` completed; npm reported zero known vulnerabilities at install time |
| Routing / app state | None configured |
| Persistence / backend | None configured; no backend is required by the current product direction |
| Tests | No test runner or test script is configured; no tests were run |
| Product behavior | Phase 1 shell implemented; library workflows remain unimplemented |

The table above is the Phase 0 snapshot. Current Phase 2 behavior and checks are recorded below.

## Phase 1 implementation

- Replaced the generated Vite demo with the initial responsive Siftory shell and library empty state.
- Added dark-first and light themes, a working appearance toggle, keyboard focus styling, reduced-motion handling, and Siftory metadata/favicon.
- Marked later-phase navigation destinations and search as planned. No library records, import actions, routing, domain persistence, or external services were added.
- `npm run build` and `npm run lint` passed after implementation.
- The Phase 5 kickoff reviewed the shell, keyboard focus, and theme switching in Chrome at desktop and mobile widths.

## Phase 2 implementation

- Added typed `SavedItem`, `Collection`, `Category`, and `Tag` entities; URL validation; canonical URL duplicate warnings; search/filter/sort logic; and native hash routes.
- Added IndexedDB schema version 1 through `idb` and repository operations for CRUD, recent views, and transactional cleanup of collection/category/tag associations.
- Implemented manual entry to Inbox, Inbox-to-All-Saved review, item details/editing, collection/category/tag management, list/grid views, keyword search, filters, sorting, and Recently Viewed.
- Added Vitest and fake-indexeddb. `npm run build`, `npm run lint`, and `npm test` pass; the test suite has 15 passing tests.
- No network fetch, import batch, AI, backend, cloud sync, or backup behavior was added.
- The Phase 5 kickoff verified manual entry, Inbox review, category assignment, search, and reload persistence at desktop and mobile widths.

## Phase 3 implementation

- Added local import adapters for Instagram JSON top-level arrays, Netscape bookmark HTML, manual HTTP(S) URLs, and PDF/plain-text files.
- Added review-before-save UI with editable title/description, source warnings, exact duplicate review, row selection, file/row limits, and per-row outcomes. Import never fetches a supplied link.
- Original Instagram/bookmark row metadata is retained on the saved item. Original PDF/text bytes remain local in IndexedDB schema version 3 and can be downloaded from item detail.
- Confirmed rows and attached source files are committed together in one IndexedDB transaction. The result report is session-only; item provenance persists.
- The Phase 5 kickoff added parser, migration, and rollback tests and verified all import formats in Chrome using synthetic fixtures.
- No extraction, PDF text reading, AI, cloud transfer, or backup behavior was added.

No existing application logic was available to reuse during the Phase 0 audit. Phase 2 confirmed `idb` over IndexedDB and native hash routes without a routing dependency. The current Phase 5 plan prioritizes an authorized ChatGPT-plan AI connection and analysis; content coverage and semantic search remain later work.

## Phase 5 batch and import follow-up

- Instagram JSON accepts up to 5,000 rows from files up to 10 MiB. The preview renders 50 rows at a time, retains edits and selections across 100-row save transactions, and recognizes rows from the same export after reopening it.
- The analysis queue stores item/model/version/attempt state locally but no copy of source text or ChatGPT credentials. It runs sequentially while the app and local server are open. Before sending, the user reviews the exact text and confirms for the selected account and model.
- A session change, plan limit, or interrupted attempt pauses work for a fresh review or explicit retry. Results and job completion are persisted together. Deleting an item also deletes its analysis jobs and results.
- Build, lint, all 55 automated tests, and a synthetic Chrome desktop/mobile flow passed on 2026-11-22. See `docs/phases/PHASE-5-BATCH-ANALYSIS.md` for the measured parser run and browser-check scope.
- ChatGPT credentials remain in local server memory and are lost on restart or expiration. Persistent account registration and automatic Instagram/YouTube transcript retrieval remain future work; user-provided transcript files are stored locally and analyzed only after explicit review and consent.

## Repository layout

```text
.
├── .agents/skills/                 # Local skills, Git-ignored
├── docs/                            # Product and engineering documentation
├── public/                          # Siftory favicon
├── src/
│   ├── app/routes.ts                 # Native hash-based screen routes
│   ├── domain/library.ts             # Library types, validation, and queries
│   ├── features/library/             # Library views and data hook
│   ├── infrastructure/persistence/   # Versioned IndexedDB and repository
│   ├── shared/                       # Planned shared UI and utilities
│   ├── App.tsx / App.css              # Siftory shell and presentation
│   ├── index.css / main.tsx           # Global styles and entry point
│   └── README.md                     # Scaffold notes
├── tests/unit/                       # Domain and route tests
├── tests/integration/                # IndexedDB repository tests
├── package.json / package-lock.json
├── index.html
├── vite.config.ts
└── tsconfig*.json
```

## AI setup

- `AGENTS.md` is the automatically applicable project instruction file for Codex.
- `.agents/skills/siftory-project-context/SKILL.md` points to authoritative product documents and reinforces privacy, AI, and provenance boundaries.
- Core skills are copied from the Claude Engineering Starter template (`template/.claude/skills`); optional packs come from `optional-skills/` and are chosen based on the app's stack and needs. They are copied into `.agents/skills/` and intentionally Git-ignored. The initializer accepts repeated `--include-skill <name>` flags.
- Local skills available here: `emil-design-eng`, `improve-animations`, `review-animations`, `vercel-react-best-practices`, `graphify`, `data-integrity-and-imports`, `privacy-security-review`, `accessibility-review`, and `testing-release-readiness`. Graphify CLI remains a separate optional global install.
- `docs/ai/CODEX_MASTER_PROMPT.md` is the full phased product brief for implementation-start tasks.
- The **Settings** route connects to an explicitly authorized ChatGPT plan while the local Vite server runs. Item detail can analyze an imported Instagram caption or a local `.txt` extraction. The local connection needs no API key.
- `npm run ai:check` checks plan access with a standalone synthetic request. The account holder verified this with `gpt-6-sol`.

## Decisions and open setup items

The Vite + React + TypeScript stack, npm, IndexedDB through `idb`, Vitest with fake-indexeddb, and native hash routes remain in use. Phase 5 selected the official Sign in with ChatGPT plan-use flow after a successful live check. See `DECISIONS.md` for the session and data boundaries.

## Next milestone

The Phase 5 batch and import follow-up is implemented. Phase 6 now supports locally attaching user-provided `.txt`, SRT, and WebVTT transcripts to saved Instagram and YouTube items, including timed subtitle evidence, bounded resumable analysis, and local provenance. It does not fetch platform captions; the official YouTube captions download route requires edit permission. See the [Phase 6 plan](phases/PHASE-6-SOURCE-COVERAGE.md) for implementation status and remaining review work, alongside the [Phase 5 plan](phases/PHASE-5-AI-KNOWLEDGE-FOUNDATION.md) and its [batch follow-up](phases/PHASE-5-BATCH-ANALYSIS.md).
