Safer paper removal across categories and writing projects. [Community listing](https://community.obsidian.md/plugins/paper-reservoir-dashboard).

- Removing a paper's only collection membership now offers cancel or move the paper to recoverable trash, instead of silently leaving it unassigned.
- Trashing papers with multiple memberships asks whether to remove only the current membership or move the papers to trash everywhere. Restoring a paper restores its existing memberships and project notes.
- Apply the same behavior to right-click actions, detail trash buttons, keyboard removal, native collection checkboxes and multi-selection. Mixed batches containing a last membership explain why local-only removal is unavailable; smart views do not pretend to be collections.
- Revalidate membership and project notes after the choice and before archiving. Cancel safely if they changed in another window or device. Explicit moves can still replace a last membership.
- Keep inbox/review/submission trash, batch restoration and permanent purge behavior unchanged.
- Update English/Chinese guidance and the README's published Community badge. Add regression coverage for the new choices, cancellation and stale selections.

Requires Obsidian 1.8.7 or newer. Tested interactively on macOS with Obsidian 1.14.4. Windows and Linux application behavior has not been validated; Finder PDF import/paste requires macOS. iPhone/iPad are not supported by this desktop-only release.

For manual installation, place `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/paper-reservoir-dashboard/`, reload Obsidian, enable Literature Database, then run **Open library** from the command palette. In an empty vault, choose **Create library**. Existing libraries are never replaced with templates. See the README for data/privacy disclosures and full usage instructions.

Project code is AGPL-3.0-only. `LICENSE` and `THIRD-PARTY.md` are attached and embedded in `main.js`. GitHub's source archive contains the plugin source, build scripts, pinned dependency lockfile and CSL styles; `dependency-source.tar.gz` contains the exact installed dependency sources used to reproduce the citation bundle. `SHA256SUMS` lists release asset hashes.
