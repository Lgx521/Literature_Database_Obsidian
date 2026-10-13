# Development

The repository tracks the 4.2.3 implementation extracted from the running plugin. It contains no personal library data. The runtime code is unchanged by the initial repository import; build output paths and tests have been adapted for an independent checkout.

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

Use normal commits for development. Update the manifest/package/version map together for a release. A future Obsidian release tag must match the manifest version exactly, without a `v` prefix. Upload the three built runtime assets and include the corresponding source and license notices. Creating an initial source commit does not publish a Community directory entry.
