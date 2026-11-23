# Siftory

**Save less. Understand more.**

Your personal library for everything worth knowing.

Siftory is a local-first personal knowledge library and research workspace. It supports reviewed imports, local text extraction, ChatGPT-plan analysis, transcripts, and library research. An optional local media trial can produce audio and transcripts for accessible Instagram links.

## Development

Use Node.js 24 or newer and run the app on this machine. The app supports manual entries, Inbox and All Saved, organization, search, and imports from Instagram JSON, bookmarks, URLs, PDFs, and plain text. Imports are parsed locally and reviewed before saving.

```sh
npm install
npm run dev
npm run build
npm run lint
npm test
```

## Dashboard theme

The dashboard adapts the free [shadcn dashboard block](https://ui.shadcn.com/blocks/dashboard). Edit the light palette under `:root` and the dark palette under `.dark` in [src/styles/theme.css](src/styles/theme.css). For example, change `--primary` and `--primary-foreground` together for primary actions, or change `--chart-1` for the activity series. The sidebar and existing screens use the same palette.

Run `npm run build` then `npm run test:browser` to check the dashboard in an isolated Puppeteer session. The test uses installed Chrome. Set `SIFTORY_CHROME_PATH` for a nonstandard installation. The screenshots are saved to `test-results/shadcn/`.

## Local storage and ChatGPT

In the browser and address where the existing seven imports are visible, open **Settings → Local storage → Move seven imports to SQLite**. Siftory identifies the items from the local `data.json`, writes and verifies a private backup under `.siftory/backups/`, then checks the migrated data before using SQLite. Keep the original browser library and the backup for recovery. Settings shows the database size, attachments, referenced audio, and reusable pages.

On Windows, connect ChatGPT once from Settings after updating. The local server encrypts the renewable OAuth session with Windows DPAPI and restores it for the same browser and address after restart. OpenAI can expire or revoke the grant. Your library works independently of ChatGPT, and analysis still requires review and consent.

If analysis fails, open **Processing queue → Error details** on the job. Match its request ID to the `[Siftory AI]` entry in the terminal where Siftory is running. These diagnostics omit source text, model response bodies, and credentials.

If an optional finding has a quote that cannot be matched exactly, Siftory keeps the supported analysis and marks that some findings were omitted. The summary still requires an exact source quote.

Open **App links** in a saved analysis to check selected app names and store links. Name searches use Apple's public catalog. Direct Google Play links can also be checked. Other URLs stay under **Links in the text**.

## Optional local media trial

The trial uses Python 3.12+, free `yt-dlp`, a local FFmpeg binary, and `faster-whisper`. It attempts direct, accessible Instagram post/Reel links without login, cookies, or retries. Instagram access is unofficial and can stop working or be restricted; use it only for media you are permitted to process. Local files work independently of Instagram. The first transcription downloads a speech model; media and transcript processing remain on this device.

In PowerShell, from the repository root:

```powershell
python -m venv .siftory/media-venv
.siftory/media-venv/Scripts/python.exe -m pip install -r scripts/media-requirements.txt
.siftory/media-venv/Scripts/python.exe scripts/media_trial.py --instagram-json path/to/saved.json --max-items 20 --model base
```

Use `--file path/to/video.mp4` for a local video or audio file, `--url https://www.instagram.com/reel/SHORTCODE/` for one link, or `--audio-only` to skip transcription. Each run writes WAV audio, SRT subtitles, and a result manifest under the Git-ignored `.siftory/media/` folder. It never changes the original export. Repeating a completed run skips existing results; a prior audio-only result is transcribed without another download. `--rerun` creates a separate result folder.

While the local Siftory app is open, it checks that folder every 30 seconds and attaches generated transcripts to matching saved Instagram links that have no transcript. Removing a transcript stops automatic attachment for that item until you enable it again. Item detail provides audio playback, timestamp seeking, and download. AI analysis still requires its separate review and consent. See [the trial plan](docs/phases/PHASE-6-LOCAL-MEDIA-TRIAL.md).

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
