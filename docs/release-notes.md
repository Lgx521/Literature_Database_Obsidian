Build your tag vocabulary visually and filter papers with several tags at once.

- Open the two-sided tag map from the circular **+** beside Tags. Create groups, tags and child tags inline; check a box to assign a tag to the current paper. Search, fold, pan and zoom without losing Notes or changing the selected paper.
- Store an optional tag vocabulary in `tags.md`, with backups and conflict checks. Paper assignments and human/AI provenance stay in the canonical library row; opening the map does not create files.
- Select multiple tag filters with **OR** semantics. Keep the searchable checkbox menu open while choosing, clear selections, and combine tags with the existing filters.
- Add or remove bookmarks from the paper context menu, including multi-selection, with one guarded batch write and no unrelated control flicker.
- Use larger 44×44 mobile disclosure targets. Fix stretched tag-map, bookmark, delete and sidebar icon buttons caused by mobile text-button padding.
- Animate iPad detail expansion in the side-by-side layout, retain phone transitions and preserve unsaved Notes during rapid reversals. Keep Obsidian's native mobile sidebar and respect reduced motion.
- Update all README screenshots and add the tag map, captured through the Obsidian CLI in an isolated English demo vault with public papers and fictional review tasks.

Requires Obsidian 1.8.7+. Existing libraries remain readable. PDF filenames, citations, private manuscripts and personal notes are preserved. No scheduled agent, telemetry or full-library metadata scan is added.

Validated with 37 synthetic regression suites on macOS and desktop, tablet and phone emulator checks using a separate demo vault. Release CI also runs on Linux (skipping the two macOS-specific suites) and verifies the locked dependency build. Physical mobile devices and Windows/Linux GUI behavior are not part of this validation.
