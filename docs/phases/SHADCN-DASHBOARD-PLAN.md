# shadcn workspace redesign

The current Vite workspace uses a custom sidebar, CSS palette, and library landing page. Keep its hash routes, local repository, AI consent, and item review flows. Use shadcn's free `dashboard-01` block as the dashboard structure and adapt the original navigation, cards, chart, and table to Siftory data. The Library and Inbox retain their existing destinations. Dashboard becomes the default route and gets its own sidebar entry.

| Work | Scope |
| --- | --- |
| Theme foundation | Install shadcn primitives and Tailwind for the existing Vite project. Keep the light and dark palettes in `src/styles/theme.css`, using shadcn semantic tokens and shared status colors across new and retained screens. Preserve the user's appearance preference. |
| Shared shell | Use shadcn's Sidebar, Button, and Input for app navigation, the header, search, and theme switching. Support the collapsible desktop sidebar and a mobile navigation drawer. Preserve hash links and keyboard focus. |
| Dashboard | Adapt the free block's cards, chart, and table to local counts, real import activity, and recent saved items. Use actual links to Inbox, Import, and Processing queue. Provide useful loading, empty, and error states. |
| Verification | Build, lint, and run the test suite. Use Puppeteer with installed Chrome and synthetic data to check dashboard navigation, transactions that should stay local, desktop and mobile layouts, sidebar keyboard controls, theme persistence, and whether a palette change reaches the dashboard and existing screens. |

References: [free shadcn dashboard block](https://ui.shadcn.com/blocks/dashboard), [Vite installation](https://ui.shadcn.com/docs/installation/vite), [semantic theme tokens](https://ui.shadcn.com/docs/theming), and [Puppeteer installation](https://pptr.dev/guides/installation).

## Verification

- Build, lint, and the automated suite passed.
- Puppeteer used a separate Chrome profile and a synthetic library. It checked Dashboard and item navigation, activity range changes, the desktop sidebar shortcut, mobile drawer dismissal and focus, theme persistence, propagation of the primary color to both Dashboard and Import buttons, and reflow down to 320 CSS pixels.
- Run `npm run build` followed by `npm run test:browser` to repeat the browser checks. Screenshots are generated under the Git-ignored `test-results/shadcn/` folder.
