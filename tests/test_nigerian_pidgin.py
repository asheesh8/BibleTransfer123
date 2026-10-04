"""Nigerian Pidgin coverage, publisher identity, media, and readable Bible links."""
import json
import pathlib
import unittest
import urllib.parse
from packer.et import catalog, build
from packer.et.curation import curate, PIDGIN_EXTERNAL
from packer.et.profiles import PROFILES
from packer.import_dbs_rendered import urls_in, LANGUAGES
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT/'catalog/source'


class NigerianPidginTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.lib=catalog.load(ROOT/'catalog/resources.json')
  cls.resources=[r for r in cls.lib['resources'] if r['lang']=='pcm']
  cls.cards={r['id']:r for r in build.card_catalog(cls.lib,[],PROFILES['pocket'],{})['resources'] if r['lang']=='pcm'}
  cls.media=json.loads((SOURCE/'dbs-media-nigerian-pidgin-2026-10-04.json').read_text())
  cls.audit=json.loads((SOURCE/'dbs-rendered-nigerian-pidgin-2026-10-04.json').read_text())['pcm']

 def test_every_listed_source_is_usable_and_keeps_its_identity(self):
  listed={a['href'] for g in self.audit.values() for a in g['links']}
  self.assertEqual(len(listed),15)
  self.assertEqual(len(self.resources),15)
  self.assertFalse(listed-set(urls_in(self.resources)))
  self.assertEqual(LANGUAGES['pcm'],('pcm','Nigerian Pidgin',''))
  self.assertFalse([r for r,_ in self.lib['excluded'] if r['lang']=='pcm'])
  for r in self.resources:
   self.assertTrue(r['native'])
   self.assertEqual(r['scope'],'Naija Pidgin')
   c=self.cards[r['id']];self.assertTrue(c['play'] or c['links'])

 def test_film_chapters_keep_the_published_counts_and_language(self):
  counts=[61,21,24,16,28,43,22,0,28,28]
  for row,n in zip(self.audit['Films']['links'],counts):
   r=next(r for r in self.resources if r['source']==row['href'])
   if n:
    self.assertEqual(len(r['play']['items']),n)
    for i in r['play']['items']:
     self.assertIn('pcm',i['file'].lower())
     self.assertTrue(self.media['verified_files'][i['file']]['valid'] or self.media['verified_files'][i['file']]['status']==403)
   else:self.assertEqual(r['play']['kind'],'file')

 def test_all_recordings_and_both_nigerian_programmes_survive_build(self):
  grn=self.cards['pcm-ac-pcm_globalrecordings_pidgin_nigeria']
  story=self.cards['pcm-ac-pcm_storyjesus_nigerian_pidgin_english']
  self.assertEqual(len(grn['play']['items']),14)
  self.assertEqual(len(story['play']['items']),9)
  for c in [grn,story]:
   for i in c['play']['items']:self.assertTrue(self.media['verified_files'][i['file']]['valid'])
  for ident,n in [('33050',12),('33051',2)]:
   self.assertEqual(len(self.cards['pcm-grn-'+ident]['play']['items']),n)
   self.assertIn('Pidgin, Nigeria',self.media['publishers']['https://globalrecordings.net/en/program/'+ident]['title'])
  self.assertEqual({i['file'] for ident in ['33050','33051'] for i in self.cards['pcm-grn-'+ident]['play']['items']},{i['file'] for i in grn['play']['items']})

 def test_checked_archives_and_reader_avoid_the_legacy_rendering_bug(self):
  text=self.cards['pcm-text-pcmwbt'];archives=self.media['browser_archives']
  self.assertEqual(len(archives),3)
  self.assertTrue(all(a['crc_valid'] for a in archives))
  bible=next(a for a in archives if 'PCMWBT' in a['url'])
  self.assertEqual(bible['books'],66)
  self.assertEqual(set(bible['genesis_1_verses']),{str(i) for i in range(1,32)})
  self.assertTrue(any(f.get('file','').endswith('html_PCMWBT.zip') for f in text['files']))
  self.assertTrue(any('inscript.org' in l['url'] for l in text['links']))
  self.assertFalse(any('app-json-study' in l['url'] for l in text['links']))
  for a in archives:
   if 'recordings' in a:self.assertTrue(a['mp3_valid']);self.assertIn(a['recordings'],[8,14])
  self.assertEqual(len(self.media['book_names']),66)
  self.assertEqual(self.media['book_names']['Matthew'],'Matiu')

 def test_external_exceptions_are_exact_and_language_scoped(self):
  for u in PIDGIN_EXTERNAL:
   r={'lang':'pcm','type':'link','title':'Bible source','source':u,'links':[{'url':u,'label':'Open'}]}
   self.assertEqual(len(curate([r])[0]),1)
   r['lang']='eng';self.assertFalse(curate([r])[0])
  self.assertFalse(curate([{'lang':'pcm','type':'film','title':'Film','play':{'kind':'file','sd':'https://stream.mux.com/unknown/720p.mp4'}}])[0])
