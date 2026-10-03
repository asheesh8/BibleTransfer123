"""Amharic source completeness, actual files and partial audio Bible behavior."""
import json
import pathlib
import re
import unittest
from packer.et import catalog, build
from packer.et.curation import curate, AMHARIC_EXTERNAL, AMHARIC_EXCLUDED
from packer.et.profiles import PROFILES
from packer.import_dbs_rendered import LANGUAGES, urls_in
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'catalog/source'

class AmharicTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lib = catalog.load(ROOT / 'catalog/resources.json')
        cls.resources = [r for r in cls.lib['resources'] if r['lang'] == 'amh']
        cls.cards = {r['id']: r for r in build.card_catalog(cls.lib, [], PROFILES['pocket'], {})['resources'] if r['lang'] == 'amh'}
        cls.media = json.loads((SOURCE / 'dbs-media-amharic-2026-10-03.json').read_text())
        cls.audit = json.loads((SOURCE / 'dbs-rendered-amharic-2026-10-03.json').read_text())['amh']
        cls.probes = cls.media['verified_files']

    def test_every_listed_url_is_included_or_explained(self):
        listed = {a['href'] for group in self.audit.values() for a in group['links']}
        self.assertEqual(len(listed), 62)
        self.assertEqual(len(self.resources), 46)
        self.assertEqual(listed - set(urls_in(self.resources)), set(self.media['excluded']))
        self.assertEqual(LANGUAGES['amh'], ('amh', 'Amharic', 'አማርኛ'))
        self.assertFalse([r for r, _ in self.lib['excluded'] if r['lang'] == 'amh'])
        for r in self.resources:
            self.assertRegex(r['native'], '[\u1200-\u137f]')
            card = self.cards[r['id']]
            self.assertTrue(card['play'] or card['read'] or card['links'])

    def test_audio_bible_book_selection_matches_published_chapters(self):
        bibles = [r for r in self.resources if r['type'] == 'audio-bible']
        self.assertEqual(len(bibles), 3)
        total = 0
        for r in bibles:
            play = r['play']
            files = [v for u, v in self.probes.items() if '/' + play['fileset'] + '/' in u]
            expected = 410 if play['fileset'].startswith('AMHSDV') else 1189 if play['fileset'].startswith('AMHNHS') else 260
            self.assertEqual(len(files), expected)
            self.assertTrue(all(v['valid'] for v in files))
            total += len(files)
            self.assertEqual(len(play['bookNames']), 66)
            self.assertEqual(play['bookNames']['3John'], '3ኛ ዮሐንስ')
            if play['fileset'].startswith('AMHSDV'):
                self.assertEqual(len(play['books']), 28)
                self.assertEqual(play['books'][0], 'Psalms')
                self.assertNotIn('Genesis', play['books'])
                self.assertEqual(self.cards[r['id']]['play']['books'], play['books'])
            else:
                self.assertNotIn('books', self.cards[r['id']]['play'])
        self.assertEqual(total, 1859)

    def test_bibleproject_keeps_each_published_episode_and_low_data_source(self):
        for slug, count in [('amh-amharic-overview', 72), ('amh-amharic-themes', 23)]:
            r = next(r for r in self.resources if r['source'].endswith('/' + slug))
            items = r['play']['items']
            published = self.media['pages'][r['source']]['episodes']
            self.assertEqual(len(items), count)
            self.assertEqual(len({i['file'] for i in items}), count)
            for i, e in zip(items, published):
                self.assertIn(i['file'], [a['url'] for a in e['links']])
                self.assertIn('_low.mp4', i['file'])
                self.assertNotEqual(self.probes[i['file']].get('status'), 404)
            self.assertEqual(items, self.cards[r['id']]['play']['items'])
            self.assertEqual(self.cards[r['id']]['files'][0]['label'], f'ሁሉም {count} ምዕራፎች')
        over = next(r for r in self.resources if r['source'].endswith('/amh-amharic-overview'))['play']['items']
        self.assertEqual(over[3]['title'], 'ዘጸአት 1-18')
        self.assertIn('Exodus_1-18', over[3]['file'])
        self.assertTrue(over[-1]['title'].endswith('12-22'))
        self.assertIn('Revelation', over[-1]['file'])

    def test_all_recordings_and_zero_padded_programmes_survive_curation(self):
        r = next(r for r in self.resources if r['id'].startswith('amh-ac-amh_global'))
        files = {i['file'] for i in r['play']['items']}
        self.assertEqual(len(files), 281)
        self.assertFalse(files & set(self.media['excluded_recordings']))
        self.assertTrue(all(self.probes[u]['valid'] for u in files))
        self.assertFalse(any(d['url'].endswith('.zip') for d in r['downloads']))
        programmes = [r for r in self.resources if r['id'].startswith('amh-grn-')]
        self.assertEqual(len(programmes), 12)
        self.assertEqual({i['file'] for r in programmes for i in r['play']['items']}, files)
        self.assertEqual(len(self.cards['amh-grn-1420']['play']['items']), 17)
        self.assertEqual(len(self.cards['amh-grn-1421']['play']['items']), 15)
        for r in self.resources:
            if r['type'] == 'audio':
                self.assertEqual(r['play']['items'], self.cards[r['id']]['play']['items'])
        stories = self.cards['amh-ac-amh_storyset_amharic']['play']['items']
        self.assertEqual(len(stories), 58)
        self.assertEqual(stories[45]['title'], 'መጽሐፍ ቅዱሳዊ ታሪክ 46')
        self.assertEqual(stories[-1]['title'], 'መዝሙር 12')

    def test_text_archives_and_additional_films_use_verified_files(self):
        bible = self.cards['amh-text-amhubs']
        self.assertTrue(bible['read']['file'].endswith('.pdf'))
        self.assertTrue(any(f.get('file', '').endswith('.epub') for f in bible['files']))
        self.assertTrue(any(f.get('file', '').endswith('.zip') for f in bible['files']))
        app_download = self.media['app_downloads'][0]
        self.assertTrue(app_download['crc_valid'] and app_download['epub_valid'])
        self.assertRegex(app_download['native_filename'], '[\u1200-\u137f]')
        self.assertEqual(len(self.media['browser_archives']), 2)
        self.assertTrue(all(a['crc_valid'] for a in self.media['browser_archives']))
        self.assertEqual(sum(r['type'] == 'film' for r in self.resources), 19)
        parts = self.cards['amh-film-savior-parts']['play']['items']
        self.assertEqual(len(parts), 9)
        for n, item in enumerate(parts):
            self.assertIn(f'Amharic_{n}-', item['file'])
            self.assertTrue(self.probes[item['file']]['valid'])
        director = self.cards['amh-film-magdalena-directors-cut']
        self.assertTrue(self.probes[director['play']['file']]['valid'])
        self.assertIn('መግደላዊት ማርያም', director['native'])
        for slug in ['amh_amharic_the_hope', 'amh-amharic-ibible_salvation']:
            r = next(r for r in self.resources if r['source'].endswith('/'+slug))
            for quality in ['sd', 'hd']:
                label = next(d['label'] for d in r['downloads'] if d['url'] == r['play'][quality])
                self.assertTrue(label.endswith(' · '+quality.upper()))

    def test_publisher_exceptions_and_exclusions_are_language_scoped(self):
        for url in AMHARIC_EXTERNAL:
            r = {'lang': 'amh', 'type': 'film', 'title': 'Christian film', 'play': {'kind': 'file', 'sd': url}}
            self.assertEqual(len(curate([r])[0]), 1)
            r['lang'] = 'eng'
            self.assertFalse(curate([r])[0])
        for url in AMHARIC_EXCLUDED:
            self.assertFalse(curate([{'lang': 'amh', 'type': 'audio', 'title': 'Imported row', 'source': url, 'links': [{'url': url, 'label': 'Open'}]}])[0])
        self.assertFalse(curate([{'lang': 'amh', 'type': 'film', 'title': 'Film', 'play': {'kind': 'file', 'sd': 'https://stream.mux.com/unknown/720p.mp4'}}])[0])
