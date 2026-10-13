Fix an existing library appearing empty after restarting Obsidian. [Community listing](https://community.obsidian.md/plugins/paper-reservoir-dashboard).

- Wait for Obsidian's workspace and vault file index to be ready before detecting an existing library. Previously, a cold start could mistake an incomplete index for an empty vault and leave the paper list stuck loading until the plugin was reloaded.
- Resolve first-run defaults after that check, preserving saved language, startup and source-file redirect preferences. Truly empty vaults still require explicit library creation.
- Prevent refresh and setup commands from acting on an incomplete startup index. Cancel pending startup work if the plugin has been unloaded.
- Add regression coverage for delayed indexing, saved opt-out settings, unchanged existing source files and startup cancellation. All 26 synthetic test suites pass on macOS.
- This fix does not restore, move or rewrite papers: the PDFs and source tables remain in place. The safeguards for collection removal from 4.3.2 are retained.

Requires Obsidian 1.8.7 or newer. Windows and Linux application behavior has not been validated; Finder PDF import/paste requires macOS. iPhone/iPad are not supported by this desktop-only release.

For manual installation, place `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/paper-reservoir-dashboard/`, reload Obsidian, enable Literature Database, then run **Open library** from the command palette. In an empty vault, choose **Create library**. Existing libraries are never replaced with templates. See the README for data/privacy disclosures and full usage instructions.

Project code is AGPL-3.0-only. `LICENSE` and `THIRD-PARTY.md` are attached and embedded in `main.js`. GitHub's source archive contains the plugin source, build scripts, pinned dependency lockfile and CSL styles; `dependency-source.tar.gz` contains the exact installed dependency sources used to reproduce the citation bundle. `SHA256SUMS` lists release asset hashes.
