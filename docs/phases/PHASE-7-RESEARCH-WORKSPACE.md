# Phase 7 Plan: Library-Grounded Research Workspace

**Status:** Phase 7 library-only workflow is implemented locally and verified by build, lint, and automated tests. Manual visual review remains unavailable in this environment. Phase 6's desktop/mobile and keyboard review remains open as a separate gate; Phase 7 implementation proceeded without claiming that review was complete.

## Goal

Let the user ask a question across content Siftory actually has, retrieve relevant saved sources locally, and receive an answer whose claims link to exact quotes and saved items. Keep research optional, local-first, and available only after explicit ChatGPT-plan connection and per-request consent.

## Current behavior

- The library has keyword search over saved-item fields; it does not search transcript or extracted text as a unified research corpus.
- Item analyses are stored separately and include source quotes and mentioned links, but there is no research route, answer workspace, or persisted research session.
- The navigation displays a Research entry without a working route.
- ChatGPT plan use is available through the local server and requires review and consent. Each provider request accepts at most 16,000 characters.
- Transcript and extracted text remain local unless separately reviewed and sent for AI analysis. Metadata-only items do not provide usable source text.
- IndexedDB is version 6. `docs/DATA_MODEL.md` describes a future `ResearchSession`, but it is not implemented.

## Related requirements and documents

- `docs/PRODUCT.md`: saved knowledge as research evidence and local ownership.
- `docs/REQUIREMENTS.md`, sections 5, 6, 8, 9, 10, and 11: item details, AI consent, research citations, portability, privacy, and accessibility.
- `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md`: current local repository, AI gateway, provenance model, and future `ResearchSession` concept.
- `docs/DECISIONS.md`: plan-use boundary, transcript provenance, and unresolved retrieval/privacy decisions.

## Product and privacy boundaries

- Begin with **Library Search** over saved sources. Do not add external web search or Deep Research in this phase.
- Retrieve candidate sources on-device. After explicit confirmation, send the question, selected source titles/types, excerpts, and opaque citation references needed to map the answer back locally.
- Do not send saved item IDs or user notes. A citation must contain a quote that matches the submitted excerpt and resolve locally to a real item and transcript segment, when applicable.
- Clearly label the generated answer as AI interpretation. Distinguish direct source evidence, inferred synthesis, conflicting source claims, and insufficient evidence.
- A result must disclose which source records and text were included and whether relevant records were excluded by the context limit. Never imply exhaustive library coverage when the request used a subset.
- Preserve the exact source URL, transcript/extracted text, analysis, user notes, and research session as separate data. Treat source text as untrusted instructions.
- Keep the existing local server session and ChatGPT plan flow. No API key, hidden provider fallback, background work, credential persistence, or automatic sync.

## Proposed initial behavior

1. User enters one question in a Research workspace and searches the saved library.
2. Local retrieval ranks items that contain usable captions, transcripts, or extracted text. Metadata can help rank a record, but citations must point to included source text.
3. Siftory proposes a small, bounded set of relevant excerpts. The user can inspect and adjust the source selection before any content leaves the device.
4. The review displays the question, each selected item and excerpt, model/account, request count, and any context exclusions. Consent applies to that exact review.
5. A structured response contains a concise answer, evidence-backed claims, citations to exact quotes, and limitations. The UI links each citation to the saved item and to a real transcript timestamp when one exists.
6. The user can save the question, answer, source snapshot fingerprints, model, citations, and limitations as a local research session, then reopen it later.

**Initial retrieval recommendation:** use deterministic local lexical scoring over titles, captions, transcript/extracted text, and selected source metadata. Avoid adding embeddings or a new dependency until measured retrieval quality shows a clear need. The first model request should fit the existing 16,000-character limit; choose and test an explicit source-count/context budget before implementation.

## Decisions confirmed for the first implementation (2026-11-22)

- Exclude user-authored notes. Retrieve only saved captions, user-provided transcripts, and locally extracted text.
- Use a maximum of six sources, 1,500 characters per excerpt, 10,000 source characters total, and one provider request. Show the exact selected excerpts before consent.
- Preserve quoted evidence as a historical snapshot when the source changes and mark it as changed. When a source or item is deleted, remove its stored excerpt and citation quote and mark the citation unavailable.
- Start a new research question by default and list previous locally saved sessions.
- Bind each provider request to the current ChatGPT connection and explicit consent for the displayed question, model, and selected excerpts.

## Scope

### Included

- Make the existing Research navigation entry a working route and provide a focused, accessible research workspace.
- Local-only retrieval over available saved captions, attached transcripts, and extracted text. Add metadata-based ranking only as a retrieval hint.
- Deterministic ranking and source excerpt selection under the per-request limit, with transparent truncation and coverage reporting.
- A review step for question, exact source text, included/excluded sources, connected account, model, request count, and explicit consent.
- A separate structured research endpoint using the existing local ChatGPT-plan session; validate every citation ID and exact quote before saving.
- Saved-item and transcript timestamp citation links, claim-level evidence, conflict/limitation reporting, and an honest no-evidence state.
- IndexedDB schema migration and local `ResearchSession` records with question, answer, model, created/updated time, selected source IDs and fingerprints, quoted evidence, and limitations.
- Reopen, rename if needed, and delete research sessions. Track source changes/deletions so stale citations are visible.
- Synthetic retrieval, citation validation, migration, source-change, consent-boundary, failure, and deletion tests; accessible desktop/mobile and keyboard review.

### Excluded

- Library + Web, Deep Research, web search, page fetching, and external citations.
- Embeddings, vector databases, semantic search, or a new retrieval service.
- Autonomous multi-turn agents, tool use, scheduled/background research, or automatic source processing.
- Searching user notes unless the privacy decision above is resolved and the UI provides explicit control.
- Persistent ChatGPT credentials, other AI providers, API-key billing, cloud sessions, or cross-device sync.
- Changes to transcript acquisition, scraping, media downloads, or platform permissions.

## Implementation sequence

1. **Track the Phase 6 review separately.** The user authorized Phase 7 to proceed. The outstanding manual transcript attach/replace/remove, narrow viewport, keyboard, consent-preview, and timed-link review remains open and must not be reported as completed.
2. **Resolve research decisions.** The initial privacy, source/context bounds, session reopening, and stale/deleted citation behavior are confirmed above and recorded in `docs/DECISIONS.md`.
3. **Design retrieval and citation contracts.** Define eligible source fields, deterministic ranking, excerpt boundaries, source-reference IDs, exact quote rules, context truncation, request count, and no-evidence behavior. Use synthetic libraries to estimate retrieval and context limits.
4. **Add domain and storage.** Define versioned `ResearchSession`, evidence/citation, and source snapshot types. Add an additive IndexedDB migration from v6 with rollback-safe tests.
5. **Implement local retrieval.** Build a testable domain service that reads available text locally, ranks results deterministically, preserves transcript timestamps, and reports omitted candidates. Do not transmit during search or review.
6. **Implement reviewed research requests.** Add a structured request path through the existing local middleware. Bind consent to the current ChatGPT connection and exact question/context/model. Validate output shape, cited IDs, quote matches, timestamp provenance, lengths, and URL safety before persistence.
7. **Build the Research workspace.** Add question entry, retrieval preview, source include/exclude controls, explicit consent, answer with citations, saved-session list, stale-source states, and accessible empty/error/loading states.
8. **Verify and document.** Add synthetic unit/integration tests. Run build, lint, and tests. Do not use the user's live ChatGPT plan for test requests unless they separately initiate them. Review the privacy/data flow, desktop/mobile layout, keyboard and screen-reader semantics, citation destinations, and deletion/migration behavior. Automated checks are complete; manual browser layout and interaction review remains open. Update only documentation for verified implementation.

## Acceptance criteria

- Research navigation opens a functional library-only workspace; search/retrieval itself makes no network request.
- Metadata-only records are reported as having no usable text and are never sent as if they contained article/video content.
- Before any model request, the user can inspect the exact question, account/model, selected source titles/types and excerpts, request count, and coverage limits and explicitly consent.
- The provider receives only the reviewed question, source labels, excerpts, and citation references. Saved item IDs and user notes remain local. Connection changes, allowance failures, cancellation, or malformed output do not produce a completed session.
- Every displayed citation resolves to a selected saved item and an exact quote in the submitted source excerpt. Timestamp links appear only for validated timed transcript segments.
- Unsupported claims, contradictions, and insufficient evidence are represented without fabricated citations or freshness claims.
- Saved sessions persist locally and reopen with source fingerprints and visible stale/unavailable citations after source edits or deletion.
- Migration, retrieval ranking, excerpt boundaries, citation validation, consent, failure recovery, and source lifecycle have automated synthetic coverage.
- No external web source, paid API fallback, or cloud persistence is introduced.

## Phase 8 handoff

Phase 8 should validate manual export/restore of research sessions, browser storage quotas for session snapshots, privacy and deletion behavior, accessibility, performance on large libraries, and release readiness. External research modes remain a separate product decision after the library-only workflow is evaluated.
