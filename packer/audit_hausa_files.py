#!/usr/bin/env python3
"""Verify files captured from the rendered Hausa DBS/publisher inventory."""
import concurrent.futures
import json
import pathlib
import re
import urllib.error
import urllib.parse
import urllib.request
from et.build import secure

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATH = ROOT / 'catalog/source/dbs-media-hausa-2026-10-04.json'
UA = {'User-Agent': 'Mozilla/5.0'}

def get_playlist(pair):
    source, page = pair
    urls = [a['url'] for a in page['links'] if urllib.parse.urlparse(a['url']).path.endswith('.m3u')]
    if not urls:
        return source, []
    try:
        with urllib.request.urlopen(urllib.request.Request(urls[0], headers=UA), timeout=30) as r:
            body = r.read().decode('utf-8-sig')
    except urllib.error.HTTPError as e:
        page['playlist_error'] = e.code
        return source, [{'url': a['url'], 'title': a['label']} for a in page['links'] if '/Audio_MP3/' in a['url']]
    items, title = [], ''
    for line in body.splitlines():
        if line.startswith('#EXTINF:'):
            title = line.split(',', 1)[-1]
        elif line.startswith(('https://', 'http://')):
            items.append({'url': secure(line.strip()), 'title': title})
    return source, items

def probe(url):
    try:
        req = urllib.request.Request(url, headers={**UA, 'Range': 'bytes=0-1023'})
        with urllib.request.urlopen(req, timeout=25) as r:
            head = r.read(1024)
            ext = urllib.parse.urlparse(url).path.lower().rsplit('.', 1)[-1]
            valid = (head.startswith(b'%PDF-') if ext == 'pdf' else
                     head.startswith(b'PK') if ext in ('epub', 'zip') else
                     b'ftyp' in head[:64] if ext == 'mp4' else
                     head.startswith(b'ID3') or any(head[n] == 255 and head[n+1] & 224 == 224 for n in range(min(len(head)-1, 32))))
            return url, {'status': r.status, 'type': r.headers.get('Content-Type'),
                         'valid': bool(valid), 'signature': head[:12].hex()}
    except urllib.error.HTTPError as e:
        return url, {'status': e.code, 'valid': False}
    except Exception as e:
        return url, {'status': 0, 'valid': False, 'error': str(e)}

def main():
    media = json.loads(PATH.read_text())
    grn = [(u, p) for u, p in media['publishers'].items() if 'globalrecordings.net/en/program/' in u]
    with concurrent.futures.ThreadPoolExecutor(3) as pool:
        for source, items in pool.map(get_playlist, grn):
            media['publishers'][source]['playlist'] = items
    PATH.write_text(json.dumps(media, ensure_ascii=False, indent=1)+'\n')
    print('Captured', sum(len(p.get('playlist', [])) for _, p in grn), 'publisher playlist tracks', flush=True)
    urls = set()
    for p in media['pages'].values():
        urls.update(secure(a['url']) for a in p['links'] if urllib.parse.urlparse(a['url']).path.lower().endswith(('.mp3', '.mp4', '.pdf', '.epub', '.zip')))
        for b in p.get('books', []):
            urls.update(re.sub(r'_\d{3}\.mp3$', '_'+str(n).zfill(3)+'.mp3', b['sample']) for n in b['chapters'])
    for u, p in media['publishers'].items():
        if 'rockintl.org' in u:
            urls.update(secure(a['url']) for a in p['links'] if 'hausa' in a['url'].lower() and urllib.parse.urlparse(a['url']).path.lower().endswith(('.mp3', '.pdf')))
        elif 'arc.gt/' in u:
            urls.add(p['resolved'])
        elif 'globalrecordings.net' in u:
            for a in p.get('playlist', []):
                name = urllib.parse.unquote(a['url']).rsplit('/', 1)[-1]
                if 'HAUSA' in p['text'][:130] or re.search(r'\d{3}\s+(?:حَوْسَ|Hausa)(?:\s|$)', name):
                    urls.add(a['url'])
    audit = json.loads((ROOT/'catalog/source/dbs-rendered-hausa-2026-10-04.json').read_text())['hau']
    urls.update(secure(a['href']) for a in audit['Links to Other Sites']['links'] if urllib.parse.urlparse(a['href']).path.endswith('.mp4') and '/MTD/' not in a['href'])
    urls = {u for u in urls if '66703' not in urllib.parse.unquote(u)}
    pending = sorted(urls - {u for u, p in media['verified_files'].items() if p.get('valid')})
    print('Checking', len(pending), 'files', flush=True)
    with concurrent.futures.ThreadPoolExecutor(24) as pool:
        for n, (u, result) in enumerate(pool.map(probe, pending), 1):
            media['verified_files'][u] = result
            if n % 100 == 0:
                PATH.write_text(json.dumps(media, ensure_ascii=False, indent=1)+'\n')
                print(n, '/', len(pending), flush=True)
    PATH.write_text(json.dumps(media, ensure_ascii=False, indent=1)+'\n')
    from collections import Counter
    print(Counter(p['status'] for p in media['verified_files'].values()))

if __name__ == '__main__':
    main()
