#!/usr/bin/env python3
"""Build Malagasy from the complete rendered DBS inventory and publisher audit."""
import collections
import json
import pathlib
import re
import urllib.parse
from et.build import secure

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'catalog/source'
DATE = '2026-10-04'
FILMS = ['LUMO: Ny Filazantsara araka an’i Jaona',
         'LUMO: Ny Filazantsara araka an’i Lioka',
         'LUMO: Ny Filazantsara araka an’i Marka',
         'LUMO: Ny Filazantsara araka an’i Matio',
         'LUMO: Ny Fanekena', 'iBible: Ny tena tantaran’i Jesosy',
         'Ny Baiboly amin’ny sarimihetsika: Matio',
         'Ny Baiboly amin’ny sarimihetsika: Asan’ny Apostoly']

def save(path, value):
    (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, indent=1)+'\n')

def files(page, suffix):
    return list(dict.fromkeys(a['url'] for a in page['links']
                if urllib.parse.urlparse(a['url']).path.lower().endswith(suffix)))

def programme(url):
    return re.search(r'(\d+)$', urllib.parse.unquote(url).split('/')[-2])[1]

def main():
    audit = json.loads((SOURCE/f'dbs-rendered-malagasy-{DATE}.json').read_text())['mlg']
    media = json.loads((SOURCE/f'dbs-media-malagasy-{DATE}.json').read_text())
    archives = {a['url'] for a in media['browser_archives'] if a['crc_valid']}
    external, resources = set(), []
    def available(u):
        probe = media['verified_files'].get(u, {})
        if u in archives or probe.get('valid') or probe.get('browser_valid'):
            return True
        # DBS blocks this HTTP client for video. Only accept captured MP4s
        # from an exact film page whose downloadable sample was validated.
        if probe.get('status') == 403 and urllib.parse.urlparse(u).path.endswith('.mp4'):
            return any(c.get('downloaded') and c.get('metadataDuration',0)>0
                       and any(a['url']==u for a in media['pages'][c['sourcePage']]['links'])
                       for c in media['browser_checks'])
        return False
    def make(slug, kind, row, native, org='Digital Bible Society', scope='Malagasy'):
        r = {'id':'mlg-'+slug, 'lang':'mlg', 'type':kind, 'title':row['title'],
             'native':native, 'langName':scope, 'scope':scope, 'source':row['href'],
             'org':org, 'desc':'', 'downloads':[], 'links':[]}
        resources.append(r)
        return r
    def link(r, u, label):
        u = secure(u)
        r['links'].append({'url':u, 'label':label})
        if not urllib.parse.urlparse(u).netloc.endswith('dbs.org'): external.add(u)
    def download(r, u, label):
        u = secure(u)
        assert available(u), u
        r['downloads'].append({'url':u, 'label':label})
        if not urllib.parse.urlparse(u).netloc.endswith('dbs.org'): external.add(u)
    def tracks(r, entries):
        items = [{'n':i,'file':a['url'],'title':a['title']} for i,a in enumerate(entries,1)]
        r['play'] = {'kind':'audio-collection','sample':items[0]['file'],'items':items}
        for a in items: download(r, a['file'], a['title']+' (MP3)')

    row = audit['Bibles']['links'][0]
    page = media['pages'][row['href']]
    r = make('text-mlgdpv', 'scripture', row, 'Ny Baiboly — dikan-teny protestanta', 'Malagasy Bible Society')
    r['year'] = 1965
    r['desc'] = 'Ny Baiboly amin’ny teny Malagasy. Ahitana boky 66 ny EPUB sy ny kopia HTML. Mila rindranasa mpamaky EPUB ianao hanokafana ny EPUB.'
    pdf = files(page, '.pdf')[0]
    r['read'] = {'kind':'pdf','url':pdf}
    for extension, label in [('.pdf','Ny Baiboly (PDF)'),('.epub','Ny Baiboly — boky 66 (EPUB)'),('.zip','Ny Baiboly azo vakina tsy misy aterineto (HTML ZIP)')]:
        download(r, files(page, extension)[0], label)
    link(r, row['href'], 'Jereo ao amin’ny DBS ny dikan-teny sy ny endrika hafa')
    audio_url = next(a['url'] for a in page['links'] if '/bibles/audio/' in a['url'])
    audio = media['pages'][audio_url]
    names = {re.search(r'/\d+_([^/]+)/',b['sample'])[1].replace('_',''):('Asan’ny Apostoly' if b['name']=='ASAN’NY APOSTOLY' else b['name']) for b in audio['books']}
    assert len(names)==27 and sum(len(b['chapters']) for b in audio['books'])==260
    r = make('ab-mlgdpv-fcbh-nt-n','audio-bible',dict(row,href=audio_url), 'Ny Testamenta Vaovao amin’ny feo', 'Faith Comes By Hearing')
    r['play'] = {'kind':'audio-bible','fileset':'MLGDPV_FCBH_NT_N','version':'MLGDPV','testaments':['NT'],'bookNames':names,'saveChapter':True}
    r['desc'] = 'Ny Testamenta Vaovao amin’ny feo: boky 27 sy toko 260. Mifidiana boky sy toko hohenoina na hosintonina.'
    link(r, audio_url, 'Jereo ao amin’ny DBS ny rakipeo sy ny endrika hafa')
    for u in files(audio,'.zip'):
        if available(u): download(r,u,'Ny Testamenta Vaovao amin’ny feo — toko rehetra (ZIP)')

    for n,row in enumerate(audit['Films']['links']):
        p = media['pages'][row['href']]
        r = make('film-'+row['href'].rsplit('/',1)[-1], 'film', row, FILMS[n], row['cells'][1])
        urls = files(p,'.mp4')
        parts = [u for u in urls if '/chapters/' in u or '/films_low/' in u and '/Lumo-' in u]
        if parts:
            r['play'] = {'kind':'chapters','base':'','items':[{'n':i,'file':u,'title':('Fizarana ' if n==4 else 'Toko ')+str(i)} for i,u in enumerate(parts,1)]}
            for i in r['play']['items']:
                # Exact browser checks are required when this publisher blocks probes.
                if available(i['file']): download(r,i['file'],i['title']+' (MP4)')
        else:
            sd = next((u for u in urls if '-sd.' in u), urls[0])
            hd = next((u for u in urls if '-hd.' in u),None)
            r['play'] = {'kind':'file','sd':sd,**({'hd':hd} if hd else {})}
        for u in urls:
            if u not in parts and available(u): download(r,u,'Sarimihetsika manontolo (MP4) · '+('HD' if '-hd.' in u else 'SD'))
        r['desc'] = 'Sarimihetsika ara-baiboly amin’ny teny Malagasy. Mifidiana toko na fizarana raha misy.'
        link(r,row['href'],'Jereo ao amin’ny DBS ny sarimihetsika sy ny fisintonana rehetra')

    for n,row in enumerate(audit['Historic Bible (Scans)']['links']):
        native = ['Ny Testamenta Vaovao (1830) — boky voasikana','Ny Baiboly (1865) — boky voasikana','Genesisy — boky voasikana','Jaona — boky voasikana'][n]
        r = make('scan-'+row['href'].rsplit('/',1)[-1].lower(),'historic',row,native)
        if n<2: r['year']=[1830,1865][n]
        pdf = files(media['pages'][row['href']],'.pdf')[0]
        r['read']={'kind':'pdf','url':pdf}
        download(r,pdf,'Boky voasikana (PDF)')
        link(r,row['href'],'Jereo ny boky ao amin’ny DBS')
        r['desc']='Boky Malagasy voasikana, araka ny lisitry ny DBS. Mety tsy hitovy amin’ny tsipelina ampiasaina ankehitriny ny tsipelina amin’ny boky tranainy.'

    grn_row, story_row = audit['Audio Collections']['links']
    groups = collections.defaultdict(list)
    for a in media['pages'][grn_row['href']]['tracks']: groups[programme(a['url'])].append(a)
    assert sum(map(len,groups.values()))==1440
    for ident, entries in groups.items():
        path = urllib.parse.unquote(entries[0]['url']).split('/')
        dialect, published = path[-3], entries[0]['series']
        scope = dialect.replace('Malagasy ', 'Malagasy: ')
        native = published.replace('Words of Life','Tenin’ny Fiainana').replace('Good News','Vaovao Tsara')
        publisher = media['publishers'].get('https://globalrecordings.net/en/program/'+ident)
        if publisher and 'Language name:' in publisher['text']:
            heading = publisher['text'].split(' Share\n',1)[1].split('\n',1)[0]
            native = heading.split(' [',1)[0].split(' - Malagasy',1)[0].split(' - Tandroy',1)[0].split(' - Betsimisaraka',1)[0]
            native = native.replace('Words of Life','Tenin’ny Fiainana').replace('Good News','Vaovao Tsara')
        elif re.search(r'LLL ([1-8])', published):
            num = int(re.search(r'LLL ([1-8])',published)[1])
            native = 'Jereo, Henoy, Hiaino '+str(num)+': '+[
                'Fiandohana miaraka amin’Andriamanitra','Lehilahy maherin’Andriamanitra',
                'Fandresena amin’ny alalan’Andriamanitra','Mpanompon’Andriamanitra',
                'Fitsapana noho ny finoana an’Andriamanitra','Jesosy, Mpampianatra sy Mpanasitrana',
                'Jesosy, Tompo sy Mpamonjy','Asan’ny Fanahy Masina'][num-1]
        elif 'Taratasy' in published:
            native = 'Taratasin’i Paoly · fandaharana '+ident
        elif 'Talily soa sinora' in published:
            native = 'Ny Filazantsara araka an’i '+{'67770':'Jaona','66834':'Lioka','67769':'Marka','67768':'Matio'}[ident]
        elif ident=='67460': native='Ny Filazantsara araka an’i Matio'
        elif 'Asa ty Apostoly' in published: native='Asan’ny Apostoly'
        r = make('grn-'+ident, 'audio', grn_row, native+' — '+dialect, 'Global Recordings Network', scope)
        r['title'] = path[-2]
        r['source'] = media['pages'][grn_row['href']]['resolved']
        r['dbsListedUrl'] = grn_row['href']
        # Preserve authored regional titles. English track headings receive
        # plain numbered Malagasy labels rather than an invented translation.
        labels = [{'url':a['url'],'title':native+' · '+('Toko ' if re.match(r'^\d+\.Toko ',a['title']) else 'Fizarana ')+str(i)} for i,a in enumerate(entries,1)]
        tracks(r,labels)
        r['desc']='Rakipeo ara-baiboly amin’ny fiteny na fitenim-paritra '+scope+'. Voatahiry ny filaharan’ny rakipeo navoakan’ny DBS.'
        link(r,r['source'],'Jereo ao amin’ny DBS ny fanangonana rakipeo')
        u='https://globalrecordings.net/en/program/'+ident
        p=media['publishers'].get(u)
        if p and u not in media['excluded']:
            assert len(p['playlist'])==len(entries)
            r.setdefault('dbsListedUrls',[]).append(u)
            link(r,u,'Jereo ao amin’ny GRN ny fandaharana sy ny endrika hafa')
    r=make('story-jesus','audio',story_row,'Ny tantaran’i Jesosy amin’ny feo','Story of Jesus')
    page=media['pages'][story_row['href']]
    urls=files(page,'.mp3')
    tracks(r,[{'url':u,'title':('Tantara manontolo' if u.endswith('_full.mp3') else 'Fizarana '+str(i))} for i,u in enumerate(urls)])
    r['source']=page['resolved'];r['dbsListedUrl']=story_row['href']
    r['desc']='Ny tantaran’i Jesosy amin’ny feo: rakipeo iray manontolo sy fizarana valo. Henoy na sintomy izay tianao.'
    link(r,r['source'],'Jereo ao amin’ny DBS ny tantara sy ny endrika hafa')
    for u in files(page,'.zip'):
        if available(u):download(r,u,'Ny tantaran’i Jesosy (ZIP)')

    for row in audit['Links to Other Sites']['links']:
        u=row['href']
        if u in media['excluded'] or 'globalrecordings.net' in u:continue
        p=media['publishers'][u]
        if 'find.bible' in u:
            code=urllib.parse.parse_qs(urllib.parse.urlparse(u).query)['abbr'][0]
            if code in ('MLGMNT','MLGOLD'):
                r=next(r for r in resources if r['type']=='historic' and ('1830' if code=='MLGMNT' else '1865') in r['native'])
                r.setdefault('dbsListedUrls',[]).append(u)
            else:
                r=make('edition-'+code.lower(),'scripture',row,'Ny Baiboly — '+('dikan-teny katolika' if code=='MLGRCV' else 'Dikanteny Iombonana Eto Madagasikara'),'find.bible')
                r['year']=2003;r['source']=p['resolved'];r['dbsListedUrl']=u
                r['desc']='Mombamomba ny dikan-teny sy rohy hahitana ny Baiboly amin’ny teny Malagasy. Tsidiho ny tranonkalan’ny mpamoaka mba hamaky na hihaino azy.'
            link(r,p['resolved'],'Jereo ny mombamomba ny dikan-teny sy ny rohin’ny mpamoaka')
        elif 'youtu.be' in u:
            book={'CAMj7DdzJPk':0,'OXBAEOUizC4':3,'XhUuv88MDzs':2,'b5rZKvuUWho':1}[u.rsplit('/',1)[-1]]
            r=next(r for r in resources if r['source']==audit['Films']['links'][book]['href'])
            r.setdefault('dbsListedUrls',[]).append(u)
            link(r,u,'Jereo ao amin’ny YouTube ny ampahany voalohany — LUMO')
        else:raise ValueError(u)
    save(f'catalog/source/dbs-media-malagasy-{DATE}.json',media)
    save(f'catalog/source/dbs-malagasy-external-{DATE}.json',{'language':'mlg','verified':DATE,'urls':sorted(external),'excluded':media['excluded']})
    save(f'catalog/source/dbs-direct-files-malagasy-{DATE}.json',{'verified':DATE,'alive_files':sorted(archives|{u for u,p in media['verified_files'].items() if p['valid'] and urllib.parse.urlparse(u).path.endswith(('.pdf','.epub','.zip'))}),'playable_audio_filesets':['MLGDPV_FCBH_NT_N']})
    save('catalog/malagasy.json',{'generated':'DBS rendered Malagasy inventory — '+DATE,'languages':{'mlg':{'code':'mlg','name':'Malagasy','native':'Malagasy','script':'latn','dir':'ltr','font':'latin','region':'Madagascar','blurb':'Baiboly, sarimihetsika ary rakipeo kristianina amin’ny teny Malagasy sy ny fitenim-paritra ao Madagasikara.'}},'resources':resources})
    print(len(resources),'Malagasy resources;',len(groups),'regional audio programmes;',len(media['excluded']),'excluded URLs')

if __name__=='__main__':main()
