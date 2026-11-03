#!/usr/bin/env python3
"""Build Tagalog (Filipino) and Telugu from their browser audits.

    python3 packer/build_dbs_asia.py            # both
    python3 packer/build_dbs_audit.py tgl       # one (the same)

Each language's DBS page, and every DBS page it links to, was rendered in a
real browser on 2026-11-03 (catalog/source/dbs-audit-<language>-2026-11-03.json),
with a ranged browser check of every file; only files that returned real media
are carried. Two audio Bibles that DBS links only from a text Bible's page
(TGLTAB_ISA_NT_N, TELERV_ISA_FB_N) were added to the audit's Bibles. Three
files on hosts that send no CORS header to dbs.org (two archive.org scans and
the StoryRunners ZIP on S3) were checked with a ranged curl request instead.

Both libraries have their own interface: Filipino (`tl`) and Telugu (`te`).
Every word the library adds (descriptions, labels, book names) is in that
language; titles DBS gives in the language stay.

  · Tagalog (tgl): Ang Dating Biblia (1905, the classic Protestant Bible,
    first), the Tagalog ULB, the Magandang Balita and Ang Dating Biblia New
    Testament audio, JESUS, LUMO, the Visual Bible's Matthew and Acts,
    BibleProject, The HOPE, iBible, Creation to Christ, Days of Creation,
    GRN, Story of Jesus, StoryRunners, three scans. DBS's Filipino page (fil)
    lists one film, King of Glory, carried here.
  · Telugu (tel): the Indian Revised Version (first) and the Easy-to-Read
    Version as text; the Bible Society's Telugu Bible (BSI), the Anjar New
    Testament and the Easy-to-Read Version as audio; JESUS in Telugu and in
    Nethakani; LUMO, the Visual Bible's Matthew, BibleProject, King of Glory,
    The HOPE, iBible, GRN's Look, Listen & Live, Story of Jesus, six scans.
"""
import re
import urllib.parse

import build_dbs_audit as base
from build_dbs_audit import BOOKS, LOCAL, Shelf

DATE = '2026-11-03'

WORDS = {
    'tgl': dict(
        slug='tagalog', ui='tl', name='Tagalog', native='Tagalog', region='Philippines',
        speakers='~83 million (with Filipino)', date=DATE,
        blurb='Bibliya, mga pelikula at Kristiyanong audio sa Tagalog (Filipino).',
        chapter='Kabanata', part='Bahagi', view='Tingnan sa DBS',
        full='Buong pelikula (MP4)', chapters_zip='Lahat ng kabanata (ZIP)',
        tracks_zip='Lahat ng recording (ZIP)', pdf='Aklat (PDF)',
        film_desc='Pelikulang batay sa Bibliya, sa Tagalog.',
        film_desc_chapters='Pelikulang batay sa Bibliya, sa Tagalog. Piliin ang bahaging gusto mong panoorin o iseyb.',
        deaf_desc='Ang Ebanghelyo para sa mga bingi, sa wikang pasenyas, na may Tagalog.',
        historic_desc='Lumang limbag na edisyon, na-scan bilang PDF. Maaaring iba ang baybay ng ilang salita ngayon.',
        grn_desc='Mga kuwento sa Bibliya at Kristiyanong mensahe sa Tagalog, inirekord ng Global Recordings Network.',
        plain=('tagalog', 'filipino'),
    ),
    'tel': dict(
        slug='telugu', ui='te', name='Telugu', native='తెలుగు', region='India',
        speakers='~83 million', date=DATE, script='telu', font='telugu',
        blurb='తెలుగులో బైబిల్, సినిమాలు, క్రైస్తవ ఆడియో.',
        chapter='అధ్యాయం', part='భాగం', view='DBSలో చూడండి',
        full='పూర్తి సినిమా (MP4)', chapters_zip='అన్ని అధ్యాయాలు (ZIP)',
        tracks_zip='అన్ని రికార్డింగ్‌లు (ZIP)', pdf='పుస్తకం (PDF)',
        film_desc='బైబిల్ ఆధారంగా తీసిన సినిమా, తెలుగులో.',
        film_desc_chapters='బైబిల్ ఆధారంగా తీసిన సినిమా, తెలుగులో. చూడాలనుకునే లేదా సేవ్ చేయాలనుకునే భాగాన్ని ఎంచుకోండి.',
        deaf_desc='బధిరుల కోసం సైగల భాషలో సువార్త, తెలుగుతో.',
        historic_desc='పాత ముద్రిత ప్రతి, PDFగా స్కాన్ చేసినది. కొన్ని పదాల అక్షరక్రమం ఈనాటికి భిన్నంగా ఉండవచ్చు.',
        grn_desc='తెలుగులో బైబిల్ కథలు, క్రైస్తవ సందేశాలు, Global Recordings Network రికార్డ్ చేసినవి.',
        plain=('telugu',),
    ),
}
base.LANGS.update(WORDS)
CODES = tuple(WORDS)

# Per-language words used below.
T = {
    'tgl': dict(
        bible='Bibliya', ot='Lumang Tipan', nt='Bagong Tipan', whole='Buong Bibliya', gospels='Apat na Ebanghelyo',
        portions='Mga bahagi ng Bibliya', read_online='Basahin online', offline='Bibliyang mababasa kahit walang internet (HTML ZIP)',
        all_chapters='Lahat ng kabanata (ZIP)', full_film_zip='Buong pelikula (ZIP)',
        text_desc='{what} sa Tagalog. Basahin sa app o iseyb ang PDF, EPUB o HTML.',
        audio_desc='{what} sa Tagalog na audio: {books} aklat, {chapters} kabanata. Piliin ang aklat at kabanatang gusto mong pakinggan o iseyb.',
        dramatised=' (may dula)',
        soj_native='Ang Kuwento ni Hesus (audio)', soj_full='Buong kuwento',
        soj_desc='Ang kuwento ni Hesus sa audio: isang buong recording o {n} bahagi. Pakinggan o iseyb ang gusto mo.',
        story_native='Mga Kuwento sa Bibliya',
        story_desc='{n} kuwento sa Bibliya, mula sa paglikha hanggang sa bagong langit at bagong lupa, inirekord ng StoryRunners.',
        lll='Tumingin, Makinig at Mabuhay',
        lll_names=['Ang Pasimula Kasama ang Diyos', 'Ang Magigiting na Lingkod ng Diyos', 'Tagumpay sa pamamagitan ng Diyos',
                   'Ang mga Lingkod ng Diyos', 'Nililitis Dahil sa Diyos', 'Si Hesus, Guro at Manggagamot',
                   'Si Hesus, Panginoon at Tagapagligtas', 'Ang mga Gawa ng Banal na Espiritu'],
        dialect={},
    ),
    'tel': dict(
        bible='బైబిల్', ot='పాత నిబంధన', nt='క్రొత్త నిబంధన', whole='సంపూర్ణ బైబిల్', gospels='నాలుగు సువార్తలు',
        portions='బైబిల్ భాగాలు', read_online='ఆన్‌లైన్‌లో చదవండి', offline='ఇంటర్నెట్ లేకుండా చదవడానికి బైబిల్ (HTML ZIP)',
        all_chapters='అన్ని అధ్యాయాలు (ZIP)', full_film_zip='పూర్తి సినిమా (ZIP)',
        text_desc='తెలుగులో {what}. యాప్‌లో చదవండి, లేదా PDF, EPUB, HTML సేవ్ చేయండి.',
        audio_desc='తెలుగు ఆడియోలో {what}: {books} పుస్తకాలు, {chapters} అధ్యాయాలు. వినాలనుకునే లేదా సేవ్ చేయాలనుకునే పుస్తకం, అధ్యాయం ఎంచుకోండి.',
        dramatised=' (నాటకీకరణ)',
        soj_native='యేసు కథ (ఆడియో)', soj_full='పూర్తి కథ',
        soj_desc='ఆడియోలో యేసు కథ: ఒకే పూర్తి రికార్డింగ్, లేదా {n} భాగాలు. కావలసినది వినండి లేదా సేవ్ చేయండి.',
        story_native='బైబిల్ కథలు', story_desc='',
        lll='చూడండి, వినండి, జీవించండి',
        lll_names=['దేవునితో ఆరంభం', 'దేవుని పరాక్రమశాలులు', 'దేవుని ద్వారా విజయం', 'దేవుని సేవకులు',
                   'దేవుని కోసం విచారణలో', 'యేసు, బోధకుడు మరియు స్వస్థపరచువాడు', 'యేసు, ప్రభువు మరియు రక్షకుడు',
                   'పరిశుద్ధాత్మ కార్యాలు'],
        dialect={'nethakani': ('Nethakani', 'నేతకాని')},
    ),
}

# Native film titles, by the DBS film series (and, for BibleProject, the video).
FILM_NATIVE = {
    'tgl': {
        'jesus': 'Hesus', 'magdalena': 'Magdalena', 'storyjesus': 'Ang Kuwento ni Hesus para sa mga Bata',
        'savior': 'Ang Tagapagligtas', 'c2c': 'Mula sa Paglikha Hanggang kay Cristo',
        'tgl-tagalog-overview': 'BibleProject: Mga Buod ng mga Aklat ng Bibliya',
        'tgl-tagalog-themes': 'BibleProject: Mga Tema ng Bibliya',
        'lumo-matthew': 'LUMO: Ang Ebanghelyo ayon kay Mateo', 'lumo-covenant': 'LUMO: Ang Tipan',
        'creation': 'Ang mga Araw ng Paglikha', 'hope': 'Ang Pag-asa',
        'matthew': 'Ang Bibliya sa Pelikula: Mateo', 'acts_vb': 'Ang Bibliya sa Pelikula: Mga Gawa',
        'deafproject': 'Ang Ebanghelyo para sa mga Bingi', 'rock': 'Hari ng Kaluwalhatian',
    },
    'tel': {
        'jesus': 'యేసు', 'magdalena': 'మగ్దలేనా', 'storyjesus': 'పిల్లల కోసం యేసు కథ',
        'savior': 'రక్షకుడు', 'rock': 'మహిమ గల రాజు',
        'tel-telugu-overview': 'BibleProject: బైబిల్ పుస్తకాల సారాంశాలు',
        'tel-telugu-themes': 'BibleProject: బైబిల్ అంశాలు',
        'lumo-john': 'LUMO: యోహాను సువార్త', 'lumo-matthew': 'LUMO: మత్తయి సువార్త',
        'lumo-acts': 'LUMO: అపొస్తలుల కార్యములు', 'hope': 'ఆశ',
        'matthew': 'బైబిల్ సినిమా: మత్తయి సువార్త', 'deafproject': 'బధిరుల కోసం సువార్త',
    },
}
# English titles where DBS's are bare or misleading.
FILM_TITLE = {'bp/tgl-tagalog-overview': 'BibleProject: Book Overviews', 'bp/tgl-tagalog-themes': 'BibleProject: Themes',
              'bp/tel-telugu-overview': 'BibleProject: Book Overviews', 'bp/tel-telugu-themes': 'BibleProject: Themes',
              'rock/fil-filipino': 'King of Glory', 'rock/tel-telugu': 'King of Glory'}
# Films that follow the Bible's chapters; the others have parts.
CHAPTER_FILMS = ('lumo-matthew', 'lumo-john', 'matthew', 'acts_vb')

TEXT = {
    'TGLTAB': ('Ang Dating Biblia (1905)', 'Ang Dating Biblia', 'British and Foreign Bible Society · American Bible Society'),
    'TGLULB': ('Tagalog Unlocked Literal Bible (ULB)', 'Banal na Bibliya', 'Door43 World Missions Community'),
    'TELOTB': ('Telugu Bible: Indian Revised Version (IRV)', 'తెలుగు బైబిల్ (ఇండియన్ రివైజ్డ్ వెర్షన్)', 'Bridge Connectivity Solutions'),
    'TELERV': ('Telugu Easy-to-Read Version', 'చదువు సులభం బైబిల్', 'Bible League International'),
}
AUDIO = {
    'TGLPBS_FCBH_NT_N': ('Magandang Balita Biblia: New Testament', 'Magandang Balita Biblia: Bagong Tipan', 'Faith Comes By Hearing'),
    'TGLTAB_ISA_NT_N': ('Ang Dating Biblia: New Testament', 'Ang Dating Biblia: Bagong Tipan', 'Digital Bible Society'),
    'TELBOV_DAVR_FB_N': ('Telugu Bible (BSI)', 'పరిశుద్ధ గ్రంథము', 'Davar Partners International'),
    'TELDVP_DAVR_NT_N': ('Anjar New Testament', 'అంజర్ క్రొత్త నిబంధన', 'Davar Partners International'),
    'TELERV_ISA_FB_N': ('Telugu Easy-to-Read Version', 'చదువు సులభం బైబిల్', 'Digital Bible Society'),
}
# The classic Bible leads each shelf (it is the one shown by default).
base.TRADITIONAL['tgl'] = ['https://dbs.org/bibles/TGLTAB']
base.TRADITIONAL['tel'] = ['https://dbs.org/bibles/TELOTB']

# Scan titles in the language (DBS repeats the English with one word changed).
SCANS = {
    'Tagalog-1933-Ang-Bagon-Tipan-New-Testament': 'Ang Bagong Tipan (1933)',
    'Tagalog-1978-Genesis-Portion-Ang-Kasaysay-ng-Paglikha': 'Aklat ng Genesis (1978)',
    'Tagalog-John-book': 'Ang Ebanghelyo ayon kay Juan (aklat)',
    'Telugu-1869-New-Testament': 'క్రొత్త నిబంధన (1869)',
    'Telugu-1881-Bible-Madras-Auxiliary-Bible-Society': 'బైబిలు, మద్రాస్ సహాయక బైబిలు సమాజం (1881)',
    'Telugu-1929-Bible': 'బైబిలు (1929)',
    'Telugu-2006-WBTC-Bible': 'చదువు సులభం బైబిలు, WBTC (2006)',
    'Telugu-2006-WBTC-New-Testament': 'చదువు సులభం క్రొత్త నిబంధన, WBTC (2006)',
    'Telugu-Bible-Unicode-print': 'బైబిలు, యూనికోడ్ ముద్రణ (1997)',
}

GRN_TGL = {
    'A Christian Life - dialogue': ('A Christian Life (dialogue)', 'Buhay Kristiyano (usapan)'),
    'Good News': ('Good News', 'Mabuting Balita'),
    'Portrait of Jesus': ('Portrait of Jesus', 'Larawan ni Hesus'),
    'Words of Life 1': ('Words of Life 1', 'Mga Salita ng Buhay 1'),
    'Words of Life 2': ('Words of Life 2', 'Mga Salita ng Buhay 2'),
    'Words of Life for Children': ('Words of Life for Children', 'Mga Salita ng Buhay para sa mga Bata'),
}
LLL_EN = base.LLL_EN
TELUGU = re.compile('[ఀ-౿]')


def booked(code, t):
    """An English Bible reference ("Genesis 1-11", "1 Samuel") in the interface's book names."""
    names = LOCAL[base.LANGS[code]['ui']]
    m = re.match(r'(\d )?([A-Z][a-z]+(?: of [A-Z][a-z]+)?)(.*)$', t)
    if m:
        key = ((m[1] or '').strip() + m[2]).replace(' of ', 'of')
        key = {'Song': 'SongofSongs', 'Psalm': 'Psalms'}.get(key, key)
        if key in names:
            return names[key] + m[3]
    return t


class AsiaShelf(Shelf):
    def __init__(self, code):
        super().__init__(code)
        self.W = T[code]
        self.books = LOCAL[self.L['ui']]

    # ------------------------------------------------------------ Bibles
    def text_bible(self, url, page):
        abbr = url.rsplit('/', 1)[1]
        title, native, org = TEXT[abbr]
        W = self.W
        r = self.make('text-' + abbr.lower(), 'scripture', title, native, url, org,
                      W['text_desc'].format(what=W['bible']), year=self.year(url))
        cand = [f'https://bibles.dbs.org/{abbr}/pdf/{abbr}.pdf', f'https://bibles.dbs.org/{abbr}/epub/{abbr}.epub',
                f'https://bibles.dbs.org/{abbr}/html_{abbr}.zip']
        if self.ok(cand[0]):
            r['read'] = {'kind': 'pdf', 'url': cand[0]}
            self.download(r, cand[0], W['bible'] + ' (PDF)')
        if self.ok(cand[1]):
            self.download(r, cand[1], W['bible'] + ' (EPUB)')
        if self.ok(cand[2]):
            self.download(r, cand[2], W['offline'])
        study = f'https://bibles.dbs.org/{abbr}/app-json-study/index.html'
        if any(l['url'] == study for l in page['links']):
            r['links'].append({'url': study, 'label': W['read_online']})
        assert r['downloads'], url

    def audio_bible(self, url, page):
        info = self.audit['audio_bibles'].get(url) or {}
        if not info.get('books'):
            return False      # a moved edition: DBS lists its replacements, carried here
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
            # The interface's book names: DBS's pickers cut some short ("ద్వితీయో").
            names[key] = self.books[key]
            counts[key] = len(b['chapters'])
        testaments = [t for t in ('OT', 'NT') if any(d.startswith(t + '_') for d in dirs)]
        version = dirs[0].split('_', 1)[1]
        title, native, org = AUDIO[fileset]
        W = self.W
        what = (W['whole'] if 'OT' in testaments and len(keys) == 66 else W['nt'] if len(keys) == 27
                else W['gospels'] if keys == ['Matthew', 'Mark', 'Luke', 'John'] else W['portions'])
        count = sum(counts.values())
        desc = W['audio_desc'].format(what=what, books=len(keys), chapters=count)
        if fileset.endswith('_D'):
            title += ' (dramatised)'
            native += W['dramatised']
        r = self.make('ab-' + fileset.lower().replace('.', '-').replace('_', '-'), 'audio-bible', title,
                      native, url, org, desc, year=self.year(url))
        play = {'kind': 'audio-bible', 'fileset': fileset, 'version': version, 'testaments': testaments,
                'bookNames': names, 'saveChapter': True}
        if len(keys) not in (27, 39, 66):
            play['books'] = keys
        r['play'] = play
        for l in page['links']:
            if l['url'].endswith('.zip') and self.ok(l['url']):
                self.download(r, l['url'], W['all_chapters'])
        return True

    # ------------------------------------------------------------ films
    def film(self, url, page):
        meta = self.audit['films'][url]
        series, ident = url.split('/video/', 1)[1].split('/', 1)
        L, W, code = self.L, self.W, self.code
        title = FILM_TITLE.get(f'{series}/{ident}') or meta['title']
        title = {'The Story of Jesus for Children': 'Story of Jesus for Children'}.get(title, title)
        if series.startswith('lumo-') and not title.startswith('LUMO'):
            title = 'LUMO: ' + title.replace('Gospel of', 'The Gospel of')
        if series == 'ibible':
            title = 'iBible: Salvation Story'
            native = 'iBible: ' + meta['title_vernacular']
        else:
            native = FILM_NATIVE[code].get(ident) or FILM_NATIVE[code][series]
        # Telugu has a second JESUS dub, in Nethakani; it names its variety.
        dialect = re.match(r'[a-z]{3}_([a-z]+)_', ident)
        scope = W['dialect'].get(dialect[1]) if dialect else None
        if scope:
            title += f' ({scope[0]})'
            native += f' ({scope[1]})'
        own_folder = '/' + ident.rsplit('_', 1)[0] + '/' if series == 'jesus' else None
        chapters = []
        for sec, i in ((s, i) for s in meta['sections'] for i in s['items']):
            u = (i['media'] or {}).get('low') or (i['media'] or {}).get('high')
            if not u or not self.ok(u):
                continue
            if own_folder and own_folder not in u:
                continue      # another dialect's chapters, misfiled on this page
            t = (i.get('title') or '').strip()
            if code == 'tel' and not TELUGU.search(t) and TELUGU.search(sec.get('title') or ''):
                t = sec['title'].strip()      # The HOPE: English "Event 7", the section's Telugu name
            # The HOPE numbers its events again in every section: count straight through.
            chapters.append((len(chapters) + 1, u, t))
        full = meta['full'][0]['media'] if meta['full'] else {}
        sd = (full.get('low') or {}).get('url')
        hd = (full.get('high') or {}).get('url')
        sd, hd = (sd if sd and self.ok(sd) else None), (hd if hd and self.ok(hd) else None)
        duration = (meta.get('summary') or {}).get('duration_human') or (meta['full'][0].get('duration_human') if meta['full'] else None)
        desc = L['deaf_desc'] if series == 'deafproject' else L['film_desc_chapters'] if chapters else L['film_desc']
        r = self.make('film-' + ident.lower().replace('_', '-'), 'film', title, native, url,
                      meta['org'] or 'Digital Bible Society', desc, duration=duration, year=meta.get('year'))
        if scope:
            r['scope'] = scope[0]
            r['langName'] = f"{L['native']} · {scope[1]}"
        if chapters:
            word = L['chapter'] if series in CHAPTER_FILMS else L['part']
            items = []
            for n, u, t in chapters:
                if series == 'bp':
                    # BibleProject's videos are separate studies: their names, book names in the language.
                    label = f'{n}. {booked(code, t)}'
                elif t and (TELUGU.search(t) if code == 'tel' else series in ('jesus', 'lumo-matthew', 'matthew', 'acts_vb')):
                    label = f'{word} {n}: {t}'      # DBS gives the scene's name in the language
                else:
                    label = f'{word} {n}'
                items.append({'n': n, 'file': u, 'title': label})
            r['play'] = {'kind': 'chapters', 'base': '', 'items': items}
            for i in items:
                self.download(r, i['file'], i['title'] + ' (MP4)')
        elif sd or hd:
            r['play'] = {'kind': 'file', **({'sd': sd} if sd else {}), **({'hd': hd} if hd else {})}
        for d in meta['downloads']:
            if d['url'] and self.ok(d['url']) and (not own_folder or own_folder in d['url']):
                self.download(r, d['url'], W['all_chapters'] if 'chapter' in d['url'] else W['full_film_zip'])
        for u, q in ((sd, 'SD'), (hd, 'HD')):
            if u:
                self.download(r, u, f"{L['full']} · {q}")
        assert r.get('play'), url

    def historic(self, url, page):
        super().historic(url, page)
        self.out[-1]['native'] = SCANS[url.rsplit('/', 1)[1]]

    # ------------------------------------------------------------ recordings
    def grn(self, url, page):
        L, W, code = self.L, self.W, self.code
        mp3 = list(dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')))
        groups = {}
        for u in mp3:
            parts = urllib.parse.unquote(u).split('/')
            groups.setdefault((parts[-3], parts[-2]), []).append(u)
        carried = 0
        for (folder, programme), urls in groups.items():
            ident = programme.rsplit(' ', 1)[1].lstrip('0') or '0'
            if any(r['id'] == f'{code}-grn-{ident}' for r in self.out):
                continue
            urls = [u for u in urls if self.ok(u)]
            if not urls:
                continue
            carried += 1
            series = programme[len(folder) + 1:].rsplit(' ', 1)[0]
            lll = re.match(r'LLL (\d) ', series)
            if lll:
                n = int(lll[1])
                title, native = f'LLL {n} {LLL_EN[n - 1]}', f"{W['lll']} {n}: {W['lll_names'][n - 1]}"
            else:
                title, native = GRN_TGL[series]
            r = self.make('grn-' + ident, 'audio', title, native, page['resolved'],
                          'Global Recordings Network', L['grn_desc'])
            r['dbsListedUrl'] = url
            r['stats'] = str(len(urls))
            self.tracks(r, [(u, f"{native} · {L['part']} {n}") for n, u in enumerate(urls, 1)])
        return carried

    def story_of_jesus(self, url, page):
        L, W = self.L, self.W
        mp3 = [u for u in dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')) if self.ok(u)]
        entries = []
        for u in mp3:
            if u.endswith('_full.mp3'):
                entries.append((u, W['soj_full']))
            else:
                n = int(re.search(r'(\d+)\.mp3$', urllib.parse.unquote(u))[1])
                entries.append((u, f"{L['part']} {n}"))
        parts = sum(1 for _, t in entries if t != W['soj_full'])
        r = self.make('story-jesus', 'audio', 'Story of Jesus', W['soj_native'], page['resolved'], 'Story of Jesus',
                      W['soj_desc'].format(n=parts))
        r['dbsListedUrl'] = url
        self.tracks(r, entries)
        for l in page['links']:
            if l['url'].endswith('.zip') and self.ok(l['url']):
                self.download(r, l['url'], W['soj_full'] + ' (ZIP)' if l['url'].endswith('_full.zip') else L['tracks_zip'])

    def storyset(self, url, page):
        L, W = self.L, self.W
        mp3 = list(dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')))
        entries, missing = [], []
        for u in mp3:
            name = urllib.parse.unquote(u).rsplit('/', 1)[1][:-4]
            _, n, story = re.match(r'(.+?)-(\d+)-(.+)$', name).groups()
            local = story.split('-')[0].replace('_', ' ').strip()
            if not self.ok(u):
                missing.append(f'{int(n)}. {story.rsplit("-", 1)[-1].replace("_", " ")}')
                continue
            entries.append((u, f'{int(n)}. {local}'))
        r = self.make('storyset', 'audio', 'StoryRunners Bible story set', W['story_native'], page['resolved'],
                      'StoryRunners', W['story_desc'].format(n=len(entries)), stats=str(len(entries)))
        r['dbsListedUrl'] = url
        self.tracks(r, entries)
        for l in page['links']:
            if l['url'].endswith('.zip') and self.ok(l['url']):
                self.download(r, l['url'], L['tracks_zip'])
        if missing:
            self.missing[url] = f'DBS links {len(missing)} StoryRunners stories its server does not hold (404): ' + '; '.join(missing) + '.'

    def other_site(self, url):
        return 'Not hosted by DBS; its DBS-hosted media is carried where DBS has it.'


def main(codes=CODES):
    for code in codes:
        AsiaShelf(code).build()


if __name__ == '__main__':
    import sys
    main(sys.argv[1:] or CODES)
