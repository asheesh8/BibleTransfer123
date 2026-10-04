#!/usr/bin/env python3
"""Build Nigerian Pidgin from the complete rendered DBS inventory."""
import json
import pathlib
import urllib.parse
from et.build import secure

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'catalog/source'
DATE = '2026-10-04'
FILMS = ['JESUS', 'LUMO: Di Good News wey John write', 'LUMO: Di Good News wey Luke write',
         'LUMO: Di Good News wey Mark write', 'LUMO: Di Good News wey Matiu write',
         'Di Good News wey John write with pictures', 'Bible stories with pictures',
         'iBible: Di Ril Tori of Jesus', 'Bible film: Matiu', 'Bible film: Acts']
GRN = ['Satan, awa big enemy', 'Di Good News', 'Wetin God pay to bring peace',
       'How to be born again', 'How to become God pikin', 'Jesus dey alive',
       'Find God kingdom first', 'Di man from Gadara', 'Jesus dey great',
       'Jesus dey heal and forgive', 'Turn from sin and believe', 'Judgement Day',
       'God or Baal · Choose today · You dey fear? · Be careful',
       'Christ na awa victory · Na light we want · Clean heart · Who get power to forgive sin? · After you believe · Your name dey higher']


def save(path, value):
    (ROOT/path).write_text(json.dumps(value, ensure_ascii=False, indent=1)+'\n')


def files(page, suffix):
    return list(dict.fromkeys(a['url'] for a in page['links']
                if urllib.parse.urlparse(a['url']).path.lower().endswith(suffix)))


def main():
    audit=json.loads((SOURCE/f'dbs-rendered-nigerian-pidgin-{DATE}.json').read_text())['pcm']
    media=json.loads((SOURCE/f'dbs-media-nigerian-pidgin-{DATE}.json').read_text())
    probes=media['verified_files']; resources=[]; external=set()
    archives={a['url'] for a in media['browser_archives'] if a['crc_valid']}
    def available(u):
        p=probes.get(secure(u), {})
        # DBS blocks non-browser Range requests to its video/CDN hosts.
        # Keep observed publisher files; browser media checks are separate evidence.
        return u in archives or p.get('valid') or p.get('status') in (403, 406)
    def make(slug, kind, row, native, org):
        r={'id':'pcm-'+slug, 'lang':'pcm', 'type':kind, 'title':row['title'],
           'native':native, 'langName':'Naija Pidgin', 'scope':'Naija Pidgin',
           'source':row['href'], 'org':org, 'desc':'', 'downloads':[], 'links':[]}
        resources.append(r); return r
    def link(r,u,label):
        u=secure(u); r['links'].append({'url':u,'label':label})
        if not urllib.parse.urlparse(u).netloc.endswith('dbs.org'): external.add(u)
    def download(r,u,label):
        if available(u):
            r['downloads'].append({'url':secure(u),'label':label})
            if not urllib.parse.urlparse(u).netloc.endswith('dbs.org'): external.add(secure(u))
    def tracks(r, urls, titles):
        assert len(urls)==len(titles)
        items=[{'n':n,'file':secure(u),'title':t} for n,(u,t) in enumerate(zip(urls,titles),1) if available(u)]
        assert len(items)==len(urls)
        r['play']={'kind':'audio-collection','sample':items[0]['file'],'items':items}
        for i in items: download(r,i['file'],i['title']+' (MP3)')
    row=audit['Bibles']['links'][0]; p=media['pages'][row['href']]
    r=make('text-pcmwbt','scripture',row,'Holy Bible for Naija Pidgin — DBS 2012 edition','Wycliffe Bible Translators')
    r['year']=2012
    r['desc']='Read di Bible online, or download di HTML ZIP. To read am without internet, extract di ZIP and open html/index.html. Di ZIP get all 66 books. DBS list dis edition as 2012.'
    download(r,files(p,'.zip')[0],'Bible to read without internet (HTML ZIP)')
    for a in p['links']:
        if 'inscript.org/' in a['url']: link(r,a['url'],'Read di Bible online')
        elif 'bible.com/versions/' in a['url']: link(r,a['url'],'See dis Bible for YouVersion')
        elif 'play.google.com/' in a['url']: link(r,a['url'],'Bible app for Android · '+('Faith Comes By Hearing' if 'fcbh' in a['url'] else 'Wycliffe'))
    for n,row in enumerate(audit['Films']['links']):
        p=media['pages'][row['href']]; r=make('film-'+row['href'].rsplit('/',1)[-1],'film',row,FILMS[n],row['cells'][1])
        urls=files(p,'.mp4'); chapters=[u for u in urls if '/chapters/' in u or '/Lumo-' in u]
        if chapters:
            items=[{'n':i,'file':secure(u),'title':('Part ' if n in (5,6) else 'Chapter ')+str(i)} for i,u in enumerate(chapters,1) if available(u)]
            assert len(items)==len(chapters)
            r['play']={'kind':'chapters','base':'','items':items}
            for i in items: download(r,i['file'],i['title']+' (MP4)')
        else:
            sd=next((u for u in urls if '-sd.' in u or '/270p.' in u), urls[0])
            hd=next((u for u in urls if '-hd.' in u or '/720p.' in u), None)
            r['play']={'kind':'file','sd':secure(sd),**({'hd':secure(hd)} if hd else {})}
        for u in urls:
            if u not in chapters: download(r,u,'Whole film (MP4) · '+('HD' if '-hd.' in u or '/720p.' in u else 'Use less data'))
        link(r,row['href'],'See di film and other downloads for DBS')
    for n,row in enumerate(audit['Audio Collections']['links']):
        p=media['pages'][row['href']]
        r=make('ac-'+row['href'].rsplit('/',1)[-1].lower(),'audio',row,'Words wey give life — all recordings' if n==0 else 'Di story of Jesus for audio',row['cells'][1])
        urls=files(p,'.mp3');titles=GRN if n==0 else ['Di whole story']+['Part '+str(i) for i in range(1,9)]
        tracks(r,urls,titles)
        for u in files(p,'.zip'):
            if u in archives: download(r,u,'All recordings (ZIP) · '+('Use less data' if '_low.zip' in u else 'All parts'))
        link(r,row['href'],'See all downloads for DBS')
    collection=next(r for r in resources if r['id'].startswith('pcm-ac-pcm_global'))
    for n,row in enumerate(audit['Links to Other Sites']['links']):
        programme=row['href'].rsplit('/',1)[-1]; p=media['publishers'][row['href']]
        assert 'Pidgin, Nigeria' in p['title']
        r=make('grn-'+programme,'audio',row,'Words wey give life '+str(n+1),'Global Recordings Network')
        items=[i for i in collection['play']['items'] if programme+'.mp3' in i['file']]
        assert len(items)==(12 if n==0 else 2)
        tracks(r,[i['file'] for i in items],[i['title'] for i in items])
        link(r,row['href'],'See di programme and other formats for GRN')
    media['excluded']={}
    save(f'catalog/source/dbs-media-nigerian-pidgin-{DATE}.json',media)
    save(f'catalog/source/dbs-nigerian-pidgin-external-{DATE}.json',{'language':'pcm','verified':DATE,'urls':sorted(external),'excluded':{}})
    save(f'catalog/source/dbs-direct-files-nigerian-pidgin-{DATE}.json',{'verified':DATE,'alive_files':sorted(archives),'playable_audio_filesets':[]})
    save('catalog/nigerian-pidgin.json',{'generated':'DBS rendered Nigerian Pidgin inventory — '+DATE,
        'languages':{'pcm':{'code':'pcm','name':'Nigerian Pidgin','native':'Naija Pidgin','script':'latn','dir':'ltr','font':'latin','region':'Nigeria','blurb':'Bible, films and Christian recordings for Naija Pidgin.'}},'resources':resources})
    print(len(resources),'Nigerian Pidgin resources')


if __name__=='__main__':main()
