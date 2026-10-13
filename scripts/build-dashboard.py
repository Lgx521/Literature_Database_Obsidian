#!/usr/bin/env python3
from pathlib import Path
root = Path(__file__).resolve().parents[1]
engine = (root / 'scripts/dashboard.js').read_text()
view = (root / 'scripts/library-view.js').read_text()
tail = (root / 'scripts/plugin-tail.js').read_text()
inbox = (root / 'scripts/inbox-import.js').read_text()
trash = (root / 'scripts/record-trash.js').read_text()
collections = (root / 'scripts/collections.js').read_text()
sharing = (root / 'scripts/deadline-sharing.js').read_text()
collection_view = (root / 'scripts/collection-view.js').read_text()
citations = (root / 'scripts/vendor/citation-engine.cjs').read_text()
metadata = (root / 'scripts/citation-metadata.js').read_text()
(root / 'main.js').write_text(
    '// Generated from scripts/dashboard.js, scripts/inbox-import.js, scripts/library-view.js and scripts/plugin-tail.js. Deterministic citation lookup only on intake/export.\n'
    'const Engine = (() => { const module = { exports: {} };\n' + engine + '\nreturn module.exports; })();\n'
    'const Collections = (() => { const module = { exports: {} };\n' + collections + '\nreturn module.exports; })();\n'
    'const DeadlineSharing = (() => { const module = { exports: {} };\n' + sharing + '\nreturn module.exports(Engine,Collections); })();\n'
    'let citationEngine; function getCitations(){ if (!citationEngine) {const module={exports:{}};\n' + citations + '\ncitationEngine=module.exports;} return citationEngine; }\n'
    'const CitationMetadata = (() => { const module = { exports: {} };\n' + metadata + '\nreturn module.exports; })();\n'
    'const InboxImport = (() => { const module = { exports: {} };\n' + inbox + '\nreturn module.exports; })();\n'
    'const TrashStore = (() => { const module = { exports: {} };\n' + trash + '\nreturn module.exports; })();\n' + view + '\n' + collection_view + '\n' + tail)
(root / 'styles.css').write_text((root / 'scripts/library-view.css').read_text())
