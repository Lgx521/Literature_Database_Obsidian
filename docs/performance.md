# Performance in 4.8.6

Version 4.8.6 includes these changes. They preserve the Markdown schema, filenames, citation output and existing layout.

## Refresh and views

- Vault events and explicit writes feed one refresh queue. A normal single-source edit reads and parses only that source; a manual refresh checks all four canonical source files but reuses unchanged parsed data.
- A snapshot is published only after its required sources validate. Missing or malformed synced files leave the last good snapshot visible. Recovery rechecks all sources, including concurrent edits from a failed pass.
- Collection membership indexing is linear in papers plus memberships. The inbox traverses its own folder rather than enumerating unrelated vault files.
- List rows and group containers retain their DOM identity by scope/group/PDF path. Changed cells update in place; focus, selection, scroll position and unsaved Notes remain intact. Bookmark views can still show the same paper under multiple categories.
- Hidden views defer painting. Activation resumes on the next animation frame, after Obsidian has made the tab visible. Navigation with unchanged counts and memberships retains its DOM and resumes only the deadline timer when needed.

## Tag map

Pan, wheel zoom and pinch updates are coalesced to one animation frame. Layouts above 250 nodes mount only visible nodes and a 240-pixel buffer, while keeping the focused node and inline editor mounted. Search and branch creation reveal their targets before focus moves.

Closing the map disconnects observers and listeners, cancels pending frames/timers, revokes native-menu callbacks and releases nodes, edges, model and layout references. Only primitive pan/zoom, folded keys, branch sides and search text remain on the owning view for reopening. Hidden documents pause painting.

## References and PDF work

Formatting stored titles has no PDF, network or formatter dependency, and exporting known titles does not wait behind PDF work. The title formatter loads the bibliography parser only if a missing title can be recovered from an existing bibliography. The export dialog preserves its existing local-PDF recognition fallback for unresolved titles; those missing-title rows still need extraction. BibTeX uses the parser without initializing CSL; APA/IEEE initialize the formatter on demand. All code remains bundled in the usual release assets. There is no remote runtime code download.

Intake recognition and Agent MCP PDF reads share one serial queue. PDF bytes are read only after a job starts; loading tasks and pages are destroyed/cleaned on completion, error, cancellation and unload. The command **Cancel PDF recognition and reading** cancels queued work and the active extraction. MCP client disconnect and service shutdown also cancel their reads. Job timeouts are 45 seconds for intake and 30 seconds for MCP reads; cancellation cannot interrupt a platform file-read promise, so the next job waits for that read to settle instead of overlapping buffers. No queue polling runs while idle.

MCP first-page evidence is bounded to 64 papers and file-revision hashes to 256 entries. If evidence has been evicted, the agent must read that paper again before enrichment. This does not relax provenance or citation rules.

## Validation and measurements

An isolated macOS Obsidian demo vault was populated with 1,000 synthetic paper rows and 1,000 tags in ten groups. The released 4.8.5 bundle and the build prepared for 4.8.6 used the same data. Measurements ran inside the actual Obsidian renderer through its CLI; no personal vault was modified for the benchmark. Refresh and map-render times below are medians of five calls, with the map expanded.

| Operation | Released 4.8.5 | 4.8.6 |
| --- | ---: | ---: |
| Unchanged manual refresh | 28.1 ms | 0.8 ms |
| Expanded tag-map render | 53.3 ms | 1.7 ms |
| Refresh passes after one field edit | 2 | 1 |
| Source reads for that edit, including concurrency guard | 9 | 2 |
| Mounted map nodes at the sampled viewport | 1,021 | 132 |
| Node-map entries after closing | 1,021 | 0 |
| Existing list-row DOM retained after edit | No | Yes |

Both versions preserved selection, focus, scroll and an unsaved Notes draft in this scenario. A closed map retaining a node-map entry does not by itself prove a permanent leak; teardown is now explicit even if the host retains a menu or modal reference.

After three warm-up map open/close cycles, diagnostic garbage collection measured the 4.8.6 build's **whole renderer JavaScript heap** at 21,815 KiB, then 21,961 KiB after ten more cycles and 21,973 KiB after twenty. Forced GC was used only for this isolated diagnostic, never by the plugin. These are not plugin-only allocations or total Obsidian memory. Electron, GPU, other plugins, PDF content and allocator caches remain outside this measurement; a total application budget of 200 MB is not established by these results.

The automated suites cover cache invalidation and failed-sync recovery, changes arriving during refresh/unload, retained selection and controls, map culling/focus and teardown, queue serialization/cancellation/timeouts, and mobile execution without Node/Electron imports. Citation fixtures compare title lists, BibTeX, APA and IEEE text/HTML and missing-entry reports byte-for-byte against 4.8.5 using synthetic bibliography records.

Full paper-list virtualization remains deferred. The retained-row approach avoids rebuilding unchanged controls; it still mounts all list rows. Very large libraries require a separate virtualization change with cross-screen selection, keyboard, grouping and drag-target tests.
