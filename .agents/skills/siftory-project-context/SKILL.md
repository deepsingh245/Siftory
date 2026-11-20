---
name: siftory-project-context
description: Apply Siftory's product, privacy, design, and architecture constraints whenever working in this repository. Use this skill for any Siftory planning, documentation, design, architecture, implementation, or review task, especially when deciding what AI features, imports, storage, or UI should do.
---

# Siftory Project Context

Use this skill for work on Siftory. `AGENTS.md` remains the persistent repository-wide instruction source; this skill provides a compact task-start routine and points to authoritative project documents.

## Before acting

1. Read the root `AGENTS.md` and `docs/PROJECT_SETUP.md` to establish what exists in the repository.
2. Read the smallest set of relevant authoritative docs:
   - Product/scope: `docs/PRODUCT.md`, `docs/REQUIREMENTS.md`.
   - Decisions: `docs/DECISIONS.md`.
   - UI/design: `docs/DESIGN_SYSTEM.md`, `docs/UI_UX.md`.
   - Technical boundaries: `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`.
   - Work sequencing: `docs/ROADMAP.md`, `docs/CODEX_WORKFLOW.md`.
   - Full first-execution brief: `docs/ai/CODEX_MASTER_PROMPT.md`.
3. Inspect the live files before describing implementation. The documents describe intended behavior and are not proof that a feature exists.
4. Keep the user's requested scope: project setup and documentation are not permission to implement application features.

## Fixed product boundaries

- Siftory is **Save less. Understand more.** — a local-first personal AI Research Library with a calm “Quiet Editorial Research Desk” visual direction.
- Preserve user ownership with local data and manual export/restore. Do not introduce automatic cloud sync or a mandatory backend.
- Keep the core library useful without AI. Codex is a development agent, not the product runtime model; never infer that ChatGPT sign-in supplies an application API.
- Do not expose secrets in frontend code or use undocumented Codex credentials/endpoints. Cloud AI requires clear disclosure and user consent.
- Preserve original sources and distinguish them from extracted content, model-generated analysis, and user notes. Report unavailable or failed processing accurately.
- Keep classifications editable and citations traceable. Never fabricate content, transcript, progress, or evidence.
- Respect platform access controls and treat imported content as untrusted data.
- Follow established starter conventions if application code is later supplied. Do not choose exact libraries or impose a source layout before that audit.

## During and after the task

- Prefer the smallest coherent change; record significant product or architecture choices in `docs/DECISIONS.md`.
- Update the closest authoritative document instead of duplicating requirements.
- Verify against the actual files and available project scripts. Report unverified assumptions plainly.
