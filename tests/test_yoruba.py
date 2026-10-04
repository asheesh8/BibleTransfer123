"""Yoruba source coverage, actual edition scope, and unavailable chapter handling."""
import json
import pathlib
import unittest
import urllib.parse
from packer.et import catalog, build
from packer.et.curation import curate, YORUBA_EXTERNAL, YORUBA_EXCLUDED
from packer.et.profiles import PROFILES
from packer.import_dbs_rendered import urls_in, LANGUAGES
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'catalog/source'


class YorubaTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.lib=catalog.load(ROOT/'catalog/resources.json')
  cls.resources=[r for r in cls.lib['resources'] if r['lang']=='yor']
  cls.cards={r['id']:r for r in build.card_catalog(cls.lib,[],PROFILES['pocket'],{})['resources'] if r['lang']=='yor'}
  cls.media=json.loads((SOURCE/'dbs-media-yoruba-2026-10-04.json').read_text())
  cls.audit=json.loads((SOURCE/'dbs-rendered-yoruba-2026-10-04.json').read_text())['yor']

 def test_every_dbs_source_is_included_or_explained(self):
  listed={a['href'] for g in self.audit.values() for a in g['links']}
  self.assertEqual(sum(len(g['links']) for g in self.audit.values()),48)
  self.assertEqual(len(listed),42)
  self.assertEqual(len(self.resources),38)
  self.assertEqual(listed-set(urls_in(self.resources)),set(self.media['excluded']))
  self.assertEqual(LANGUAGES['yor'],('yor','Yoruba',''))
  self.assertFalse([r for r,_ in self.lib['excluded'] if r['lang']=='yor'])
  for r in self.resources:
   self.assertTrue(r['native']);c=self.cards[r['id']]
   self.assertTrue(c['play'] or c['read'] or c['links'])

 def test_audio_editions_and_missing_chapters_survive_build(self):
  bibles=[r for r in self.resources if r['type']=='audio-bible']
  self.assertEqual(len(bibles),4)
  checked=0
  for r in bibles:
   p=r['play'];probes={u:v for u,v in self.media['verified_files'].items() if '/'+p['fileset']+'/' in u};checked+=len(probes)
   self.assertEqual(len(probes),260 if p['testaments']==['NT'] else 1189)
   bad=[u for u,v in probes.items() if not v['valid']]
   if 'YOROLD' in p['fileset']:
    self.assertEqual(len(bad),15)
    self.assertTrue(all('/13_1Chronicles/' in u for u in bad))
    self.assertEqual(p['missingChapters'],{'1Chronicles':list(range(1,16))})
    self.assertEqual(self.cards[r['id']]['play']['missingChapters'],p['missingChapters'])
    evidence=self.media['pages'][r['source']]['missing_chapter_evidence']
    self.assertEqual([int(o['value']) for o in evidence['selects'][1]['options']],list(range(16,30)))
   else:self.assertFalse(bad)
   self.assertEqual(len(p['bookNames']),66)
  self.assertEqual(checked,2898)
  okun=next(r for r in bibles if 'YOROBV' in r['play']['fileset'])
  self.assertEqual(okun['scope'],'Okun');self.assertIn('Okun',okun['native'])
  self.assertFalse(any('YORBIB_DAVR' in json.dumps(r) for r in self.resources))

 def test_films_keep_the_correct_language_and_parts(self):
  films=[r for r in self.resources if r['type']=='film'];self.assertEqual(len(films),12)
  counts={'yor_yoruba_jesus':61,'yor_yoruba_john':21,'yor_yoruba_luke':24,'yor_yoruba_mark':16,'yor_yoruba_matthew':28,'yor_yoruba_acts':5,'yor_yoruba_covenant':12,'yor-matthew-vb-yoruba':28,'yor-acts-vb-yoruba':28}
  for r in films:
   slug=r['source'].rsplit('/',1)[-1]
   if slug in counts:
    self.assertEqual(len(r['play']['items']),counts[slug])
    for i in r['play']['items']:self.assertIn('yor_',i['file'].lower().replace('yor-','yor_'))
    self.assertTrue(self.cards[r['id']]['files'][0]['label'].startswith('Gbogbo orí '))
   else:self.assertEqual(r['play']['kind'],'file')

 def test_all_grn_recordings_and_regional_labels_are_retained(self):
  all_grn=next(r for r in self.resources if r['id'].startswith('yor-ac-yor_global'))
  files={i['file'] for i in all_grn['play']['items']};self.assertEqual(len(files),171)
  programmes=[r for r in self.resources if r['id'].startswith('yor-grn-')]
  self.assertEqual(len(programmes),10)
  self.assertEqual(len({i['file'] for r in programmes for i in r['play']['items']}),170)
  for ident,region in [('10191','Igbomina'),('11181','Abunu'),('10261','Yagba'),('37859','Aworo'),('8291','Ekiti'),('27720','Iyara: Ijumu')]:
   self.assertIn(region,self.cards['yor-grn-'+ident]['scope'])
  self.assertIn('Christian teaching',self.media['publishers']['https://globalrecordings.net/en/program/68155']['text'])
  archive=next(a for a in self.media['browser_archives'] if a['url'].endswith('_high.zip'))
  self.assertTrue(archive['crc_valid'] and archive['mp3_valid']);self.assertEqual(archive['recordings'],171)
  self.assertEqual({urllib.parse.unquote(u).rsplit('/',1)[-1] for u in files},set(archive['recording_names']))
  for prefix,count in [('yor-ac-yor_storyjesus',9),('yor-ac-yor_storyset',48)]:
   self.assertEqual(len(next(r for r in self.resources if r['id'].startswith(prefix))['play']['items']),count)

 def test_modern_archives_and_historical_scope(self):
  text=self.cards['yor-text-yorycb']
  self.assertTrue(any(f.get('file','').endswith('.zip') for f in text['files']))
  self.assertTrue(any(f.get('file','').endswith('.epub') for f in text['files']))
  archives=[a for a in self.media['browser_archives'] if 'YORYCB' in a['url']]
  self.assertEqual(len(archives),2)
  self.assertTrue(all(a['crc_valid'] and a['books']==66 for a in archives))
  self.assertTrue(next(a for a in archives if a['url'].endswith('.epub'))['epub_valid'])
  scans=[r for r in self.resources if r['type']=='historic'];self.assertEqual(len(scans),6)
  self.assertIn('Gẹnẹsisi',next(r for r in scans if '1959' in r['source'])['native'])
  self.assertIn('apá',next(r for r in scans if '1879' in r['source'])['native'])

 def test_publisher_exceptions_and_exclusions_are_scoped(self):
  for u in YORUBA_EXTERNAL:
   r={'lang':'yor','type':'film','title':'Christian film','play':{'kind':'file','sd':u}}
   self.assertEqual(len(curate([r])[0]),1)
   r['lang']='eng';self.assertFalse(curate([r])[0])
  for u in YORUBA_EXCLUDED:
   self.assertFalse(curate([{'lang':'yor','type':'link','title':'Imported row','source':u,'links':[{'url':u,'label':'Open'}]}])[0])
  self.assertFalse(curate([{'lang':'yor','type':'film','title':'Film','play':{'kind':'file','sd':'https://stream.mux.com/unknown/720p.mp4'}}])[0])
