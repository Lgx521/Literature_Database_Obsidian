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

## 4.9.2 interaction and memory audit — 2026-10-16

Rebuilding the browser view (for example after a language change) registered another visibility listener each time and retained the previous detail element through its motion controller. Rebuild now destroys that controller, initializes motion against the new details and registers visibility once. Dismissed collection menus also revoke native callbacks and release selected rows and the document reference.

In the isolated Obsidian demo renderer, 40 rebuilds previously increased view-managed hooks from 4 to 44. The local fix keeps 4 hooks, 805 mounted document nodes and 1,045 total renderer event listeners throughout the same visible-window exercise. The motion root remained the current detail element. After diagnostic GC, JS heap changed from 20.39 to 20.46 MiB over 40 rebuilds; this bounded test found no growing retained panel tree.

A separate comparison in one freshly restarted demo renderer used no other community plugins, no open PDF viewer and no AI requests. The 1,000-row case used synthetic records held only in memory:

| State | Renderer private memory | Renderer JS heap | Mounted document nodes |
| --- | ---: | ---: | ---: |
| Plugin disabled, empty tab | 149.6 MiB | 13.1 MiB | 412 |
| Plugin enabled, 12 demo papers | 158.8 MiB | 19.8 MiB | 951 |
| Plugin enabled, 1,000 synthetic papers | 198.0 MiB | 20.7 MiB | 13,643 |

Private memory includes Chromium/Blink, rendering allocations and allocator caches; it is neither plugin-only JS memory nor the sum of all Obsidian processes. These sequential samples are diagnostic comparisons, not a fixed memory budget. Large paper lists still mount every row, so DOM virtualization remains the main larger-scale opportunity. Tests do not force GC in normal plugin operation.

`test-view-lifecycle.cjs` checks repeated rebuild/close cleanup; collection and drag suites cover nested targets, Cmd moves, duplicate/no-op feedback, callback revocation and source-data preservation. Search navigation and import-reveal behavior are also covered.

## 4.9.2 AI memory audit — 2026-10-16

The 4.9.2 build was exercised in the actual macOS Obsidian demo renderer with real PDF.js extraction and production planning, preview and tag-map code. Only the API transport was replaced with deterministic responses: no provider requests, credentials or personal papers were used. Fixtures were twenty 12-page PDFs of 1.89 MiB each and one 12-page PDF of 26.13 MiB, containing synthetic text and embedded RGB images. Nothing was applied to the library. Background timer throttling was disabled in the demo for the final run and restored afterward.

These are whole-renderer JS heap readings after diagnostic GC, not plugin-only or total-process memory:

| State | JS heap |
| --- | ---: |
| Library open, AI not initialized | 19.86 MiB |
| AI panel open, before PDF extraction | 19.98 MiB |
| Twenty completed proposals visible | 21.79 MiB |
| Twenty additional panel/tag-map open-close cycles, proposals retained | 22.23 MiB |
| Results cleared, repeated large-PDF reads and cancellation finished | 22.10 MiB |

The retained JS increase in this workload was about 2.2 MiB. PDF buffers are separate: external-memory sampling peaked at 27.05 MiB during twenty-paper planning, 17.82 MiB during per-paper enrichment and 60.41 MiB for the large PDF, against a post-initialization baseline of 8.14 MiB. Thus this large-file case temporarily added about 52 MiB of external buffers. Renderer private memory peaked at 241.08 MiB in that run and later fell to 161.19 MiB; allocator caches and OS accounting make it unsuitable as a fixed plugin allocation. Sampling may miss shorter peaks, and complex real PDFs or other platforms can differ.

The audit found that cancellation during `vault.readBinary`, before PDF.js received the data, left the host adapter's last-read promise holding a 26.13 MiB ArrayBuffer. A heap retaining path confirmed the owner. Extraction now covers the read itself with cleanup and transfers any remaining owned buffer after destroying the loading task, when the platform supports transfer. It does not change host adapter state or force GC. The same cancellation test reduced external memory after GC from 34.27 MiB to the 8.14 MiB baseline.

All 52 created PDF tasks were destroyed, maximum concurrent tasks stayed at one, and no simulated API request began while a PDF task remained active. At the end there were no pending work items, requests, queue jobs or modal subscribers. Twenty panel/map cycles released map models and nodes on every close. Regression coverage includes cancellation during a deferred file read, oversized-read rejection and normal completion; all 55 offline suites pass. The bounded exercise found no accumulating PDF or panel allocations, but is not a universal memory ceiling. DeepSeek model inference runs remotely; this test measures local orchestration and parsing, not inference or actual HTTP transport overhead.

## 4.9.3 search optimization — 2026-10-16

Advanced search reuses the current snapshot's sort order, lazily normalized text and field values, and the current advanced predicate's per-row results. Snapshot replacement, language changes and custom-field edits invalidate derived data. Typing coalesces to one animation frame, waits for IME composition to finish and pauses in hidden views. Closing or rebuilding the view releases its search cache and pending frame. Search adds no network requests, PDF reads, worker, runtime dependency or persistent index.

`node --expose-gc scripts/benchmark-search.cjs` runs an offline synthetic fixture. The comparison used the implementation before this optimization and the cached implementation in five alternating process runs on macOS with Node 26.7.0. Each workload ran 48 typing/backspace queries, discarded the first 12 for warm-up and reported the median; the table is the median across those five runs. Advanced queries combine tags, publication dates and TL;DR. All result checksums matched.

| Papers | Plain search before | Plain search cached | Advanced search before | Advanced search cached |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | 2.03 ms | 0.07 ms | 3.14 ms | 0.06 ms |
| 10,000 | 22.17 ms | 1.37 ms | 33.84 ms | 1.29 ms |

These timings cover warm filtering and sorting, not painting. Cold first-call time for 10,000 rows increased from 27.19 to 31.71 ms. The cache retains at most 8 MiB of estimated value payload; oversized Notes remain fully searchable without being cached. Maps, row references and runtime overhead are additional. The benchmark's post-GC heap increase was 2.06 MiB for 1,000 cached rows versus 0.37 MiB before, and 12.21 MiB for 10,000 versus 2.48 MiB before. Diagnostic GC is used only by the benchmark.

In the actual Obsidian demo renderer, 1,000 synthetic rows held only in memory took a median 1.2 ms in `renderList` JavaScript during consecutive searches retaining the same results. Adding or removing many visible DOM rows still costs more; full list virtualization remains separate work. Input bursts and IME commits each produced one render, with focus retained. Forty search-dialog and ten tag-map open/close cycles left mounted document nodes unchanged at 968 and released map models and callbacks. Demo source files remained byte-identical.

All 58 offline suites pass, including 200 cached/stateless equivalence cases, cache invalidation, long Notes beyond the cache budget, AND/OR and date semantics, composition handling, hidden views, draft protection and teardown. The package check passes. These changes ship in 4.9.3.

## 4.9.6 preview memory audit — 2026-10-20

AI preview editors now mount on expansion and unmount after the collapse animation finishes. Draft values survive in the work item; completed previews retain their summary. Placement controls capture only category names and subcategories, rather than membership arrays. Tag-map sessions release their full catalog on close and keep only additions, removed suggestions and primitive view preferences. Reopening uses the current catalog and rejects conflicting additions. PDF excerpt construction stops at the existing character budget instead of joining an entire large page before truncation.

`benchmark-ai-memory.cjs` compares the local build before this optimization with 4.9.6 using Chromium and lightweight Obsidian host shims. The fixture has 20 previews, 100 categories, 1,000 synthetic papers and 1,000 tags. It edits a summary, exercises collapse/reopen, opens and edits each proposal's tag map, then opens/closes the AI panel twenty times and checks a narrow viewport with reduced motion. No provider requests, real PDFs or personal data are used. The script accepts an external Playwright installation; it adds no runtime dependency.

| Measurement | Before | 4.9.6 |
| --- | ---: | ---: |
| Initially mounted document elements | 2,880 | 334 |
| Mounted preview editors | 20 | 1 |
| Mounted preview select options | 2,080 | 104 |
| Serialized retained draft state after 20 tag maps | 1,290,992 bytes | 18,512 bytes |
| Full tag catalogs retained per closed-map batch | 20 | 0 |
| Renderer JS heap after 20 panel reopen cycles | 4.182 MiB | 3.244 MiB |
| Renderer JS heap after final close and focus release | 4.050 MiB | 3.257 MiB |

Both final-close samples had 22 DOM nodes and 30 event listeners in Chromium's counters, with zero task subscribers; the page had seven mounted elements. Diagnostic GC is used only by this benchmark. Serialized draft size is a payload comparison, not measured heap allocation. These component-harness heap readings exclude the real Obsidian shell and do not establish a total-application memory ceiling. The separate 50 MiB extraction boundary tests retain serial PDF ownership and buffer cleanup.

65 offline suites cover batch continuation/retry, protected writes, compact draft reconstruction and conflicts, late-read teardown, bounded excerpt assembly, disclosure reversals, mobile execution and existing library interactions.
