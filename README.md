# Siftory

**Save less. Understand more.**

Your personal library for everything worth knowing.

Siftory is a local-first personal knowledge library and research workspace. The responsive shell, local library, and review-before-save imports are in place. Extraction, AI analysis, and research remain planned.

## Development

The current app supports manual entries, Inbox and All Saved, organization, keyword search, filters, recently viewed items, and imports from Instagram JSON, browser bookmark HTML, manual URLs, PDFs, and plain-text files. Imports are parsed locally and reviewed before saving; links are never fetched. Navigation destinations marked “Planned” are not implemented features yet.

```sh
npm install
npm run dev
npm run build
npm run lint
npm test
```

## Start here

1. Read [`docs/PLAN.md`](docs/PLAN.md) for the phase overview and how detailed phase plans will be created.
2. Read [`AGENTS.md`](AGENTS.md) for the project-wide AI working agreement.
3. Read [`docs/PROJECT_SETUP.md`](docs/PROJECT_SETUP.md) for the repository audit and current setup status.
4. Read [`docs/PRODUCT.md`](docs/PRODUCT.md), [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md), and [`docs/DECISIONS.md`](docs/DECISIONS.md) for product scope and decisions.
5. Read design and technical guidance before work in those areas: `docs/DESIGN_SYSTEM.md`, `docs/UI_UX.md`, `docs/ARCHITECTURE.md`, and `docs/DATA_MODEL.md`.
6. Use [`docs/ai/CODEX_MASTER_PROMPT.md`](docs/ai/CODEX_MASTER_PROMPT.md) as the phased implementation brief when starting app work.

## Documentation map

- `AGENTS.md` — persistent Codex instructions for this repository.
- `docs/PLAN.md` — high-level phase sequence and the process for planning each coding phase.
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
