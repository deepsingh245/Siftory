# Phase 5 Plan: AI-Powered Knowledge Foundation

## Goal

Deliver Siftory's central promise: let the user explicitly connect a ChatGPT account and use eligible plan allowance to understand saved material. Starting with text actually present in Instagram exports and local text files, Siftory should produce useful summaries, key points, editable categories, mentioned links/entities, and traceable evidence.

## Audit and starting baseline

The Phase 0 audit is recorded. The Phase 5 kickoff verified the core Phase 1–4 flows in fresh Chrome profiles at 1280 px and 390 px with synthetic records:

- **Phase 1:** keyboard focus and navigation, dark and light theme switching, and layout width. Search now opens the library after entering a query, so tabbing through the input keeps the current screen open.
- **Phase 2:** manual records, moving them to All Saved, applying a category, keyword search, and persistence across reload.
- **Phase 3 and 5:** Instagram preview and duplicate handling, bookmark provenance and unsafe-link rejection, manual URL import, and PDF/text import. Instagram JSON now supports 5,000 rows (50 per preview page, 100 per transaction); bookmark HTML remains at 1,000 rows. JSON/bookmark files remain capped at 10 MiB.
- **Phase 4:** queue persistence after reload, skip and requeue, text extraction and viewing the result, and downloading an original PDF. Tests also cover invalid UTF-8 and recovery from expired leases.

The browser review used desktop Chrome at both widths and included a visual inspection of import previews in desktop dark and mobile light layouts. Screen reader testing, physical mobile testing, and a full accessibility review remain release work. This baseline preceded the in-app AI analysis flow documented below.

## Product and technical references

- `docs/PRODUCT.md`, `docs/REQUIREMENTS.md`, and `docs/ai/CODEX_MASTER_PROMPT.md` define import, analysis, summaries, takeaways, entities, evidence, and user-controlled processing.
- `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/DESIGN_SYSTEM.md`, and `docs/UI_UX.md` define privacy, provider and persistence boundaries, provenance, and interaction.
- ApplyDock reference reviewed: sibling project `applydock/README.md`, `docs/USER_GUIDE.md`, and `docs/features/ats-analysis.md` describe a local helper that invokes the signed-in Codex CLI, uses structured results and validation, caches work, and pauses on plan limits. This is a reference pattern, not a code or credential dependency.
- OpenAI's current [Sign in with ChatGPT open-source/local app guide](https://developers.openai.com/siwc/token-sharing-open-source) describes an OAuth path that can request explicit ChatGPT plan-use consent for eligible Responses requests. Its [inference guide](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference) uses the public Responses endpoint; its [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) require `store: false` and `stream: true` and currently exclude audio/video input and transcription API. Recheck these docs and eligibility when implementation starts.

## Prerequisites and decisions

- The product requirement is ChatGPT-account-based AI without requiring an OpenAI API key. Ordinary ChatGPT sign-in alone is not enough: the user must grant the separate plan-use permission where available.
- **Preferred feasibility path:** official Sign in with ChatGPT plan-use for a locally hosted/open-source app. Verify the app/user eligibility, dynamic client registration, stable host ID, OAuth/PKCE and callback requirements, token refresh/revocation, model availability, preview limitations, and usage/error behavior.
- **Reference alternative:** evaluate ApplyDock's local Codex CLI helper pattern. Do not read CLI credential files, call private endpoints, or claim the CLI method is the same as in-app OAuth. Use it only if it is a supported fit and the user chooses it after the feasibility comparison.
- If neither path is available or safe, stop before adding a paid API-key fallback. Keep the library functional without AI and present the blocker clearly.
- AI is optional for core library use, but it is a required product capability for Siftory's main understanding promise. No request is sent until the user has connected and consented and the action is explicit.
- No model, provider, or cost behavior is assumed beyond what the signed-in account's supported model/usage data confirms.

## Scope

### In scope

- A documented feasibility spike and a recorded provider decision, including a minimal test of sign-in, plan-use consent, one small Responses request, model listing, token renewal, disconnect, usage-limit error, and unsupported-capability handling.
- Secure local connection broker if required by the selected flow. Keep access/refresh tokens out of source control, frontend bundles, IndexedDB, URLs, logs, and browser-visible errors. Use an OS-protected local store where available. Use OAuth state/PKCE, least-privilege scopes, and explicit disconnect/revoke behavior.
- A clear AI settings experience showing connection state, selected model/availability, the separate plan-use grant, what source content will be sent, and how to disconnect. Consent to connect and consent to analyze content must be clear and distinct.
- An explicit, persistent analysis queue with process-now, batch selection, retry/skip, cache/reuse, quota/auth pauses, and interruption recovery. Do not analyze every imported item silently.
- Versioned `Analysis` output, separate from source metadata, extracted text, and user notes. Include source item/fingerprint, analyzed-content fingerprint, model, schema/prompt version, and timestamps.
- Initial analysis of text actually present in Instagram JSON (caption/description and relevant metadata) and Phase 4 extracted `.txt` content. Extract source URLs and all URLs mentioned in text separately. Return a concise summary, key points, editable category/tag suggestions, mentioned tools/sites/products/concepts, and mentioned-link labels/URLs with supporting source evidence.
- Bounded structured output with strict local parsing and validation. Reject missing/invalid evidence; do not store partial or invalid results as completed. Treat imported text as untrusted data and prohibit it from changing the task or activating tools.
- A user-visible disclosure before content is sent to OpenAI, with per-item or explicitly selected batch processing. Preserve the local-only mode.
- Revisit JSON byte/row/transaction limits and import batching for large saved-post exports; import and queue incrementally without losing source metadata or creating duplicates.
- Focused provider, OAuth-state, analysis schema, cache, queue, recovery, consent, privacy/log-redaction, and migration tests using mocks/fixtures. No real user content in committed test fixtures.

### Out of scope

- Automatic analysis at import time or sending the entire library without a user-selected action.
- Runtime access to ChatGPT conversations or memories; ordinary account sign-in does not provide them.
- OpenAI API-key billing, hidden fallback providers, automatic credit purchasing, or unapproved cloud services.
- Scraping Instagram/YouTube URLs, using user cookies, bypassing login walls/platform controls, or claiming inaccessible media was analyzed.
- YouTube audio/video understanding or automatic transcript retrieval in this phase. The chosen plan-use route currently does not accept audio/video or transcription API requests; source/transcript acquisition is Phase 6.
- Research chat, web search, semantic embeddings, OCR, or PDF extraction beyond future phase scope.

## Implementation sequence

1. Run the Phase 3 parser/migration tests and review the Phase 1–4 flows at desktop and mobile widths with keyboard checks. The kickoff results are recorded above.
2. Confirm eligibility and a live synthetic response using the official Sign in with ChatGPT check below. Validate the documented account renewal and disconnection paths before building persistent account sessions.
3. Record the selected integration and threat/data-flow model in `docs/DECISIONS.md` before implementing auth or persistence.
4. Implement the smallest secure connection flow and one consented, text-only Responses request. Use only supported public endpoints and request settings; handle authorization denial, token expiry/revocation, plan-use denial, usage limits, and unsupported models/capabilities without silent billing fallback.
5. Define the analysis domain/storage migration and idempotency key. Preserve originals and user edits; make outputs traceable to exact source text and analyzer versions.
6. Add an explicit analysis queue and one-item vertical slice for Instagram caption/text and `.txt`: summary, key points, category/tag suggestions, mentioned links/entities, evidence, status, retry, and result review/editing.
7. Improve large-export import/confirmation and batch queue behavior based on actual tested file size and row counts, with resumable/reviewable outcomes.
8. Add fault-focused tests and verify build/lint/test. Complete privacy/data-flow review and accessible keyboard/mobile review before closing the phase.
9. Update this plan, `docs/PLAN.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/PROJECT_SETUP.md`, and `AGENTS.md` only to describe behavior confirmed in code.

## Privacy, data integrity, and accessibility

- Clearly tell users that selected content leaves the device for AI analysis and goes to the connected ChatGPT account; explain plan-use consent and usage limits separately from source-import consent.
- Set request retention behavior required by the supported integration. Keep model output local after receiving it unless the user exports it. Never log source text, prompts, tokens, or personal links.
- Never use undocumented Codex credential stores or ChatGPT private backend endpoints. Never expose access tokens to React or put them in browser storage.
- Treat imports and model outputs as untrusted. Validate schema, evidence references, URLs, output size, and types before persistence or rendering.
- Keep source URL, URLs mentioned in the post, extracted text, analysis, and user edits as separate data with explicit provenance.
- Ensure queue/settings controls work with keyboard and screen readers, show visible status/error text, and remain usable at narrow widths. Do not communicate consent, confidence, or completion by color alone.

## Acceptance criteria

- User can connect the intended ChatGPT account through the selected supported path and explicitly grant plan usage where offered; no API key is needed.
- The UI accurately reports account/model readiness, plan-use consent, limit/revocation failures, and disconnect state.
- User can select a text-bearing Instagram item or `.txt` item, explicitly start processing, and receive a persisted summary, points, editable classification suggestions, and mentioned links.
- Each returned claim/link/category can be traced to the analyzed source or is clearly marked as an unverified model suggestion. Invalid or unsupported output never becomes Completed.
- Analysis results remain separate from original import data and user notes, and are reused only for matching input/model/prompt/schema versions.
- Large imports can be split/batched safely; retries and refresh do not duplicate source records or erase provenance.
- Core library use remains useful when disconnected, offline, out of allowance, or on an unsupported source.
- Tests verify privacy/consent boundaries, error handling, schema validation, caching, queue recovery, and migration; browser/manual review is recorded.

## Current status

The account holder verified the terminal check live. `gpt-6-sol` returned a completed response and the temporary session was revoked. Earlier runs had returned HTTP 200 without a usable content type. The shared client reads a bounded response and recognizes valid streamed completion events even when the header is missing. `npm run ai:check` remains available as a diagnostic.

### First in-app flow

1. Open the same Siftory address you use for your library with `npm run dev` or `npm run preview`. IndexedDB is scoped to the exact browser address and port.
2. Open **Settings**, choose **Connect ChatGPT**, and use **Continue with ChatGPT** to sign in and grant plan access. Return to Siftory to see the connection and available models.
3. Open a saved Instagram item with a caption, or extract an imported `.txt` file in **Processing** first. On its detail page, review the exact text, choose a model, and confirm before starting. For a batch, select items in **Inbox** or **All saved**, review each exact text, and confirm once for that selected batch. The **Processing queue** shows queued and completed AI jobs, and lets you review, retry, or skip work.
4. The analysis shows the summary, key points, mentioned links and entities, suggested categories, and matching source quotes. Edit a category name before applying it. Analyze only text you're comfortable sending to OpenAI. Each request may use plan allowance or enabled credits.

The connection lives in local server memory until expiration, disconnect, or server restart. Settings runs a fresh authorization when reconnecting. Analysis uses at most 16,000 characters per request. Results save in local IndexedDB and are reused for the same item, analyzed text, model, and analysis version. Deleting the item removes its results.

The in-app sign-in reached the model listing but hit the smaller limit for text responses. The model catalog now has its own 8 MiB limit. A regression test verifies that a catalog above the text response limit loads and only selectable models reach Settings.

On 2026-11-22, the account holder reported that the in-app flow works after the model list size fix. The follow-up adds persistent local jobs, batch consent and review, session-bound requests, and resumable Instagram import batches. Build and lint pass; all 55 automated tests pass. Headless Chrome verified a 160-row multi-batch import, duplicate recognition after reload, keyboard selection, a mocked two-item analysis, and a 390 px layout without overflow. A synthetic 5,000-row parser test records elapsed time. These browser/test checks use mocked provider responses and synthetic source text. Persistent account registrations, credential renewal, automatic platform transcript retrieval, and actual browser storage quota behavior for a full-size export remain open. Phase 6 later adds user-provided transcript inputs.

The next work is documented in the [Phase 5 follow-up plan](PHASE-5-BATCH-ANALYSIS.md).
