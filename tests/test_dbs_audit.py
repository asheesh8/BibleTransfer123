"""Xhosa, Chichewa, Kinyarwanda, Shona, Kirundi, Akan and Tigrinya: complete, verified and DBS-hosted."""
import json
import pathlib
import re
import unittest
from packer.et import catalog, build
from packer.et.curation import excluded
from packer.et.profiles import PROFILES

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATE = '2026-10-06'
SHELVES = {'xho': ('xhosa', 'xh', 13), 'nya': ('chichewa', 'ny', 34),
           'kin': ('kinyarwanda', 'rw', 26), 'sna': ('shona', 'sn', 32),
           'run': ('kirundi', 'rn', 27), 'aka': ('akan', 'ak', 47),
           'tir': ('tigrinya', 'ti', 26)}


def urls(r):
    return re.findall(r'https?://[^"\s]+', json.dumps({k: r.get(k) for k in ('play', 'read', 'downloads')}))


class DbsAuditTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lib = catalog.load(ROOT / 'catalog/resources.json')
        cls.cards = {r['id']: r for r in build.card_catalog(cls.lib, [], PROFILES['pocket'], {})['resources']}
        cls.audit = {c: json.loads((ROOT / f'catalog/source/dbs-audit-{s}-{DATE}.json').read_text())
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
            for path in (slug, code, ui):
                self.assertEqual(routes['/' + path], f'/{slug}/index.html')
            self.assertIn(f"{{ code: '{ui}',", i18n)
            self.assertIn(f'STRINGS.{ui} = {{', i18n)
            self.assertRegex(privacy, r'\n    ' + ui + r': \{\n      title: ')
            self.assertTrue((ROOT / f'app/data/catalog-{code}.js').exists())
            self.assertTrue(any(c['lang'] == code for c in self.cards.values()))


if __name__ == '__main__':
    unittest.main()
