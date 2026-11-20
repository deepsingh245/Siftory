# Project Setup and Initial Audit

## Current state

Audited on 2026-11-20. The supplied `Siftory_Project_Starter_Pack` contained product and implementation-guidance documents only. It did not include an application starter or source code. The workspace also has no Git repository metadata, package manifest, build scripts, installed dependencies, router, UI framework configuration, persistence layer, or test runner.

Therefore the project’s target stack (web app, React + TypeScript direction) is documented, but no framework or working infrastructure has been verified. No product feature is implemented yet.

## What was set up

- Moved the starter pack’s root guidance to `AGENTS.md` and `README.md`.
- Placed the product, requirements, design, UX, architecture, data model, roadmap, decisions, and workflow documents in `docs/`.
- Moved the complete first-execution prompt to `docs/ai/CODEX_MASTER_PROMPT.md`.
- Added a repository-local Codex skill at `.agents/skills/siftory-project-context/SKILL.md`.
- Created an empty application folder scaffold based on the documented product areas and architecture boundaries. It contains no application code or dependencies.

## Repository layout

```text
.
├── .agents/
│   └── skills/siftory-project-context/SKILL.md
├── docs/
│   ├── ai/CODEX_MASTER_PROMPT.md
│   ├── ARCHITECTURE.md
│   ├── CODEX_WORKFLOW.md
│   ├── DATA_MODEL.md
│   ├── DECISIONS.md
│   ├── DESIGN_SYSTEM.md
│   ├── PRODUCT.md
│   ├── PROJECT_SETUP.md
│   ├── REQUIREMENTS.md
│   ├── ROADMAP.md
│   └── UI_UX.md
├── public/
├── src/
│   ├── app/
│   ├── domain/
│   ├── features/
│   │   ├── collections/  # User-defined groupings
│   │   ├── inbox/        # Imports awaiting review
│   │   ├── library/      # Saved items and detail views
│   │   ├── processing/   # Queue and job controls
│   │   ├── research/     # Evidence-led research workspace
│   │   ├── search/       # Library search and filters
│   │   └── settings/     # Preferences and data portability
│   ├── infrastructure/
│   │   ├── ai/           # Optional provider adapters
│   │   ├── extractors/   # Source content extraction
│   │   ├── importers/    # File and URL ingestion adapters
│   │   └── persistence/  # Local storage implementation
│   └── shared/
│       ├── lib/
│       └── ui/
└── tests/
    ├── fixtures/
    ├── integration/
    └── unit/
```

This is a starting boundary map, not a commitment to specific libraries. When an application starter is supplied or selected, inspect it and adapt the scaffold to its conventions before adding code.

## AI setup

- `AGENTS.md` is the automatically applicable project instruction file for Codex.
- `.agents/skills/siftory-project-context/SKILL.md` is the reusable Siftory skill. It points Codex to the right authoritative documents and reinforces the project’s privacy, AI, and provenance boundaries.
- `docs/ai/CODEX_MASTER_PROMPT.md` is the full phased product brief for an implementation-start task.
- No runtime AI credentials, providers, or API integration are configured. None is needed for this documentation and folder setup.

## Decisions and open setup items

Confirmed product constraints remain in `DECISIONS.md`. The exact React starter, persistence package, router/state tools, AI runtime options, and extraction capabilities remain open. Choose them only after reviewing an actual starter and the user’s runtime/privacy needs.

## Next setup milestone

Provide or choose the React + TypeScript starter, then perform the Phase 0 audit in `docs/ROADMAP.md`: inspect scripts and dependencies, identify reusable code, confirm the folder scaffold, and document actual build/test status. Only after that should implementation dependencies or runtime providers be selected.
