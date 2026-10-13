# Literature Database

A compact, Zotero-style literature manager for Obsidian, by **shengzhegan**. Browse collections on the left, papers in a dense list, and metadata and notes on the right. Your library stays in Markdown, with PDFs stored as ordinary files.

**Status:** development baseline **4.2.3**, tested locally on macOS with Obsidian 1.14.4. This repository is not yet listed in the Obsidian Community directory. Windows, Linux, iPhone and iPad support has not been validated. The current interface is primarily Chinese.

[中文使用指南](docs/usage.zh-CN.md) · [Development](docs/development.md) · [Community release preparation](docs/community-release.md)

## Features

- Compact three-pane browsing, search, reading status, priority, tags, publication venues, TL;DR and personal notes.
- Multiple collections and writing projects per paper, without duplicating its PDF or metadata. Drag papers to add memberships; explicitly move or remove a membership when needed.
- A PDF inbox with Finder drag-and-drop and blank-area **Paste** on macOS. Original files and matching annotation sidecars are preserved.
- Separate review and submission trackers, venue deadlines, AoE time zones and countdowns. Writing projects are independent; deadlines are shared only by explicit choice.
- Open PDFs in the system's default application. Skim is optional; the plugin does not embed a second desktop PDF viewer.
- Recoverable deletion, multi-select trash, batch restore and batch permanent deletion with a single confirmation. File collisions are never overwritten.
- BibTeX, APA 7, IEEE and paper-title exports. Citation metadata comes from PDF evidence and verified Crossref/arXiv lookups, not AI-generated bibliographies.
- Manual agent handoff. No scheduled agent runs, per-paper Markdown files or second JSON metadata database.

## Try the current version

Use a separate test vault first. This version expects a fixed Markdown schema and opens its literature view on startup; it also redirects the named source documents into that view. General-purpose onboarding is still planned.

1. Install Node.js 20+ and Python 3. Clone this repository.
2. Run `npm run build`. Normal builds use the checked-in citation formatter and need no dependency installation.
3. Create a new, empty Obsidian vault. Copy the contents of [`templates/empty-vault`](templates/empty-vault) into its root. These are empty templates, not the author's library.
4. Create `papers/`, `temp/`, `reviews/` and `submissions/` in that vault.
5. Create `<vault>/.obsidian/plugins/paper-reservoir-dashboard/` and copy the generated `main.js`, `styles.css` and the repository's `manifest.json` there.
6. Reload Obsidian and enable **Literature Database** in Community plugins. Drag PDFs into the inbox and organize them manually or with your own agent following the template `AGENTS.md`.

Do not overwrite existing source tables with the templates. The internal plugin ID remains `paper-reservoir-dashboard` for compatibility with existing installations.

## Data and privacy

The canonical files are `文献库.md` (paper metadata), `集合.md` (collection/project memberships), `审稿.md` (reviews) and `投稿.md` (submissions). The right-hand paper title uses the confirmed title; list entries retain the actual PDF filename. Skim `.skim`, `.fdf` and `.xfdf` sidecars stay paired with their PDFs.

The plugin makes local backups before edits, checks for concurrent changes and keeps recoverable deletions under `.maintenance-backups/deleted/`. Permanent deletion removes only the selected archived record and its attachments. This is not a substitute for a separate backup. iCloud and other file sync are provided by your vault's storage provider; this plugin does not implement a sync service.

**Network access:** citation recognition uses `api.crossref.org`, `export.arxiv.org` and, when needed, `arxiv.org`. Requests contain a public identifier or paper title. It does not upload PDFs, personal notes, review manuscripts or submission attachments. Recognition runs for newly admitted public papers while the plugin is active, for exports missing citations, or after the explicit retry command; it does not scan the entire library on startup. Uncertain matches remain empty. Existing bibliography fields are preserved.

**Outside-vault access:** when you explicitly drop or paste local PDFs on macOS, the importer reads those files and matching annotation sidecars and copies them into the vault using `ditto`, preserving extended attributes. It reads the clipboard only when Paste is chosen. Opening a PDF invokes the default desktop application (`/usr/bin/open` on macOS). The plugin does not change your default PDF application.

No account, payment or analytics is required by the plugin. The optional agent button copies instructions; it does not itself launch an AI model or send your library to one.

## License and attribution

Copyright (c) 2026 shengzhegan. Project code is licensed under **GNU AGPL-3.0-only**; see [LICENSE](LICENSE).

Citation formatting includes Citation.js (MIT), citeproc-js by Frank Bennett (using its AGPL v3-or-later option), and CSL APA/IEEE styles (CC BY-SA 3.0). Other bundled dependencies retain their own licenses. Full notices, versions and rebuild instructions are in [THIRD-PARTY.md](scripts/vendor/THIRD-PARTY.md). The project license does not replace those licenses.

This project is not affiliated with Obsidian, Zotero or Skim.
