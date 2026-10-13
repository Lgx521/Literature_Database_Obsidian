Fill publication dates from verified metadata and use the existing organization selector to show automatic organization.

- Add **Auto organized** (`自动整理`) alongside Pending, AI organized and Manually complete. Successful deterministic metadata extraction promotes pending records; total failures stay pending. Existing AI/manual completion is preserved. Auto organized records remain eligible for agent TL;DR and tag enrichment.
- Fill unknown publication dates as `YYYY.M`, retaining year-only precision when appropriate. Refine a system-owned year to its verified month, preserving human/unknown dates and manually complete metadata. Store date evidence in the same Markdown provenance cell.
- Use arXiv's first submission (`published`), an explicit v1 PDF stamp or unversioned abstract-page metadata. Ignore PDF lifecycle and revision dates. Do not substitute a later journal date when arXiv's first date is unavailable.
- Preserve independently verified dates even if bibliography conversion is incomplete. Keep existing BibTeX and citation keys unchanged. No AI-generated citations, new background scan or separate metadata-status UI.
- Read XMP metadata through both PDF.js metadata interfaces and handle completed Finder copies before Obsidian indexes them, so newly imported PDFs can be recognized immediately.
- Retain original PDF filenames, annotation companions, memberships and Notes. All 28 synthetic suites pass on macOS, including date provenance, partial recognition, failed recognition, concurrent human edits and automatic-to-AI enrichment.

Requires Obsidian 1.8.7+ on desktop. Finder import/paste requires macOS; iPhone/iPad are not supported. Install `main.js`, `manifest.json` and `styles.css` into the existing `paper-reservoir-dashboard` plugin folder and reload. Back up first; do not overwrite library files with empty templates. Existing vaults should adopt the updated rules in `templates/empty-vault/AGENTS.md`; the plugin never overwrites an existing AGENTS.md automatically.

Project code is AGPL-3.0-only. License notices are attached and embedded in main.js. The repository contains source, locked dependencies and CSL styles; dependency-source.tar.gz contains exact dependency sources. SHA256SUMS lists asset hashes.
