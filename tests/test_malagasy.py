"""Complete Malagasy source coverage, playable files and regional boundaries."""
import collections
import json
import pathlib
import re
import unittest
import urllib.parse
from packer.et import catalog, build
from packer.et.curation import curate, MALAGASY_EXTERNAL, MALAGASY_EXCLUDED
from packer.et.profiles import PROFILES
from packer.import_dbs_rendered import urls_in, LANGUAGES

ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'catalog/source'

class MalagasyTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.lib=catalog.load(ROOT/'catalog/resources.json')
  cls.resources=[r for r in cls.lib['resources'] if r['lang']=='mlg']
  cls.cards={r['id']:r for r in build.card_catalog(cls.lib,[],PROFILES['pocket'],{})['resources'] if r['lang']=='mlg'}
  cls.media=json.loads((SOURCE/'dbs-media-malagasy-2026-10-04.json').read_text())
  cls.audit=json.loads((SOURCE/'dbs-rendered-malagasy-2026-10-04.json').read_text())['mlg']

 def test_every_rendered_source_is_represented_or_explained(self):
  listed={a['href'] for g in self.audit.values() for a in g['links']}
  self.assertEqual(len(listed),52)
  for group in self.audit.values():self.assertEqual(group['count'],len(group['links']))
  self.assertEqual(len(self.resources),85)
  self.assertEqual(LANGUAGES['mlg'],('mlg','Malagasy',''))
  self.assertEqual(listed-set(urls_in(self.resources)),set(MALAGASY_EXCLUDED))
  self.assertEqual(set(MALAGASY_EXCLUDED),{'https://globalrecordings.net/en/program/12011'})
  self.assertTrue(all(r['native'] and r['desc'] for r in self.resources))
  self.assertTrue(all(c['play'] or c['read'] or c['links'] for c in self.cards.values()))

 def test_full_text_bible_archives_and_all_pdf_files(self):
  self.assertEqual(len(self.media['browser_archives']),2)
  for a in self.media['browser_archives']:
   self.assertTrue(a['crc_valid']);self.assertEqual(a['books'],66)
  text=self.cards['mlg-text-mlgdpv']
  self.assertTrue(any(f['file'].endswith('MLGDPV.epub') and '66' in f['label'] for f in text['files']))
  self.assertTrue(any(f['file'].endswith('html_MLGDPV.zip') for f in text['files']))
  for r in self.resources:
   if r.get('read'):self.assertTrue(self.media['verified_files'][r['read']['url']]['valid'])

 def test_new_testament_audio_has_only_the_260_published_chapters(self):
  r=next(r for r in self.resources if r['type']=='audio-bible')
  p=r['play'];books=self.media['pages'][r['source']]['books']
  self.assertEqual(p['testaments'],['NT']);self.assertEqual(len(books),27)
  self.assertEqual(sum(len(b['chapters']) for b in books),260)
  self.assertEqual(p['bookNames']['Matthew'],'Matio')
  self.assertEqual(p['bookNames']['1Corinthians'],'1 Korintiana')
  self.assertEqual(p['bookNames']['Acts'],'Asan’ny Apostoly')
  for b in books:
   for n in b['chapters']:
    u=re.sub(r'_\d{3}\.mp3$',f'_{n:03}.mp3',b['sample'])
    self.assertTrue(self.media['verified_files'][u]['valid'],u)

 def test_all_regional_recordings_are_playable_and_labeled(self):
  regional=[r for r in self.resources if r['id'].startswith('mlg-grn-')]
  self.assertEqual(len(regional),68)
  self.assertEqual(sum(len(r['play']['items']) for r in regional),1440)
  by_scope=collections.Counter()
  for r in regional:
   self.assertIn(r['scope'],r['desc'])
   by_scope[r['scope']]+=len(r['play']['items'])
   self.assertEqual([i['n'] for i in r['play']['items']],list(range(1,len(r['play']['items'])+1)))
   for i in r['play']['items']:self.assertTrue(self.media['verified_files'][i['file']]['valid'],i['file'])
  self.assertEqual(len(by_scope),12)
  self.assertEqual(by_scope['Ntandroy'],417)
  self.assertEqual(by_scope['Malagasy: Merina'],287)
  self.assertEqual(by_scope['Malagasy: Atesaka'],269)
  self.assertEqual(by_scope['Malagasy: Vezo'],250)
  for u,p in self.media['publishers'].items():
   if 'globalrecordings.net/en/program/' in u and u not in MALAGASY_EXCLUDED:
    r=next(r for r in regional if r['id']=='mlg-grn-'+u.rsplit('/',1)[-1])
    self.assertEqual(len(p['playlist']),len(r['play']['items']))
  story=next(r for r in self.resources if r['id']=='mlg-story-jesus')
  self.assertEqual(len(story['play']['items']),9)
  self.assertEqual(story['play']['items'][0]['title'],'Tantara manontolo')
  self.assertEqual(story['play']['items'][-1]['title'],'Fizarana 8')

 def test_eight_films_keep_published_order_and_have_real_browser_file_checks(self):
  films=[r for r in self.resources if r['type']=='film']
  self.assertEqual(len(films),8)
  self.assertEqual([len(r['play'].get('items',[])) for r in films],[21,24,16,28,12,0,28,28])
  self.assertEqual(sum(len(r['play'].get('items',[])) for r in films),157)
  checks=[c for c in self.media['browser_checks'] if c.get('downloaded')]
  self.assertEqual({c['sourcePage'] for c in checks},{r['source'] for r in films})
  for c in checks:
   self.assertGreater(c['bytes'],40000000)
   self.assertGreater(c['metadataDuration'],0)
   self.assertTrue(self.media['verified_files'][c['file']]['browser_valid'])
  for r in films:
   for i in r['play'].get('items',[]):
    self.assertIn(i['file'],self.media['verified_files'])
    self.assertTrue(any(f['url']==i['file'] for f in r['downloads']))

 def test_publisher_exceptions_are_exact_and_language_scoped(self):
  for u in MALAGASY_EXTERNAL:
   r={'lang':'mlg','type':'film','title':'Bible source','source':u,'links':[{'url':u,'label':'Open'}]}
   self.assertEqual(len(curate([r])[0]),1,u)
   r['lang']='eng';self.assertFalse(curate([r])[0],u)
  self.assertFalse(curate([{'lang':'mlg','type':'film','title':'Film','play':{'kind':'file','sd':'https://youtu.be/unknown'}}])[0])
  for u in MALAGASY_EXCLUDED:
   self.assertFalse(curate([{'lang':'mlg','type':'audio','title':'Words of Life','source':u,'links':[{'url':u}]}])[0])
  self.assertNotIn('ara',self.lib['languages'])
