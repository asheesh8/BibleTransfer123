"""The complete audited Dholuo inventory survives import, curation and packing."""
import json
import pathlib
import unittest
from packer.et import catalog, build
from packer.et.curation import RETIRED, LUO_PUBLISHERS, curate
from packer.et.profiles import PROFILES
from packer.import_dbs_rendered import urls_in

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'catalog/source'

class LuoTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.library = catalog.load(ROOT / 'catalog/resources.json')
        cls.resources = [r for r in cls.library['resources'] if r['lang'] == 'luo']
        cls.byid = {r['id']: r for r in cls.resources}
        cls.audit = json.loads((SOURCE / 'dbs-rendered-2026-10-02.json').read_text())['luo']
        cls.media = json.loads((SOURCE / 'dbs-media-luo-2026-10-02.json').read_text())

    def test_every_dbs_listing_is_present_or_has_a_verified_reason_for_exclusion(self):
        captured = {i['href'] for g in self.audit.values() for i in g['links']}
        represented = set(urls_in(self.resources))
        omitted = self.media['excluded']
        self.assertEqual(len(captured), 28)
        self.assertEqual(len(self.resources), 24)
        self.assertEqual(captured - represented, set(omitted))
        self.assertFalse(set(omitted) & represented)
        self.assertTrue(set(u for u in omitted if '/bibles/audio/' in u) <= RETIRED)
        for u in omitted:
            if 'globalrecordings.net' in u:
                self.assertIn('Luhya', self.media['partners'][u]['title'])

    def test_all_dholuo_recordings_are_playable_saveable_and_packable(self):
        collection = self.byid['luo-ac-grn']
        page = self.media['pages'][collection['source']]
        tracks = {u for u in page['files'] if '/Dholuo/' in u and u.endswith('.mp3')}
        foreign = {u for u in page['files'] if '/Luhya%20Lunyore/' in u}
        self.assertEqual(len(tracks), 299)
        self.assertEqual(len(foreign), 22)
        self.assertEqual({i['file'] for i in collection['play']['items']}, tracks)
        self.assertTrue(tracks <= {d['url'] for d in collection['downloads']})
        self.assertTrue(tracks <= {a.url for a in catalog.assets_for(collection)})
        self.assertFalse(foreign & set(urls_in(self.resources)))
        programmes = [r for r in self.resources if r['id'].startswith('luo-grn-')]
        self.assertEqual(len(programmes), 14)
        self.assertEqual({d['url'] for r in programmes for d in r['downloads']}, tracks)
        probes = {r['url']:r for r in self.media['verified_files']['results']}
        self.assertTrue(all(probes[u]['valid'] for u in tracks))
        for archive in (d for d in collection['downloads'] if d['url'].endswith('.zip')):
            self.assertIn('Luhya Lunyore', archive['label'], 'Mixed archive must disclose its other language')

    def test_films_and_story_keep_all_parts_and_downloads(self):
        for rid, count in [('luo-film-jesus',61),('luo-film-lumo-covenant',12)]:
            r = self.byid[rid]
            items = r['play']['items']
            self.assertEqual(len(items), count)
            self.assertEqual([i['n'] for i in items],list(range(1,count+1)))
            expected = {u for u in self.media['pages'][r['source']]['files'] if u.endswith('.mp4')}
            self.assertEqual({i['file'] for i in items},expected)
        r = self.byid['luo-film-ibible']
        self.assertTrue(r['play']['sd'].endswith('-sd.mp4'))
        self.assertTrue(r['play']['hd'].endswith('-hd.mp4'))
        story = self.byid['luo-ac-story-jesus']
        self.assertEqual(len(story['play']['items']),8)
        self.assertEqual({d['url'] for d in story['downloads']},set(self.media['pages'][story['source']]['files']))
        for i,item in enumerate(story['play']['items'],1):
            self.assertIn(f'_Part_{i}.mp3',item['file'])
            self.assertEqual(next(d['label'] for d in story['downloads'] if d['url']==item['file']),f'Wach mar Yesu — {i} (MP3)')
        archives = {a['name']:a for a in self.media['verified_archives']}
        for name,count in [('luo_jesus_chapters_low.zip',61),('luo_GlobalRecordings_dholuo_low.zip',321),('luo-dholuo-ibible_salvation.zip',2),('luo_StoryJesus_luo.zip',8),('luo_StoryJesus_luo_full.zip',1)]:
            self.assertEqual(len(archives[name]['files']),count)
            self.assertEqual(archives[name]['crc'],'passed')

    def test_current_bible_and_verified_pdf(self):
        bibles=[r for r in self.resources if r['type']=='audio-bible']
        self.assertEqual(len(bibles),1)
        self.assertEqual(bibles[0]['play']['fileset'],'LUOGEN_DAVR_FB_N')
        self.assertEqual(bibles[0]['play']['testaments'],['OT','NT'])
        self.assertTrue(bibles[0]['play']['saveChapter'])
        # Missing EPUBs, the old OLT PDF and the unavailable full audio ZIP
        # must not be advertised as downloads.
        downloads={d['url'] for r in self.resources if r['type'] in ('scripture','audio-bible') for d in r['downloads']}
        self.assertEqual(downloads,{'https://bibles.dbs.org/LUOONT/pdf/LUOONT.pdf'})
        probes={r['url']:r for r in self.media['verified_files']['results']}
        self.assertTrue(probes[next(iter(downloads))]['signature'].startswith('25504446'))
        self.assertEqual(len(self.media['audio']['books']),66)
        self.assertEqual(self.media['audio']['books'][0]['label'],'Chakruok')
        self.assertEqual(self.media['audio']['books'][-1]['label'],'Fweny')

    def test_publisher_exception_is_limited_to_audited_luo_pages(self):
        for url in LUO_PUBLISHERS:
            r={'id':'test','lang':'luo','type':'link','title':'Publisher','links':[{'label':'Publisher','url':url}]}
            kept,_=curate([r]);self.assertEqual(len(kept),1)
            kept,_=curate([dict(r,lang='lug')]);self.assertEqual(kept,[])
        for url in ['https://globalrecordings.net/en/program/9460','https://globalrecordings.net/en/program/82771','https://example.org/']:
            kept,_=curate([{'lang':'luo','type':'link','title':'Other','links':[{'label':'Other','url':url}]}]);self.assertFalse(kept)
        for r in self.resources:
            self.assertTrue(r['native'])
            self.assertEqual(r['lang'],'luo')

    def test_collection_track_paths_resolve_to_packed_media(self):
        r=self.byid['luo-grn-24360'];assets=catalog.assets_for(r)
        mini=dict(self.library,resources=[r])
        packed=build.card_catalog(mini,[(r,assets)],PROFILES['pocket'],{r['id']:assets})['resources'][0]
        self.assertTrue(packed['offline'])
        self.assertEqual(len(packed['play']['items']),40)
        self.assertTrue(all(i['file'].startswith('../media/') for i in packed['play']['items']))
        preview=build.card_catalog(mini,[],PROFILES['pocket'],{r['id']:assets})['resources'][0]
        self.assertEqual({i['file'] for i in preview['play']['items']},{i['file'] for i in r['play']['items']})
        self.assertTrue(all(i['file'].startswith('https://') for i in preview['play']['items']))

if __name__ == '__main__':
    unittest.main()
