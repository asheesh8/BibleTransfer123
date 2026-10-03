"""French source coverage, native titles, playable inventory and curation scope."""
import json,pathlib,unittest,urllib.parse
from packer.et import catalog,build
from packer.et.curation import curate,FRENCH_EXTERNAL,FRENCH_EXCLUDED
from packer.et.profiles import PROFILES
from packer.import_dbs_rendered import LANGUAGES,urls_in
ROOT=pathlib.Path(__file__).resolve().parents[1];SOURCE=ROOT/'catalog/source'
class FrenchTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.lib=catalog.load(ROOT/'catalog/resources.json');cls.resources=[r for r in cls.lib['resources'] if r['lang']=='fra'];cls.cards={r['id']:r for r in build.card_catalog(cls.lib,[],PROFILES['pocket'],{})['resources'] if r['lang']=='fra'};cls.media=json.loads((SOURCE/'dbs-media-french-2026-10-03.json').read_text());cls.audit=json.loads((SOURCE/'dbs-rendered-french-2026-10-03.json').read_text())['fra'];cls.probes=cls.media['verified_files']
 def test_every_dbs_source_is_carried_or_explicitly_excluded(self):
  listed={a['href'] for g in self.audit.values() for a in g['links']}
  self.assertEqual(len(listed),196);self.assertEqual(len(self.resources),172)
  self.assertEqual(listed-set(urls_in(self.resources)),set(self.media['excluded']))
  self.assertEqual(LANGUAGES['fra'],('fra','French',''))
  self.assertFalse([r for r,w in self.lib['excluded'] if r['lang']=='fra'])
 def test_bibleproject_episodes_have_distinct_correct_downloads(self):
  for slug,count in [('fra-french-overview',73),('fra-french-themes',86)]:
   r=next(r for r in self.resources if r['source'].endswith('/'+slug));items=r['play']['items'];published=self.media['pages'][r['source']]['episodes']
   self.assertEqual(len(items),count);self.assertEqual(len({i['file'] for i in items}),count)
   for i,e in zip(items,published):self.assertIn(i['file'],[a['url'] for a in e['links']]);self.assertNotEqual(self.probes[i['file']].get('status'),404)
   self.assertEqual(items,self.cards[r['id']]['play']['items']);self.assertEqual(self.cards[r['id']]['files'][0]['label'],f'Tous les {count} chapitres')
  over=next(r for r in self.resources if r['source'].endswith('/fra-french-overview'))['play']['items']
  self.assertEqual(over[3]['title'],'Exode 1-18');self.assertIn('Exodus_1-18',over[3]['file'])
  self.assertEqual(over[-1]['title'],'Apocalypse 12-22')
 def test_four_current_audio_bibles_keep_native_books_and_known_missing_files(self):
  bibles=[r for r in self.resources if r['type']=='audio-bible'];self.assertEqual(len(bibles),4)
  for r in bibles:
   p=r['play'];self.assertEqual(len(p['bookNames']),66);self.assertEqual(p['bookNames']['Genesis'],'Genèse');self.assertEqual(p['bookNames']['Revelation'],'Apocalypse')
   matches=[v for u,v in self.probes.items() if '/'+p['fileset']+'/' in u]
   self.assertEqual(len(matches),929 if p['testaments']==['OT'] else 1189)
   expected=p['fileset'] in ['FRAACT_DAVR_FB_N','FRATLS_FCBH_FB_N']
   self.assertEqual(sum(v.get('status')==404 for v in matches),1 if expected else 0)
   self.assertTrue(all(v.get('valid') or v.get('status')==404 for v in matches))
   if expected:self.assertEqual(p['missingChapters'],{'Malachi':[4]});self.assertEqual(self.cards[r['id']]['play']['missingChapters'],p['missingChapters'])
 def test_recordings_and_complete_text_archives_survive_packing(self):
  collection=next(r for r in self.resources if 'fra-ac-fra_global' in r['id']);urls={i['file'] for i in collection['play']['items']}
  self.assertEqual(len(urls),987);self.assertFalse(urls&set(self.media['excluded_recordings']));self.assertTrue(all(self.probes[u]['valid'] for u in urls))
  self.assertFalse(any(d['url'].endswith('.zip') for d in collection['downloads']))
  for r in self.resources:
   if r['type']=='audio' and r.get('play'):self.assertEqual(r['play']['items'],self.cards[r['id']]['play']['items'])
  texts=[r for r in self.resources if r['id'].startswith('fra-text-')];self.assertEqual(len(texts),7)
  for r in texts:
   self.assertTrue(any(d['url'].endswith('.zip') for d in r['downloads']));self.assertTrue(any(d['url'].endswith('.epub') for d in r['downloads']));self.assertTrue(r['read'])
  self.assertEqual(len(self.media['browser_archives']),14);self.assertTrue(all(a['crc_valid'] for a in self.media['browser_archives']))
 def test_only_exact_french_publisher_urls_are_allowed(self):
  for u in FRENCH_EXTERNAL:
   r={'lang':'fra','type':'film','title':'Christian film','play':{'kind':'file','sd':u}}
   self.assertEqual(len(curate([r])[0]),1)
   r['lang']='eng';self.assertFalse(curate([r])[0])
  for u in ['https://rockintl.org/unknown.pdf','https://stream.mux.com/unknown/270p.mp4']:
   self.assertFalse(curate([{'lang':'fra','type':'film','title':'Film','play':{'kind':'file','sd':u}}])[0])
  for u in FRENCH_EXCLUDED:
   self.assertFalse(curate([{'lang':'fra','type':'link','title':'Imported row','source':u,'links':[{'url':u,'label':'Read'}]}])[0])
  for title in ['Queen James Bible','Bible inclusive','Traduction du monde nouveau','French Jefferson Bible']:
   self.assertFalse(curate([{'lang':'fra','type':'link','title':title,'source':'https://dbs.org/example','links':[{'url':'https://dbs.org/example','label':'Read'}]}])[0])
 def test_native_downloads_supported_types_and_correct_directory_labels(self):
  for r in self.resources:
   self.assertTrue(r['native']);self.assertIn(r['type'],self.lib['types']);self.assertTrue(self.cards[r['id']]['play'] or self.cards[r['id']]['read'] or self.cards[r['id']]['links'])
  s=next(r for r in self.resources if r['id']=='fra-edition-frasg21');self.assertEqual(s['native'],'Bible Segond 21 — 2007');self.assertNotIn('King James',s['title'])
  self.assertTrue(any(r['native']=='Questions sur le péché' for r in self.resources))
  rock=next(r for r in self.resources if r['source']=='https://dbs.org/video/rock/fra-french')
  self.assertTrue(rock['play']['sd'].endswith('_low.mp4'))
  self.assertTrue(any(d['label'].startswith('Partie 1') for d in rock['downloads']))
  for slug in ['fra_french_the_hope','fra-french-ibible_salvation','fra-french_canadian-ibible_salvation']:
   film=next(r for r in self.resources if r['source'].endswith('/'+slug))
   self.assertEqual(film['play']['kind'],'file');self.assertIn('hd',film['play'])
  acts=next(r for r in self.resources if r['source'].endswith('/fra_french_acts'))
  self.assertEqual([i['title'] for i in acts['play']['items']],['Film complet','Partie 1','Partie 2','Partie 3','Partie 4'])
  lessons=[r for r in self.resources if '/APC/' in r['source']]
  self.assertEqual([r['source'].split('/')[-1] for r in lessons],[f'APC{n}_French.pdf' for n in range(1,7)])
  self.assertTrue(lessons[-1]['native'].endswith('leçon 6 : Le salut'))
