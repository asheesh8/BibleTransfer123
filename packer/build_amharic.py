#!/usr/bin/env python3
"""Rebuild Amharic from the rendered DBS shelf and its published media URLs."""
import json
import pathlib
import re
import urllib.parse
from et.build import secure

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'catalog/source'
DATE = '2026-10-03'


def load(name):
    return json.loads((SOURCE / name).read_text())


def save(name, data):
    (ROOT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n')


def files(page, extension):
    return list(dict.fromkeys(a['url'] for a in page['links']
                             if urllib.parse.urlparse(a['url']).path.lower().endswith(extension)))


def overview_title(reference, books):
    special = {'TaNaK / Old Testament Overview': 'የብሉይ ኪዳን አጠቃላይ ዳሰሳ',
               'New Testament Overview': 'የአዲስ ኪዳን አጠቃላይ ዳሰሳ',
               '1-2 Kings': '1ኛ እና 2ኛ ነገሥት', 'Ezra-Nehemiah': 'ዕዝራ እና ነህምያ',
               'Song of Songs': 'መኃልየ መኃልይ', '1-3 John': '1ኛ፣ 2ኛ እና 3ኛ ዮሐንስ'}
    if reference in special:
        return special[reference]
    for name, native in sorted(books.items(), key=lambda x: -len(x[0])):
        english = re.sub(r'^(\d)', r'\1 ', name)
        if reference == english or reference.startswith(english + ' '):
            return native + reference[len(english):]
    raise ValueError('Untranslated overview: ' + reference)


THEMES = dict(zip(
    'God|Justice|The Messiah|Holy Spirit|Image of God|Tree of Life|Heaven and Earth|Holiness|Sacrifice and Atonement|Day of the Lord|The Law|Son of Man|Gospel of the Kingdom|Covenant|Exile|Chaos Dragon|The City|Eternal Life|The Way of the Exile|Shalom|Agape|Yakhal|Chara'.split('|'),
    'እግዚአብሔር|ፍትሕ|መሲሑ|መንፈስ ቅዱስ|የእግዚአብሔር አምሳል|የሕይወት ዛፍ|ሰማይና ምድር|ቅድስና|መሥዋዕትና ስርየት|የጌታ ቀን|ሕግ|የሰው ልጅ|የመንግሥቱ ወንጌል|ኪዳን|ስደት|የነውጥ ዘንዶ|ከተማ|ዘላለማዊ ሕይወት|የስደት መንገድ|ሻሎም፦ ሰላም|አጋፔ፦ ፍቅር|ያካል፦ ተስፋ|ካራ፦ ደስታ'.split('|')))
FILMS = dict(zip(
    'amh_amharic_jesus|amh_amharic_magdalena|amh_amharic_story_of_jesus_for_children|amh_amharic_the_savior|amh-amharic-overview|amh-amharic-themes|amh_amharic_john|amh_amharic_luke|amh_amharic_mark|amh_amharic_matthew|amh_amharic_acts|amh_amharic_covenant|amh_amharic_the_hope|amh-amharic-ibible_salvation|amh-matthew-vb-amharic|amh-acts-vb-amharic|amh_amharic_rescue_project_deaf_gospel'.split('|'),
    'ኢየሱስ|መግደላዊት ማርያም|የኢየሱስ ታሪክ ለልጆች|አዳኙ|BibleProject፦ የመጽሐፍ ቅዱስ መጻሕፍት አጠቃላይ ዳሰሳ|BibleProject፦ መጽሐፍ ቅዱሳዊ ርዕሶች|LUMO፦ የዮሐንስ ወንጌል|LUMO፦ የሉቃስ ወንጌል|LUMO፦ የማርቆስ ወንጌል|LUMO፦ የማቴዎስ ወንጌል|LUMO፦ የሐዋርያት ሥራ|LUMO፦ ኪዳኑ|ተስፋ|iBible፦ የድነት ታሪክ|መጽሐፍ ቅዱስ በፊልም፦ ማቴዎስ|መጽሐፍ ቅዱስ በፊልም፦ የሐዋርያት ሥራ|Rescue Project፦ ወንጌል መስማት ለተሳናቸው'.split('|')))
PROGRAMMES = dict(zip(
    ['20760','81709','81710','81711','81712','81713','81714','81715','81716','30410','1420','1421'],
    'ምሥራች|ይመልከቱ፣ ያዳምጡ እና ይኑሩ 1፦ በመጀመሪያ እግዚአብሔር|ይመልከቱ፣ ያዳምጡ እና ይኑሩ 2፦ ለእግዚአብሔር የቆሙ ኃያላን|ይመልከቱ፣ ያዳምጡ እና ይኑሩ 3፦ በእግዚአብሔር የሚገኝ ድል|ይመልከቱ፣ ያዳምጡ እና ይኑሩ 4፦ የእግዚአብሔር አገልጋዮች|ይመልከቱ፣ ያዳምጡ እና ይኑሩ 5፦ ለእግዚአብሔር ሲሉ ለፍርድ መቅረብ|ይመልከቱ፣ ያዳምጡ እና ይኑሩ 6፦ ኢየሱስ አስተማሪና ፈዋሽ|ይመልከቱ፣ ያዳምጡ እና ይኑሩ 7፦ ኢየሱስ ጌታና መድኃኒት|ይመልከቱ፣ ያዳምጡ እና ይኑሩ 8፦ የመንፈስ ቅዱስ ሥራ|የኢየሱስ ሕይወት|የሕይወት ቃላት 1|የሕይወት ቃላት 2'.split('|')))
EDITIONS = {'AMHIBS':'የIBS መጽሐፍ ቅዱስ — 2001','AMHNIV':'አዲሱ መደበኛ የአማርኛ ትርጉም — 2001',
            'AMHACLB':'መጽሐፍ ቅዱስ በዕለታዊ አማርኛ — 1980','AMHN74':'የአማርኛ አዲስ ኪዳን — 1874',
            'AMHORT':'የአማርኛ ኦርቶዶክስ መጽሐፍ ቅዱስ — 2012','AMHEVG':'የአማርኛ መጽሐፍ ቅዱስ — 1962 ቅጂ'}


def main():
    audit = load(f'dbs-rendered-amharic-{DATE}.json')['amh']
    media = load(f'dbs-media-amharic-{DATE}.json')
    probes, books = media['verified_files'], media['book_names']
    resources, external, excluded, records = [], set(), {}, {}

    def available(url):
        # Protected published media are also checked in the browser player.
        check = probes.get(secure(url), {})
        return check.get('valid') or check.get('status') in (403, 406)

    def resource(slug, kind, title, native, source, org='Digital Bible Society'):
        r = {'id':'amh-'+slug,'lang':'amh','type':kind,'title':title,'native':native,
             'langName':'አማርኛ','source':source,'org':org,'desc':'','downloads':[],'links':[]}
        resources.append(r)
        records[source] = r
        return r

    def download(r, url, label):
        if not available(url):
            return
        r['downloads'].append({'url':secure(url),'label':label})
        if not urllib.parse.urlparse(secure(url)).netloc.endswith('dbs.org'):
            external.add(secure(url))

    def tracks(r, urls, titles):
        pairs = [(secure(u),t) for u,t in zip(urls,titles) if available(u)]
        if not pairs:
            raise ValueError('No available recordings: '+r['source'])
        r['play'] = {'kind':'audio-collection','sample':pairs[0][0],
                     'items':[{'n':n,'file':u,'title':t} for n,(u,t) in enumerate(pairs,1)]}
        for u,t in pairs:
            download(r,u,t+' (MP3)')

    def film(r, page):
        urls = files(page,'.mp4')
        chapters = [u for u in urls if '/chapters/' in u or '/films_low/' in u and '/Lumo-' in u]
        if page.get('episodes'):
            chapters = [next(a['url'] for a in e['links'] if a['label'].startswith('SD (')) for e in page['episodes']]
            if len(set(chapters)) != len(chapters) or not all('_low.mp4' in u for u in chapters):
                raise ValueError('Repeated or incorrect BibleProject SD sources: '+r['source'])
            titles = [THEMES[e['reference']] if r['source'].endswith('-themes') else overview_title(e['reference'],books) for e in page['episodes']]
            urls += [a['url'] for e in page['episodes'] for a in e['links'] if urllib.parse.urlparse(a['url']).path.endswith('.mp4')]
        else:
            titles = [('ሙሉ ፊልም' if '_full_' in u else 'ክፍል '+str(int(re.search(r'_(\d\d)_360',u)[1])) if '/Lumo-Acts/' in u else 'ምዕራፍ '+str(n)) for n,u in enumerate(chapters,1)]
        if chapters:
            r['play'] = {'kind':'chapters','base':'','items':[{'n':n,'file':secure(u),'title':t} for n,(u,t) in enumerate(zip(chapters,titles),1) if available(u)]}
            for u,t in zip(chapters,titles):
                download(r,u,t+' (MP4)')
        else:
            sd = next((a['url'] for a in page['links'] if ('SD' in a['label'] or 'Compressed' in a['label']) and a['url'] in urls),next((u for u in urls if '_low.' in u),urls[0] if urls else None))
            hd = next((a['url'] for a in page['links'] if ('HD' in a['label'] or 'High Quality' in a['label']) and a['url'] in urls),None)
            if sd and available(sd):
                r['play'] = {'kind':'file','sd':secure(sd),**({'hd':secure(hd)} if hd and available(hd) else {})}
        high_files = {a['url'] for a in page['links'] if 'HD' in a['label'] or 'High Quality' in a['label']}
        for n,u in enumerate(dict.fromkeys(urls),1):
            if u in chapters:
                continue
            part = re.search(r'_part_?(\d+)',u,re.I)
            label = 'ክፍል '+part[1] if part else 'ሙሉ ፊልም'
            if page.get('episodes'):
                label = next(overview_title(e['reference'],books) if not r['source'].endswith('-themes') else THEMES[e['reference']] for e in page['episodes'] if any(a['url']==u for a in e['links']))
            download(r,u,label+' (MP4) · HD' if page.get('episodes') or u in high_files or '/720p.' in u or '_high.' in u else label+' (MP4) · SD')
        if not r.get('play'):
            r['links'] = [{'label':'በDBS ይመልከቱ','url':r['source']}]
        # Unchecked large ZIP packages stay available on the source page.

    for section, group in audit.items():
        if section == 'Links to Other Sites':
            continue
        for row in group['links']:
            url = row['href']
            page = media['pages'][url]
            slug = urllib.parse.urlparse(url).path.split('/')[-1]
            if section == 'Bibles' and '/audio/' in url:
                fileset = slug
                native = 'የአማርኛ ኦርቶዶክስ አዲስ ኪዳንና መዝሙረ ዳዊት — ድምፅ' if fileset.startswith('AMHSDV') else 'የአፄ ኃይለ ሥላሴ መጽሐፍ ቅዱስ — ድምፅ (1962)' if fileset.startswith('AMHNHS') else 'የአማርኛ ካቶሊክ አዲስ ኪዳን — ድምፅ'
                r = resource('ab-'+fileset.lower().replace('_','-').replace('+','plus'),'audio-bible',row['title'],native,url,'International Scripture Audio' if '_ISA_' in fileset else 'Faith Comes By Hearing')
                r['play'] = {'kind':'audio-bible','fileset':fileset,'version':fileset.split('_')[0],'testaments':['NT'] if '_NT_' in fileset else ['OT','NT'],'bookNames':books,'saveChapter':True}
                if fileset.startswith('AMHSDV'):
                    r['play']['books'] = ['Psalms']+list(books)[39:]
                    r['desc'] = 'ይህ የድምፅ ቅጂ አዲስ ኪዳንንና መዝሙረ ዳዊትን ብቻ ይዟል።'
            elif section == 'Bibles':
                r = resource('text-'+slug.lower(),'scripture',row['title'],'የአማርኛ አዲስ ኪዳን — 1962',url,'Bible Society of Ethiopia / United Bible Societies')
                pdf = next(u for u in files(page,'.pdf') if available(u))
                r['read'] = {'kind':'pdf','url':pdf}
                r['links'] = [{'label':'በDBS ያንብቡ','url':u} for u in [a['url'] for a in page['links'] if 'app-json-study/index.html' in a['url']]]
                download(r,pdf,'አዲስ ኪዳን (PDF)')
                for ext,label in [('.zip','አዲስ ኪዳን ያለ ኢንተርኔት ለማንበብ (HTML ZIP)'),('.epub','አዲስ ኪዳን (EPUB)')]:
                    for u in files(page,ext):
                        if any(a['url']==u and a['crc_valid'] for a in media['browser_archives']):
                            download(r,u,label)
            elif section == 'Historic Bible (Scans)':
                native = 'የአማርኛ መጽሐፍ ቅዱስ — የተቃኘ ቅጂ' if slug=='Amharic-Bible-book' else 'የዮሐንስ ወንጌል — የተቃኘ ቅጂ (1962)'
                r = resource('scan-'+slug.lower(),'historic',row['title'],native,url)
                pdf = next(u for u in files(page,'.pdf') if available(u))
                r['read'] = {'kind':'pdf','url':pdf}
                download(r,pdf,'የተቃኘ ቅጂ (PDF)')
            elif section == 'Films':
                r = resource('film-'+slug,'film',row['title'],FILMS[slug],url,row['cells'][1])
                film(r,page)
                if '/deafproject/' in url:
                    r['desc'] = 'ወንጌልን በእንቅስቃሴና በምስል መስማት ለተሳናቸው የሚያቀርብ ፊልም።'
            elif section == 'Audio Collections':
                grn = '/grn/' in url
                native = 'Global Recordings፦ የአማርኛ ድምፅ ቅጂዎች' if grn else 'የኢየሱስ ታሪክ — ድምፅ' if '/soj/' in url else 'StoryRunners፦ መጽሐፍ ቅዱሳዊ ታሪኮችና መዝሙሮች'
                r = resource('ac-'+slug.lower(),'audio',row['title'],native,url,row['cells'][1])
                urls = files(page,'.mp3')
                if grn:
                    eligible, titles, counts = [], [], {}
                    for u in urls:
                        folder = urllib.parse.unquote(u).split('/')[-2]
                        ident = str(int(re.search(r'(\d+)$',folder)[1]))
                        if ident not in PROGRAMMES:
                            media.setdefault('excluded_recordings',{})[u] = 'Public-service recording; Christian content not confirmed.'
                            continue
                        counts[ident] = counts.get(ident,0)+1
                        eligible.append(u)
                        titles.append(PROGRAMMES[ident]+' — ድምፅ '+str(counts[ident]))
                    urls = eligible
                elif '/soj/' in url:
                    titles = ['ሙሉ ታሪክ']+['ክፍል '+str(n) for n in range(1,9)]
                else:
                    # Several filenames have conflicting English/Amharic subjects.
                    # Preserve published order with neutral labels, without guessing topics.
                    titles = ['መጽሐፍ ቅዱሳዊ ታሪክ '+str(n) if n<=46 else 'መዝሙር '+str(n-46) for n in range(1,59)]
                tracks(r,urls,titles)
    collection = next(r for r in resources if r['id'].startswith('amh-ac-amh_global'))
    aliases = {'AMHNHS':'AMHNHS_ISA_FB_N','AMHSDV':'AMHSDV_FCBH_N+_N','AMHZZZP':'AMHBSE_FCBH_NT_N'}
    parts = []
    for url,row in {a['href']:a for a in audit['Links to Other Sites']['links']}.items():
        if 'find.bible' in url:
            code = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)['abbr'][0]
            dest = media['publishers'][url]['resolved']
            external.add(dest)
            if code in aliases:
                r = records['https://dbs.org/bibles/audio/'+aliases[code]]
                r.setdefault('dbsListedUrls',[]).append(url)
                r['links'].append({'label':'የቅጂውን ዝርዝር ይመልከቱ','url':dest})
            else:
                r = resource('edition-'+code.lower(),'scripture',row['title'],EDITIONS[code],dest,'find.bible')
                r['dbsListedUrl'] = url
                r['links'] = [{'label':'የቅጂውን ዝርዝርና የአሳታሚውን አገናኞች ይመልከቱ','url':dest}]
                r['desc'] = 'ይህ ገጽ የመጽሐፍ ቅዱሱን ቅጂ ዝርዝር ያቀርባል። ለማንበብ፣ ለማዳመጥ ወይም ፋይሎችን ለማውረድ የአሳታሚውን አገናኞች ይክፈቱ።'
        elif 'globalrecordings.net' in url:
            ident = url.split('/')[-1]
            if ident not in PROGRAMMES:
                excluded[url] = 'Publisher identifies this as Deme, with an Amharic song; no separate Amharic track is identified.'
                continue
            matches = [i for i in collection['play']['items'] if re.search(r'\b0*'+ident+r'$',urllib.parse.unquote(i['file']).split('/')[-2])]
            if not matches:
                raise ValueError('Programme has no Amharic recordings: '+ident)
            r = resource('grn-'+ident,'audio',row['title'],PROGRAMMES[ident],url,'Global Recordings Network')
            external.add(url)
            r['links'] = [{'label':'የአሳታሚውን ገጽ ይክፈቱ','url':url}]
            tracks(r,[i['file'] for i in matches],[i['title'] for i in matches])
        elif 'amazonaws.com' in url:
            parts.append((url,secure(url)))
        elif 'youtu.be' in url:
            slug = 'amh_amharic_'+{'fN7ikyuaJ6Y':'luke','3ACxxDE8EOk':'john','L8stLl-HtCw':'mark'}[url.split('/')[-1]]
            r = next(r for r in resources if r['source'].endswith('/'+slug))
            r.setdefault('dbsListedUrls',[]).append(url)
        elif 'arc.gt' in url:
            dest = media['publishers'][url]['resolved']
            external.add(dest)
            if 'xeesb' in url:
                r = records['https://dbs.org/video/storyjesus/amh_amharic_story_of_jesus_for_children']
                r.setdefault('dbsListedUrls',[]).append(url)
                download(r,dest,'ሙሉ ፊልም (MP4) · HD')
            else:
                r = resource('film-magdalena-directors-cut','film',row['title'],'መግደላዊት ማርያም — የዳይሬክተሩ ቅጂ',dest,'Jesus Film Project')
                r['dbsListedUrl'] = url
                r['play'] = {'kind':'file','sd':dest}
                download(r,dest,'ሙሉ ፊልም (MP4) · HD')
        else:
            raise ValueError('Unaccounted Amharic source: '+url)
    if parts:
        parts.sort(key=lambda p:int(re.search(r'Amharic_(\d)',p[1])[1]))
        labels = 'የፊልሙ መግቢያ|የኢየሱስ ልደት|የኢየሱስ ጥምቀት|ሴትዮዋ በውኃ ጉድጓዱ አጠገብ|የቃሉ ዘር|ደጉ ሳምራዊ|የጌታ ጸሎት|ጎልጎታ|የኢየሱስ ትንሣኤ'.split('|')
        r = resource('film-savior-parts','film','The Savior — Trailer and eight parts','አዳኙ — መግቢያና 8 ክፍሎች',records['https://dbs.org/video/savior/amh_amharic_the_savior']['source'],'Create International')
        r['dbsListedUrls'] = [u for u,d in parts]
        r['play'] = {'kind':'chapters','base':'','items':[{'n':n,'file':d,'title':t} for n,((u,d),t) in enumerate(zip(parts,labels),1) if available(d)]}
        for (u,d),t in zip(parts,labels):
            download(r,d,t+' (MP4)')
    media['excluded'] = excluded
    save(f'catalog/source/dbs-media-amharic-{DATE}.json',media)
    save(f'catalog/source/dbs-amharic-external-{DATE}.json',{'language':'amh','verified':DATE,'urls':sorted(external),'excluded':excluded})
    save(f'catalog/source/dbs-direct-files-amharic-{DATE}.json',{'verified':DATE,'alive_files':sorted(u for u,p in probes.items() if p.get('valid') and urllib.parse.urlparse(u).path.endswith(('.pdf','.epub','.zip'))),'playable_audio_filesets':[r['play']['fileset'] for r in resources if r['type']=='audio-bible']})
    save('catalog/amharic.json',{'generated':'DBS rendered Amharic inventory — '+DATE,'languages':{'amh':{'code':'amh','name':'Amharic','native':'አማርኛ','script':'ethi','dir':'ltr','font':'ethiopic','region':'Ethiopia','blurb':'መጽሐፍ ቅዱስ፣ ክርስቲያናዊ ፊልሞችና የድምፅ ቅጂዎች በአማርኛ።'}},'resources':resources})
    print(len(resources),'Amharic resources;',len(excluded),'excluded source URLs')


if __name__ == '__main__':
    main()
