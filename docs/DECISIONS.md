# Siftory Decisions Register

Use the labels **Confirmed**, **Proposed**, **Open** and **Superseded**. Add dates and rationale when a decision changes.

## Confirmed

| Decision | Status | Rationale |
|---|---|---|
| Product name is Siftory | Confirmed | Chosen product identity |
| Tagline is “Save less. Understand more.” | Confirmed | Communicates the product promise |
| Local-first application | Confirmed | User ownership and low operating cost |
| React + TypeScript direction | Confirmed | Existing starter and intended workflow |
| Web application | Confirmed | Primary product surface |
| Manual backup/restore | Confirmed | No automatic cross-device sync |
| No mandatory cloud backend | Confirmed | Keep cost and operational complexity low |
| No mandatory paid AI API | Confirmed | Preserve core utility without API billing |
| Queue with process-now option | Confirmed | User controls processing timing |
| Detailed analysis target | Confirmed | Transcript/text, summary, tools, sites, concepts, timestamps and takeaways when available |
| Broad source ambition | Confirmed | Multiple social, video, browser and file sources over time |
| Hybrid AI/privacy direction | Confirmed | Local storage with explicit control over cloud processing |
| Codex is the development agent | Confirmed | Local development through ChatGPT sign-in |

## Proposed design decisions

| Decision | Status | Notes |
|---|---|---|
| Quiet Editorial Research Desk | Proposed | Dark-first, calm, content-first visual direction |
| Graphite / sage / amber palette | Proposed | Initial tokens; validate against actual screens |
| Sidebar + central content + optional detail panel | Proposed | Desktop workspace structure |
| Inter or Geist typography | Proposed | Reuse existing project font if suitable |

## Open technical decisions

1. Exact persistence library after starter audit.
2. Exact router/state-management choices; prefer existing working stack.
3. Local transcription feasibility on the user's hardware.
4. Runtime AI provider strategy; Codex sign-in is not an app API.
5. Semantic search/embedding provider and storage cost.
6. Which source adapters can reliably extract actual content under legitimate access conditions.
7. Whether any local helper process is justified for protected credentials or local model execution.

## Explicit constraints and cautions

- Empty Instagram `media` arrays do not establish content type.
- A saved Instagram URL does not guarantee accessible media or transcript.
- Platform restrictions must not be bypassed.
- Browser-only processing does not continue while the browser is closed.
- Browser IndexedDB is device/browser-specific and may be cleared or evicted.
- ChatGPT/Codex subscription access must not be treated as general runtime API access.
- Do not add cloud sync unless the product decision is explicitly revisited.
