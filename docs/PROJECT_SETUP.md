# Project Setup and Phase 0 Audit

## Current state

Audited on 2026-11-20; updated for Phase 2 on 2026-11-21. The repository has a runnable Vite + React + TypeScript application using npm. Phase 2 provides local manual records, Inbox/All Saved, IndexedDB persistence, organization, keyword search, filters, sorting, and recently viewed. Batch imports, extraction, AI, backup/restore, and research workflows are not implemented. The starter pack supplied product and implementation guidance but no application source.

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
- Manual desktop/mobile browser inspection remains pending because no browser surface was available in the implementation environment. Do not treat the Phase 1 review gate as verified until that visual review is completed.

## Phase 2 implementation

- Added typed `SavedItem`, `Collection`, `Category`, and `Tag` entities; URL validation; canonical URL duplicate warnings; search/filter/sort logic; and native hash routes.
- Added IndexedDB schema version 1 through `idb` and repository operations for CRUD, recent views, and transactional cleanup of collection/category/tag associations.
- Implemented manual entry to Inbox, Inbox-to-All-Saved review, item details/editing, collection/category/tag management, list/grid views, keyword search, filters, sorting, and Recently Viewed.
- Added Vitest and fake-indexeddb. `npm run build`, `npm run lint`, and `npm test` pass; the test suite has 15 passing tests.
- No network fetch, import batch, AI, backend, cloud sync, or backup behavior was added.
- Manual browser review of Phase 2 screens and keyboard flows remains pending because no browser surface was available. The Phase 1 visual-review gate is also still open; the user directed Phase 2 to proceed despite that limitation.

No existing application logic was available to reuse during Phase 0. Phase 2 confirms `idb` over IndexedDB and native hash routes without a routing dependency. Runtime AI providers, content extraction, and semantic search remain open for later phases.

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
- No runtime AI credentials, providers, or API integration are configured. None is needed for the scaffold.

## Decisions and open setup items

The Vite + React + TypeScript starter, npm, IndexedDB through `idb`, schema version 1, Vitest with fake-indexeddb, and native hash routes are confirmed in `DECISIONS.md`. Runtime AI options, source extraction capabilities, and semantic search remain open. Choose them only when a focused phase plan establishes the need and considers the user's runtime and privacy needs.

## Next milestone

Phase 0 and Phase 2 implementation are complete. Manual viewport and keyboard review of Phases 1 and 2 remains open. The focused Phase 3 import plan is the next planning deliverable; review it before implementing source imports.
