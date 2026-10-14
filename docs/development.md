# Development

This repository contains the plugin source and synthetic tests, with no personal library data. The first version-controlled baseline was 4.2.3; the current release is 4.8.0.

## Build and test

Requirements: Node.js 20+ and Python 3. No npm install is needed for a normal build.

```sh
npm run build
npm test
```

The build assembles source modules into `main.js` and copies the plugin CSS to `styles.css`. The test runner exercises parsing, collections, deadlines, citation handling, clipboard import, trash, batch operations and view controls. Removal tests cover last-membership prompts, local/global scope, mixed batches, native checkbox and keyboard paths, changed memberships/project notes, and cancellation. The two macOS filesystem/clipboard suites are explicitly skipped on other systems; that does not establish compatibility on those platforms.

`scripts/vendor/citation-engine.cjs` is a vendored dependency build. To change citation formatting, follow its [locked dependency rebuild instructions](../scripts/vendor/THIRD-PARTY.md), then rebuild and test the plugin. Keep all original license notices. `scripts/migrate-collections.cjs` is a pure migration function, not an automatic migration of a user's files.

## Source map

| Files | Responsibility |
| --- | --- |
| `dashboard.js`, `collections.js`, `organization.js` | Markdown parsing, metadata and collection membership |
| `library-view.js`, `collection-view.js`, `library-view.css` | Navigation, compact lists, details and controls |
| `pane-splitter.js` | Accessible mouse/touch pane resizing and workspace-only size preferences |
| `tag-tree.js`, `tag-map-view.js`, `tag-filter-view.js` | Optional Markdown tag vocabulary and editable map; assignments remain in the library |
| `setup.js` | Explicit empty-vault setup and startup preferences |
| `plugin-tail.js` | Obsidian lifecycle, mutation guards, coordination and system PDF opening |
| `inbox-import.js` | Explicit PDF/sidecar import and clipboard decoding |
| `record-trash.js` | Recoverable archive receipts, restore and permanent purge |
| `deadline-sharing.js` | Explicitly shared project/submission deadlines |
| `citation-metadata.js`, `citation-engine.js` | Evidence-based recognition and deterministic formatting |

All paths in the table are under `scripts/`.

## Deploy to a test vault

Build and test, then copy only `main.js`, `manifest.json` and `styles.css` into the vault's `.obsidian/plugins/paper-reservoir-dashboard/` directory. Keep a backup of its previous runtime. Reload the plugin from Obsidian. Never copy source fixtures or empty templates over an existing vault.

For a vault integrity check, specify the target explicitly:

```sh
python3 scripts/check_library.py check --vault /absolute/path/to/test-vault
python3 scripts/check_library.py inbox --vault /absolute/path/to/test-vault
```

The optional `scripts/setup-skim.sh` is a manually run macOS utility, not part of plugin startup or installation. It changes three Skim sidecar preferences, saves their previous values under this checkout's ignored `.maintenance-backups/`, and does not change the default PDF application. Review it before running.

## Versions

Use normal commits for development. Update the manifest/package/version map together for a release. A future Obsidian release tag must match the manifest version exactly, without a `v` prefix. Upload the three built runtime assets and include the corresponding source and license notices. Creating a source commit or release does not publish a Community directory entry.

Run `npm run release:check` after building. It validates the manifest and distribution, stages runtime files, license notices, an installation ZIP and SHA-256 hashes under ignored `dist/<version>/`. The release workflow tests on macOS/Linux, recreates the citation bundle from its locked dependencies, compares it with the committed bundle, and only then publishes assets for an exact matching tag (for example `4.3.1`). Dependency source is attached separately. Do not reuse a published version or tag. See [release notes](release-notes.md).

## Localization and filename migration

`scripts/i18n.js` owns English translations and the Chinese source strings. Use `tr()` for UI strings and tagged templates for interpolation. Keep table headers, markers, statuses, record identity and user-entered values independent of interface language. The citation formatter accepts the shared translator when loaded. `getLanguage()` requires Obsidian 1.8.7. Language changes are saved through plugin settings; unsaved edits block switching.

`scripts/storage-migration.js` renames only the four canonical source files on layout readiness, before loading data. Back up all candidates, refuse old/new collisions, check content before each rename and roll back only unchanged files. Old document routes and tracker identifiers remain recognized. Historical backup/receipt contents must not be rewritten.

## Organization data

4.4.0 adds `整理状态` and `整理来源` as columns 12–13. Migration is lazy and preserves old cells and hand-written prose. The source checkout's actor-aware helper computes SHA-256 field/tag fingerprints; external changes invalidate attribution. Unknown history stays unknown. Tests cover manual completion locks, forbidden agent citation edits, protected human fields, original names, nested collisions, paired import rollback and restoration. See `templates/empty-vault/AGENTS.md` for the complete agent contract.

Mobile changes are isolated behind `Platform.isMobile` and `.ldb-mobile` CSS. Keep desktop layout/interactions frozen unless explicitly requested. `scripts/sha256.js` preserves the existing provenance fingerprints without Node; `scripts/mobile-import.js` reads user-selected browser Files through the vault API. `test-mobile.cjs` rejects every external require except obsidian and covers edits, automatic metadata, citation exports, import failures/collisions, PDF open and trash/restore. Validate mobile layouts with Obsidian's official emulator; record physical-device validation separately.


## Mobile layout and screenshot checks

The tag-map and fixed-size icon controls explicitly override Obsidian's mobile text-button padding; do not apply a global button reset. Keep SVG aspect ratios intact. The native mobile sidebar remains owned by Obsidian. Tablet detail expansion animates two grid columns; narrow screens animate two rows. Keep both tracks and the same DOM, make the hidden list inert, preserve Notes/selection and support reduced motion and rapid reversals.

For documentation, create an isolated English demo vault with the built version, public paper metadata and explicitly fictional task data. Use Obsidian CLI `dev:screenshot` to capture the real application without Computer Use overlays. Wait for layout/animations to settle and dismiss tooltips before capture. Review each image for private content and stale UI. Record version, data sources and capture method in [screenshot provenance](screenshots/README.md); never commit the demo vault or PDFs.
