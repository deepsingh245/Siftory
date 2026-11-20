# Codex Workflow

## Purpose

Keep AI-assisted development controlled, auditable and maintainable.

## Before a task

1. Read `AGENTS.md`.
2. Read relevant product/design/architecture documents.
3. Inspect the existing implementation before proposing changes.
4. Identify the smallest useful scope.
5. List assumptions and potential side effects.

## Planning

For substantial tasks, provide:
- Current behaviour.
- Desired behaviour.
- Files/modules likely affected.
- Implementation steps.
- Risks and dependencies.
- Tests/verification required.
- Documentation updates required.

Do not create a large plan for a trivial one-line fix.

## Implementation

- Prefer incremental changes.
- Reuse existing patterns.
- Avoid broad refactors mixed with feature work.
- Keep types and domain logic explicit.
- Avoid unnecessary dependencies.
- Never create fake functionality.
- Do not silently alter product requirements.
- Keep user data migration safe.

## Verification

Run relevant repository scripts, such as:
- Lint.
- Type check.
- Unit tests.
- Integration tests.
- Production build.

Use only scripts that exist or are deliberately added. Report commands that could not be run and why.

Review:
- Changed files.
- Unexpected generated files.
- Secrets or environment values.
- Accessibility and responsive behaviour.
- Error/empty/loading states.
- Data integrity and migration impact.

## Documentation

Update the smallest relevant document. Add meaningful decisions to `DECISIONS.md`. Do not copy the same content into multiple documents.

## Completion report

Summarise:
1. What changed.
2. Files/modules changed.
3. Verification performed and results.
4. Known limitations.
5. Next logical task.

## When blocked

Do not guess about high-impact product or architecture decisions. Explain the blocker, provide options with trade-offs and wait for direction when the decision is genuinely necessary. For low-risk implementation details, use the established project conventions and record the assumption.
