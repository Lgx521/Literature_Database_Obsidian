Literature Database 4.9.6 supports larger PDFs, multi-batch AI organization and lighter previews.

- Accept PDFs up to **50 MB** for DeepSeek organization.
- Queue selections over 20 papers in batches. Review each batch, then **Continue to next batch**; later Inbox batches reuse the applied taxonomy. Stop/retry preserves unfinished paths.
- Create preview editors only when expanded and release them after collapse, preserving drafts and animations.
- Keep compact tag-map edits instead of a full catalog per paper after closing the map.
- Bound PDF excerpt construction without first joining all text on a large page.

Validation: 65 offline regression suites on macOS; synthetic Chromium memory comparison with 20 previews, 100 categories and 1,000 tags, including repeated open/close and narrow-viewport checks. Requires Obsidian 1.8.7+.
