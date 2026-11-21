# Application source

`App.tsx` is the responsive Siftory shell. `features/library/` contains the current Inbox, All Saved, detail, organization, search, filtering, and recent-history views. `infrastructure/persistence/` stores library records in IndexedDB. Batch imports, extraction, processing, AI, backup/restore, and research are not implemented yet.

Other folders are architectural boundaries from `docs/ARCHITECTURE.md`; they do not imply that later-phase features exist.
