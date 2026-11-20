# Project Setup and Phase 0 Audit

## Current state

Audited on 2026-11-20. The repository has a runnable Vite + React + TypeScript application using npm. Phase 1 provides the Siftory shell, theme foundation, responsive navigation, and an honest library empty state. Library data and product workflows are not implemented. The starter pack supplied product and implementation guidance but no application source.

The repository was initialized with Git before this task. No remote push or commit was performed for this setup work.

## What is set up

- Product, requirements, design, UX, architecture, data model, roadmap, decisions, workflow, and AI implementation guidance are organized under `docs/`.
- `AGENTS.md` contains project-wide development instructions.
- `.agents/skills/siftory-project-context/SKILL.md` provides reusable Siftory context. The personal skills collection is local-only and Git-ignored.
- A Vite React + TypeScript starter is configured at the repository root, with npm scripts and a lockfile.
- The HTML metadata and favicon use Siftory's name, palette, and documented tagline.
- The app shell uses semantic CSS tokens, dark and light themes, responsive navigation, and an empty-state illustration built with CSS.
- Product-oriented `src/` directories and `tests/` directories provide intended boundaries; feature and test directories remain empty.

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

## Phase 1 implementation

- Replaced the generated Vite demo with the initial responsive Siftory shell and library empty state.
- Added dark-first and light themes, a working appearance toggle, keyboard focus styling, reduced-motion handling, and Siftory metadata/favicon.
- Marked later-phase navigation destinations and search as planned. No library records, import actions, routing, domain persistence, or external services were added.
- `npm run build` and `npm run lint` passed after implementation.
- Manual desktop/mobile browser inspection remains pending because no browser surface was available in the implementation environment. Do not treat the Phase 1 review gate as verified until that visual review is completed.

No existing application logic was available to reuse. The current scaffold is consistent with the intended React + TypeScript direction, so no framework replacement is indicated. Persistence, routing, state management, and optional AI runtime decisions remain open until the relevant phase plan.

## Repository layout

```text
.
├── .agents/skills/                 # Local skills, Git-ignored
├── docs/                            # Product and engineering documentation
├── public/                          # Siftory favicon
├── src/
│   ├── app/                          # Planned app shell boundary
│   ├── domain/                       # Planned domain boundary
│   ├── features/                     # Planned product features
│   ├── infrastructure/               # Planned adapters and persistence
│   ├── shared/                       # Planned shared UI and utilities
│   ├── App.tsx / App.css              # Siftory shell and presentation
│   ├── index.css / main.tsx           # Global styles and entry point
│   └── README.md                     # Scaffold notes
├── tests/                            # Planned test boundaries; currently empty
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

Confirmed product constraints remain in `DECISIONS.md`. The Vite + React + TypeScript starter and npm are now confirmed. Persistence implementation, routing, state tools, AI runtime options, and extraction capabilities remain open. Choose them only when a focused phase plan establishes the need and considers the user's runtime and privacy needs.

## Next milestone

Phase 0 is complete. Phase 1 implementation is complete and its automated build/lint checks pass; finish the manual viewport review before closing its gate. Then create and review a focused Phase 2 plan before implementing library behavior.
