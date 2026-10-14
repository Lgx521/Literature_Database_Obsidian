# Changelog

## 4.7.0 — 2026-10-14

- Add one level of subcategories to categories and writing projects, with inline create/rename, drag ordering, per-parent paper placement and grouped lists without duplicate rows.
- Preserve parent memberships, project notes and deadlines when moving or removing child placements; retain existing last-membership and trash safeguards.
- Support PDF drops across entire child sections and scrolling the middle list during a drag, with the target following the pointer.
- Select and reveal imported papers; retain visible selection after metadata changes the title order, without interrupting a user who has scrolled away.
- Animate sidebar expansion without rebuilding controls; hide empty Ungrouped sidebar entries while preserving named empty children.
- Order details as TL;DR, Categories, Tags, Venue and Notes. Keep tags independent of child placement and preserve existing Markdown data.

## 4.3.1 — 2026-10-13

- Prepare the first installable release for Community review; mark Node/Electron functionality as desktop-only.
- Add explicit first-run creation of empty source tables and attachment folders, preserving existing files and agent instructions. New libraries have no predefined categories or writing projects.
- Make startup opening and source-table redirects configurable; retain existing library preferences and default new installs to off.
- Refuse to rename unrelated notes that happen to use a legacy source filename.
- Use the current window document for inline renaming and move input widths into scoped CSS.
- Embed license notices in the runtime; add reproducible release packaging, dependency sources and checksums.
- Add README badges and manual release installation instructions.

## 4.3.0

- Keep the selected manuscript after saving Notes/status or refreshing changed row indices.

- Change review status directly in the details pane (To review / Reviewing / Completed), preserving unsaved Notes.

- Use English source filenames with backed-up legacy migration and collision protection.
- Add Chinese/English UI and a compact language picker; follow Obsidian by default.
- Translate controls, menus, dialogs, notices and citation diagnostics without changing stored values or user content.
- Preserve older tracker identifiers and trash receipts after filename migration.
- Require Obsidian 1.8.7 for its public language API.

## 4.2.3 — 2026-10-13

Initial version-controlled baseline of Literature Database.

- Compact literature browsing, multiple collection memberships and writing projects.
- Review/submission venue management, explicit shared deadlines and AoE countdowns.
- Evidence-based citation recognition and APA 7, IEEE, BibTeX and title exports.
- Finder PDF import/paste, annotation preservation and system-default PDF opening.
- Confirmed paper titles in details and direct editing of reading status/priority.
- Immediate recoverable deletion; multi-select trash with batch restore and batch permanent deletion.
- Independent source build, synthetic tests, CI, licensing and empty-vault templates.

This is a development baseline, not an Obsidian Community directory release.
