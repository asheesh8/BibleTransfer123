#!/usr/bin/env python3
"""Rebuild Igbo from rendered DBS rows and audited publisher media, never guesses."""
import json
import pathlib
import re
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'catalog/source'
DATE = '2026-10-03'

def load(name):
    return json.loads((SOURCE / name).read_text())

def save(name, data):
    (ROOT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1)+'\n')

def files(page, extension):
    return list(dict.fromkeys(a['url'] for a in page['links']
        if urllib.parse.urlparse(a['url']).path.endswith(extension)))

def main():
    audit = load(f'dbs-rendered-igbo-{DATE}.json')['ibo']
    media = load(f'dbs-media-igbo-{DATE}.json')
    probes = {p['url']:p for p in media['verified_files']['results']}
    resources, external, omitted, regional = [], set(), {}, {}
    def resource(slug, kind, title, native, source, variety='Igbo', org='Digital Bible Society'):
        r={'id':'ibo-'+slug,'lang':'ibo','type':kind,'title':title,'native':native,
           'scope':variety,'langName':'Asụsụ Igbo' + (' · '+variety if variety!='Igbo' else ''),
           'source':source,'org':org,'desc':'','downloads':[],'links':[]}
        resources.append(r)
        return r
    def downloads(r, urls, labels):
        r['downloads'] += [{'url':u,'label':labels(u,n)} for n,u in enumerate(urls,1)]
    def tracks(r, urls, titles=None):
        r['play']={'kind':'audio-collection','sample':urls[0],'items':[
            {'n':n,'file':u,'title':titles[n-1] if titles else f'Ụda {n}'} for n,u in enumerate(urls,1)]}
        downloads(r,urls,lambda u,n:(titles[n-1] if titles else f'Ụda {n}')+' (MP3)')
    def audio(fileset, source, title, native, variety='Igbo'):
        r=resource('ab-'+fileset.lower().replace('_','-'),'audio-bible',title,native,source,variety)
        r['org']='Faith Comes By Hearing' if fileset.startswith('IGR') else 'Davar Partners International'
        r['play']={'kind':'audio-bible','fileset':fileset,'version':fileset.split('_')[0],
                   'testaments':['NT'] if '_NT_' in fileset else ['OT','NT'],'saveChapter':True}
        opts=media['pages'][source]['selects'][0]['options']
        if not fileset.startswith('IGR'):
            core=(ROOT/'app/assets/js/core.js').read_text()
            table=re.search(r'var BOOKS = (\{.*?\n  \});',core,re.S)[1]
            layout=json.loads(re.sub(r'(OT|NT):',r'"\1":',table).replace("'",'"'))
            # Standard names come from the app's canonical CDN book layout.
            r['play']['bookNames']={b[1]:o['text'] for b,o in zip(layout['OT']+layout['NT'],opts)}
        if fileset in media['missing_chapters']:
            r['play']['missingChapters']=media['missing_chapters'][fileset]
            r['desc']='Ndi-Ikpe isi 18 adịghị na faịlụ DBS maka mbipụta a. Ị nwere ike ịnụ isi ahụ na mbipụta Union.'
        return r
    native_films={
        'ibo_ehugbo_jesus':'Jizọs — Ehugbo', 'ibo_enuani_jesus':'Jizọs — Enuani',
        'ibo_igbo_jesus':'Jizọs — Igbo',
        'ibo_igbo_story_of_jesus_for_children':'Akụkọ Jizọs maka ụmụaka',
        'ibo_enuani_luke':'LUMO: Ozi Ọma Luk — Enuani',
        'ibo_igbo_john':'LUMO: Ozi Ọma Jọn', 'ibo_igbo_luke':'LUMO: Ozi Ọma Luk',
        'ibo_igbo_mark':'LUMO: Ozi Ọma Mak', 'ibo_igbo_matthew':'LUMO: Ozi Ọma Matiu',
        'ibo_igbo_acts':'LUMO: Ọrụ Ndị Ozi', 'ibo_igbo_covenant':'LUMO: Ọgbụgba Ndụ',
        'ibo-acts-vb-igbo':'Baịbụl na vidio: Ọrụ Ndị Ozi',
        'ibo_igbo_rescue_project_deaf_gospel':'Rescue Project: Ozi Ọma maka ndị ntị chiri'}
    historic={
        'Igbo-1905-Genesis-Portion':'Akụkụ Jenesis — 1905',
        'Igbo-1906-Job-Malachi':'Job ruo Malakai — 1906',
        'Igbo-1982-Genesis-Portion':'Akụkụ Jenesis — 1982',
        'Igbo-Bible-print':'Baịbụl Igbo — akwụkwọ e nyochara',
        'Igbo-John-print':'Ozi Ọma Jọn — akwụkwọ e nyochara',
        'Igbo-New-Testament-print':'Agba Ọhụrụ — akwụkwọ e nyochara'}
    for section,group in audit.items():
        if section=='Links to Other Sites':continue
        for row in group['links']:
            u=row['href'];p=media['pages'][u];slug=urllib.parse.urlparse(u).path.split('/')[-1]
            if 'has moved' in p['text']:
                omitted[u]='DBS marks this edition as moved and links to current audio editions.'
                continue
            if section=='Bibles' and '/audio/' in u:
                ehugbo=slug.startswith('IGR')
                audio(slug,u,'Ehugbo New Testament — Audio' if ehugbo else 'Igbo Union Version — Audio', 'Agba Ọhụrụ n’ụda — Ehugbo' if ehugbo else 'Baịbụl n’ụda — Union', 'Ehugbo' if ehugbo else 'Igbo')
            elif section=='Bibles':
                r=resource('text-'+slug.lower(),'scripture','Igbo Contemporary Bible™','Baịbụlụ Nsọ n’Igbo Ndị Ugbu a',u,org='Biblica')
                r['links']=[{'label':'Gụọ Baịbụl na DBS','url':a['url']} for a in p['links'] if 'app-json-study/index.html' in a['url']][:1]
                downloads(r,[f for f in files(p,'.zip') if f in {a['url'] for a in media.get('browser_archives',[])}],lambda u,n:'Baịbụl HTML maka iji ya n’enweghị ịntanetị (ZIP)')
            elif section=='Historic Bible (Scans)':
                r=resource('scan-'+slug.lower(),'historic',row['title'],historic[slug],u)
                pdf=next(f for f in files(p,'.pdf') if probes.get(f,{}).get('valid'))
                r['read']={'kind':'pdf','url':pdf};downloads(r,[pdf],lambda u,n:'Akwụkwọ e nyochara (PDF)')
                # DBS's optional flip-Bible archives remain reachable on the original page.
            elif section=='Audio Collections':
                r=resource('ac-'+slug.lower(),'audio',row['title'],'Ụda e dekọrọ n’Igbo',u,org='Global Recordings Network')
                mp3=files(p,'.mp3');titles=[urllib.parse.unquote(f).split('/')[-3]+' — Ụda '+str(n) for n,f in enumerate(mp3,1)]
                tracks(r,mp3,titles)
                verified={a['url'] for a in media['browser_archives'] if a.get('crc_valid')}
                downloads(r,[f for f in files(p,'.zip') if f in verified],lambda u,n:'Ụda niile (ZIP) · '+('Nha faịlụ pere mpe' if 'low' in u else 'Ụda dị mma karịa'))
            elif section=='Films':
                variety='Ehugbo' if '_ehugbo_' in slug else 'Enuani' if '_enuani_' in slug else 'Igbo'
                r=resource('film-'+slug,'film',row['title'],native_films[slug],u,variety, row['cells'][1])
                mp4=files(p,'.mp4')
                chapters=[f for f in mp4 if '/chapters/' in f or '/films_low/' in f]
                if '/jesus/' in u and variety!='Enuani':
                    regional[u]='DBS links these chapters and ZIPs to Enuani; use this variety’s own full-film SD/HD instead.'
                    chapters=[]
                    mp4=[f for f in mp4 if 'ibo_enuani' not in f]
                if chapters:
                    titles=['Vidio zuru ezu' if '_full_' in f else 'Akụkụ '+str(int(re.search(r'_(\d\d)_360',f)[1])) if '/Lumo-Acts/' in f else f'Isi {n}' for n,f in enumerate(chapters,1)]
                    r['play']={'kind':'chapters','base':'','items':[{'n':n,'file':f,'title':titles[n-1]} for n,f in enumerate(chapters,1)]}
                    downloads(r,chapters,lambda u,n:titles[n-1]+' (MP4)')
                else:
                    sd=next((a['url'] for a in p['links'] if 'SD' in a['label'] and urllib.parse.urlparse(a['url']).path.endswith('.mp4')),None)
                    hd=next((a['url'] for a in p['links'] if 'HD' in a['label'] and urllib.parse.urlparse(a['url']).path.endswith('.mp4')),None)
                    if not sd:raise ValueError('No published full-film SD: '+u)
                    r['play']={'kind':'file','sd':sd,**({'hd':hd} if hd else {})}
                extras=[f for f in mp4 if f not in chapters]
                downloads(r,extras,lambda u,n:'Vidio zuru ezu (MP4) · '+('HD' if '/720p.' in u or '_high.' in u else 'SD'))
                for f in extras:
                    if not urllib.parse.urlparse(f).netloc.endswith('dbs.org'):external.add(f)
                if '/deafproject/' in u:
                    r['desc']='Ozi Ọma e gosiri site na mmegharị ahụ na ihe a na-ahụ anya maka ndị ntị chiri.'
                # Published chapter ZIPs are retained only when a complete browser download was checked.
                verified={a['url'] for a in media['browser_archives'] if a.get('crc_valid')}
                downloads(r,[f for f in files(p,'.zip') if f in verified and not (variety!='Enuani' and '/jesus/' in u)],lambda u,n:'Isi niile (ZIP)')
    audio('IBOBIB_DAVR_FB_N','https://dbs.org/bibles/audio/IBOBIB_DAVR_FB_N',
          'Igbo Contemporary Bible — Audio','Baịbụlụ Nsọ n’Igbo Ndị Ugbu a — n’ụda')
    rows={a['href']:a for a in audit['Links to Other Sites']['links']}
    collection=next(r for r in resources if r['id'].startswith('ibo-ac-'))
    youtube={'https://youtu.be/t98Ooce4B24':'mark','https://youtu.be/smiIy05SxKk':'matthew',
             'https://youtu.be/wosnMnMekI0':'john','https://youtu.be/raBzSRz7tWo':'luke'}
    for u,row in rows.items():
        if 'globalrecordings.net' in u:
            ident=u.split('/')[-1];variety={'1010':'Union','1670':'Asaa','5650':'Ohafia'}[ident]
            title=media['publishers'][u]['title']
            r=resource('grn-'+ident,'audio',title,'Okwu Ndụ — '+variety,u,variety,'Global Recordings Network')
            if ident=='5650':r['native']+=' na Union'
            external.add(u);r['links']=[{'label':'Mepee na weebụsaịtị onye bipụtara ya','url':u}]
            matched=[i['file'] for i in collection['play']['items'] if re.search(r'\b0*'+ident+r'\b',urllib.parse.unquote(i['file']).split('/')[-2])]
            if not matched:raise ValueError('Programme has no recordings: '+ident)
            tracks(r,matched)
        elif 'find.bible' in u:
            resolved=next(k for k in media['publishers'] if 'find.bible' in k)
            r=resource('publisher-iboilb','scripture',row['title'],'Baịbụl Igbo — mbipụta Union (1988)',resolved,org='find.bible')
            r['dbsListedUrl']=u;r['links']=[{'label':'Lee nkọwa mbipụta Baịbụl a','url':resolved}];external.add(resolved)
        elif u in youtube:
            r=next(r for r in resources if r['source'].endswith('/ibo_igbo_'+youtube[u]))
            r.setdefault('dbsListedUrls',[]).append(u)
    media['excluded']=omitted;media['wrong_regional_chapter_links']=regional
    save(f'catalog/source/dbs-media-igbo-{DATE}.json',media)
    save(f'catalog/source/dbs-igbo-external-{DATE}.json',{'language':'ibo','verified':DATE,'urls':sorted(external)})
    save('catalog/igbo.json',{'generated':'DBS rendered Igbo inventory — '+DATE,
        'languages':{'ibo':{'code':'ibo','name':'Igbo','native':'Asụsụ Igbo','script':'latn','dir':'ltr','font':'latin','region':'Nigeria','blurb':'Igbo Scripture, films and audio from DBS, with regional varieties labeled.'}},'resources':resources})
    save(f'catalog/source/dbs-direct-files-igbo-{DATE}.json',{'verified':DATE,
        'alive_files':sorted({u for u,p in probes.items() if p.get('valid') and urllib.parse.urlparse(u).path.endswith('.pdf')} | {a['url'] for a in media['browser_archives'] if a.get('crc_valid')}),
        'playable_audio_filesets':['IGRNBT_FCBH_NT_N','IBOILB_DAVR_FB_N','IBOBIB_DAVR_FB_N']})
    print(len(resources),'Igbo resources;',len(omitted),'retired editions;',len(external),'exact publisher URLs')

if __name__=='__main__':main()
