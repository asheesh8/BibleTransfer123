"""Hausa inventory coverage, Christian selection, media and language boundaries."""
import json
import pathlib
import re
import unittest
import urllib.parse
from packer.et import catalog, build
from packer.et.curation import curate, HAUSA_EXTERNAL, HAUSA_EXCLUDED
from packer.et.profiles import PROFILES
from packer.import_dbs_rendered import urls_in, LANGUAGES
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'catalog/source'

class HausaTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.lib=catalog.load(ROOT/'catalog/resources.json')
  cls.resources=[r for r in cls.lib['resources'] if r['lang']=='hau']
  cls.cards={r['id']:r for r in build.card_catalog(cls.lib,[],PROFILES['pocket'],{})['resources'] if r['lang']=='hau'}
  cls.media=json.loads((SOURCE/'dbs-media-hausa-2026-10-04.json').read_text())
  cls.audit=json.loads((SOURCE/'dbs-rendered-hausa-2026-10-04.json').read_text())['hau']

 def test_complete_rendered_inventory_is_represented_or_explained(self):
  listed={a['href'] for g in self.audit.values() for a in g['links']}
  self.assertEqual(sum(len(g['links']) for g in self.audit.values()),107)
  self.assertEqual(len(listed),83)
  self.assertEqual(len(self.resources),64)
  self.assertEqual(LANGUAGES['hau'],('hau','Hausa',''))
  self.assertEqual(listed-set(urls_in(self.resources)),set(HAUSA_EXCLUDED)&listed)
  self.assertEqual(len(set(HAUSA_EXCLUDED)&listed),8)
  self.assertTrue(all(r['native'] for r in self.resources))
  self.assertTrue(all(c['play'] or c['read'] or c['links'] for c in self.cards.values()))

 def test_both_audio_bibles_have_every_published_book_and_chapter(self):
  bibles=[r for r in self.resources if r['type']=='audio-bible']
  self.assertEqual({r['play']['version'] for r in bibles},{'HAUBSN','HAUPOR'})
  for r in bibles:
   p=r['play'];books=self.media['pages'][r['source']]['books']
   self.assertEqual(len(books),66)
   self.assertEqual(sum(len(b['chapters']) for b in books),1189)
   self.assertEqual(len(p['bookNames']),66)
   self.assertEqual(p['bookNames']['Genesis'],'Farawa')
   self.assertEqual(p['testaments'],['OT','NT'])
   self.assertTrue(self.cards[r['id']]['play']['saveChapter'])
   for b in books:
    for n in b['chapters']:
     u=re.sub(r'_\d{3}\.mp3$',f'_{n:03}.mp3',b['sample'])
     self.assertTrue(self.media['verified_files'][u]['valid'],u)

 def test_film_parts_preserve_order_and_published_boundaries(self):
  self.assertEqual(len([r for r in self.resources if r['type']=='film']),16)
  total=0
  for row,n in zip(self.audit['Films']['links'],[61,0,0,0,0,21,24,16,12,0,28,28,0]):
   r=next(r for r in self.resources if r['source']==row['href'])
   if n:
    parts=r['play']['items'];self.assertEqual(len(parts),n);total+=n
    self.assertEqual([i['n'] for i in parts],list(range(1,n+1)))
    for i in parts:self.assertIn(i['file'],self.media['verified_files'])
   else:self.assertEqual(r['play']['kind'],'file')
  self.assertEqual(total,190)
  savior=self.cards['hau-film-savior-parts']['play']['items']
  self.assertEqual(len(savior),9)
  self.assertIn('Hausa_0-',savior[0]['file'])
  self.assertIn('Hausa_8-',savior[-1]['file'])
  for i in savior:self.assertTrue(self.media['verified_files'][i['file']]['valid'])

 def test_christian_audio_omits_health_files_and_unsafe_unfiltered_bundles(self):
  grn=self.cards['hau-ac-hau_globalrecordings_hausa']
  self.assertEqual(len(grn['play']['items']),372)
  self.assertEqual(len(self.cards['hau-ac-hau_storyjesus_hausa']['play']['items']),9)
  self.assertEqual(len(self.cards['hau-ac-hau_storyset_hausa']['play']['items']),43)
  self.assertEqual(len(self.cards['hau-rock-audio']['play']['items']),100)
  self.assertFalse(any('66703' in urllib.parse.unquote(i['file']) for i in grn['play']['items']))
  self.assertFalse(any(f.get('file','').endswith('.zip') for f in grn['files']))
  for i in grn['play']['items']:self.assertTrue(self.media['verified_files'][i['file']]['valid'])
  self.assertFalse(any('/MTD/' in u for u in urls_in(self.resources)))

 def test_mixed_programmes_keep_identified_hausa_and_disclose_other_languages(self):
  for ident,n in [('550',4),('600',1),('610',4),('611',2),('401',1),('370',1)]:
   r=next(r for r in self.resources if r['id']=='hau-grn-'+ident)
   self.assertEqual(r['scope'],'Hausa')
   self.assertEqual(len(r['play']['items']),n)
   for i in r['play']['items']:
    self.assertRegex(urllib.parse.unquote(i['file']),r'\d{3} حَوْسَ ')
    self.assertTrue(self.media['verified_files'][i['file']]['valid'])
  for ident in ['2301','2330','2320','391','14600','5701','531','14821']:
   r=next(r for r in self.resources if r['id']=='hau-grn-'+ident)
   self.assertIn('+ Hausa',r['scope'])
   self.assertIn('Ba Hausa kaɗai ba ne',r['desc'])
   self.assertEqual(len(r['play']['items']),2)

 def test_epub_is_crc_checked_and_labeled_as_new_testament(self):
  archive=self.media['browser_archives'][0]
  self.assertTrue(archive['crc_valid'])
  self.assertEqual(archive['books'],27)
  text=self.cards['hau-text-haudor']
  self.assertTrue(any(f['file'].endswith('HAUDOR.epub') and '27' in f['label'] for f in text['files']))
  self.assertNotIn('app-json-study',str(text['links']))
  for r in self.resources:
   if r.get('read'):self.assertTrue(self.media['verified_files'][r['read']['url']]['valid'])

 def test_external_exceptions_are_exact_and_hausa_scoped(self):
  for u in HAUSA_EXTERNAL:
   r={'lang':'hau','type':'link','title':'Bible source','source':u,'links':[{'url':u,'label':'Open'}]}
   self.assertEqual(len(curate([r])[0]),1,u)
   r['lang']='eng';self.assertFalse(curate([r])[0],u)
  for u in HAUSA_EXCLUDED:
   r={'lang':'hau','type':'audio','title':'Audio','source':u,'play':{'kind':'file','sd':u}}
   self.assertFalse(curate([r])[0],u)
  self.assertFalse(curate([{'lang':'hau','type':'film','title':'Film','play':{'kind':'file','sd':'https://stream.mux.com/unknown/720p.mp4'}}])[0])
  # Arabic is its own audited DBS shelf; no Arabic item comes in through this language's exceptions.
  self.assertTrue(all(r['source'].startswith('https://dbs.org/') for r in self.lib['resources'] if r['lang']=='ara'))
