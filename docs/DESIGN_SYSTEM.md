# Siftory Design System

## Design concept

**Quiet Editorial Research Desk**

The interface should feel like a calm, premium reading and research workspace. It should prioritise saved content, clarity and navigation over decorative dashboard elements.

## Brand

- Name: Siftory
- Tagline: Save less. Understand more.
- Descriptor: Your personal library for everything worth knowing.
- Voice: clear, thoughtful, confident, helpful and honest.
- Avoid exaggerated AI language and marketing-heavy microcopy.

## Colour foundations

Initial brand tokens:

| Token | Hex | Intended use |
|---|---|---|
| Graphite | `#171B1A` | Dark app background |
| Secondary surface | `#252C29` | Elevated dark surfaces |
| Parchment | `#E8E9DF` | Light theme background |
| Sage | `#A5B8A0` | Primary accent |
| Amber | `#D6A66D` | Highlights and selected states |

Create semantic tokens rather than scattering raw hex values:
- `--background`
- `--foreground`
- `--surface`
- `--surface-elevated`
- `--muted`
- `--muted-foreground`
- `--border`
- `--primary`
- `--primary-foreground`
- `--accent`
- `--warning`
- `--danger`
- `--success`
- `--focus-ring`

Dark theme should be the default. Light theme must be deliberately designed, not mechanically inverted.

## Typography

Preferred direction:
- UI: Inter or Geist, depending on existing project assets/dependencies.
- Editorial accent: optional readable serif for selected page titles or long-form reading, not general controls.
- Use a consistent type scale.
- Prioritise line length and line height for transcripts and articles.
- Avoid tiny metadata text and inconsistent heading sizes.

## Layout and spacing

- Use a consistent spacing scale.
- Desktop: compact persistent sidebar, flexible content region and optional detail panel.
- Mobile: compact header and drawer/bottom navigation where appropriate.
- Content width should support reading without excessively long lines.
- Keep dense metadata visually secondary.
- Avoid excessive card nesting.

## Components

Establish reusable variants for:
- Buttons and icon buttons.
- Inputs and search.
- Selects and filters.
- Tabs and segmented controls.
- Dialogs and drawers.
- Menus and popovers.
- Badges/status labels.
- Content cards and list rows.
- Source/platform indicators.
- Empty states.
- Loading skeletons.
- Toasts/alerts.
- Resizable or collapsible panels if supported by the starter.

## Iconography

Use one consistent icon library already present in the project where possible. Use simple line icons. Platform logos may be used as source identifiers where appropriate. Do not use emoji as primary application navigation icons.

## Content components

Saved item cards should prioritise:
1. Title or meaningful fallback.
2. Source/platform.
3. Creator and saved date when available.
4. Content type.
5. Short summary/preview if processed.
6. Processing status.

Do not show invented thumbnails. Use a neutral source placeholder when no image is available.

## Motion

- Subtle transitions only.
- Motion should communicate state changes, panel movement or progress.
- Respect reduced-motion preferences.
- No decorative looping animation.

## Accessibility

- Maintain adequate contrast.
- Visible keyboard focus.
- Semantic landmarks and heading hierarchy.
- Accessible names for icon-only controls.
- Keyboard-operable menus and dialogs.
- Do not communicate state by colour alone.

## Design acceptance criteria

- Dark and light themes are coherent.
- Responsive layouts are usable.
- Spacing and typography are consistent.
- Content remains the visual priority.
- No fake buttons or decorative controls.
- Empty, loading, error and partial-data states are designed.
