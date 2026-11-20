# Siftory

**Save less. Understand more.**

Your personal library for everything worth knowing.

Siftory is a planned local-first personal knowledge library and research workspace. This repository currently holds the product foundation and AI project guidance; it does not yet contain the application itself.

## Start here

1. Read [`AGENTS.md`](AGENTS.md) for the project-wide AI working agreement.
2. Read [`docs/PROJECT_SETUP.md`](docs/PROJECT_SETUP.md) for the repository audit and current setup status.
3. Read [`docs/PRODUCT.md`](docs/PRODUCT.md), [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md), and [`docs/DECISIONS.md`](docs/DECISIONS.md) for product scope and decisions.
4. Read design and technical guidance before work in those areas: `docs/DESIGN_SYSTEM.md`, `docs/UI_UX.md`, `docs/ARCHITECTURE.md`, and `docs/DATA_MODEL.md`.
5. Use [`docs/ai/CODEX_MASTER_PROMPT.md`](docs/ai/CODEX_MASTER_PROMPT.md) as the phased implementation brief when starting app work.

## Documentation map

- `AGENTS.md` — persistent Codex instructions for this repository.
- `docs/PROJECT_SETUP.md` — audit findings, initial folder plan, and setup checklist.
- `docs/PRODUCT.md` — vision, users, product areas, principles, and non-goals.
- `docs/REQUIREMENTS.md` — functional and quality requirements.
- `docs/DESIGN_SYSTEM.md` and `docs/UI_UX.md` — visual system and screen/interaction plans.
- `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md` — target boundaries and conceptual data model.
- `docs/ROADMAP.md` — phased delivery and acceptance criteria.
- `docs/DECISIONS.md` — confirmed, proposed, and open decisions.
- `docs/CODEX_WORKFLOW.md` — AI-assisted task workflow.
- `docs/ai/CODEX_MASTER_PROMPT.md` — full product and implementation brief.
- `.agents/skills/siftory-project-context/SKILL.md` — reusable project-specific AI skill.

## Product boundaries

Siftory is local-first, with manual backup and restore and no mandatory cloud service or paid AI API. Codex helps develop the product; it is not the app's runtime AI provider. See the decision and architecture docs before selecting implementation details.
