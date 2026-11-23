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

## Theme

The workspace uses shadcn/ui's neutral theme, with dark appearance by default. The [theme stylesheet](../src/styles/theme.css) controls both appearances for the dashboard, navigation, and existing library screens.

1. Open `src/styles/theme.css`. Change `:root` for light appearance and `.dark` for dark appearance.
2. Change a base color alongside its matching foreground token. For example, edit `--primary` and `--primary-foreground` together to recolor filled action buttons and their labels.
3. Reload and check both appearances. View the dashboard, a saved item, and a form to confirm text, links, controls, chart marks, and focus remain legible.

| Tokens | Use |
|---|---|
| `--background`, `--foreground` | Page background and normal text |
| `--card`, `--popover` and their foregrounds | Panels and menus |
| `--primary`, `--secondary`, `--accent` and their foregrounds | Action hierarchy and active controls |
| `--muted`, `--muted-foreground` | Quiet backgrounds and supporting text |
| `--input`, `--border`, `--ring` | Form outlines, dividers, and keyboard focus |
| `--sidebar` and related tokens | Navigation surface and active states |
| `--chart-1` through `--chart-5` | Dashboard chart colors |
| `--success`, `--warning`, `--danger`, `--destructive` | Status text and destructive controls |

New components use shadcn's semantic utility classes, such as `bg-card` and `text-muted-foreground`. The aliases at the end of the theme file connect existing styles to the same palette. Keep shared colors in the palette and use those tokens in components. See [shadcn's theming guide](https://ui.shadcn.com/docs/theming).

Build new or updated UI controls with shadcn primitives in `src/components/ui`. Use `DropdownMenu` for actions and radio menus such as the dashboard date range. Use `Select` for form values, filters, and model choices. The shared `FieldSelect` provides labels and supports an “Any” choice. Use semantic HTML for page structure, and native browser controls for file selection and media playback.

## Typography

Roboto Variable is bundled locally and defined in `src/styles/theme.css`. Use the sidebar's 14 px label and 16 px Lucide icon sizes for navigation, buttons, selects, and disclosures. Use larger headings for hierarchy and keep body text at 16 px. Transcripts use 17 px with generous line spacing.

Standard buttons, text inputs, and select triggers use the shared `--control-height` theme token. It is 32 px with a mouse and 40 px on touch devices.

## Layout and spacing

- The workspace uses the full width beside the sidebar. The global toolbar and page content share `--workspace-gutter`.
- Render each route with `PageLayout` for its heading, description, page actions, and section spacing. Keep route titles in the page body and use the toolbar for global controls.
- Keep reading-width limits on individual text sections such as transcripts and descriptions.
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

Use Lucide for workspace controls and navigation. Platform logos may be used as source identifiers where appropriate. Do not use emoji as primary application navigation icons.

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

- The shared shadcn `Disclosure` uses a rotating chevron and keeps form values when collapsed.
- Menus and select popovers ease in and out from their anchored side. Enter and exit durations are shared theme tokens.
- Respect reduced-motion preferences. Show or hide dropdowns and disclosures immediately when motion is reduced.

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
