Literature Database 4.9.1 adds batch-first Inbox organization, helping new libraries build a consistent taxonomy before papers are filed.

- **Plan the batch first.** Read up to 20 Inbox PDFs together, propose shared categories and tags, and preview every paper’s assignment. Existing names are preferred.
- **Review and merge.** Edit suggestion names to combine similar categories or tags. Confirm the plan before per-paper title, TL;DR and tag generation; Apply remains a separate step.
- **Consistent assignments.** Confirmed categories are fixed by the plugin, and subsequent AI results use only existing or approved tags. Human tag edits retain their own provenance.
- **Resume the preview.** Closing and reopening the panel preserves the current session’s plan and edits. Mobile confirmation controls stay visible while the plan scrolls.

Validation: 54 offline regression suites on macOS, plus an isolated live test with six public papers and a second two-paper batch that reused the existing taxonomy. PDF filenames and contents were preserved. Requires Obsidian 1.8.7+.

[AI organization guide](https://github.com/Lgx521/Literature_Database_Obsidian/blob/4.9.1/docs/deepseek-beta.md)
