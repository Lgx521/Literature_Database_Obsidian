Add bookmarks, subtle interaction feedback, and stable in-place bookmark updates.

- Add **Bookmarks** between Inbox and Reading. Mark or unmark a paper in the details pane; a small red bookmark overlaps its PDF icon.
- Group bookmarked papers by research category in sidebar order. Papers with multiple categories appear in every category; counts, exports and batch actions remain deduplicated. Papers without a research category appear under Unfiled.
- Preserve bookmarks through trash and restore. Store the user-controlled marker in an optional 14th Markdown column, extending older tables losslessly on the first bookmark change. Agents preserve this field.
- Add short pop/fade feedback for tags, venues, memberships and detail controls. Respect reduced motion and avoid replaying animations on navigation or unchanged refreshes.
- Fix flashing when toggling a bookmark: keep unchanged list/detail controls mounted, preserve focus, scroll and Notes drafts, and avoid disabling unrelated controls. Retained actions use the latest paper data.

Requires Obsidian 1.8.7+. Validated with 30 synthetic regression suites on macOS and app checks in a separate demo vault, including mobile emulation, reduced motion, failed saves and unsaved Notes. Existing PDF filenames, annotations, bibliography and notes are preserved. Reload the plugin on other devices after the runtime files finish syncing.
