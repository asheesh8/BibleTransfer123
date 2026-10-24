"""Xhosa, Chichewa, Kinyarwanda, Shona, Kirundi, Akan, Tigrinya, Arabic, Haitian Creole, Kuria, Spanish, Saamia, Luhya, Bukusu, Maragoli, Idakho-Isukha-Tiriki, Kabras, Tachoni, Banyala, Marachi, Kamba, Kalenjin, Giryama, Digo and Duruma: complete, verified and DBS-hosted."""
import json
import pathlib
import re
import unittest
from packer.et import catalog, build
from packer.et.curation import excluded
from packer.et.profiles import PROFILES

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATE = '2026-10-06'
ARA_COUNT = 263
SPA_COUNT = 84
SHELVES = {'xho': ('xhosa', 'xh', 13), 'nya': ('chichewa', 'ny', 34),
           'kin': ('kinyarwanda', 'rw', 26), 'sna': ('shona', 'sn', 32),
           'run': ('kirundi', 'rn', 27), 'aka': ('akan', 'ak', 47),
           'tir': ('tigrinya', 'ti', 26), 'ara': ('arabic', 'ar', ARA_COUNT),
           'hat': ('haitian', 'ht', 29), 'kuj': ('kuria', 'swh', 12),
           'spa': ('spanish', 'es', SPA_COUNT), 'lsm': ('saamia', 'swh', 16),
           'luy': ('luhya', 'swh', 83), 'bxk': ('bukusu', 'swh', 33),
           'rag': ('maragoli', 'swh', 13), 'ida': ('idakho', 'swh', 4),
           'lkb': ('kabras', 'swh', 11), 'lts': ('tachoni', 'swh', 11),
           'nle': ('banyala', 'swh', 12), 'lri': ('marachi', 'swh', 14),
           'kam': ('kamba', 'swh', 22), 'kln': ('kalenjin', 'swh', 97),
           'nyf': ('giryama', 'swh', 26), 'dig': ('digo', 'swh', 21), 'dug': ('duruma', 'swh', 16)}
DATES = {'ara': '2026-10-07', 'hat': '2026-10-13', 'kuj': '2026-10-14', 'spa': '2026-10-15',
         'lsm': '2026-10-20', 'luy': '2026-10-20', 'bxk': '2026-10-20',
         'rag': '2026-10-21', 'ida': '2026-10-21',
         'lkb': '2026-10-24', 'lts': '2026-10-24', 'nle': '2026-10-24', 'lri': '2026-10-24',
         'kam': '2026-10-24', 'kln': '2026-10-24',
         'nyf': '2026-10-24', 'dig': '2026-10-24', 'dug': '2026-10-24'}


def urls(r):
    return re.findall(r'https?://[^"\s]+', json.dumps({k: r.get(k) for k in ('play', 'read', 'downloads')},
                                                       ensure_ascii=False))


class DbsAuditTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lib = catalog.load(ROOT / 'catalog/resources.json')
        cls.cards = {r['id']: r for r in build.card_catalog(cls.lib, [], PROFILES['pocket'], {})['resources']}
        cls.audit = {c: json.loads((ROOT / f'catalog/source/dbs-audit-{s}-{DATES.get(c, DATE)}.json').read_text())
                     for c, (s, _, _) in SHELVES.items()}
        cls.built = {c: json.loads((ROOT / f'catalog/{s}.json').read_text()) for c, (s, _, _) in SHELVES.items()}

    def shelf(self, code):
        return [r for r in self.lib['resources'] if r['lang'] == code]

    def test_every_listed_dbs_page_is_carried_or_explained(self):
        for code, (slug, ui, count) in SHELVES.items():
            resources = self.shelf(code)
            self.assertEqual(len(resources), count, code)
            carried = {r['source'] for r in resources} | {r.get('dbsListedUrl') for r in resources}
            listed = {row['url'] for rows in self.audit[code]['sections'].values() for row in rows}
            missing = listed - carried - set(self.built[code]['notCarried'])
            self.assertEqual(missing, set(), code)
            for r in resources:
                self.assertTrue(r['native'] and r['desc'], r['id'])
                self.assertTrue(r.get('play') or r.get('read') or r['downloads'], r['id'])

    def test_every_carried_file_passed_the_browser_check(self):
        for code in SHELVES:
            files = self.audit[code]['files']
            for r in self.shelf(code):
                for u in urls(r):
                    if '/cdn/audio/' in u:
                        continue          # audio Bible chapters, checked below
                    self.assertTrue(files.get(u, {}).get('valid'), u)
                    self.assertRegex(u, r'^https://([a-z0-9]+\.)?dbs\.org/')

    def test_audio_bibles_cover_every_published_chapter(self):
        totals = {}
        for code in SHELVES:
            audit = self.audit[code]['audio_bibles']
            for r in self.shelf(code):
                if r['type'] != 'audio-bible':
                    continue
                books = audit[r['source']]['books']
                self.assertEqual(audit[r['source']]['bad'], [])
                self.assertEqual(audit[r['source']]['chapters_verified'], sum(len(b['chapters']) for b in books))
                totals[code] = totals.get(code, 0) + audit[r['source']]['chapters_verified']
                p = r['play']
                self.assertEqual(len(p['bookNames']), len(books))
                self.assertTrue(all(not n.isupper() for n in p['bookNames'].values()), r['id'])
        self.assertEqual(sum(totals[c] for c in ('xho', 'nya', 'kin', 'sna') if c in totals), 1189 * 4 + 260 * 2 + 24)
        self.assertEqual(totals['run'], 1189)
        # Two NTs, five full Bibles (one DBS picker omits eight chapters) and the Fante Old Testament.
        self.assertEqual(totals['aka'], 260 * 2 + 1189 * 4 + 1181 + 929)
        # Five full Bibles, two full New Testaments, the Sudanese New Testament
        # (DBS has 248 of its chapters) and four editions of a few books.
        self.assertEqual(totals['ara'], 1189 * 5 + 260 * 2 + 248 + 16 + 43 + 16 + 204)
        # The easy-to-read New Testament with Psalms and Proverbs.
        self.assertEqual(totals['hat'], 260 + 150 + 31)
        self.assertEqual(totals['kuj'], 1189)
        self.assertEqual(totals['lsm'], 1189)
        # Davar's whole Bible and FCBH's Luke.
        self.assertEqual(totals['bxk'], 1189 + 24)
        # The Lulogooli Bible (2019): DBS has its Old Testament in audio.
        self.assertEqual(totals['rag'], 929)
        # Faith Comes By Hearing's Nyala New Testament.
        self.assertEqual(totals['nle'], 260)
        # Davar's Mbivilia Ũvoo Mũseo; the Bible Society of Kenya's Kalenjin Bible and FCBH's New Testament.
        self.assertEqual(totals['kam'], 1189)
        self.assertEqual(totals['kln'], 1189 + 260)
        # Davar's whole Bibles; the Giryama picker lists 1,175 of its chapters.
        self.assertEqual((totals['nyf'], totals['dig'], totals['dug']), (1175, 1189, 1189))
        # Three full Bibles, the Reina-Valera 1960 Old Testament and three New Testaments.
        self.assertEqual(totals['spa'], 1189 * 3 + 929 + 260 * 3)

    def test_moved_audio_bibles_are_left_out(self):
        moved = {'https://dbs.org/bibles/audio/NYABSM04605_DAVR_FB_N',
                 'https://dbs.org/bibles/audio/NYABSMW00333_DAVR_FB_N',
                 'https://dbs.org/bibles/audio/KINBSR_DAVR_OT_N',
                 'https://dbs.org/bibles/audio/RUNBSB2018_DAVR_FB_N',
                 'https://dbs.org/bibles/audio/TWIBIB02272_DAVR_FB_N',
                 'https://dbs.org/bibles/audio/TWIBSG00360_DAVR_FB_N',
                 'https://dbs.org/bibles/audio/TWIBIB00360_DAVR_FB_N'}
        carried = {r['source'] for c in SHELVES for r in self.shelf(c)}
        self.assertFalse(moved & carried)
        for u in moved:
            code = {'KIN': 'kin', 'RUN': 'run', 'TWI': 'aka'}.get(u.rsplit('/', 1)[1][:3], 'nya')
            self.assertIn('moved', self.built[code]['notCarried'][u])

    def test_jesus_chapters_stay_with_the_dialect_that_recorded_them(self):
        for code in ('kin', 'sna', 'aka'):
            for r in self.shelf(code):
                if '/video/jesus/' not in r['source']:
                    continue
                folder = '/' + r['source'].rsplit('/', 1)[1].rsplit('_', 1)[0] + '/'
                for u in urls(r):
                    self.assertIn(folder, u, r['id'])
        rufumbira = next(r for r in self.shelf('kin') if r['id'] == 'kin-film-kin-rufumbira-jesus')
        self.assertEqual(len(rufumbira['play']['items']), 61)
        kinyarwanda = next(r for r in self.shelf('kin') if r['id'] == 'kin-film-kin-kinyarwanda-jesus')
        self.assertEqual(kinyarwanda['play']['kind'], 'file')
        fante = next(r for r in self.shelf('aka') if r['id'] == 'aka-film-aka-fante-jesus')
        self.assertEqual(len(fante['play']['items']), 61)
        for ident in ('asante-twi', 'twi'):
            asante = next(r for r in self.shelf('aka') if r['id'] == f'aka-film-aka-{ident}-jesus')
            self.assertEqual(asante['play']['kind'], 'file')

    def test_traditional_editions_lead_and_no_inclusive_translation_is_carried(self):
        nya = [r for r in self.shelf('nya') if r['type'] == 'audio-bible']
        self.assertEqual(nya[0]['native'], 'Buku Lopatulika ndilo Mau a Mulungu')
        sna = [r for r in self.shelf('sna') if r['type'] in ('scripture', 'audio-bible')]
        self.assertEqual(sna[0]['id'], 'sna-text-snaold')
        run = [r for r in self.shelf('run') if r['type'] in ('scripture', 'audio-bible')]
        self.assertEqual(run[0]['id'], 'run-text-runbsb')
        aka = [r['id'] for r in self.shelf('aka') if r['type'] in ('scripture', 'audio-bible')]
        self.assertEqual(aka[:5], ['aka-ab-twibsg-00360-davr-fb-n', 'aka-ab-akabsg-fcbh-fb-n', 'aka-ab-akaubs-fcbh-nt-n',
                                   'aka-ab-twintp-davr-fb-n', 'aka-ab-fatbsg-davr-ot-n'])
        hat = [r for r in self.shelf('hat') if r['type'] in ('scripture', 'audio-bible')]
        self.assertEqual([r['id'] for r in hat], ['hat-text-hatabs', 'hat-ab-hatbli-fcbh-np-n'])
        self.assertEqual(hat[0]['org'], 'Société Biblique Haïtienne')
        self.assertEqual(hat[0]['read']['kind'], 'pdf')
        tir = [r for r in self.shelf('tir') if r['type'] in ('scripture', 'audio-bible')]
        self.assertEqual([r['id'] for r in tir], ['tir-text-tirtbi'])
        self.assertEqual(tir[0]['org'], 'Bible Society of Ethiopia')
        for code in SHELVES:
            for r in self.shelf(code):
                self.assertIsNone(excluded(r), r['id'])
                self.assertNotRegex(r['title'] + ' ' + r['native'], re.compile(r'inclusive|queen james', re.I))

    def test_unconfirmed_programmes_are_not_carried(self):
        for code, numbers in (('kin', ('67900', '85249', '79090', '81791')), ('run', ('67169',))):
            ids = {r['id'] for r in self.shelf(code)}
            for n in numbers:
                self.assertNotIn(f'{code}-grn-' + n, ids)
                self.assertIn('https://globalrecordings.net/en/program/' + n, self.built[code]['notCarried'])

    def test_akan_dialects_are_named_and_shared_grn_files_carried_once(self):
        aka = self.shelf('aka')
        for r in aka:
            if r['type'] in ('film', 'audio-bible', 'scripture'):
                self.assertIn(r['scope'], ('Asante Twi', 'Akuapem Twi', 'Fante', 'Twi'), r['id'])
        grn = [r for r in aka if r['id'].startswith('aka-grn-')]
        self.assertEqual(len(grn), 14)
        self.assertEqual(len({u for r in grn for u in urls(r)}), sum(len(r['play']['items']) for r in grn))
        self.assertIn('https://dbs.org/audio/collections/grn/fat_GlobalRecordings_fante', self.built['aka']['notCarried'])

    def test_tigrinya_names_each_country_and_lists_missing_stories(self):
        tir = self.shelf('tir')
        self.assertEqual(self.built['tir']['languages']['tir']['script'], 'ethi')
        jesus = {r['scope']: r for r in tir if '/video/jesus/' in r['source']}
        self.assertEqual(set(jesus), {'Eritrea', 'Ethiopia'})
        self.assertEqual(jesus['Eritrea']['native'], 'ኢየሱስ (ኤርትራ)')
        self.assertEqual(len(jesus['Ethiopia']['play']['items']), 61)
        for r in tir:
            self.assertNotRegex(r['native'], r'[A-Za-z]{4,}(?<!LUMO)', r['id'])
        story = next(r for r in tir if r['id'] == 'tir-storyset')
        self.assertEqual(len(story['play']['items']), 24)
        self.assertIn('18 StoryRunners stories', self.built['tir']['notCarried']['https://dbs.org/audio/collections/srun/tir_storyset_tigrigna'])

    def test_arabic_reads_right_to_left_and_names_each_variety(self):
        ara = self.shelf('ara')
        lang = self.built['ara']['languages']['ara']
        self.assertEqual((lang['dir'], lang['script'], lang['font']), ('rtl', 'arab', 'naskh'))
        self.assertEqual([r['id'] for r in ara[:2]], ['ara-text-arbvdv', 'ara-ab-arbvdv-isa-fb-n'])
        for r in ara:
            self.assertRegex(r['native'], '[\u0600-\u06FF]', r['id'])
            if r.get('scope'):
                self.assertTrue(r['langName'].startswith('العربية · '), r['id'])
        egyptian = {r['id'] for r in ara if r.get('scope') == 'Egyptian Arabic'}
        self.assertIn('ara-text-arzvdv', egyptian)
        self.assertIn('ara-film-arz-arabic-egyptian-colloquial-jesus', egyptian)
        juba = [r for r in ara if r.get('scope') == 'Juba Arabic']
        self.assertEqual(len(juba), 12)
        # JESUS pages that list the Visual Bible Acts chapters carry only JESUS's own.
        for r in ara:
            if '/video/jesus/' in r['source']:
                for u in urls(r):
                    self.assertNotIn('Acts73', u, r['id'])
        sudanese = next(r for r in ara if r['id'] == 'ara-ab-apdsim-fcbh-nt-n')['play']
        self.assertEqual(sudanese['missingChapters']['Luke'], [4, 15, 19])
        davar = next(r for r in ara if r['id'] == 'ara-ab-arzpor-davr-fb-n')['play']
        self.assertEqual(davar['dirs'], {'OT': '01 OT_ARZPOR', 'NT': '02 NT_ARZPOR'})
        left_out = self.built['ara']['notCarried']
        for u in ('https://dbs.org/video/ps/arb_ps_adamawa_fulfulde_of_nigeria_arabic',
                  'https://dbs.org/bibles/historic/Tajiki-1992-Genesis-Portion',
                  'https://dbs.org/bibles/audio/ARZBIB_DAVR_FB_N', 'https://dbs.org/bibles/audio/SHUBSC_DAVR_OT_N'):
            self.assertIn(u, left_out)
        ids = {r['id'] for r in ara}
        for n in ('67597', '67202', '67633', '65954', '4141', '38024'):
            self.assertNotIn('ara-grn-' + n, ids)
            self.assertIn('https://globalrecordings.net/en/program/' + n, left_out)

    def test_pages_routes_worker_and_interface(self):
        sw = (ROOT / 'app/sw.js').read_text()
        vercel = json.loads((ROOT / 'vercel.json').read_text())
        routes = {r['source']: r['destination'] for r in vercel['rewrites']}
        i18n = (ROOT / 'app/assets/js/i18n.js').read_text()
        privacy = (ROOT / 'app/assets/js/analytics.js').read_text()
        for code, (slug, ui, _) in SHELVES.items():
            page = (ROOT / f'app/{slug}/index.html').read_text()
            self.assertIn(f'"lang":"{code}","ui":"{ui}","slug":"{slug}"', page)
            self.assertIn(f'data/catalog-{code}.js', page)
            self.assertIn(f"'{slug}/index.html', 'data/catalog-{code}.js'", sw)
            # Kuria uses the Swahili interface, whose own code is the Swahili page's route.
            for path in (slug, code) + ((ui,) if ui != 'swh' else ()):
                self.assertEqual(routes['/' + path], f'/{slug}/index.html')
            self.assertIn(f"{{ code: '{ui}',", i18n)
            self.assertIn(f'STRINGS.{ui} = {{', i18n)
            self.assertRegex(privacy, r'\n    ' + ui + r': \{\n      title: ')
            self.assertTrue((ROOT / f'app/data/catalog-{code}.js').exists())
            self.assertTrue(any(c['lang'] == code for c in self.cards.values()))

    def test_haitian_creole_keeps_its_own_spelling(self):
        hat = self.shelf('hat')
        ab = next(r for r in hat if r['type'] == 'audio-bible')
        self.assertEqual(ab['play']['books'][:3], ['Psalms', 'Proverbs', 'Matthew'])
        self.assertEqual(ab['play']['bookNames']['Romans'], 'Ròm')
        self.assertEqual(len([r for r in hat if r['type'] == 'film']), 9)
        for r in hat:
            self.assertNotIn('+', r['id'])
        story = next(r for r in hat if r['id'] == 'hat-storyset')
        self.assertEqual(story['play']['items'][5]['title'], '6. Jezi fèt')
        self.assertEqual(self.built['hat']['languages']['hat']['native'], 'Kreyòl ayisyen')

    def test_kuria_carries_everything_dbs_hosts(self):
        kuj = self.shelf('kuj')
        self.assertEqual([r['id'] for r in kuj][:2], ['kuj-ab-kujifb-davr-fb-n', 'kuj-film-kuj-kuria-jesus'])
        ab = kuj[0]
        self.assertEqual(self.audit['kuj']['audio_bibles'][ab['source']]['chapters_verified'], 1189)
        self.assertEqual(ab['play']['testaments'], ['OT', 'NT'])
        self.assertEqual(ab['play']['bookNames']['Mark'], 'Marko')
        self.assertEqual(ab['play']['bookNames']['Jude'], 'Yuda')
        film = kuj[1]
        self.assertEqual(len(film['play']['items']), 61)
        self.assertEqual(film['native'], 'Yesu')
        self.assertEqual(len([r for r in kuj if r['id'].startswith('kuj-grn-')]), 9)
        story = next(r for r in kuj if r['id'] == 'kuj-storyset')
        self.assertEqual(len(story['play']['items']), 40)
        self.assertEqual(story['play']['items'][0]['title'], '1. Uumbaji')
        self.assertIn('https://dbs.org/bibles/audio/KUJBSK_DAVR_FB_N', self.built['kuj']['notCarried'])
        page = (ROOT / 'app/kuria/index.html').read_text()
        self.assertIn('"lang":"kuj","ui":"swh","slug":"kuria"', page)
        for alias in ('igikuria', 'kikuria', 'kurya'):
            self.assertIn('{ "source": "/' + alias + '", "destination": "/kuria/index.html" }', (ROOT / 'vercel.json').read_text())

    def test_spanish_leads_with_reina_valera_and_names_each_variety(self):
        spa = self.shelf('spa')
        bibles = [r['id'] for r in spa if r['type'] in ('scripture', 'audio-bible')]
        self.assertEqual(bibles[:3], ['spa-text-sparv09', 'spa-ab-sparv09-isa-fb-n', 'spa-ab-sparv00-asm-fb-n'])
        self.assertEqual(len(bibles), 12)
        rv = spa[0]
        self.assertEqual(rv['read']['kind'], 'pdf')
        ab = spa[1]
        self.assertEqual(ab['play']['bookNames']['Revelation'], 'Apocalipsis')
        self.assertEqual(ab['dbsListedUrl'], 'https://dbs.org/bibles/SPARV09')
        films = {r['id']: r for r in spa if r['type'] == 'film'}
        self.assertEqual(len(films), 28)
        cast = films['spa-film-spa-spanish-castilian-jesus']
        self.assertEqual(cast['native'], 'JESÚS (castellano)')
        self.assertEqual(cast['play']['items'][0]['title'], '1. El comienzo')
        self.assertEqual(len(cast['play']['items']), 61)
        latin = films['spa-film-spa-spanish-latin-american-jesus']
        self.assertEqual(latin['langName'], 'Español · Latinoamérica')
        for u in urls(latin):
            self.assertNotIn('book-of-acts', u)
        lumo = films['spa-film-spa-spanish-john']
        self.assertTrue(all('Reina-Valera-Contemporanea' in i['file'] for i in lumo['play']['items']))
        left_out = self.built['spa']['notCarried']
        for n in ('66810', '66811', '38331', '66862'):
            self.assertIn('https://globalrecordings.net/en/program/' + n, left_out)
        self.assertEqual(self.built['spa']['languages']['spa']['native'], 'Español')
        visibility = (ROOT / 'app/assets/js/visibility.js').read_text()
        self.assertIn("spa: ['spa-text-sparv09']", visibility)

    def test_luhya_shelves_carry_everything_dbs_hosts(self):
        lsm = self.shelf('lsm')
        self.assertEqual([r['id'] for r in lsm][:3],
                         ['lsm-text-lsmbsu', 'lsm-ab-lsmbsu-davr-fb-n', 'lsm-film-lsm-samia-jesus'])
        self.assertEqual(lsm[0]['read']['kind'], 'pdf')
        self.assertEqual(lsm[0]['org'], 'Bible Society of Uganda')
        self.assertEqual(lsm[1]['play']['bookNames']['Mark'], 'Marko')
        self.assertEqual(len([r for r in lsm if r['id'].startswith('lsm-grn-')]), 10)
        bxk = self.shelf('bxk')
        self.assertEqual(bxk[0]['id'], 'bxk-ab-bxkbsk-davr-fb-n')
        self.assertEqual(bxk[0]['native'], 'Ebibilia Endakatifu')
        # The Bukusu picker shows only abbreviations; the Swahili names stand in.
        self.assertEqual(bxk[0]['play']['bookNames']['Genesis'], 'Mwanzo')
        luke = next(r for r in bxk if r['id'] == 'bxk-ab-bxkbxk-fcbh-np-n')
        self.assertEqual(luke['play']['books'], ['Luke'])
        luy = self.shelf('luy')
        self.assertEqual(luy[0]['id'], 'luy-film-luy-oluluyia-luke')
        varieties = {r.get('scope') for r in luy if r['id'].startswith('luy-grn-')}
        self.assertEqual(varieties, {'Bukusu', 'Logooli', 'Idakho', 'Tachoni', 'Bunyala', 'Kabras', 'Isukha',
                                     'Marachi', 'Wanga', 'Samia'})
        samia = next(r for r in luy if r['id'] == 'luy-grn-65483')
        self.assertEqual(samia['title'], 'LLL 1 Beginning with GOD — Samia')
        self.assertEqual(samia['native'], 'Tazama, Sikiliza, Uishi 1: Ohuchaka nende Nyasaye')
        for r in lsm + bxk + luy:
            if r['type'] == 'film':
                self.assertIsInstance(r['org'], str)
        vercel = (ROOT / 'vercel.json').read_text()
        for slug, aliases in (('saamia', ('samia', 'olusaamia', 'lusamia')), ('luhya', ('oluluhya', 'luyia', 'oluluyia')),
                              ('bukusu', ('lubukusu', 'babukusu'))):
            for alias in aliases:
                self.assertIn('{ "source": "/' + alias + '", "destination": "/' + slug + '/index.html" }', vercel)


    def test_maragoli_idakho_and_tiriki(self):
        rag = self.shelf('rag')
        self.assertEqual(rag[0]['id'], 'rag-ab-ragbsk19-davr-ot-n')
        # DBS's Lulogooli book names are kept, not replaced by the Swahili ones.
        self.assertEqual(rag[0]['play']['bookNames']['Genesis'], 'Litanga')
        self.assertEqual(rag[0]['play']['bookNames']['1Chronicles'], "1 Zing'inga")
        self.assertEqual(len([r for r in rag if r['id'].startswith('rag-grn-')]), 8)
        self.assertFalse(any(r.get('scope') for r in rag))
        self.assertIn('moved', self.built['rag']['notCarried']['https://dbs.org/bibles/audio/RAGBSK_DAVR_OT_N'])
        ida = {r['id']: r for r in self.shelf('ida')}
        self.assertEqual(ida['ida-film-ida-tiriki-jesus']['scope'], 'Tiriki')
        self.assertNotIn('scope', ida['ida-film-ida-lukakamega-mark'])
        self.assertEqual(ida['ida-grn-18971']['scope'], 'Idakho')
        self.assertEqual(ida['ida-grn-23261']['scope'], 'Isukha')
        # One shelf, two pages: /tiriki names itself and loads the same catalogue.
        tiriki = (ROOT / 'app/tiriki/index.html').read_text()
        self.assertIn('"lang":"ida","ui":"swh","slug":"tiriki","name":"Tiriki","native":"Lutirichi"', tiriki)
        self.assertIn('data/catalog-ida.js', tiriki)
        self.assertIn("'tiriki/index.html'", (ROOT / 'app/sw.js').read_text())
        vercel = (ROOT / 'vercel.json').read_text()
        for slug, aliases in (('maragoli', ('lulogooli', 'logooli', 'luragoli', 'maragooli')),
                              ('idakho', ('luidakho', 'lwidakho', 'isukha', 'lwisukha')),
                              ('tiriki', ('tiriki', 'lutirichi', 'lutiriki'))):
            for alias in aliases:
                self.assertIn('{ "source": "/' + alias + '", "destination": "/' + slug + '/index.html" }', vercel)
        mail = (ROOT / 'packer/library_mail.py').read_text()
        for slug in ('maragoli', 'idakho', 'tiriki'):
            self.assertIn(f'"{slug}": (', mail)

    def test_kabras_tachoni_banyala_and_marachi(self):
        luy = self.shelf('luy')
        for code, slug, variety, films in (('lkb', 'kabras', 'Kabras', 1), ('lts', 'tachoni', 'Tachoni', 1),
                                           ('nle', 'banyala', 'Bunyala', 1), ('lri', 'marachi', 'Marachi', 0)):
            shelf = self.shelf(code)
            self.assertEqual(len([r for r in shelf if r['type'] == 'film']), films, code)
            self.assertFalse(any(r.get('scope') for r in shelf), code)
            # Every one of the variety's programmes in DBS's Luyia collection, and no other variety's.
            grn = {r['id'].rsplit('-', 1)[1] for r in shelf if r['id'].startswith(code + '-grn-')}
            self.assertEqual(grn, {r['id'].rsplit('-', 1)[1] for r in luy if r.get('scope') == variety}, code)
            page = (ROOT / f'app/{slug}/index.html').read_text()
            self.assertIn(f'"lang":"{code}","ui":"swh","slug":"{slug}"', page)
            self.assertIn(f'data/catalog-{code}.js', page)
            self.assertIn(f"'{slug}/index.html', 'data/catalog-{code}.js'", (ROOT / 'app/sw.js').read_text())
        nle = self.shelf('nle')
        self.assertEqual(nle[0]['id'], 'nle-ab-nleufw-fcbh-nt-n')
        self.assertEqual(nle[0]['play']['bookNames']['Matthew'], 'Mathayo')
        self.assertEqual(self.shelf('lkb')[0]['id'], 'lkb-film-lkb-lukabaras-jesus')
        self.assertEqual(self.shelf('lts')[0]['id'], 'lts-film-lts-olutachoni-jesus')
        vercel = (ROOT / 'vercel.json').read_text()
        for slug, aliases in (('kabras', ('kabras', 'lukabaras', 'lkb')), ('tachoni', ('tachoni', 'lutachoni', 'lts')),
                              ('banyala', ('banyala', 'olunyala', 'bunyala', 'nle')), ('marachi', ('marachi', 'olumarachi', 'lri'))):
            for alias in aliases:
                self.assertIn('{ "source": "/' + alias + '", "destination": "/' + slug + '/index.html" }', vercel)
            self.assertIn(f'"{slug}": (', (ROOT / 'packer/library_mail.py').read_text())

    def test_kamba_and_kalenjin(self):
        kam, kln = self.shelf('kam'), self.shelf('kln')
        self.assertEqual(kam[0]['id'], 'kam-ab-kamkkb-davr-fb-n')
        self.assertEqual(kam[0]['play']['bookNames']['Genesis'], 'Mwanzo')      # DBS gives only "Mwa"
        self.assertEqual(kln[0]['id'], 'kln-ab-klnbsc-davr-fb-n')
        self.assertEqual(kln[0]['play']['bookNames']['Genesis'], 'Taunet')      # Kalenjin names stay
        self.assertEqual(kln[0]['play']['bookNames']['Exodus'], "Komong'u")
        # The JESUS dubs come from the Kipsigis and Nandi pages and name their dialect.
        films = {r['id']: r.get('scope') for r in kln if r['type'] == 'film'}
        self.assertEqual(films, {'kln-film-kln-kalenjin-mark': None, 'kln-film-sgc-kalenjin-kipsigis-jesus': 'Kipsigis',
                                 'kln-film-niq-nandi-jesus': 'Nandi'})
        self.assertEqual([r.get('scope') for r in kam if r['type'] == 'film'], [None])
        # Every Kalenjin GRN programme names its dialect; each is carried once.
        self.assertTrue(all(r.get('scope') for r in kln if r['type'] == 'audio'))
        for code, slug in (('kam', 'kamba'), ('kln', 'kalenjin')):
            page = (ROOT / f'app/{slug}/index.html').read_text()
            self.assertIn(f'"lang":"{code}","ui":"swh","slug":"{slug}"', page)
            self.assertIn(f'data/catalog-{code}.js', page)
            self.assertIn(f"'{slug}/index.html', 'data/catalog-{code}.js'", (ROOT / 'app/sw.js').read_text())
            self.assertIn(f'"{slug}": (', (ROOT / 'packer/library_mail.py').read_text())
        vercel = (ROOT / 'vercel.json').read_text()
        for slug, aliases in (('kamba', ('kamba', 'kikamba', 'akamba', 'kam')), ('kalenjin', ('kalenjin', 'kln', 'kipsigis', 'nandi'))):
            for alias in aliases:
                self.assertIn('{ "source": "/' + alias + '", "destination": "/' + slug + '/index.html" }', vercel)

    def test_giryama_digo_and_duruma(self):
        for code, slug, films in (('nyf', 'giryama', 5), ('dig', 'digo', 4), ('dug', 'duruma', 5)):
            shelf = self.shelf(code)
            # A text Bible (PDF to read), a whole audio Bible and the films, all in the language.
            self.assertEqual([r['type'] for r in shelf[:2]], ['scripture', 'audio-bible'], code)
            self.assertEqual(shelf[0]['read']['kind'], 'pdf', code)
            self.assertEqual(len([r for r in shelf if r['type'] == 'film']), films, code)
            self.assertFalse(any(r.get('scope') for r in shelf if r['type'] == 'film'), code)
            page = (ROOT / f'app/{slug}/index.html').read_text()
            self.assertIn(f'"lang":"{code}","ui":"swh","slug":"{slug}"', page)
            self.assertIn(f"'{slug}/index.html', 'data/catalog-{code}.js'", (ROOT / 'app/sw.js').read_text())
            self.assertIn(f'"{slug}": (', (ROOT / 'packer/library_mail.py').read_text())
        # Digo's picker names its books in Digo; Giryama's and Duruma's give English, so they take Swahili.
        self.assertEqual(self.shelf('dig')[1]['play']['bookNames']['Genesis'], 'Mwandzo')
        self.assertEqual(self.shelf('nyf')[1]['play']['bookNames']['Genesis'], 'Mwanzo')
        self.assertEqual(self.shelf('dug')[1]['play']['bookNames']['Genesis'], 'Mwanzo')
        vercel = (ROOT / 'vercel.json').read_text()
        for slug, aliases in (('giryama', ('giryama', 'giriama', 'nyf')), ('digo', ('digo', 'chidigo', 'dig')),
                              ('duruma', ('duruma', 'chiduruma', 'dug'))):
            for alias in aliases:
                self.assertIn('{ "source": "/' + alias + '", "destination": "/' + slug + '/index.html" }', vercel)


if __name__ == '__main__':
    unittest.main()
