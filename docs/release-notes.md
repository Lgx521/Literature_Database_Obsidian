Use paper titles throughout the library while keeping original PDF filenames unchanged. [Community listing](https://community.obsidian.md/plugins/paper-reservoir-dashboard).

- Show paper titles in the compact list and detail heading, with the actual filename in smaller detail text. Edit titles without renaming files. Existing PDF names remain unchanged.
- Import PDFs directly into categories and writing projects on macOS. Create a provisional title, empty tags/TL;DR and pending organization status, with immediate membership. Retain originals, annotation companions and extended attributes. Resolve filename collisions with separate subfolders.
- Add inline organization status: Pending, AI organized and Manually complete. Manually complete records are excluded from agent enrichment; filter pending/incomplete records for manual handoff.
- Track per-field and per-tag provenance in the same Markdown row. Human tags use the theme accent; AI tags use neutral gray. Tooltips identify the source. Old content remains unrecorded instead of receiving invented attribution.
- Preserve existing notes, reading state, priority, memberships and bibliography. The actor-aware agent helper refuses protected edits; agents must never invent citations. Deterministic PDF/official metadata recognition can replace provisional titles while title export excludes filename placeholders.
- Read older table schemas and safely migrate on the first provenance write. Preserve the 4.3.2 deletion safeguards and 4.3.3 cold-start fix. All 28 synthetic suites pass on macOS.

Requires Obsidian 1.8.7+ on desktop. Finder import/paste requires macOS; Windows/Linux app behavior has not been validated. This release does not support iPhone/iPad. Agent organization remains manually triggered.

For manual installation, copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/paper-reservoir-dashboard/` and reload the plugin. Back up first. Never replace existing library files with empty templates. Existing vault maintainers should adopt the updated filename/provenance rules in `templates/empty-vault/AGENTS.md`; upgrades never overwrite an existing AGENTS.md automatically.

Project code is AGPL-3.0-only. License notices are attached and embedded in main.js. Source, locked dependencies and CSL styles are available in the repository; dependency-source.tar.gz provides exact dependency sources. SHA256SUMS lists release asset hashes.
