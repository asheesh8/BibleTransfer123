"""Xhosa, Chichewa, Kinyarwanda and Shona: complete, verified and DBS-hosted."""
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
           'kin': ('kinyarwanda', 'rw', 26), 'sna': ('shona', 'sn', 32)}


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
        total = 0
        for code in SHELVES:
            audit = self.audit[code]['audio_bibles']
            for r in self.shelf(code):
                if r['type'] != 'audio-bible':
                    continue
                books = audit[r['source']]['books']
                self.assertEqual(audit[r['source']]['bad'], [])
                self.assertEqual(audit[r['source']]['chapters_verified'], sum(len(b['chapters']) for b in books))
                total += audit[r['source']]['chapters_verified']
                p = r['play']
                self.assertEqual(len(p['bookNames']), len(books))
                self.assertTrue(all(not n.isupper() for n in p['bookNames'].values()), r['id'])
        self.assertEqual(total, 1189 * 4 + 260 * 2 + 24)

    def test_moved_audio_bibles_are_left_out(self):
        moved = {'https://dbs.org/bibles/audio/NYABSM04605_DAVR_FB_N',
                 'https://dbs.org/bibles/audio/NYABSMW00333_DAVR_FB_N',
                 'https://dbs.org/bibles/audio/KINBSR_DAVR_OT_N'}
        carried = {r['source'] for c in SHELVES for r in self.shelf(c)}
        self.assertFalse(moved & carried)
        for u in moved:
            code = 'kin' if 'KIN' in u else 'nya'
            self.assertIn('moved', self.built[code]['notCarried'][u])

    def test_jesus_chapters_stay_with_the_dialect_that_recorded_them(self):
        for code in ('kin', 'sna'):
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

    def test_traditional_editions_lead_and_no_inclusive_translation_is_carried(self):
        nya = [r for r in self.shelf('nya') if r['type'] == 'audio-bible']
        self.assertEqual(nya[0]['native'], 'Buku Lopatulika ndilo Mau a Mulungu')
        sna = [r for r in self.shelf('sna') if r['type'] in ('scripture', 'audio-bible')]
        self.assertEqual(sna[0]['id'], 'sna-text-snaold')
        for code in SHELVES:
            for r in self.shelf(code):
                self.assertIsNone(excluded(r), r['id'])
                self.assertNotRegex(r['title'] + ' ' + r['native'], re.compile(r'inclusive|queen james', re.I))

    def test_unconfirmed_programmes_are_not_carried(self):
        ids = {r['id'] for r in self.shelf('kin')}
        for n in ('67900', '85249', '79090', '81791'):
            self.assertNotIn('kin-grn-' + n, ids)
            self.assertIn('https://globalrecordings.net/en/program/' + n, self.built['kin']['notCarried'])

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
