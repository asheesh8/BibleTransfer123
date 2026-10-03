#!/usr/bin/env python3
"""Build the Oromo shelf from the saved, rendered DBS inventory and media audit.

No file paths are inferred. Re-running this script preserves the capture's
publisher URLs, complete chapter lists and clearly labeled regional varieties.
"""
import json
import pathlib
import re
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'catalog/source'
DATE = '2026-10-03'
VARIETIES = {'gaz':'Dhihaa fi Giddugaleessaa', 'orm':'Oromoo', 'hae':'Bahaa', 'gax':'Borana-Arsi-Guji'}

def load(name):
    return json.loads((SOURCE / name).read_text())

def save(name, data):
    (ROOT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1)+'\n')

def unique(xs):
    return list(dict.fromkeys(xs))

def files(page, ext):
    return unique(a['url'] for a in page['links'] if urllib.parse.urlparse(a['url']).path.endswith(ext))

def native_title(title):
    if '[' in title:
        return title.split(' [',1)[0]
    for original, translated in [
        ('King of Glory - HAYYU GUDDINNA','HAYYU GUDDINNA'), ('JESUS','Yesuus'), ('The Story of Jesus for Children','Seenaa Yesuus Ijoolleedhaaf'),
        ('Story of Jesus for Children','Seenaa Yesuus Ijoolleedhaaf'), ('Story of Jesus','Seenaa Yesuus'),
        ('Magdalena', 'Maariyaam Magdala'), ('The Savior','Fayyisaa'),
        ('LUMO: Acts of the Apostles','LUMO: Hojii Ergamootaa'),
        ('The Visual Bible: Acts','Kitaaba Qulqulluu Viidiyoodhaan: Hojii Ergamootaa'),
        ('The Visual Bible: Matthew','Kitaaba Qulqulluu Viidiyoodhaan: Maatewos'),
        ('LUMO: The Gospel of Mark','LUMO: Wangeela Maarqos'),
        ('LUMO: The Gospel of Luke','LUMO: Wangeela Luqaas'),
        ('Gospel of John','Wangeela Yohaannis'), ('LUMO: The Covenant','LUMO: Kakuu'),
        ('iBible: Salvation Story','iBible: Seenaa Fayyinaa'),
        ('Beginning with GOD','Waaqayyo waliin jalqabuu'), ('Mighty Men of GOD','Namoota Waaqayyoo jajjaboo'),
        ('Victory through GOD','Waaqayyoon moʼachuu'), ('Servants of GOD','Tajaajiltoota Waaqayyoo'),
        ('On Trial for GOD','Waaqayyoof qoramuu'), ('Teacher & Healer','Barsiisaa fi Fayyisaa'),
        ('Lord & Saviour','Gooftaa fi Fayyisaa'), ('Acts of the HOLY SPIRIT','Hojii Hafuura Qulqulluu'),
        ('Long Version','Gosa dheeraa'), ('Short','Gosa gabaabaa'),
        ('Oromo, Eastern','Oromoo Bahaa'), ('Oromo:','Oromoo:'),
        ('Words of Life','Jechoota Jireenyaa'), ('Good News','Oduu Gaarii'),
        ('Look, Listen & Live','Ilaali, Dhaggeeffadhu, Jiraadhu'), ('Songs','Faarfannaa')]:
        title = title.replace(original, translated)
    return title

def main():
    audit = load(f'dbs-rendered-{DATE}.json')
    media = load(f'dbs-media-oromo-{DATE}.json')
    probes = {p['url']:p for p in media['verified_files']['results']}
    external, resources, omitted = set(), [], {}
    def resource(rid, code, kind, title, source, native=None, org='Digital Bible Society'):
        r = {'id':rid,'lang':'orm','type':kind,'title':title,'native':(native or native_title(title)) + (' — '+VARIETIES[code] if code!='orm' and org!='Global Recordings Network' else ''),
             'scope':VARIETIES[code], 'langName':'Afaan Oromoo · '+VARIETIES[code], 'org':org,'desc':'','source':source,'downloads':[],'links':[]}
        resources.append(r)
        return r
    def downloads(r, urls, label):
        r['downloads'] += [{'label':label(u,n),'url':u} for n,u in enumerate(urls,1)]
    def tracks(r, urls, titles=None):
        if not urls:return
        r['play']={'kind':'audio-collection','sample':urls[0], 'items':[
            {'n':n,'title':titles[n-1] if titles else f'Sagalee {n}', 'file':u} for n,u in enumerate(urls,1)]}
        downloads(r,urls,lambda u,n:(titles[n-1] if titles else f'Sagalee {n}')+' (MP3)')
    # Readers and films in each distinct DBS regional listing.
    for code, groups in audit.items():
        for section, group in groups.items():
            if section=='Links to Other Sites':continue
            for a in group['links']:
                u=a['href'];p=media['pages'][u];slug=urllib.parse.urlparse(u).path.split('/')[-1]
                if 'has moved' in p['text']:
                    omitted[u]='DBS says this edition has moved and points to the current edition.'
                    continue
                if section=='Bibles' and '/audio/' in u:
                    title = 'Kitaaba Qulqulluu sagaleedhaan' + (' — Kakuu Moofaa' if '_OT_' in slug else '')
                    r=resource('orm-ab-'+slug.lower().replace('_','-'),code,'audio-bible',a['title'].split('\n')[0],u,title)
                    r['dbsTitle']=r['title']
                    r['title']=('West Central Oromo Old Testament audio — GAZGAZ' if slug.startswith('GAZGAZ') else 'Arsi-Bale Oromo full audio Bible — GAXWFW' if slug.startswith('GAXWFW') else r['title'])
                    r['play']={'kind':'audio-bible','fileset':slug,'version':slug.split('_')[0],
                               'testaments':['OT'] if '_OT_' in slug else ['OT','NT'],'saveChapter':True,
                               'bookNames':media['book_names'][slug]}
                elif section in ('Bibles','Historic Bible (Scans)'):
                    native={'GAZBIB':'Kitaaba Qulqulluu — Hiikkaa Ammayyaa Banamaa Haaraa',
                            'GAZBIBL':'Kitaaba Qulqulluu — Qubee Laatiiniitiin', 'HAEBSE':'Irbuu Haaraya',
                            'Oromo-John-print':'Wangeela Yohaannis — 1994',
                            'Oromo-Latin-John-book':'Wangeela Yohaannis — Qubee Laatiiniitiin, 1994'}[slug]
                    r=resource('orm-text-'+slug.lower(),code,'historic' if 'historic' in u else 'scripture',a['title'].split('\n')[0],u,native)
                    live=[f for f in files(p,'.pdf') if probes.get(f,{}).get('valid')]
                    if live:r['read']={'kind':'pdf','url':live[0]};downloads(r,live,lambda u,n:'PDF')
                    for link in p['links']:
                        if 'app-json-study/index.html' in link['url'] and link['url'] not in [x['url'] for x in r['links']]:
                            r['links'].append({'label':'DBS irratti dubbisi','url':link['url']})
                elif section=='Films':
                    r=resource('orm-film-'+slug,code,'film',a['title'],u,org=a['cells'][1])
                    if slug.startswith('gax_guji_'):
                        r['scope']='Guji';r['langName']='Afaan Oromoo · Guji';r['native']=r['native'].replace(' — Borana-Arsi-Guji',' — Guji')
                    mp4=files(p,'.mp4');chapters=[f for f in mp4 if '/chapters/' in f or '/films_low/' in f]
                    if '/rock/' in u:chapters=[f for f in mp4 if 'part' in f and '_low.mp4' in f]
                    if chapters:
                        r['play']={'kind':'chapters','base':'','items':[{'n':n,'title':f'Boqonnaa {n}','file':f} for n,f in enumerate(chapters,1)]}
                        downloads(r,chapters,lambda u,n:f'Boqonnaa {n} (MP4)')
                    elif mp4:
                        sd=next((a['url'] for a in p['links'] if 'SD' in a['label'] and '.mp4' in a['url']),None)
                        sd=sd or next((f for f in mp4 if '-sd.mp4' in f or '_low.mp4' in f),mp4[0])
                        hd=next((a['url'] for a in p['links'] if 'HD' in a['label'] and '.mp4' in a['url']),None)
                        hd=hd or next((f for f in mp4 if '-hd.mp4' in f),None)
                        r['play']={'kind':'file','sd':sd,**({'hd':hd} if hd else {})}
                    for f in mp4:
                        if f not in chapters:r['downloads'].append({'label':'Viidiyoo (MP4)' + (' · Qulqullina olaanaa' if f==r.get('play',{}).get('hd') else ''),'url':f})
                        if not urllib.parse.urlparse(f).netloc.endswith('dbs.org'):external.add(f)
                    downloads(r,files(p,'.zip'),lambda u,n:'Boqonnaawwan hundumaa (ZIP) · '+('Daataa xiqqaa' if 'low' in u else 'Qulqullina olaanaa'))
                elif section=='Audio Collections':
                    title='Seenaa Yesuus' if '/soj/' in u else 'Seenaawwan Kitaaba Qulqulluu' if '/srun/' in u else 'Waraabbiiwwan sagalee'
                    r=resource('orm-ac-'+slug.lower(),code,'audio',a['title'],u,title,org=a['cells'][1])
                    mp3=files(p,'.mp3')
                    foreign=[f for f in mp3 if re.search(r'/(Orma|Afan%20Munyoyaya)/',f)]
                    mp3=[f for f in mp3 if f not in foreign]
                    full=[f for f in mp3 if '_Full.' in f or '_full.' in f]
                    parts=[f for f in mp3 if f not in full]
                    titles=None
                    if '/grn/' in u:
                        titles=[urllib.parse.unquote(f).split('/')[-3]+' — Sagalee '+str(n) for n,f in enumerate(parts,1)]
                    tracks(r,parts,titles)
                    downloads(r,full,lambda u,n:'Seenaa guutuu (MP3)')
                    downloads(r,files(p,'.zip'),lambda u,n:'Sagalee hundumaa (ZIP) · '+('Daataa xiqqaa' if 'low' in u else 'Qulqullina olaanaa')+(' · Oromoo, Orma fi Munyoyaya' if foreign else ''))
                    if foreign:r['desc']='MP3 as taphatu Afaan Oromoo keessa jira. ZIP maxxansaan qopheesse waraabbiiwwan Orma fi Munyoyaya dabalatee qaba.'
    # The current GAZBIB audio edition is linked from its Bible detail page.
    fileset='GAZBIB_DAVR_FB_N';u='https://dbs.org/bibles/audio/'+fileset
    r=resource('orm-ab-gazbib-davr-fb-n','gaz','audio-bible','Open New Oromo Contemporary Version — Audio',u,'Kitaaba Qulqulluu sagaleedhaan — Hiikkaa Ammayyaa')
    r['play']={'kind':'audio-bible','fileset':fileset,'version':'GAZBIB','testaments':['OT','NT'],'saveChapter':True,'bookNames':media['book_names'][fileset]}
    # Preserve publisher programmes with all of their DBS-hosted recordings.
    grn = [r for r in resources if r['id'].startswith('orm-ac-') and '/grn/' in r['source'] and '/orm_' not in r['source']]
    rows={a['href']:(c,a) for c,g in audit.items() for s,x in g.items() if s=='Links to Other Sites' for a in x['links']}
    for u,(code,a) in rows.items():
        if 'globalrecordings.net' in u:
            ident=u.split('/')[-1];p=media['partners'][u];title=p['title'];native=native_title(title)
            r=resource('orm-grn-'+ident,code,'audio',title,u,native,org='Global Recordings Network')
            r['links']=[{'label':'Weebsaayitii maxxansaa irratti bani','url':u}];external.add(u)
            matched=[]
            for c in grn:
                matched += [i['file'] for i in c.get('play',{}).get('items',[]) if re.search(r'\b0*'+ident+r'\b',urllib.parse.unquote(i['file']).split('/')[-2])]
            matched=unique(matched);tracks(r,matched)
        elif 'find.bible' in u:
            abbr=u.split('abbr=')[-1];resolved='https://find.bible/bibles/'+abbr+'/index.html';external.add(resolved)
            r=resource('orm-publisher-'+abbr.lower(),code,'scripture',a['title'],resolved,'Kitaaba Qulqulluu — '+abbr)
            r['dbsListedUrl']=u;r['links']=[{'label':'Maxxansa Kitaaba Qulqulluu ilaali','url':resolved}]
        elif 'arc.gt' in u:
            target = next(r for r in resources if ('/magdalena/' if '8q6oi' in u else '/storyjesus/') in r['source'])
            target.setdefault('dbsListedUrls',[]).append(u)
        elif '/KoG/' in u or '/rock-video/' in u:
            target=next(r for r in resources if '/video/rock/' in r['source']);target.setdefault('dbsListedUrls',[]).append(u)
        elif 'Yaadanii' in u:
            resolved='https://s3.amazonaws.com/cdn.createinternational.com/non-create_videos/Oromo-Ethiopia_Yaadanii_sm.mp4'
            r=resource('orm-film-yaadanii','gaz','film','Yaadanii',resolved,'Yaadanii',org='Create International')
            r['dbsListedUrl']=u;r['play']={'kind':'file','sd':resolved};r['downloads']=[{'label':'Yaadanii (MP4)','url':resolved}];external.add(resolved)
        elif '/rock-audio/' in u or '/rock-document/' in u:
            audio='/rock-audio/' in u
            r=resource('orm-rock-karaa-haqa-'+('audio' if audio else 'text'),'orm','audio' if audio else 'scripture','The Way of Righteousness',u,'Karaa Haqa — '+('Barumsa sagaleedhaan' if audio else 'Barreeffama'),org='ROCK International')
            r['links']=[{'label':'Barumsa 100 maxxansaa irraa dhaggeeffadhu' if audio else 'Barreeffama maxxansaa irraa dubbisi','url':u}];external.add(u)
            if not audio:
                pdf=next(f for f in files(media['partners'][u],'.pdf') if probes.get(f,{}).get('valid'))
                r['read']={'kind':'pdf','url':pdf};r['downloads']=[{'label':'Karaa Haqa (PDF)','url':pdf}];external.add(pdf)
            else:r['desc']='Barumsa 100 Afaan Oromoo keessatti. Dhaggeeffachuuf weebsaayitii maxxansaa bani.'
    media['excluded']=omitted
    save(f'catalog/source/dbs-media-oromo-{DATE}.json',media)
    save(f'catalog/source/dbs-oromo-external-{DATE}.json',{'language':'orm','verified':DATE,'urls':sorted(external)})
    save('catalog/oromo.json',{'generated':'DBS rendered Oromo inventories — '+DATE,
         'languages':{'orm':{'code':'orm','name':'Oromo','native':'Afaan Oromoo','script':'latn','dir':'ltr','font':'latin','region':'Ethiopia and Kenya','blurb':'Oromo resources from DBS, with their regional varieties labeled.'}},'resources':resources})
    save(f'catalog/source/dbs-direct-files-{DATE}.json',{'verified':DATE,
         'alive_files':sorted(u for u,p in probes.items() if p['valid'] and urllib.parse.urlparse(u).path.endswith(('.pdf','.epub','.zip'))),
         'playable_audio_filesets':sorted(media['book_names'])})
    print(len(resources),'Oromo resources;',len(omitted),'retired editions;',len(external),'exact publisher URLs')

if __name__=='__main__':main()
