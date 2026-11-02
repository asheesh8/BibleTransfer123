#!/usr/bin/env python3
"""Build Saraiki, Balochi and Hindko from their browser audits: Pakistan's three
biggest languages that had no library yet, all with the Urdu interface.

    python3 packer/build_dbs_pakistan.py            # all three
    python3 packer/build_dbs_audit.py skr           # one (the same)

Each language's DBS page, and every DBS page it links to, was rendered in a
real browser on 2026-11-02 (catalog/source/dbs-audit-<language>-2026-11-02.json),
with a ranged browser check of every file; only files that returned real media
are carried.

Saraiki, Balochi and Hindko readers in Pakistan read Urdu, the national
language, and none of the three has a reviewed interface translation, so the
pages use the Urdu interface (`ur`) the way Kenya's smaller languages use
Swahili: every word the library adds (descriptions, labels, book names) is in
Urdu, and titles DBS gives in the language itself stay. All three are written
in Arabic script, right to left (Naskh, like Urdu's own page).

  · Saraiki (skr): FCBH's Modern Central Saraiki Gospels (dramatised) and
    Davar's Saraiki New Testament, JESUS, LUMO Luke and John, iBible, Story of
    Jesus and GRN. GRN's programmes come from five Saraiki varieties
    (Derawali, Jangli, Multani, Riasiti); each names its variety.
  · Balochi (bal): one shelf for DBS's four Balochi pages, the umbrella (bal)
    and Southern (bcc), Western (bgn) and Eastern (bgp) Balochi, the way
    Akan merges its dialects. Every item names its variety.
  · Hindko (hno): DBS's Northern Hindko page (Hazara, the Hindko of
    Abbottabad and Mansehra). JESUS, The Prophets' Story, iBible, Story of
    Jesus, and GRN's readings of Genesis, Exodus, Psalms and much of the New
    Testament. DBS's Southern Hindko page (hnd) lists only the Hindi
    Easy-to-Read Bible, so it is not part of this shelf.
"""
import re
import urllib.parse

import build_dbs_audit as base
from build_dbs_audit import BOOKS, LOCAL, Shelf

UR = LOCAL['ur']
DATE = '2026-11-02'


def words(name, native):
    """The Urdu interface words for one language."""
    return dict(
        ui='ur', date=DATE, script='arab', dir='rtl', font='naskh',
        blurb=f'{native} میں بائبل، فلمیں اور مسیحی آڈیو۔',
        chapter='حصہ', part='حصہ', view='DBS پر دیکھیں',
        full='پوری فلم (MP4)', chapters_zip='تمام حصے (ZIP)',
        tracks_zip='تمام ریکارڈنگز (ZIP)', pdf='کتاب (PDF)',
        film_desc=f'بائبل پر مبنی فلم، {native} میں۔',
        film_desc_chapters=f'بائبل پر مبنی فلم، {native} میں۔ جو حصہ دیکھنا یا محفوظ کرنا چاہیں، اسے چنیں۔',
        deaf_desc='',
        historic_desc='کلامِ مقدس کا پرانا ایڈیشن، PDF میں اسکین کیا ہوا۔ کچھ الفاظ کی املا آج سے مختلف ہو سکتی ہے۔',
        grn_desc=f'بائبل کی کہانیاں اور مسیحی پیغامات {native} میں، جنہیں Global Recordings Network نے ریکارڈ کیا۔',
    )


base.LANGS['skr'] = dict(slug='saraiki', name='Saraiki', native='سرائیکی', region='Pakistan',
                         speakers='~26 million', **words('Saraiki', 'سرائیکی'))
base.LANGS['bal'] = dict(slug='balochi', name='Balochi', native='بلوچی', region='Pakistan, Iran & Afghanistan',
                         speakers='~8 million', **words('Balochi', 'بلوچی'))
base.LANGS['hno'] = dict(slug='hindko', name='Hindko', native='ہندکو', region='Pakistan',
                         speakers='~5 million', **words('Hindko', 'ہندکو'))
CODES = ('skr', 'bal', 'hno')

# Varieties, by the DBS page (ISO code) or GRN folder an item comes from:
# English name and Urdu name.
VARIETY = {
    'bcc': ('Southern Balochi', 'جنوبی بلوچی'),
    'bgn': ('Western Balochi', 'مغربی بلوچی'),
    'bgp': ('Eastern Balochi', 'مشرقی بلوچی'),
    'Saraiki Derawali': ('Derawali', 'ڈیروی'),
    'Saraiki Jangli': ('Jangli', 'جانگلی'),
    'Saraiki Multani': ('Multani', 'ملتانی'),
    'Saraiki Mutani': ('Multani', 'ملتانی'),     # GRN's folder misspells it
    'Saraiki Reasiti': ('Riasiti', 'ریاستی'),
}

# Urdu film titles, by the DBS film series.
FILM_NATIVE = {
    'jesus': 'یسوع',
    'matthew': 'ویژول بائبل: متی کی انجیل',
    'acts_vb': 'ویژول بائبل: رسولوں کے اعمال',
    'hope': 'امید',
    'magdalena': 'مگدلینی',
    'storyjesus': 'بچوں کے لیے یسوع کی کہانی',
}

# Global Recordings programme names: English title and Urdu title.
GRN = {
    'Good News': ('Good News', 'خوشخبری'),
    'Good News (Men)': ('Good News (Men)', 'خوشخبری (مردوں کے لیے)'),
    'Good News 1-20 (Women)': ('Good News 1-20 (Women)', 'خوشخبری ۱ تا ۲۰ (خواتین کے لیے)'),
    'Words of Life': ('Words of Life', 'زندگی کے کلمات'),
    'Words of Life for Women': ('Words of Life for Women', 'خواتین کے لیے زندگی کے کلمات'),
    'Jesus Story': ('Jesus Story', 'یسوع کی کہانی'),
    'Scripture': ('Scripture readings', 'کلامِ مقدس کی تلاوت'),
    'Gospel Messages': ('Gospel Messages', 'انجیل کے پیغامات'),
    'Messages w SARAIKI Derawali': ('Messages', 'پیغامات'),
    # Programmes GRN names only in Saraiki: the title stays, with GRN's English.
    'خدا پاک دیاں تعلیمات': ("God's Teachings", 'خدا پاک دیاں تعلیمات'),
    'خشی دی خبر': ('Good News', 'خشی دی خبر'),
    'John': ('John', UR['John']),
    'Genesis': ('Genesis', UR['Genesis']),
    'Exodus': ('Exodus', UR['Exodus']),
    'Psalms': ('Psalms', UR['Psalms']),
    'Matthew': ('Matthew', UR['Matthew']),
    'Luke': ('Luke', UR['Luke']),
    'Acts': ('Acts', UR['Acts']),
    'Romans': ('Romans', UR['Romans']),
    'Galatians Philippians': ('Galatians & Philippians', f"{UR['Galatians']} اور {UR['Philippians']}"),
    'Ephesians Colossians': ('Ephesians & Colossians', f"{UR['Ephesians']} اور {UR['Colossians']}"),
    '1 2 Thessalonians': ('1 & 2 Thessalonians', '۱ اور ۲ تھسلنیکیوں'),
    '1 2 Peter': ('1 & 2 Peter', '۱ اور ۲ پطرس'),
    'James 1 2 3 John Jude': ('James; 1, 2, 3 John; Jude', f"{UR['James']}، ۱، ۲ اور ۳ یوحنا، {UR['Jude']}"),
}
LLL = ('دیکھو، سنو اور جیو', ['خدا کے ساتھ آغاز', 'خدا کے زورآور لوگ', 'خدا کے وسیلے فتح', 'خدا کے خادم',
                             'خدا کی خاطر آزمائش', 'یسوع، استاد اور شفا دینے والا', 'یسوع، خداوند اور نجات دہندہ',
                             'روح القدس کے کام'])

# Audio Bibles: English title where DBS's is wrong or bare.
AUDIO_TITLE = {
    'SKRSRG_FCBH_NP_D': 'Modern Central Saraiki Gospels (dramatised)',   # DBS: "Modern Central Saraiki Bible"; the audio is the four Gospels
    'SKRSBS_DAVR_NT_N': 'Saraiki New Testament',                          # DBS: "Saraiki Bible Stories"; the audio is all 27 books
    'BCCBNT_DAVR_NT_N': 'Southern Balochi New Testament',
}
# DBS subtitles that name one book of a larger edition ("یوهَنّا", John, on
# portions of 17 books): the edition is described instead.
SUBTITLE_LEFT_OUT = {'BCCWBT'}

ARABIC = re.compile('[؀-ۿ]')
DIGITS = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')


class PakistanShelf(Shelf):
    def __init__(self, code):
        super().__init__(code)
        # DBS's umbrella Balochi GRN page repeats the variety pages' programmes;
        # read it last so each programme is credited to its own variety.
        rows = self.audit['sections'].get('Audio Collections', [])
        rows.sort(key=lambda r: r['url'].rsplit('/', 1)[1].startswith('bal_'))

    def variety(self, key):
        return VARIETY.get(key)

    def tag(self, r, key):
        v = self.variety(key)
        if not v:
            return
        r['scope'] = v[0]
        r['langName'] = f"{self.L['native']} · {v[1]}"
        if v[0] not in r['title']:
            r['title'] += f' ({v[0]})'
        if v[1] not in (r['native'] or ''):
            r['native'] = f"{r['native']} ({v[1]})"

    # ------------------------------------------------------------ Bibles
    def text_bible(self, url, page):
        abbr = url.rsplit('/', 1)[1]
        label = self.listed[url]
        title = label.split(' ' + abbr)[0].strip().rstrip(',')
        native = re.split(r' (Read|Study|Download|Audio|Print) ', label.split(abbr, 1)[1] + ' ')[0].strip()
        native = native if ARABIC.search(native) and abbr not in SUBTITLE_LEFT_OUT else 'کلامِ مقدس کے حصے'
        where = (self.variety(abbr[:3].lower()) or (None, self.L['native']))[1]
        r = self.make('text-' + abbr.lower(), 'scripture', title, native, url, 'Digital Bible Society',
                      f'{where} میں کلامِ مقدس۔ ایپ میں پڑھیں یا PDF، EPUB یا HTML محفوظ کریں۔', year=self.year(url))
        self.tag(r, abbr[:3].lower())
        cand = [f'https://bibles.dbs.org/{abbr}/pdf/{abbr}.pdf', f'https://bibles.dbs.org/{abbr}/epub/{abbr}.epub',
                f'https://bibles.dbs.org/{abbr}/html_{abbr}.zip']
        if self.ok(cand[0]):
            r['read'] = {'kind': 'pdf', 'url': cand[0]}
            self.download(r, cand[0], 'کلامِ مقدس (PDF)')
        if self.ok(cand[1]):
            self.download(r, cand[1], 'کلامِ مقدس (EPUB)')
        if self.ok(cand[2]):
            self.download(r, cand[2], 'انٹرنیٹ کے بغیر پڑھنے کے لیے (HTML ZIP)')
        study = f'https://bibles.dbs.org/{abbr}/app-json-study/index.html'
        if any(l['url'] == study for l in page['links']):
            r['links'].append({'url': study, 'label': 'آن لائن پڑھیں'})
        assert r['downloads'] or r['links'][1:], url

    def audio_bible(self, url, page):
        info = self.audit['audio_bibles'].get(url) or {}
        if not info.get('books'):
            return False      # a moved edition: DBS lists its replacements, carried below
        assert not info['bad'], url
        fileset = url.rsplit('/', 1)[1]
        dirs, keys, names, counts = [], [], {}, {}
        for b in info['books']:
            m = re.search(r'/cdn/audio/[^/]+/((OT|NT)_[^/]+)/(\d\d)_([^/]+)/', b['sample'])
            if m[1] not in dirs:
                dirs.append(m[1])
            key = BOOKS[int(m[3]) - 1]
            assert m[4] == key, (m[4], key)
            keys.append(key)
            # A picker that names books in the language keeps them; English names take Urdu's.
            names[key] = b['name'] if ARABIC.search(b['name']) else UR[key]
            counts[key] = len(b['chapters'])
        testaments = [t for t in ('OT', 'NT') if any(d.startswith(t + '_') for d in dirs)]
        version = dirs[0].split('_', 1)[1]
        abbr = fileset.split('_', 1)[0]
        label = self.listed[url]
        title = AUDIO_TITLE.get(fileset) or label.split(' ' + abbr)[0].strip()
        sub = re.split(r' Audio · ', label.split(abbr, 1)[1])[0].strip()
        whole = 'OT' in testaments and len(keys) == 66
        what = ('پوری بائبل' if whole else 'نیا عہد نامہ' if len(keys) == 27
                else 'چاروں انجیلیں' if keys == ['Matthew', 'Mark', 'Luke', 'John'] else 'کلامِ مقدس کے حصے')
        native = sub if ARABIC.search(sub) and abbr not in SUBTITLE_LEFT_OUT else what
        count = sum(counts.values())
        where = (self.variety(abbr[:3].lower()) or (None, self.L['native']))[1]
        desc = (f'{what} {where} آڈیو میں: {len(keys)} کتابیں، {count} ابواب۔'.translate(DIGITS)
                + ' جو کتاب اور باب سننا یا محفوظ کرنا چاہیں، اسے چنیں۔')
        if fileset.endswith('_D'):
            desc = desc.replace(' آڈیو میں:', ' ڈرامائی آڈیو میں:')
        org = 'Faith Comes By Hearing' if '_FCBH_' in fileset else 'Davar Partners International'
        r = self.make('ab-' + fileset.lower().replace('.', '-').replace('_', '-'), 'audio-bible', title,
                      native, url, org, desc, year=self.year(url))
        self.tag(r, abbr[:3].lower())
        play = {'kind': 'audio-bible', 'fileset': fileset, 'version': version, 'testaments': testaments,
                'bookNames': names, 'saveChapter': True}
        if len(keys) not in (27, 39, 66):
            play['books'] = keys
        r['play'] = play
        for l in page['links']:
            if l['url'].endswith('.zip') and self.ok(l['url']):
                self.download(r, l['url'], 'تمام ابواب (ZIP)')
        return True

    # ------------------------------------------------------------ films
    def film(self, url, page):
        meta = self.audit['films'][url]
        series, ident = url.split('/video/', 1)[1].split('/', 1)
        L = self.L
        title = meta['title']
        if series.startswith('lumo-'):
            title = 'LUMO: ' + title.removeprefix('LUMO: ')
            native = 'LUMO: ' + (f"{UR[series[5:].title()]} کی انجیل" if series[5:] in ('matthew', 'mark', 'luke', 'john')
                                 else {'acts': UR['Acts'], 'covenant': 'عہد'}[series[5:]])
        elif series == 'ibible':
            title = 'iBible: Salvation Story'
            native = 'iBible: ' + meta['title_vernacular']
        elif series == 'ps':
            native = meta['title_vernacular']
        elif series == 'matthew':
            title = 'The Visual Bible: Matthew'
            native = FILM_NATIVE[series]
        else:
            native = FILM_NATIVE[series]
        own_folder = '/' + ident.rsplit('_', 1)[0] + '/' if series == 'jesus' else None
        chapters = []
        for i in (i for s in meta['sections'] for i in s['items']):
            u = (i['media'] or {}).get('low') or (i['media'] or {}).get('high')
            if not u or not self.ok(u):
                continue
            if own_folder and own_folder not in u:
                continue      # another dialect's chapters, misfiled on this page
            chapters.append((i['n'], u))
        full = meta['full'][0]['media'] if meta['full'] else {}
        sd = (full.get('low') or {}).get('url')
        hd = (full.get('high') or {}).get('url')
        sd, hd = (sd if sd and self.ok(sd) else None), (hd if hd and self.ok(hd) else None)
        duration = (meta.get('summary') or {}).get('duration_human') or (meta['full'][0].get('duration_human') if meta['full'] else None)
        r = self.make('film-' + ident.lower().replace('_', '-'), 'film', title, native, url,
                      meta['org'] or 'Digital Bible Society', L['film_desc_chapters'] if chapters else L['film_desc'],
                      duration=duration, year=meta.get('year'))
        self.tag(r, ident[:3])
        if chapters:
            # JESUS has scenes (حصہ); the Visual Bible and LUMO follow the Bible's chapters (باب).
            word = L['chapter'] if series == 'jesus' else 'باب'
            r['play'] = {'kind': 'chapters', 'base': '', 'items': [
                {'n': n, 'file': u, 'title': f"{word} {n}".translate(DIGITS)} for n, u in chapters]}
            for i in r['play']['items']:
                self.download(r, i['file'], i['title'] + ' (MP4)')
        elif sd or hd:
            r['play'] = {'kind': 'file', **({'sd': sd} if sd else {}), **({'hd': hd} if hd else {})}
        for d in meta['downloads']:
            if d['url'] and self.ok(d['url']) and (not own_folder or own_folder in d['url']):
                self.download(r, d['url'], L['chapters_zip'] if 'chapter' in d['url'] else 'پوری فلم (ZIP)')
        for u, q in ((sd, 'SD'), (hd, 'HD')):
            if u:
                self.download(r, u, f"{L['full']} · {q}")
        assert r.get('play'), url

    # ------------------------------------------------------------ recordings
    def grn(self, url, page):
        L, code = self.L, self.code
        mp3 = list(dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')))
        groups = {}
        for u in mp3:
            parts = urllib.parse.unquote(u).split('/')
            groups.setdefault((parts[-3], parts[-2]), []).append(u)
        carried = 0
        for (folder, programme), urls in groups.items():
            ident = programme.rsplit(' ', 1)[1].lstrip('0') or '0'
            if any(r['id'] == f'{code}-grn-{ident}' for r in self.out):
                continue      # the same programme already carried from another DBS page
            urls = [u for u in urls if self.ok(u)]
            if not urls:
                continue
            carried += 1
            series = programme[len(folder) + 1:].rsplit(' ', 1)[0]
            lll = re.match(r'LLL (\d) (.+)$', series)
            if lll:
                n = int(lll[1])
                title, native = f'LLL {n} {lll[2]}', f'{LLL[0]} {n}: {LLL[1][n - 1]}'.translate(DIGITS)
            else:
                title, native = GRN[series]
            key = folder if folder in VARIETY else url.rsplit('/', 1)[1][:3]
            r = self.make('grn-' + ident, 'audio', title, native, page['resolved'],
                          'Global Recordings Network', L['grn_desc'])
            r['dbsListedUrl'] = url
            v = self.variety(key)
            if v:
                r['title'] += f' — {v[0]}'
                r['native'] += f' ({v[1]})'
                r['scope'], r['langName'] = v[0], f"{L['native']} · {v[1]}"
            r['stats'] = str(len(urls))
            self.tracks(r, [(u, f"{native} · {L['part']} {n}".translate(DIGITS)) for n, u in enumerate(urls, 1)])
        return carried

    def story_of_jesus(self, url, page):
        L = self.L
        iso = url.rsplit('/', 1)[1][:3]
        mp3 = [u for u in dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')) if self.ok(u)]
        full = 'پوری کہانی'
        entries = [(u, full if u.endswith('_full.mp3') else
                    f"{L['part']} {int(re.search(r'(?:Part_|Part%20|/)(\d+)\.mp3$', u)[1])}".translate(DIGITS)) for u in mp3]
        parts = sum(1 for _, t in entries if t != full)
        r = self.make('story-jesus' + ('' if self.code == iso else '-' + iso), 'audio', 'Story of Jesus',
                      'یسوع کی کہانی (آڈیو)', page['resolved'], 'Story of Jesus',
                      f'یسوع کی کہانی آڈیو میں: پوری ریکارڈنگ ایک ساتھ یا {parts} حصوں میں۔ جو چاہیں سنیں یا محفوظ کریں۔'.translate(DIGITS))
        r['dbsListedUrl'] = url
        self.tag(r, iso)
        self.tracks(r, entries)
        for l in page['links']:
            if l['url'].endswith('.zip') and self.ok(l['url']):
                self.download(r, l['url'], full + ' (ZIP)' if l['url'].endswith('_full.zip') else L['tracks_zip'])

    def finish(self):
        # Recordings in a steady order: Story of Jesus, then GRN's messages,
        # Look, Listen & Live and Bible readings in the Bible's order; varieties
        # in VARIETY's order within each.
        audio = [r for r in self.out if r['type'] == 'audio']
        rank = list(GRN)
        scopes = [v[0] for v in VARIETY.values()]

        def key(r):
            var = scopes.index(r['scope']) if r.get('scope') in scopes else -1
            if '-grn-' not in r['id']:
                return (-1, 0, var)
            series = r['title'].split(' — ')[0]
            m = re.match(r'LLL (\d)', series)
            if m:
                return (1, int(m[1]), var)
            eng = [k for k, v in GRN.items() if v[0] == series]
            n = rank.index(eng[0]) if eng else 0
            return (0 if n < rank.index('John') else 2, n, var)
        ordered = iter(sorted(audio, key=key))
        self.out = [next(ordered) if r['type'] == 'audio' else r for r in self.out]

    def other_site(self, url):
        return 'Not hosted by DBS; its DBS-hosted media is carried where DBS has it.'


def main(codes=CODES):
    for code in codes:
        PakistanShelf(code).build()


if __name__ == '__main__':
    import sys
    main(sys.argv[1:] or CODES)
