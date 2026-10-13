# Development

This repository contains the plugin source and synthetic tests, with no personal library data. The first version-controlled baseline was 4.2.3; the current submission candidate is 4.3.1.

## Build and test

Requirements: Node.js 20+ and Python 3. No npm install is needed for a normal build.

```sh
npm run build
npm test
```

The build assembles source modules into `main.js` and copies the plugin CSS to `styles.css`. The test runner exercises parsing, collections, deadlines, citation handling, clipboard import, trash, batch operations and view controls. The two macOS filesystem/clipboard suites are explicitly skipped on other systems; that does not establish compatibility on those platforms.

`scripts/vendor/citation-engine.cjs` is a vendored dependency build. To change citation formatting, follow its [locked dependency rebuild instructions](../scripts/vendor/THIRD-PARTY.md), then rebuild and test the plugin. Keep all original license notices. `scripts/migrate-collections.cjs` is a pure migration function, not an automatic migration of a user's files.

## Source map

| Files | Responsibility |
| --- | --- |
| `dashboard.js`, `collections.js` | Markdown parsing, metadata and collection membership |
| `library-view.js`, `collection-view.js`, `library-view.css` | Navigation, compact lists, details and controls |
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
