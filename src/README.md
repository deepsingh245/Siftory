# Application source

`App.tsx` is the responsive Siftory shell. `features/library/` contains the library and organization views. `features/import/` previews and confirms local imports, and `features/processing/` handles local text extraction. `features/analysis/` connects Settings to the local server and shows analysis for individual items. `infrastructure/persistence/` stores the library, extraction results, and versioned analyses in IndexedDB schema version 4.

Other folders are architectural boundaries from `docs/ARCHITECTURE.md`; they do not imply that later-phase features exist.
