# Application source

`App.tsx` is the responsive Siftory shell. `features/library/` contains Inbox, All Saved, detail, organization, search, filtering, and recent-history views. `features/import/` provides local import previews and confirmation. `domain/imports.ts` parses Instagram JSON and bookmark HTML, validates manual URLs and PDF/text files, and prepares provenance-safe records. `infrastructure/persistence/` stores library records and original imported files in IndexedDB schema version 2. Extraction, processing, AI, backup/restore, and research are not implemented yet.

Other folders are architectural boundaries from `docs/ARCHITECTURE.md`; they do not imply that later-phase features exist.
