"""All four Oromo inventories remain usable through curation and packing."""
import json
import pathlib
import unittest
from packer.et import catalog, build
from packer.et.curation import RETIRED, OROMO_EXTERNAL, curate
from packer.et.profiles import PROFILES
from packer.import_dbs_rendered import urls_in

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'catalog/source'

class OromoTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lib=catalog.load(ROOT/'catalog/resources.json')
        cls.resources=[r for r in cls.lib['resources'] if r['lang']=='orm']
        cls.byid={r['id']:r for r in cls.resources}
        cls.audit=json.loads((SOURCE/'dbs-rendered-2026-10-03.json').read_text())
        cls.media=json.loads((SOURCE/'dbs-media-oromo-2026-10-03.json').read_text())
        cls.packed=build.card_catalog(cls.lib,[],PROFILES['pocket'],{})
        cls.cards={r['id']:r for r in cls.packed['resources'] if r['lang']=='orm'}

    def test_every_listing_in_all_four_varieties_is_accounted_for(self):
        self.assertEqual(set(self.audit),{'orm','gaz','hae','gax'})
        captured={i['href'] for groups in self.audit.values() for group in groups.values() for i in group['links']}
        self.assertEqual(len(captured),93)
        self.assertEqual(len(self.resources),86)
        self.assertEqual(captured-set(urls_in(self.resources)),set(self.media['excluded']))
        self.assertTrue(set(self.media['excluded'])<=RETIRED)
        for u in self.media['excluded']:
            self.assertIn('has moved',self.media['pages'][u]['text'])

    def test_all_films_keep_complete_playback_and_save_choices(self):
        films=[r for r in self.resources if r['type']=='film']
        self.assertEqual(len(films),20)  # 19 DBS films plus Yaadanii.
        for r in films:
            card=self.cards[r['id']]
            self.assertTrue(card['play'],r['id'])
            self.assertTrue(card['files'],r['id'])
            if r['play']['kind']=='chapters':
                expected=r['play']['items']
                self.assertEqual(len(card['play']['items']),len(expected))
                self.assertEqual({i['file'] for i in expected},{i['file'] for i in card['play']['items']})
            else:
                self.assertEqual(card['play']['kind'],'video')
                self.assertEqual(card['play']['file'],r['play']['sd'])
        self.assertEqual(sum(len(r['play']['items']) for r in films if '/video/jesus/' in r['source']),244)
        guji=self.byid['orm-film-gax_guji_jesus']
        self.assertEqual(guji['scope'],'Guji')
        self.assertIn('Guji',guji['native'])

    def test_recordings_are_playable_and_mixed_archives_are_disclosed(self):
        collections=[r for r in self.resources if r['id'].startswith('orm-ac-')]
        self.assertEqual(len(collections),6)
        expected=[281,8,725,14,444,39]
        self.assertEqual([len(r['play']['items']) for r in collections],expected)
        for r in collections:
            items=r['play']['items'];urls={i['file'] for i in items}
            self.assertEqual({i['file'] for i in self.cards[r['id']]['play']['items']},urls)
            self.assertTrue(urls<={a.url for a in catalog.assets_for(r)})
            self.assertEqual(self.cards[r['id']]['files'][0]['label'], items[0]['title'] + ' (MP3)')
            self.assertFalse(any('/Orma/' in u or '/Afan%20Munyoyaya/' in u for u in urls))
        mixed=next(r for r in collections if '/orm_' in r['source'])
        for d in mixed['downloads']:
            if d['url'].endswith('.zip'):
                self.assertIn('Orma fi Munyoyaya',d['label'])
        probes={p['url']:p for p in self.media['verified_files']['results']}
        for r in collections:
            self.assertTrue(all(probes[i['file']]['valid'] for i in r['play']['items']))
        programmes=[r for r in self.resources if r['id'].startswith('orm-grn-')]
        self.assertEqual(len(programmes),44)
        self.assertTrue(all(r['play']['items'] for r in programmes))

    def test_current_bibles_keep_their_own_published_book_names(self):
        bibles=[r for r in self.resources if r['type']=='audio-bible']
        self.assertEqual(len(bibles),4)
        for r in bibles:
            play=r['play'];packed=self.cards[r['id']]['play']
            self.assertTrue(packed['saveChapter'])
            names=self.media['book_names'][play['fileset']]
            self.assertEqual(packed['bookNames'],names)
            self.assertEqual(len(names),39 if play['testaments']==['OT'] else 66)
        self.assertIn('Old Testament',self.byid['orm-ab-gazgaz-davr-ot-n']['title'])
        self.assertIn('full audio Bible',self.byid['orm-ab-gaxwfw-davr-fb-n']['title'])
        pdfs={d['url'] for r in self.resources for d in r['downloads'] if d['url'].endswith('.pdf')}
        self.assertEqual(len(pdfs),6)
        probes={p['url']:p for p in self.media['verified_files']['results']}
        self.assertTrue(all(probes[u]['valid'] and probes[u]['signature'].startswith('25504446') for u in pdfs))
        self.assertFalse(any(d['url'].endswith('.epub') or '/audio_zip/' in d['url'] for r in bibles for d in r['downloads']))

    def test_external_exception_does_not_widen_other_language_shelves(self):
        for u in OROMO_EXTERNAL:
            r={'lang':'orm','type':'link','title':'Publisher','links':[{'label':'Publisher','url':u}]}
            self.assertEqual(len(curate([r])[0]),1)
            r['lang']='eng';self.assertFalse(curate([r])[0])
        for u in ['https://example.org/film.mp4','https://rockintl.org/another-programme/']:
            r={'lang':'orm','type':'film','title':'Film','play':{'kind':'file','sd':u},'downloads':[{'label':'File','url':u}]}
            self.assertFalse(curate([r])[0])
