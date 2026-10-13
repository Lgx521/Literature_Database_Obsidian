#!/usr/bin/env python3
"""Read-only validation and temp inventory. Python standard library only."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import argparse
import hashlib
import html
import json
import re
import sys

PUBLICATION_DATE_RE = re.compile(r'(?:(?:19|20)\d{2}(?:\.(?:[1-9]|1[0-2]))?|待核实)')


def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def check(root):
    errors = []
    linked = set()
    entries = 0
    collection_refs = set()
    trashed = set()
    for receipt in (root / '.maintenance-backups/deleted').glob('*/record.json'):
        try:
            value = json.loads(receipt.read_text())
            if value.get('scope') == 'library' and value.get('state') in ['deleted', 'pending', 'failed', 'purging', 'purge-failed']:
                relative = value['row']['path']
                if relative.startswith('papers/') and '..' not in Path(relative).parts:
                    trashed.add((root / relative).resolve())
        except (ValueError, KeyError, OSError):
            continue
    for md in root.rglob('*.md'):
        if any(part.startswith('.') for part in md.relative_to(root).parts):
            continue
        # Links are standard relative paths; quoted examples in fenced code are ignored.
        text = re.sub(r'```[^\n]*\n.*?```', '', md.read_text(), flags=re.S)
        # These generated blocks are historical snapshots, no longer active links.
        if md.name in ['首页.md', '阅读队列.md']:
            text = re.sub(r'<!-- dashboard:begin -->.*?<!-- dashboard:end -->', '', text, flags=re.S)
        for label, destination in re.findall(r'\[([^\]]+)\]\(([^)]+)\)', text):
            url = urlsplit(destination)
            if url.scheme or url.netloc or not url.path:
                continue
            target = (md.parent / unquote(url.path)).resolve()
            if not target.is_relative_to(root.resolve()):
                errors.append(f'{md.name}: 链接离开 vault: {destination}')
            elif not target.is_file() and not (md.name == 'collections.md' and target in trashed):
                errors.append(f'{md.name}: 失效链接: {destination}')
            if target.suffix.lower() == '.pdf' and html.unescape(label) != target.name:
                errors.append(f'{md.name}: 链接显示名不等于实际文件名: {label}')
        if md.name == 'collections.md':
            if text.count('<!-- collections:end -->') != 1:
                errors.append('集合: 完整性标记缺失或重复')
            groups, members, current = set(), set(), ''
            for line in text.splitlines():
                if line.startswith('## '):
                    current = line[3:].strip()
                    if not re.fullmatch(r'(分类|项目)：.+', current) or current.lower() in groups:
                        errors.append('集合: 标题无效或重复: ' + current)
                    groups.add(current.lower()); members = set()
                if re.match(r'^\|\s*\[', line):
                    row = [c.strip() for c in re.split(r'(?<!\\)\|', line)[1:-1]]
                    matches = re.findall(r'\]\(([^)]+)\)', row[0])
                    if len(row) != 2 or len(matches) != 1:
                        errors.append('集合: 关系表行无效'); continue
                    target = (root / unquote(matches[0])).resolve()
                    if target in members:
                        errors.append('集合: 同一集合重复引用: ' + current)
                    members.add(target); collection_refs.add(target)
        if md.name == 'library.md':
            for line in text.splitlines():
                if not re.match(r'^\|\s*\[', line):
                    continue
                row = [c.strip() for c in re.split(r'(?<!\\)\|', line)[1:-1]]
                if len(row) not in (6, 7, 8, 10, 11, 13):
                    errors.append('文献库: 表格列数异常'); continue
                entries += 1
                if not PUBLICATION_DATE_RE.fullmatch(row[1]):
                    errors.append(row[0] + ': 发表时间须为 YYYY.M（月份 1–12，不补零）、YYYY 或待核实')
                if row[4] not in ['未标记', '待整理', '待读', '在读', '已读', '暂存']:
                    errors.append(row[0] + ': 无效阅读状态')
                if len(row) == 13:
                    if row[11] not in ['', '待整理', 'AI 已整理', '人工完成']:
                        errors.append(row[0] + ': 无效整理状态')
                    if row[12]:
                        try:
                            provenance = json.loads(html.unescape(row[12]))
                            if provenance.get('v') != 1 or not isinstance(provenance.get('fields'), dict) or not isinstance(provenance.get('tags'), dict):
                                raise ValueError('invalid provenance')
                        except (ValueError, AttributeError):
                            errors.append(row[0] + ': 无效整理来源')
                if row[5] not in ['高', '中', '低', '—']:
                    errors.append(row[0] + ': 无效优先级')
                matches = re.findall(r'\]\(([^)]+)\)', row[0])
                if len(matches) != 1:
                    errors.append(row[0] + ': 必须有一个 PDF 链接'); continue
                target = (root / unquote(matches[0])).resolve()
                if target in linked:
                    errors.append(row[0] + ': 同一 PDF 重复入表')
                linked.add(target)
    for target in collection_refs - linked - trashed:
        errors.append('集合引用未收录的文献: ' + str(target.relative_to(root.resolve()) if target.is_relative_to(root.resolve()) else target))
    library_text = (root / 'library.md').read_text()
    if '<!-- library:collections -->' in library_text and not (root / 'collections.md').is_file():
        errors.append('collections.md 尚未同步')
    hashes = {}
    pdfs = sorted((p for p in (root / 'papers').rglob('*') if p.is_file() and p.suffix.lower() == '.pdf'))
    for p in pdfs:
        if p.resolve() not in linked:
            errors.append('未收录的 PDF: ' + p.name)
        hashes.setdefault(digest(p), []).append(str(p.relative_to(root)))
    for names in hashes.values():
        if len(names) > 1:
            errors.append('PDF 内容重复（先检查批注，不自动删除）: ' + ', '.join(names))
    for folder in ['papers', 'reviews', 'submissions', 'temp']:
        for sidecar in (root / folder).rglob('*.skim'):
            if not any(p.suffix.lower() == '.pdf' and p.stem == sidecar.stem for p in sidecar.parent.iterdir()):
                errors.append('孤立 Skim 批注: ' + str(sidecar.relative_to(root)))
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'检查通过：{entries} 条文献；{len(pdfs)} 个 PDF；本地链接、显示文件名、发表时间、重复收录、状态及批注配对有效。')
    return 0


def inbox(root):
    known = {}
    for p in (p for p in (root / 'papers').rglob('*') if p.is_file() and p.suffix.lower() == '.pdf'):
        known.setdefault(digest(p), []).append(str(p.relative_to(root)))
    results = []
    for p in sorted((root / 'temp').rglob('*')):
        if p.suffix.lower() != '.pdf' or not p.is_file():
            continue
        d = digest(p)
        results.append({'file': str(p.relative_to(root)), 'sha256': d,
                        'same_pdf_bytes': known.get(d, []),
                        'skim_sidecar': p.with_suffix('.skim').exists()})
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['check', 'inbox'], nargs='?', default='check')
    parser.add_argument('--vault', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    sys.exit(check(args.vault) if args.command == 'check' else inbox(args.vault))
