#!/usr/bin/env python3
from pathlib import Path
import json
root = Path(__file__).resolve().parents[1]
i18n = (root / 'scripts/i18n.js').read_text()
storage = (root / 'scripts/storage-migration.js').read_text()
organization = (root / 'scripts/organization.js').read_text()
sha256 = (root / 'scripts/sha256.js').read_text()
mobile_import = (root / 'scripts/mobile-import.js').read_text()
custom_fields = (root / 'scripts/custom-fields.js').read_text()
advanced_search = (root / 'scripts/advanced-search.js').read_text()
library_search = (root / 'scripts/library-search.js').read_text()
search_view = (root / 'scripts/search-results-view.js').read_text()
advanced_view = (root / 'scripts/advanced-search-view.js').read_text()
field_settings = (root / 'scripts/field-settings-view.js').read_text()
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
tag_tree = (root / 'scripts/tag-tree.js').read_text()
transaction = (root / 'scripts/source-transaction.js').read_text()
tag_rename = (root / 'scripts/tag-rename.js').read_text()
tag_view = (root / 'scripts/tag-map-view.js').read_text()
tag_filter = (root / 'scripts/tag-filter-view.js').read_text()
splitter = (root / 'scripts/pane-splitter.js').read_text()
motion = (root / 'scripts/ui-motion.js').read_text()
text_selection = (root / 'scripts/text-selection.js').read_text()
citations = (root / 'scripts/vendor/citation-engine.cjs').read_text()
metadata = (root / 'scripts/citation-metadata.js').read_text()
pdf_work = (root / 'scripts/pdf-work.js').read_text()
title_export = (root / 'scripts/title-export.js').read_text()
snapshot_cache = (root / 'scripts/snapshot-cache.js').read_text()
deepseek = (root / 'scripts/deepseek-beta.js').read_text()
deepseek_plan = (root / 'scripts/deepseek-plan.js').read_text()
deepseek_secret = (root / 'scripts/deepseek-secret.js').read_text()
deepseek_work = (root / 'scripts/deepseek-work.js').read_text()
deepseek_view = (root / 'scripts/deepseek-view.js').read_text()
(root / 'main.js').write_text(
    '/*! Literature Database — Copyright (c) 2026 shengzhegan\n'
    'Source: https://github.com/Lgx521/Literature_Database_Obsidian\n' + notices.replace('*/', '* /') + '\n*/\n'
    '// Generated from scripts/dashboard.js, scripts/inbox-import.js, scripts/library-view.js and scripts/plugin-tail.js. Deterministic citation lookup only on intake/export.\n'
    'const LDB_TEMPLATES = ' + json.dumps(templates, ensure_ascii=False) + ';\n'
    'const LdbI18n = (() => { const module = { exports: {} };\n' + i18n + '\nreturn module.exports; })();\n'
    'const Sha256 = (() => { const module = { exports: {} };\n' + sha256 + '\nreturn module.exports; })();\n'
    'const tr=LdbI18n.t, ldbRequire=id=>id==="./i18n"?LdbI18n:id==="./sha256"?Sha256:id==="./organization"?Organization:id==="./custom-fields"?CustomFields:id==="./advanced-search"?AdvancedSearch:require(id);\n'
    'const StorageMigration = ((require) => { const module = { exports: {} };\n' + storage + '\nreturn module.exports; })(ldbRequire);\n'
    'const Organization = ((require) => { const module = { exports: {} };\n' + organization + '\nreturn module.exports; })(ldbRequire);\n'
    'const CustomFields = ((require) => { const module = { exports: {} };\n' + custom_fields + '\nreturn module.exports; })(ldbRequire);\n'
    'const AdvancedSearch = (() => { const module = { exports: {} };\n' + advanced_search + '\nreturn module.exports; })();\n'
    'const Engine = ((require) => { const module = { exports: {} };\n' + engine + '\nreturn module.exports; })(ldbRequire);\n'
    'const LibrarySearch = (() => { const module = { exports: {} };\n' + library_search + '\nreturn module.exports(Engine,AdvancedSearch); })();\n'
    'const Collections = ((require) => { const module = { exports: {} };\n' + collections + '\nreturn module.exports; })(ldbRequire);\n'
    'const TagTree = ((require) => { const module = { exports: {} };\n' + tag_tree + '\nreturn module.exports; })(ldbRequire);\n'
    'const SourceTransaction = (() => { const module = { exports: {} };\n' + transaction + '\nreturn module.exports; })();\n'
    'const TagRename = (() => { const module = { exports: {} };\n' + tag_rename + '\nreturn module.exports(Engine,TagTree,Organization); })();\n'
    'const DeadlineSharing = ((require) => { const module = { exports: {} };\n' + sharing + '\nreturn module.exports(Engine,Collections); })(ldbRequire);\n'
    'const PdfWorkQueue = (() => { const module = { exports: {} };\n' + pdf_work + '\nreturn module.exports; })();\n'
    'const SnapshotCache = (() => { const module = { exports: {} };\n' + snapshot_cache + '\nreturn module.exports; })();\n'
    'const TitleExport = ((require) => { const module = { exports: {} };\n' + title_export + '\nreturn module.exports; })(ldbRequire);\n'
    'function ldbExportReferences(rows,format,title){return format==="titles"?TitleExport.exportTitles(rows,raw=>getCitations().parseEntry(raw)):getCitations().exportRows(rows,format,title); }\n'
    'let citationEngine; function getCitations(){ if (!citationEngine) {const module={exports:{}};\n' + citations + '\ncitationEngine=module.exports;citationEngine.setTranslator(tr);} return citationEngine; }\n'
    'const CitationMetadata = ((require) => { const module = { exports: {} };\n' + metadata + '\nreturn module.exports; })(ldbRequire);\n'
    'const InboxImport = ((require) => { const module = { exports: {} };\n' + inbox + '\nreturn module.exports; })(ldbRequire);\n'
    'const MobileImport = ((require) => { const module = { exports: {} };\n' + mobile_import + '\nreturn module.exports; })(ldbRequire);\n'
    'const TrashStore = ((require) => { const module = { exports: {} };\n' + trash + '\nreturn module.exports; })(ldbRequire);\n'
    'let deepSeekModule,deepSeekSecret; function ldbDeepSeek(plugin){if(!deepSeekModule){const Plan=(()=>{const module={exports:{}};\n' + deepseek_plan + '\nreturn module.exports({TagTree,Collections,tr});})();const module={exports:{}};\n' + deepseek + '\ndeepSeekModule=module.exports({Plan,Engine,Collections,TagTree,Organization,Sha256,CitationMetadata,SourceTransaction,loadPdfJs,requestUrl,tr,desktop:Platform.isDesktopApp&&!Platform.isMobile,nodeRequire:require});} return plugin.deepSeek??=new deepSeekModule.Service(plugin);}\n'
    'function getDeepSeekSecret(){if(!deepSeekSecret){const Plan=(()=>{const module={exports:{}};\n' + deepseek_plan + '\nreturn module.exports({TagTree,Collections,tr});})();const module={exports:{}};\n' + deepseek_secret + '\ndeepSeekSecret=module.exports;}return deepSeekSecret;}\n'
    'let deepSeekWorkClass; function getDeepSeekWork(){if(!deepSeekWorkClass){const Plan=(()=>{const module={exports:{}};\n' + deepseek_plan + '\nreturn module.exports({TagTree,Collections,tr});})();const module={exports:{}};\n' + deepseek_work + '\ndeepSeekWorkClass=module.exports;}return deepSeekWorkClass;}\n'
    + motion + '\n' + text_selection + '\n' + splitter + '\n' + view + '\n' + tag_view + '\n' + tag_filter + '\n' + search_view + '\n' + advanced_view + '\n' + collection_view + '\n' + setup + '\n' + field_settings + '\n' + deepseek_view + '\n' + tail)
(root / 'styles.css').write_text((root / 'scripts/library-view.css').read_text())
