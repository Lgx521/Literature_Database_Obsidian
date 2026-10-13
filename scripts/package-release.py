#!/usr/bin/env python3
"""Validate and stage release assets; never publish or read from a user's vault."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'manifest.json').read_text())
version = manifest['version']
assert re.fullmatch(r'\d+\.\d+\.\d+', version), 'Use an x.y.z version without a v prefix'
assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', manifest['id'])
assert 'obsidian' not in manifest['id']
assert manifest['isDesktopOnly'] is True, 'Node/Electron APIs require desktop-only marking'
assert len(manifest['description']) <= 250 and manifest['description'].endswith('.')
assert json.loads((root / 'package.json').read_text())['version'] == version
assert json.loads((root / 'versions.json').read_text())[version] == manifest['minAppVersion']
if os.environ.get('GITHUB_REF_TYPE') == 'tag':
    assert os.environ['GITHUB_REF_NAME'] == version, 'Release tag must equal manifest version'
for name in ['README.md', 'LICENSE', 'scripts/vendor/THIRD-PARTY.md', 'scripts/vendor/package-lock.json']:
    assert (root / name).is_file(), f'Missing {name}'
tracked = subprocess.check_output(['git', 'ls-files'], cwd=root, text=True).splitlines()
assert 'main.js' not in tracked and 'styles.css' not in tracked
assert not any(name.endswith(('.pdf', '.skim', '.fdf', '.xfdf')) for name in tracked), 'Do not release personal attachments'
assert not any(name.startswith(('.obsidian/', '.maintenance-backups/')) for name in tracked)
for name in ['main.js', 'styles.css']:
    assert (root / name).stat().st_size > 0, 'Build first'
main = (root / 'main.js').read_text()
assert 'GNU AFFERO GENERAL PUBLIC LICENSE' in main and 'Frank Bennett' in main
destination = root / 'dist' / version
destination.mkdir(parents=True, exist_ok=True)
for name in ['main.js', 'manifest.json', 'styles.css', 'LICENSE']:
    shutil.copy2(root / name, destination / name)
shutil.copy2(root / 'scripts/vendor/THIRD-PARTY.md', destination / 'THIRD-PARTY.md')
with zipfile.ZipFile(destination / 'literature-database.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ['main.js', 'manifest.json', 'styles.css', 'LICENSE', 'THIRD-PARTY.md']:
        archive.write(destination / name, manifest['id'] + '/' + name)
    for path in sorted((root / 'templates/empty-vault').glob('*.md')):
        archive.write(path, 'empty-vault/' + path.name)
checksums = ''.join(hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + path.name + '\n'
                    for path in sorted(destination.iterdir()) if path.is_file() and path.name != 'SHA256SUMS')
(destination / 'SHA256SUMS').write_text(checksums)
print(f'Validated {manifest["name"]} {version}; staged assets at {destination}')
