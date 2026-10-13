# Community release preparation

Checked against the official documentation on 2026-10-13. This is a readiness list, not a claim that the plugin has been submitted or approved.

## Prepared

- Public source repository with a 4.2.3 development baseline.
- Root manifest, version map, AGPL-3.0 license and third-party attribution.
- Reproducible local build, independent synthetic tests, CI and empty vault templates.
- README disclosures for network requests, clipboard use, outside-vault import and platform limitations.

## Before the first public release

1. Decide whether to retain `paper-reservoir-dashboard` as the permanent public identifier or migrate it to a new name before submission. The displayed name is already Literature Database. Do not silently rename an installed plugin's ID.
2. Add a clear first-run setup flow. Currently the plugin requires fixed Chinese source filenames and the empty templates; it opens the library on startup and redirects those documents. Test it in a clean vault and make potentially surprising startup behavior configurable.
3. Audit platform support and the manifest. The baseline still declares `isDesktopOnly: false` and `minAppVersion: 1.5.0`, inherited from the private implementation; these are not validated support claims. Current official requirements call for desktop-only marking when using Node/Electron APIs, which this implementation uses. Verify the minimum version for every Obsidian API and set an accurate manifest before release.
4. Verify installation, upgrades, unload, concurrent edits, iCloud interruptions and recovery in a separate vault. Run mobile/Windows/Linux testing only if those platforms will be claimed. A Linux CI parser pass does not validate the whole app.
5. Review visible strings, accessibility, dark mode and narrow windows. Add an English interface and screenshots made with synthetic example data if targeting a broad audience.
6. Check all bundled dependency source/license obligations. Include the full project license and third-party notices with distribution, and retain the exact source/lockfiles corresponding to the release.
7. Build a GitHub release whose tag exactly matches the updated manifest version. Attach `main.js`, `manifest.json` and `styles.css`; ensure the build can be reproduced from the same tag. No GitHub Release has been created by the initial source import.
8. Sign in to the Obsidian Community directory, link the owning GitHub account, submit the repository, inspect automated review feedback and address it. This requires the owner's account and acceptance of the directory's policies; source upload alone is not submission.

## Official references

- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin): repository files, release assets and the Community directory submission flow.
- [Submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins): manifest, desktop APIs and descriptions.
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies): privacy disclosures and licensing.
- [Set up and claim](https://docs.obsidian.md/community-directory/set-up-and-claim): account linking and ownership.

The current process uses the Community directory; do not follow older instructions that only add a line to `community-plugins.json` through a pull request.
