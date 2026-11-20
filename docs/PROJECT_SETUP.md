# Project Setup and Phase 0 Audit

## Current state

Audited on 2026-11-20. The repository now has a runnable Vite + React + TypeScript application scaffold using npm. This is generated starter UI only; no Siftory product feature has been implemented. The starter pack supplied product and implementation guidance but no application source.

The repository was initialized with Git before this task. No remote push or commit was performed for this setup work.

## What is set up

- Product, requirements, design, UX, architecture, data model, roadmap, decisions, workflow, and AI implementation guidance are organized under `docs/`.
- `AGENTS.md` contains project-wide development instructions.
- `.agents/skills/siftory-project-context/SKILL.md` provides reusable Siftory context. The personal skills collection is local-only and Git-ignored.
- A Vite React + TypeScript starter is configured at the repository root, with npm scripts and a lockfile.
- The HTML metadata uses the Siftory name and documented tagline. The visible React screen remains the generated Vite demo and is temporary.
- Product-oriented `src/` directories and `tests/` directories provide intended boundaries; they remain empty apart from the generated starter entry point and UI.

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
| Product behavior | No Siftory features implemented; generated starter demo remains |

No existing application logic was available to reuse. The current scaffold is consistent with the intended React + TypeScript direction, so no framework replacement is indicated. Persistence, routing, state management, and optional AI runtime decisions remain open until the relevant phase plan.

## Repository layout

```text
.
├── .agents/skills/                 # Local skills, Git-ignored
├── docs/                            # Product and engineering documentation
├── public/                          # Vite public assets
├── src/
│   ├── app/                          # Planned app shell boundary
│   ├── domain/                       # Planned domain boundary
│   ├── features/                     # Planned product features
│   ├── infrastructure/               # Planned adapters and persistence
│   ├── shared/                       # Planned shared UI and utilities
│   ├── assets/                       # Generated starter assets
│   ├── App.tsx / App.css              # Temporary generated demo
│   ├── index.css / main.tsx           # Starter styles and entry point
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

Phase 0 is complete. Create and review a focused Phase 1 plan under `docs/phases/` before implementing the product shell and design foundation. Keep the generated Vite demo clearly temporary until that work replaces it.
