"""Lingala inventory identity, language scope, chapter boundaries and curation."""
import json
import pathlib
import unittest
import urllib.parse
from packer.et import catalog,build
from packer.et.curation import curate,LINGALA_EXTERNAL,LINGALA_EXCLUDED
from packer.et.profiles import PROFILES
from packer.import_dbs_rendered import urls_in,LANGUAGES
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'catalog/source'

class LingalaTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.lib=catalog.load(ROOT/'catalog/resources.json')
  cls.resources=[r for r in cls.lib['resources'] if r['lang']=='lin']
  cls.cards={r['id']:r for r in build.card_catalog(cls.lib,[],PROFILES['pocket'],{})['resources'] if r['lang']=='lin'}
  cls.media=json.loads((SOURCE/'dbs-media-lingala-2026-10-04.json').read_text())
  cls.audit=json.loads((SOURCE/'dbs-rendered-lingala-2026-10-04.json').read_text())['lin']

 def test_all_listed_rows_are_represented_or_explained(self):
  listed={a['href'] for g in self.audit.values() for a in g['links']}
  self.assertEqual(sum(len(g['links']) for g in self.audit.values()),46)
  self.assertEqual(len(listed),44)
  self.assertEqual(len(self.resources),40)
  self.assertEqual(LANGUAGES['lin'],('lin','Lingala',''))
  self.assertEqual(listed-set(urls_in(self.resources)),set(LINGALA_EXCLUDED))
  self.assertEqual(len(LINGALA_EXCLUDED),2)
  self.assertTrue(all(r['native'] for r in self.resources))
  self.assertTrue(all(c['play'] or c['read'] or c['links'] for c in self.cards.values()))

 def test_film_playlists_preserve_all_published_parts(self):
  counts=[61,0,21,24,16,28,4,12,0,28,0]
  self.assertEqual(len([r for r in self.resources if r['type']=='film']),12)
  total=0
  for row,n in zip(self.audit['Films']['links'],counts):
   r=next(r for r in self.resources if r['source']==row['href'])
   if n:
    self.assertEqual(len(r['play']['items']),n);total+=n
    for i in r['play']['items']:
     self.assertIn('lin',i['file'].lower())
     p=self.media['verified_files'][i['file']]
     self.assertTrue(p['valid'] or p['status']==403)
   else:self.assertEqual(r['play']['kind'],'file')
  self.assertEqual(total,194)
  director=self.cards['lin-film-magdalena-directors-cut']
  self.assertIn('stream.mux.com',director['play']['file'])
  self.assertTrue(self.media['verified_files'][director['play']['file']]['valid'])

 def test_audio_bibles_have_66_books_and_published_three_chapter_malachi(self):
  bibles=[r for r in self.resources if r['type']=='audio-bible']
  self.assertEqual({r['play']['version'] for r in bibles},{'LINBSC','LINDRC'})
  for r in bibles:
   p=r['play'];c=self.cards[r['id']]['play']
   self.assertEqual(p['testaments'],['OT','NT'])
   self.assertEqual(len(p['bookNames']),66)
   self.assertEqual(c['chapterCounts'],{'Malachi':3})
   self.assertEqual(self.media['pages'][r['source']]['malachi']['chapters'],['1','2','3'])
   probes=[v for u,v in self.media['verified_files'].items() if '/'+p['fileset']+'/' in u and u.endswith('.mp3')]
   self.assertEqual(sum(bool(v['valid']) for v in probes),1188)
   self.assertEqual(sum(v['status']==404 for v in probes),1)
   self.assertEqual(len(r['dbsListedUrls']),1)

 def test_audio_collections_remove_health_material_and_keep_christian_programmes(self):
  grn=self.cards['lin-ac-lin_globalrecordings_lingala'];story=self.cards['lin-ac-lin_storyjesus_lingala']
  self.assertEqual(len(grn['play']['items']),332)
  self.assertEqual(len(story['play']['items']),9)
  self.assertFalse(any('AIDS' in urllib.parse.unquote(i['file']) for i in grn['play']['items']))
  self.assertFalse(any(f.get('file','').endswith('.zip') for f in grn['files']))
  programme=[r for r in self.resources if r['id'].startswith('lin-grn-') and r['id'] not in ('lin-grn-9981','lin-grn-24940','lin-grn-2460')]
  self.assertEqual(len(programme),17)
  self.assertEqual({i['file'] for r in programme for i in r['play']['items']},{i['file'] for i in grn['play']['items']})
  for c in [grn,story]:
   for i in c['play']['items']:self.assertTrue(self.media['verified_files'][i['file']]['valid'])
  unavailable=next(r for r in programme if r['id']=='lin-grn-34561')
  self.assertEqual(unavailable['scope'],'Lingála')
  self.assertEqual(unavailable['source'],grn['source'])
  self.assertFalse(any('34561' in l['url'] for l in unavailable['links']))

 def test_mixed_programmes_keep_explicit_lingala_tracks_and_label_other_language(self):
  mixed=next(r for r in self.resources if r['id']=='lin-grn-9981')
  self.assertEqual(mixed['scope'],'Kiyansi: Banningville + Lingála')
  self.assertEqual(len(mixed['play']['items']),2)
  for ident in ['24940','2460']:
   c=self.cards['lin-grn-'+ident]
   self.assertEqual(len(c['play']['items']),1)
   self.assertIn('Lingala',urllib.parse.unquote(c['play']['items'][0]['file']).rsplit('/',1)[-1])
   self.assertTrue(self.media['verified_files'][c['play']['items'][0]['file']]['valid'])

 def test_bible_and_story_archives_are_complete_and_crc_checked(self):
  text=self.cards['lin-text-linocb'];archives=self.media['browser_archives']
  self.assertEqual(len(archives),3)
  self.assertTrue(all(a['crc_valid'] for a in archives))
  self.assertEqual([a['books'] for a in archives if 'books' in a],[66,66])
  self.assertEqual([a['recordings'] for a in archives if 'recordings' in a],[8])
  self.assertTrue(any(f.get('file','').endswith('html_LINOCB.zip') for f in text['files']))
  self.assertTrue(any(f.get('file','').endswith('LINOCB.epub') for f in text['files']))
  self.assertTrue(any('inscript.org' in l['url'] for l in text['links']))
  self.assertFalse(any('app-json-study' in l['url'] for l in text['links']))

 def test_external_exceptions_are_exact_and_language_scoped(self):
  for u in LINGALA_EXTERNAL:
   r={'lang':'lin','type':'link','title':'Bible source','source':u,'links':[{'url':u,'label':'Open'}]}
   self.assertEqual(len(curate([r])[0]),1)
   r['lang']='eng';self.assertFalse(curate([r])[0])
  self.assertFalse(curate([{'lang':'lin','type':'film','title':'Film','play':{'kind':'file','sd':'https://stream.mux.com/unknown/720p.mp4'}}])[0])
  for u in LINGALA_EXCLUDED:
   self.assertFalse(curate([{'lang':'lin','type':'audio','title':'Audio','source':u,'play':{'kind':'file','sd':u}}])[0])
