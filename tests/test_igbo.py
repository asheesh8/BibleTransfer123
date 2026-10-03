"""Complete Igbo inventory, dialect correctness and verified chapter availability."""
import json
import pathlib
import unittest
from packer.et import catalog, build
from packer.et.curation import RETIRED, IGBO_EXTERNAL, curate
from packer.et.profiles import PROFILES
from packer.import_dbs_rendered import LANGUAGES, urls_in

ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'catalog/source'

class IgboTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lib=catalog.load(ROOT/'catalog/resources.json')
        cls.resources=[r for r in cls.lib['resources'] if r['lang']=='ibo']
        cls.byid={r['id']:r for r in cls.resources}
        cls.audit=json.loads((SOURCE/'dbs-rendered-igbo-2026-10-03.json').read_text())['ibo']
        cls.media=json.loads((SOURCE/'dbs-media-igbo-2026-10-03.json').read_text())
        cls.probes={p['url']:p for p in cls.media['verified_files']['results']}
        cls.packed=build.card_catalog(cls.lib,[],PROFILES['pocket'],{})
        cls.cards={r['id']:r for r in cls.packed['resources'] if r['lang']=='ibo'}

    def test_every_listed_resource_is_accounted_for(self):
        self.assertEqual(LANGUAGES['ibo'],('ibo','Igbo',''))
        captured={a['href'] for group in self.audit.values() for a in group['links']}
        self.assertEqual(len(captured),32)
        self.assertEqual(len(self.resources),28)
        self.assertEqual(captured-set(urls_in(self.resources)),set(self.media['excluded']))
        self.assertTrue(set(self.media['excluded'])<=RETIRED)
        for u in self.media['excluded']:self.assertIn('has moved',self.media['pages'][u]['text'])

    def test_films_keep_correct_dialects_and_full_chapter_lists(self):
        films=[r for r in self.resources if r['type']=='film']
        self.assertEqual(len(films),13)
        for r in films:
            card=self.cards[r['id']]
            self.assertTrue(card['play'],r['id']);self.assertTrue(card['files'],r['id'])
            if r['play']['kind']=='chapters':
                self.assertEqual(r['play']['items'],card['play']['items'])
                published={a['url'] for a in self.media['pages'][r['source']]['links']}
                self.assertTrue({i['file'] for i in r['play']['items']}<=published)
            else:
                self.assertTrue(self.probes[r['play']['sd']]['valid'])
                self.assertTrue(all(f['label'].startswith('Vidio') for f in card['files']))
        for variety in ['ehugbo','igbo']:
            r=self.byid['ibo-film-ibo_'+variety+'_jesus']
            self.assertEqual(r['play']['kind'],'file')
            self.assertFalse(any('ibo_enuani' in d['url'] for d in r['downloads']))
            self.assertIn(r['source'],self.media['wrong_regional_chapter_links'])
        enuani=self.byid['ibo-film-ibo_enuani_jesus']
        self.assertEqual(len(enuani['play']['items']),61)
        self.assertEqual(len({self.byid['ibo-film-ibo_'+v+'_jesus']['downloads'][0]['url'] for v in ['igbo','enuani','ehugbo']}),3)
        acts=self.byid['ibo-film-ibo_igbo_acts']['play']['items']
        self.assertEqual(len(acts),5);self.assertEqual(acts[0]['title'],'Vidio zuru ezu')
        self.assertEqual(acts[1]['title'],'Akụkụ 1')

    def test_current_bibles_disclose_and_disable_the_single_missing_chapter(self):
        bibles=[r for r in self.resources if r['type']=='audio-bible']
        self.assertEqual(len(bibles),3)
        for r in bibles:
            self.assertTrue(self.cards[r['id']]['play']['saveChapter'])
            if r['play']['version'].startswith('IBO'):
                names=r['play']['bookNames']
                self.assertEqual(len(names),66)
                self.assertEqual(names['Genesis'],'Jenesis')
                self.assertEqual(self.cards[r['id']]['play']['bookNames'],names)
        r=self.byid['ibo-ab-ibobib-davr-fb-n']
        self.assertEqual(r['play']['missingChapters'],{'Judges':[18]})
        self.assertEqual(self.cards[r['id']]['play']['missingChapters'],{'Judges':[18]})
        self.assertIn('18',r['desc'])
        available=self.media['chapter_availability']['chapters']
        self.assertEqual(available,[n for n in range(1,22) if n!=18])
        missing=[p for p in self.probes.values() if p.get('status')==404]
        self.assertEqual(len(missing),1);self.assertIn('07_Judges_018.mp3',missing[0]['url'])
        for r in bibles:
            chapterfiles=[p for u,p in self.probes.items() if '/'+r['play']['fileset']+'/' in u]
            self.assertEqual(sum(bool(p.get('valid')) for p in chapterfiles),260 if r['play']['version']=='IGRNBT' else 1188 if r['play']['version']=='IBOBIB' else 1189)

    def test_all_recordings_and_checked_archives_survive_packing(self):
        collection=self.byid['ibo-ac-ibo_globalrecordings_igbo']
        self.assertEqual(len(collection['play']['items']),29)
        for r in [collection]+[r for r in self.resources if r['id'].startswith('ibo-grn-')]:
            items=r['play']['items'];urls={i['file'] for i in items}
            self.assertEqual({i['file'] for i in self.cards[r['id']]['play']['items']},urls)
            self.assertTrue(urls<={a.url for a in catalog.assets_for(r)})
            self.assertTrue(all(self.probes[u]['valid'] for u in urls))
        self.assertEqual([len(self.byid['ibo-grn-'+n]['play']['items']) for n in ['1010','1670','5650']],[18,4,6])
        archives=self.media['browser_archives']
        self.assertTrue(all(a['crc_valid'] for a in archives))
        self.assertEqual([a['mp3_files'] for a in archives if 'grn/' in a['url']],[29,29])
        text=self.byid['ibo-text-ibobib']
        self.assertTrue(any(d['url'].endswith('/html_IBOBIB.zip') for d in text['downloads']))
        self.assertTrue(any(a.get('entries')==74 for a in archives))

    def test_six_actual_scan_pdfs_are_readable(self):
        scans=[r for r in self.resources if r['type']=='historic']
        self.assertEqual(len(scans),6)
        for r in scans:
            u=r['read']['url'];self.assertTrue(self.probes[u]['valid'])
            self.assertTrue(self.probes[u]['signature'].startswith('25504446'))
            self.assertIn('/books/',u)
            self.assertEqual(self.cards[r['id']]['read']['file'],u)
        self.assertIn('Agba Ọhụrụ',self.byid['ibo-scan-igbo-new-testament-print']['native'])

    def test_exact_publisher_exception_is_scoped_to_igbo(self):
        self.assertEqual(len(IGBO_EXTERNAL),14)
        for u in IGBO_EXTERNAL:
            r={'lang':'ibo','type':'link','title':'Publisher','links':[{'label':'Publisher','url':u}]}
            self.assertEqual(len(curate([r])[0]),1)
            r['lang']='eng';self.assertFalse(curate([r])[0])
        for u in ['https://stream.mux.com/other-film/270p.mp4','https://globalrecordings.net/en/program/999','https://youtu.be/example']:
            r={'lang':'ibo','type':'film','title':'Film','play':{'kind':'file','sd':u},'downloads':[{'label':'File','url':u}]}
            self.assertFalse(curate([r])[0])
