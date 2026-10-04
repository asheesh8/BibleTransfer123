"""Portuguese completeness, source mismatches, archives and regional recordings."""
import json
import pathlib
import re
import unittest
from packer.et import catalog, build
from packer.et.curation import curate, PORTUGUESE_EXTERNAL, PORTUGUESE_EXCLUDED
from packer.et.profiles import PROFILES
from packer.import_dbs_rendered import LANGUAGES, urls_in
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'catalog/source'


class PortugueseTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.lib = catalog.load(ROOT / 'catalog/resources.json')
  cls.resources = [r for r in cls.lib['resources'] if r['lang']=='por']
  cls.cards = {r['id']:r for r in build.card_catalog(cls.lib,[],PROFILES['pocket'],{})['resources'] if r['lang']=='por'}
  cls.media = json.loads((SOURCE/'dbs-media-portuguese-2026-10-03.json').read_text())
  cls.audit = json.loads((SOURCE/'dbs-rendered-portuguese-2026-10-03.json').read_text())['por']

 def test_every_listed_source_is_included_or_explained(self):
  listed = {a['href'] for group in self.audit.values() for a in group['links']}
  self.assertEqual(sum(len(g['links']) for g in self.audit.values()),406)
  self.assertEqual(len(listed),382)
  self.assertEqual(len(self.resources),112)
  self.assertEqual(listed-set(urls_in(self.resources)),set(self.media['excluded']))
  self.assertEqual(LANGUAGES['por'],('por','Portuguese',''))
  self.assertFalse([r for r,_ in self.lib['excluded'] if r['lang']=='por'])
  for r in self.resources:
   self.assertTrue(r['native'])
   c=self.cards[r['id']]
   self.assertTrue(c['play'] or c['read'] or c['links'])
  for u in listed:
   if '/Video/' not in u and '/discover/' not in u and not u.startswith('https://dbs.org/'):
    self.assertIn(u,self.media['publishers'])
  self.assertFalse(any('awaiting' in reason for reason in self.media['excluded'].values()))

 def test_audio_bible_testaments_and_chapter_divisions_survive_build(self):
  bibles=[r for r in self.resources if r['type']=='audio-bible']
  self.assertEqual(len(bibles),6)
  checked=0
  for r in bibles:
   p=r['play'];counts={'PORB09_FCBH_OT_D':930,'PORTLH_FCBH_NT_D':260}
   probes={u:v for u,v in self.media['verified_files'].items() if '/'+p['fileset']+'/' in u}
   self.assertEqual(len(probes),counts.get(p['fileset'],1189))
   checked+=len(probes)
   self.assertEqual(len(p['bookNames']),66)
   self.assertEqual(p['bookNames']['John'],'João')
   if p['fileset']=='PORB09_FCBH_OT_D':
    self.assertEqual(p['testaments'],['OT'])
    self.assertEqual(p['chapterCounts'],{'Joel':4,'Malachi':3})
    self.assertEqual(self.cards[r['id']]['play']['chapterCounts'],p['chapterCounts'])
    missing=[u for u,v in probes.items() if not v['valid']]
    self.assertEqual(len(missing),1)
    self.assertTrue(missing[0].endswith('/39_Malachi_004.mp3'))
   else:self.assertTrue(all(v['valid'] for v in probes.values()))
  self.assertEqual(checked,5946)

 def test_mislabeled_jesus_chapters_are_not_offered(self):
  for r in self.resources:
   if '/video/jesus/' not in r['source']:continue
   self.assertEqual(r['play']['kind'],'file')
   self.assertIn('stream.mux.com',r['play']['sd'])
   self.assertFalse(any('/chapters/' in d['url'] for d in r['downloads']))
   self.assertNotIn('book-of-acts',json.dumps(r))
   self.assertEqual(self.cards[r['id']]['files'][0]['label'],'Filme completo (MP4) · SD')
  self.assertEqual(len(self.media['excluded_files']),134)
  for slug,count in [('por_portuguese_john',21),('por_portuguese_luke',24),('por_portuguese_mark',16),('por_portuguese_matthew',28),('por_portuguese_acts',5),('por_portuguese_covenant',12)]:
   r=next(r for r in self.resources if r['source'].endswith('/'+slug))
   self.assertEqual(len(r['play']['items']),count)
   self.assertEqual(r['play']['items'],self.cards[r['id']]['play']['items'])
   self.assertTrue(self.cards[r['id']]['files'][0]['label'].startswith('Todos os '))

 def test_recordings_keep_programmes_and_regions(self):
  collection=next(r for r in self.resources if r['id'].startswith('por-ac-por_global'))
  files={i['file'] for i in collection['play']['items']}
  self.assertEqual(len(files),824)
  self.assertTrue(all(self.media['verified_files'][u]['valid'] for u in files))
  self.assertFalse(files & set(self.media['excluded_recordings']))
  programmes=[r for r in self.resources if r['id'].startswith('por-grn-') and r.get('play')]
  self.assertEqual(len(programmes),30)
  self.assertEqual({i['file'] for r in programmes for i in r['play']['items']},files)
  self.assertEqual(len(self.cards['por-grn-4030']['play']['items']),15)
  self.assertEqual(len(self.cards['por-grn-4031']['play']['items']),20)
  self.assertEqual(self.cards['por-grn-34420']['native'],'Palavras de Vida — Interior do Brasil')
  self.assertEqual(self.cards['por-grn-61023']['scope'],'Moçambique')
  self.assertIn('tupari',self.cards['por-grn-63701']['desc'])
  story=next(r for r in self.resources if r['id'].startswith('por-ac-por_story'))
  self.assertEqual(len(story['play']['items']),9)
  self.assertEqual(story['play']['items'][0]['title'],'História completa')

 def test_archives_match_their_actual_scope_and_downloads(self):
  archives=self.media['browser_archives']
  self.assertEqual(len(archives),3)
  self.assertTrue(all(a['crc_valid'] for a in archives))
  self.assertEqual(next(a['books'] for a in archives if 'PORBRB' in a['url']),66)
  self.assertEqual(next(a['books'] for a in archives if a['url'].endswith('html_PORTFT.zip')),27)
  self.assertTrue(next(a['epub_valid'] for a in archives if a['url'].endswith('.epub')))
  self.assertEqual(sum(r['type']=='historic' for r in self.resources),5)
  for ident in ['por-text-portft','por-text-porbrb']:
   self.assertTrue(any(f.get('file','').endswith('.zip') for f in self.cards[ident]['files']))
  self.assertIn('Novo Testamento',self.cards['por-text-portft']['native'])

 def test_publisher_exceptions_and_exclusions_remain_portuguese_only(self):
  for u in PORTUGUESE_EXTERNAL:
   r={'lang':'por','type':'film','title':'Christian film','play':{'kind':'file','sd':u}}
   self.assertEqual(len(curate([r])[0]),1)
   r['lang']='eng';self.assertFalse(curate([r])[0])
  for u in PORTUGUESE_EXCLUDED:
   self.assertFalse(curate([{'lang':'por','type':'link','title':'Imported row','source':u,'links':[{'url':u,'label':'Open'}]}])[0])
  self.assertFalse(curate([{'lang':'por','type':'film','title':'Film','play':{'kind':'file','sd':'https://stream.mux.com/unknown/720p.mp4'}}])[0])
