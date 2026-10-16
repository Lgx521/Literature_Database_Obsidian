Literature Database 4.9.2 improves collection navigation, searchable AI summaries and memory cleanup.

- **Clear transfer feedback.** Distinguish papers newly added, moved or already present at the destination.
- **Move directly into subcategories.** Cmd-drag works across same-type collections, including child targets. Add/move menus show nested destinations only when a collection has children.
- **Keep your search.** Switching categories, subcategories, projects or smart views preserves the search query.
- **Search by method name.** AI summaries retain explicitly stated method names/acronyms, with the same rule for external workspace agents.
- **Release unused memory.** Rebuilt views and dismissed menus release old DOM, listeners and callbacks. PDF extraction also releases its read buffer when cancelled before parsing starts.

Validation: 55 offline regression suites on macOS, plus isolated Obsidian tests covering batch planning, 20-paper previews, repeated panel/tag-map cycles, large PDFs and cancellation. AI memory tests used synthetic PDFs and a simulated API transport. Requires Obsidian 1.8.7+.

[Performance measurements](https://github.com/Lgx521/Literature_Database_Obsidian/blob/4.9.2/docs/performance.md)
