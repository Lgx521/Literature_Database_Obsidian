# Community releases

The [Community listing](https://community.obsidian.md/plugins/paper-reservoir-dashboard) was published on **2026-10-13**. The initial submission checklist covered **4.3.1**; the current release is **4.5.0**. New releases are reviewed separately and may take time to propagate to the app directory.

## Repository and distribution

| Requirement | Result |
| --- | --- |
| Public source repository | `Lgx521/Literature_Database_Obsidian`, with no personal vault contents |
| Root `README.md`, `LICENSE`, `manifest.json` | Present; usage, installation, screenshots, data access and platform limits documented |
| Plugin identity | `paper-reservoir-dashboard`, displayed as Literature Database, author shengzhegan; retain the installed ID for upgrade compatibility |
| Community entry | Published as `paper-reservoir-dashboard`; retain this ID across updates |
| Version metadata | Manifest, package and version map agree on `4.5.0`; release tag must be exactly `4.5.0`, without `v` |
| Description | Short action statement, under 250 characters, ending with a period |
| Minimum app | `1.8.7` for the public `getLanguage()` API; native menus and deferred views also use public APIs available by this version |
| Mobile declaration | `isDesktopOnly: false`; mobile paths use browser/vault APIs and are tested with Node/Electron imports forbidden |
| Runtime assets | `main.js`, `manifest.json`, `styles.css` staged by `npm run release:check` and attached by the tag release workflow |
| Reproducible dependencies | Locked versions; rebuilding the citation bundle produces the committed bytes |
| License materials | AGPL-3.0-only project license, dependency notices embedded in `main.js`, separate release attachments, CSL source/styles in Git and dependency source archive in the release |
| Badges | License, latest GitHub release, and a published Obsidian plugin badge linking to the Community entry |

The first release is [4.3.1](https://github.com/Lgx521/Literature_Database_Obsidian/releases/tag/4.3.1). Check that the three required runtime attachments are present before submitting. A tag or source archive alone is insufficient.

## Runtime and policy checks

- New installs do not create source files or take over the workspace just by enabling the plugin. **Create library** is explicit. New libraries have no predefined categories or writing projects; users create their own.
- Initialization refuses source-name collisions, preserves an existing `AGENTS.md` and leaves originals intact. Legacy migration requires source markers and backs up before renaming; it does not rename unrelated notes based only on their names.
- Startup opening and source-table redirects are configurable. Existing libraries retain their prior behavior. The plugin does not close unrelated Markdown tabs on startup or detach leaves during unload.
- Commands do not include the plugin ID in their IDs and define no default keyboard shortcuts. No sample-plugin placeholder code, client telemetry, ads, self-updater, runtime package installer or dynamic downloaded code is used.
- Source mutations use guarded `vault.process` operations with backups. The adapter is used for hidden maintenance data that the indexed Vault API cannot access. macOS import uses explicit argv to `ditto`; PDF opening uses explicit argv to the default opener, with no shell expansion.
- UI content is built with DOM helpers rather than injecting note text as HTML. Citation exports use escaped/sanitized HTML. CSS is scoped to plugin classes/views, and inputs use the current window document.
- Vault/workspace handlers use `registerEvent`; refresh/countdown timers are cancelled on unload/close. Citation work checks unload/cancellation before writing.
- README discloses Crossref/arXiv requests, explicit clipboard access and outside-vault PDF/sidecar imports. There is no account/payment requirement and no upload of PDFs or private review/submission material. See [README data and privacy](../README.md#data-and-privacy).
- Bibliography formatting is deterministic. Agents are explicitly prohibited from inventing or filling citation fields.

## Validation and limits

- **28 synthetic regression suites pass on macOS**, including first-run defaults, initialization races, existing-file preservation, legacy migration, concurrent source edits, citation evidence, deletion scope, trash, deadlines and inline controls.
- macOS application smoke checks use a separate temporary vault: plugin enable/disable, settings, explicit creation and library opening. No personal vault is used for testing.
- The locked dependency audit reports **0 known vulnerabilities** as of the check date. This is not a guarantee that the software is vulnerability-free.
- Release CI tests macOS and Linux, compares the rebuilt dependency bundle and validates version/asset consistency before publishing. Linux skips the two macOS Finder/clipboard suites; this does not establish Linux GUI compatibility.
- Interactive testing used **macOS / Obsidian 1.14.4**, not every older app version. Mobile emulator and Node-free tests pass; physical iOS/Android devices, Windows/Linux GUI behavior and third-party themes have not been validated. Sync is provided by the vault's storage provider; simultaneous-device/iCloud failure testing is not an exhaustive certification.

## Publish an update

Commit the source, update the manifest/package/version map, then push a new exact-version tag. The release workflow runs the tests and publishes the runtime attachments. The existing Community entry detects new releases; the owner can use **Check for new releases** or **Request review** on its management page. Do not create a second entry for an update.

## Initial submission (completed)

1. Verify [release 4.3.1](https://github.com/Lgx521/Literature_Database_Obsidian/releases/tag/4.3.1) has `main.js`, `manifest.json` and `styles.css`, and that the latest [workflow run](https://github.com/Lgx521/Literature_Database_Obsidian/actions) succeeded.
2. Sign in at [Obsidian Community](https://community.obsidian.md) with your Obsidian account and connect the GitHub account that owns the repository.
3. Open **Plugins → New plugin**. Enter `https://github.com/Lgx521/Literature_Database_Obsidian` and choose the owner.
4. Read and agree to the developer policies and maintenance commitment, then submit. Submission and agreement are actions for the owner; this preparation does not perform them.
5. Address any automated review findings by committing fixes and publishing a new numbered release. Only change the badge to a directory/install link after the entry is published.

The current process uses the Community directory, not the older pull-request workflow for `community-plugins.json`.

## Official references

- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin): source repository, exact release tag and binary attachments.
- [Submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins): manifest, desktop APIs and description rules.
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies): privacy disclosures and licensing.
- [Plugin review guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md): lifecycle, DOM, file APIs and styles.
- [Set up and claim](https://docs.obsidian.md/community-directory/set-up-and-claim): owner account linking and submission.
