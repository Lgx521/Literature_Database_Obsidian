# Performance

## 4.8.6 source refresh and tag maps

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

Intake recognition and DeepSeek PDF reads share one serial queue. Read bytes only when a job starts; destroy loading tasks and clean pages on completion, error, cancellation and unload. Cancellation waits for an in-flight file read to settle rather than overlapping buffers. DeepSeek releases PDF resources before sending its bounded excerpt request. No queue polling runs while idle.


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

## 4.9.0 AI and rendering audit — 2026-10-15

Version 4.9.0 includes the following additional optimizations. It removes the obsolete tag-picker vocabulary read and dead menu state. DeepSeek eligibility uses a linear membership set and caches only the current source revision. Preview validation caches immutable edits; Apply independently revalidates current source files. Input/job notifications coalesce to one animation frame, hidden documents defer rendering, unchanged controls are not rewritten, and status SVGs retain their DOM. Closing releases frames, visibility listeners, node references and batch caches. Applied/ignored previews release their full tag-map catalogs. Pending preview edits still survive close/reopen.

Paper filtering now assembles search text once per row regardless of token count and reuses an English numeric collator instead of constructing one for each comparison. Sorting, query results and exports remain compatible. Field settings no longer repeatedly parse their initial JSON during rendering. No new runtime dependency, polling loop, worker or persistent index was introduced.

| Synthetic workload | Before this pass | After |
| --- | ---: | ---: |
| 5,000 papers, title sort (Node 26, median of 7) | 64.147 ms | 5.731 ms |
| 5,000 papers, three-term search + sort (same fixture) | 72.011 ms | 8.862 ms |
| 1,000 papers / 20 previews, unchanged UI sync (Obsidian, median of 5) | 2.3 ms | 0.1 ms |
| Same preview, 20 edits + final synchronous flush | 26.6 ms | 0.1 ms |

Renderer timer resolution is coarse near 0.1 ms; these are local fixture measurements, not universal latency guarantees. Unchanged preview sync generated zero DOM mutations in the final UI probe. Caret, textarea/summary/icon identity, draft text, tag-map reopening and close cleanup passed.

After five warm-up preview + 1,000-tag map open/close cycles, forced diagnostic GC measured renderer JS heap at 21,583.4 KiB; after ten more cycles it was 21,730.2 KiB, and after twenty, 21,755.3 KiB. Mounted document nodes stayed at 996; task subscribers, map models/nodes and queued frames were released on every close. This bounded sample does not establish a permanent leak-free guarantee or a 200 MB total-process ceiling. The plugin never invokes GC. No real provider requests or private-vault mutations were used in these benchmarks.

`test-performance-beta.cjs` covers source-cache invalidation, bounded selection, per-edit validation, batch Apply complexity, draft release, frame cancellation/hidden pause, and search/sort compatibility. All 53 offline suites pass.
