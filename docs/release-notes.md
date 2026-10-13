First installable release prepared for Obsidian Community review. The plugin is not yet listed in the Community directory.

- Compact three-pane paper library with English/Chinese UI, collections and writing projects.
- Separate review/submission trackers, venue deadlines, AoE and sidebar countdowns.
- PDF citation recognition and deterministic BibTeX, APA 7, IEEE and confirmed-title exports.
- macOS PDF drag/paste with annotation preservation; recoverable trash and batch operations.
- Explicit first-run library creation; configurable startup and source-table redirects.
- Desktop-only manifest, consistent version metadata, bundled license notices and reproducible release checks.

Requires Obsidian 1.8.7 or newer. Tested interactively on macOS with Obsidian 1.14.4. Windows and Linux application behavior has not been validated; Finder PDF import/paste requires macOS. iPhone/iPad are not supported by this desktop-only release.

For manual installation, place `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/paper-reservoir-dashboard/`, reload Obsidian, enable Literature Database, then run **Open library** from the command palette. In an empty vault, choose **Create library**. Existing libraries are never replaced with templates. See the README for data/privacy disclosures and full usage instructions.

Project code is AGPL-3.0-only. `LICENSE` and `THIRD-PARTY.md` are attached and embedded in `main.js`. GitHub's source archive contains the plugin source, build scripts, pinned dependency lockfile and CSL styles; `dependency-source.tar.gz` contains the exact installed dependency sources used to reproduce the citation bundle. `SHA256SUMS` lists release asset hashes.
