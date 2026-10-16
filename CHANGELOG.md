# Changelog

## 4.9.2 — 2026-10-16

- Distinguish newly added, moved and already-present papers in collection transfer feedback.
- Support Cmd-drag moves into subcategories and nested native add/move menus; flat collections remain direct menu items.
- Preserve search queries while navigating categories, subcategories, writing projects and smart views.
- Retain explicitly stated method names/acronyms in AI TL;DR summaries and workspace-agent instructions.
- Release stale detail DOM, visibility listeners and native-menu callbacks during view rebuild/close.
- Release owned PDF buffers on completion and cancellation, including cancellation before a PDF task exists.
- Validate with 55 offline suites and isolated Obsidian interaction/AI memory tests.

## 4.9.1 — 2026-10-15

- Plan Inbox categories and tags across a batch before per-paper enrichment, reusing existing canonical names.
- Review assignments, merge draft names, and explicitly confirm the taxonomy before generating editable metadata previews.
- Keep confirmed category assignments fixed in code; reject unapproved tags and stale plans. Preserve human tag provenance and guarded Apply transactions.
- Retain session plans across panel close/reopen and keep mobile confirmation controls visible.
- Validate with 54 offline suites and two public-paper demo batches.

## 4.8.0 — 2026-10-14

- Add a two-sided editable tag map with inline group/tag/child creation, independent checkboxes, search, folding, pan and zoom. Keep paper assignments and provenance in the canonical library row.
- Store optional vocabulary and visual groups in tags.md, with backups and conflict guards; opening the map does not create a file.
- Support multiple exact tag filters with OR semantics, a stable searchable checkbox menu and migration from legacy single-tag view state.
- Add single and batch bookmark actions to paper context menus, preserving Notes and unrelated controls.
- Enlarge mobile category/project disclosure targets to 44×44 without changing desktop targets.
- Prevent mobile text-button padding from stretching tag-map and other icon controls; add smooth tablet detail expansion, preserve phone transitions and respect reduced motion. Retain the native Obsidian mobile sidebar.
- Refresh README screenshots from an isolated English demo vault using the Obsidian CLI.

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
