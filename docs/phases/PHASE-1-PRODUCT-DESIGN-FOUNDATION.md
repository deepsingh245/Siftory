# Phase 1 Plan: Product and Design Foundation

## Goal

Replace the generated Vite demo with Siftory's accessible, responsive application shell and establish the visual system that later phases can use. This phase creates the product's frame and shared interface foundations; it does not implement the library, imports, processing, or research features.

## Current behavior and references

The repository runs on Vite, React, and TypeScript. `src/App.tsx` and its styles are the generated Vite demo. There is no router, persistence layer, app-wide state, or component library.

Use these project sources:

- `docs/PRODUCT.md` and `docs/REQUIREMENTS.md` for product behavior and constraints.
- `docs/DESIGN_SYSTEM.md` for the Quiet Editorial Research Desk direction, brand tokens, themes, typography, and accessibility.
- `docs/UI_UX.md` for shell structure, navigation, and responsive behavior.
- `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md` for boundaries and domain concepts.
- `docs/PLAN.md` for phase order and completion gates.

## Prerequisites and decisions

- Phase 0 is complete; `docs/PROJECT_SETUP.md` records the audited baseline.
- Keep Vite + React + TypeScript and the existing Oxlint setup.
- Use semantic CSS custom properties and the existing CSS setup. Do not add a component library or icon package unless implementation demonstrates a concrete need.
- Keep dark theme as the default and implement a deliberately designed light theme.
- Keep navigation inside the shell lightweight. Do not add a routing dependency solely to demonstrate static shell screens.
- Do not add domain persistence, backend services, AI providers, or runtime credentials in this phase.
- Use the existing brand palette and typography guidance. If a chosen font is not already available locally, use a system font stack rather than adding a remote font dependency.

## Scope

### In scope

- Remove generated Vite demo content and assets that are no longer referenced.
- Create the app shell with semantic landmarks, desktop sidebar, compact mobile navigation, page heading, global search entry point, and appearance control.
- Establish semantic color, typography, spacing, border, radius, elevation, and focus tokens.
- Implement complete dark and light themes with a usable theme switch.
- Create reusable, accessible primitives needed by the shell, such as buttons, icon buttons, text input, navigation item, and page container.
- Provide a calm first-use placeholder for the library area that clearly describes the product's purpose without pretending library operations already exist.
- Ensure controls either work within this shell or are visibly unavailable until their feature phase.
- Keep page structure responsive, keyboard operable, and understandable with assistive technology.

### Out of scope

- Working import, Inbox, library, collection, category, tag, search, processing, insight, or research workflows.
- Database or browser storage setup, domain types, seed data, or persistence.
- Real global search, quick-add/import actions, user accounts, settings workflows, or cloud sync.
- AI, extraction, analytics, charts, or external service connections.
- Adding a test framework or unrelated dependencies.

## Implementation steps

1. Review the generated app files and current starter conventions; remove unused Vite demo assets and replace demo markup/styles.
2. Define CSS custom properties for both themes and shared layout/type/spacing primitives, honoring the documented brand palette.
3. Build semantic shared UI primitives with visible focus, disabled states, accessible labels, and reduced-motion behavior where transitions are used.
4. Implement the application shell: responsive sidebar/navigation, compact mobile navigation, content header, global search entry point, theme control, and main content region.
5. Add the nonfunctional-feature boundaries to the shell: links that do not yet have a Phase 1 destination must be disabled or otherwise clearly unavailable; do not ship fake actions.
6. Add a purposeful empty library landing state, without creating sample records or implying completed functionality.
7. Update `src/README.md` and project documentation to remove stale starter-demo descriptions and record the resulting shell boundaries.

## Data, privacy, accessibility, and migration considerations

- The shell must not request or store user content. Theme choice is presentation state only; defer persistent settings to the phase that settles preferences and storage.
- Do not add third-party telemetry, remote fonts, external image calls, or credentials.
- Use native semantic elements, logical heading order, descriptive labels, keyboard access, visible focus, and sufficient contrast in both themes.
- Honor `prefers-reduced-motion`; never use color alone to communicate active or unavailable navigation state.
- Verify narrow mobile layouts without horizontal overflow and ensure navigation remains operable at keyboard and touch sizes.
- This is a new shell over generated demo code; no user data migration is involved.

## Acceptance criteria

- The generated Vite screen and unused starter assets are gone from the user-facing app.
- The app builds and lint passes using the existing scripts.
- The shell renders at desktop and mobile widths with no horizontal overflow.
- Dark theme is the initial theme; the light theme is complete and the user can switch between themes.
- Keyboard users can reach and operate all enabled controls; focus is visible; icon-only controls have accessible names.
- The navigation communicates the intended Siftory areas without claiming unimplemented workflows are ready.
- The empty library state is clear and honest; no fake records or inert action controls are shown.
- No router, backend, domain persistence, AI integration, or new dependency is introduced without an updated decision and clear need.
- `docs/PROJECT_SETUP.md` and `docs/PLAN.md` reflect Phase 1 completion after the gate is met.

## Verification

- Run `npm run build` and `npm run lint`.
- Inspect the shell at desktop and narrow mobile viewport sizes.
- Manually verify keyboard navigation, focus visibility, theme switching, disabled controls, and reduced-motion behavior.
- Review the rendered contrast and semantic structure in both themes.
- Do not claim automated accessibility or browser tests unless such checks are added in a separately agreed scope.

## Completion gate

Review the implemented shell and evidence against the acceptance criteria before beginning Phase 2. Record any deferred decisions in `docs/DECISIONS.md`; then update `docs/PLAN.md` and `docs/PROJECT_SETUP.md` to mark Phase 1 complete.
