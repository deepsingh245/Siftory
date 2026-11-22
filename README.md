# Siftory

**Save less. Understand more.**

Your personal library for everything worth knowing.

Siftory is a local-first personal knowledge library and research workspace. The responsive shell, local library, review-before-save imports, local text extraction, ChatGPT-plan analysis, transcripts, and library-only research are implemented. An optional local media trial can produce audio and transcripts for accessible Instagram links. Manual backup/restore and external web research remain planned.

## Development

The current app supports manual entries, Inbox and All Saved, organization, keyword search, filters, recently viewed items, and imports from Instagram JSON, browser bookmark HTML, manual URLs, PDFs, and plain-text files. App imports are parsed locally and reviewed before saving. The optional media trial is a separate command. Navigation destinations marked “Planned” are not implemented features yet.

```sh
npm install
npm run dev
npm run build
npm run lint
npm test
```

## Optional local media trial

The trial uses Python 3.12+, free `yt-dlp`, a local FFmpeg binary, and `faster-whisper`. It attempts direct, accessible Instagram post/Reel links without login, cookies, or retries. Instagram access is unofficial and can stop working or be restricted; use it only for media you are permitted to process. Local files work independently of Instagram. The first transcription downloads a speech model; media and transcript processing remain on this device.

In PowerShell, from the repository root:

```powershell
python -m venv .siftory/media-venv
.siftory/media-venv/Scripts/python.exe -m pip install -r scripts/media-requirements.txt
.siftory/media-venv/Scripts/python.exe scripts/media_trial.py --instagram-json path/to/saved.json --max-items 20 --model base
```

Use `--file path/to/video.mp4` for a local video or audio file, `--url https://www.instagram.com/reel/SHORTCODE/` for one link, or `--audio-only` to skip transcription. Each run writes WAV audio, SRT subtitles, and a result manifest under the Git-ignored `.siftory/media/` folder. It never changes the original export. Repeating a completed run skips existing results; a prior audio-only result is transcribed without another download. `--rerun` creates a separate result folder.

While the local Siftory app is open, it checks that folder every 30 seconds and attaches generated transcripts to matching saved Instagram links that have no transcript. It leaves human-attached transcripts untouched. Removing a transcript stops automatic reattachment for that item until you enable it again. Item detail offers a local audio download. AI analysis still requires its separate review and consent. See [the trial plan](docs/phases/PHASE-6-LOCAL-MEDIA-TRIAL.md) for scope and limits.

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
