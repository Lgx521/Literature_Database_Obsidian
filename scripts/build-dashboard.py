#!/usr/bin/env python3
from pathlib import Path
import json
root = Path(__file__).resolve().parents[1]
i18n = (root / 'scripts/i18n.js').read_text()
storage = (root / 'scripts/storage-migration.js').read_text()
organization = (root / 'scripts/organization.js').read_text()
engine = (root / 'scripts/dashboard.js').read_text()
view = (root / 'scripts/library-view.js').read_text()
tail = (root / 'scripts/plugin-tail.js').read_text()
setup = (root / 'scripts/setup.js').read_text()
templates = {p.name: p.read_text() for p in sorted((root / 'templates/empty-vault').glob('*.md'))}
notices = (root / 'LICENSE').read_text() + '\n' + (root / 'scripts/vendor/THIRD-PARTY.md').read_text()
inbox = (root / 'scripts/inbox-import.js').read_text()
trash = (root / 'scripts/record-trash.js').read_text()
collections = (root / 'scripts/collections.js').read_text()
sharing = (root / 'scripts/deadline-sharing.js').read_text()
collection_view = (root / 'scripts/collection-view.js').read_text()
citations = (root / 'scripts/vendor/citation-engine.cjs').read_text()
metadata = (root / 'scripts/citation-metadata.js').read_text()
(root / 'main.js').write_text(
    '/*! Literature Database — Copyright (c) 2026 shengzhegan\n'
    'Source: https://github.com/Lgx521/Literature_Database_Obsidian\n' + notices.replace('*/', '* /') + '\n*/\n'
    '// Generated from scripts/dashboard.js, scripts/inbox-import.js, scripts/library-view.js and scripts/plugin-tail.js. Deterministic citation lookup only on intake/export.\n'
    'const LDB_TEMPLATES = ' + json.dumps(templates, ensure_ascii=False) + ';\n'
    'const LdbI18n = (() => { const module = { exports: {} };\n' + i18n + '\nreturn module.exports; })();\n'
    'const tr=LdbI18n.t, ldbRequire=id=>id==="./i18n"?LdbI18n:id==="./organization"?Organization:require(id);\n'
    'const StorageMigration = ((require) => { const module = { exports: {} };\n' + storage + '\nreturn module.exports; })(ldbRequire);\n'
    'const Organization = ((require) => { const module = { exports: {} };\n' + organization + '\nreturn module.exports; })(ldbRequire);\n'
    'const Engine = ((require) => { const module = { exports: {} };\n' + engine + '\nreturn module.exports; })(ldbRequire);\n'
    'const Collections = ((require) => { const module = { exports: {} };\n' + collections + '\nreturn module.exports; })(ldbRequire);\n'
    'const DeadlineSharing = ((require) => { const module = { exports: {} };\n' + sharing + '\nreturn module.exports(Engine,Collections); })(ldbRequire);\n'
    'let citationEngine; function getCitations(){ if (!citationEngine) {const module={exports:{}};\n' + citations + '\ncitationEngine=module.exports;citationEngine.setTranslator(tr);} return citationEngine; }\n'
    'const CitationMetadata = ((require) => { const module = { exports: {} };\n' + metadata + '\nreturn module.exports; })(ldbRequire);\n'
    'const InboxImport = ((require) => { const module = { exports: {} };\n' + inbox + '\nreturn module.exports; })(ldbRequire);\n'
    'const TrashStore = ((require) => { const module = { exports: {} };\n' + trash + '\nreturn module.exports; })(ldbRequire);\n' + view + '\n' + collection_view + '\n' + setup + '\n' + tail)
(root / 'styles.css').write_text((root / 'scripts/library-view.css').read_text())
