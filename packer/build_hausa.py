#!/usr/bin/env python3
"""Build Hausa from the complete DBS rendered inventory and publisher audit."""
import json
import pathlib
import re
import urllib.parse
from et.build import secure
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'catalog/source'
DATE='2026-10-04'
FILMS=['YESU','Magdalena','Labarin Yesu don Yara','Mai Ceto','Labarin Annabawa',
 'LUMO: Bishara ta Yohanna','LUMO: Bishara ta Luka','LUMO: Bishara ta Markus',
 'LUMO: Alkawari','iBible: Labarin Ceto','Littafi Mai Tsarki a Fim: Mattiyu',
 'Littafi Mai Tsarki a Fim: Ayyukan Manzanni','Rescue Project: Bishara ga Masu Rashin Ji']
SERIES={'37742':'Zama Abokin Allah — Kurfey','37743':'Labari Mai Daɗi — Kurfey',
 '35171':'Labari Mai Daɗi — Kano','130':'Kalmomin Rai 1 — Kano','131':'Kalmomin Rai 2 — Kano',
 '121':'Kalmomin Rai — Sokoto','120':'Kalmomin Rai — Ghana',
 '10500':'Kalmomin Rai 1 — Arewa','10810':'Kalmomin Rai 2 — Arewa','74541':'Labari Mai Daɗi',
 '74543':'Duba, Saurara, ka Rayu 1 — Farawa da Allah',
 '74546':'Duba, Saurara, ka Rayu 2 — Jaruman Allah',
 '74542':'Duba, Saurara, ka Rayu 3 — Nasara ta wurin Allah',
 '80293':'Duba, Saurara, ka Rayu 4 — Bayin Allah',
 '74540':'Duba, Saurara, ka Rayu 5 — Jarrabawa saboda Allah',
 '74544':'Duba, Saurara, ka Rayu 6 — Yesu, Malami da Mai Warkarwa',
 '74547':'Duba, Saurara, ka Rayu 7 — Yesu, Ubangiji da Mai Ceto',
 '80294':'Duba, Saurara, ka Rayu 8 — Ayyukan Ruhu Mai Tsarki'}
MIXED={'2301':'Jarawa: Gar','2330':'Kulere','2320':'Mada: Katanza','391':'Zul',
 '14600':'Shiki: Gubi','5701':'Tehl','531':'Tsuvadi: Ubaka','401':'Zari: Zakshi',
 '370':'Zeem: Lushi','14821':'Whana'}
SAVIOR=['Tallan Fim','Haihuwar Yesu','Baptismar Yesu','Matar da ke Rijiyar',
 'Shuka Kalmar Allah','Basamariye Mai Kirki','Addu’ar Ubangiji','Golgotha','Yesu ya Tashi daga Matattu']

def save(path,value):
 (ROOT/path).write_text(json.dumps(value,ensure_ascii=False,indent=1)+'\n')

def files(p,suffix):
 return list(dict.fromkeys(a['url'] for a in p.get('links',[]) if urllib.parse.urlparse(a['url']).path.lower().endswith(suffix)))

def programme(u):
 return str(int(re.search(r'(\d+)$',urllib.parse.unquote(u).split('/')[-2])[1]))

def booknames(p):
 return {re.search(r'/\d+_([^/]+)/',b['sample'])[1].replace('_',''):b['name'] for b in p['books']}

def main():
 audit=json.loads((SOURCE/f'dbs-rendered-hausa-{DATE}.json').read_text())['hau']
 media=json.loads((SOURCE/f'dbs-media-hausa-{DATE}.json').read_text())
 probes=media['verified_files'];resources=[];external=set();excluded=dict(media['excluded'])
 archives={a['url'] for a in media['browser_archives'] if a['crc_valid']}
 for row in audit['Links to Other Sites']['links']:
  if '/MTD/' in row['href']:
   excluded[row['href']]='Christian conversion testimony set in Muslim communities; omitted under the requested content selection.'
 excluded['https://globalrecordings.net/en/program/5690']='GRN says this recording is not currently available online.'
 excluded['https://globalrecordings.net/en/program/66703']='COVID education, not a Christian Bible resource; all six tracks and the unfiltered GRN ZIPs are omitted.'
 def available(u):
  p=probes.get(secure(u),{})
  # Browser checks confirm these publishers serve media despite blocking the
  # command-line client. Availability is not a claim to have watched each film.
  return u in archives or p.get('valid') or (p.get('status') in (403,406) and urllib.parse.urlparse(u).hostname in ('video.dbs.org','dbs.org','rockintl.org'))
 def make(slug,kind,row,native,org='Digital Bible Society',scope='Hausa'):
  r={'id':'hau-'+slug,'lang':'hau','type':kind,'title':row['title'],'native':native,'langName':scope,'scope':scope,'source':row['href'],'org':org,'desc':'','downloads':[],'links':[]};resources.append(r);return r
 def link(r,u,label):
  u=secure(u);r['links'].append({'url':u,'label':label})
  if not urllib.parse.urlparse(u).netloc.endswith('dbs.org'):external.add(u)
 def download(r,u,label):
  assert available(u),u
  u=secure(u);r['downloads'].append({'url':u,'label':label})
  if not urllib.parse.urlparse(u).netloc.endswith('dbs.org'):external.add(u)
 def tracks(r,urls,titles):
  assert len(urls)==len(titles) and urls
  items=[{'n':n,'file':secure(u),'title':t} for n,(u,t) in enumerate(zip(urls,titles),1)]
  r['play']={'kind':'audio-collection','sample':items[0]['file'],'items':items}
  for i in items:download(r,i['file'],i['title']+' (MP3)')
 for section,g in audit.items():
  if section=='Links to Other Sites':continue
  for n,row in enumerate(g['links']):
   u=row['href'];p=media['pages'][u];slug=u.rsplit('/',1)[-1]
   if u in excluded:continue
   if section=='Bibles' and '/audio/' in u:
    version=slug.split('_')[0];r=make('ab-'+slug.lower().replace('_','-'),'audio-bible',row,'Littafi Mai Tsarki a Sauti — '+('Littafi Mai Tsarki' if version=='HAUBSN' else 'Labari Nagari'),'Davar Partners International')
    r['play']={'kind':'audio-bible','fileset':slug,'version':version,'testaments':['OT','NT'],'bookNames':booknames(p),'saveChapter':True}
    assert len(p['books'])==66 and sum(len(b['chapters']) for b in p['books'])==1189
    r['desc']='Cikakken Littafi Mai Tsarki a sauti: littattafai 66, babi 1,189. Zaɓi littafi da babi don sauraro ko zazzagewa.'
    r['year']=1932 if version=='HAUBSN' else 1857
    if version=='HAUPOR':r['desc']+=' DBS ya danganta wannan da bugun Labari Nagari na 1857, amma sautin da aka wallafa ya ƙunshi Sabon Alkawari da Tsohon Alkawari.'
    link(r,u,'Duba wannan bugun da sauran nau’o’insa a DBS')
   elif section=='Bibles':
    door=slug=='HAUDOR';r=make('text-'+slug.lower(),'scripture',row,'Littafi Mai Tsarki — Door Version' if door else 'Sabon Rai Don Kowa — Sabon Alkawari','Door43 World Missions Community' if door else 'Biblica');r['year']=2020
    for a in p['links']:
     if 'inscript.org/?' in a['url']:link(r,a['url'],'Karanta a intanet')
    if door:
     epub=files(p,'.epub')[0];download(r,epub,'Sabon Alkawari — littattafai 27 (EPUB)')
     r['desc']='Bugun Door43 na Hausa. Fayil ɗin EPUB da DBS ya wallafa yana ɗauke da littattafai 27 na Sabon Alkawari. Ka buɗe shi da manhajar karanta EPUB. DBS yana bayyana bugun a matsayin cikakken Littafi Mai Tsarki; wannan EPUB ɗin Sabon Alkawari ne kawai.'
    else:r['desc']='Sabon Rai Don Kowa na Biblica. Shafin DBS yana bayyana wannan jerin a matsayin Sabon Alkawari; ana karantawa a intanet.'
    link(r,u,'Duba bayanin bugun a DBS')
   elif section=='Films':
    r=make('film-'+slug,'film',row,FILMS[n],row['cells'][1]);urls=files(p,'.mp4');parts=[f for f in urls if ('/chapters/' in f or '/Lumo-' in f) and '_full_' not in f]
    if parts:
     items=[{'n':i,'file':secure(f),'title':('Sashe ' if n in (0,8) else 'Babi ')+str(i)} for i,f in enumerate(parts,1)]
     r['play']={'kind':'chapters','base':'','items':items}
     for i in items:download(r,i['file'],i['title']+' (MP4)')
    else:
     sd=next((f for f in urls if '_low.' in f or '-sd.' in f or '/270p.' in f),urls[0]);hd=next((f for f in urls if '_high.' in f or '-hd.' in f or '/720p.' in f),None)
     r['play']={'kind':'file','sd':secure(sd),**({'hd':secure(hd)} if hd and hd!=sd else {})}
    for f in urls:
     if f not in parts:download(r,f,'Cikakken fim (MP4) · '+('HD' if '_high.' in f or '-hd.' in f or '/720p.' in f else 'SD'))
    link(r,u,'Duba fim ɗin da sauran nau’o’insa a DBS')
   elif section=='Historic Bible (Scans)':
    names=['Ayyukan Manzanni — Schön (1857)','Yohanna — Labari Nagari (1877)','Wasiku da Wahayin Yohanna (1879)','Bisharu da Ayyukan Manzanni (1914)','Farawa — wani ɓangare (1932)','Sabon Alkawari — hotunan littafi']
    r=make('scan-'+slug.lower(),'historic',row,names[n]);
    if n<5:r['year']=[1857,1877,1879,1914,1932][n]
    pdf=files(p,'.pdf')[0];r['read']={'kind':'pdf','url':pdf};download(r,pdf,'Hotunan littafi (PDF)');link(r,u,'Duba littafin a DBS')
    r['desc']='Hotunan shafukan littafin Hausa. Rubutun tsohon bugu zai iya bambanta da Hausa ta yau.'
   elif section=='Audio Collections':
    grn='/grn/' in u;story='/soj/' in u
    r=make('ac-'+slug.lower(),'audio',row,'GRN: Koyarwar Littafi Mai Tsarki a Hausa' if grn else 'Labarin Yesu a Sauti' if story else 'StoryRunners: Labarun Littafi Mai Tsarki a Hausa',row['cells'][1]);urls=files(p,'.mp3')
    if grn:
     urls=[f for f in urls if programme(f)!='66703'];counts={};titles=[]
     for f in urls:
      ident=programme(f);counts[ident]=counts.get(ident,0)+1;titles.append(SERIES[ident]+' · Sashe '+str(counts[ident]))
     assert len(urls)==372
     r['desc']='Koyarwar Littafi Mai Tsarki da waƙoƙin Kirista a Hausa, ciki har da Kano, Kurfey, Arewa, Sokoto da Ghana. Ba a haɗa shirin ilimin COVID ba.'
    elif story:titles=['Cikakken labari']+['Sashe '+str(i) for i in range(1,9)]
    else:
     titles=[]
     for i,f in enumerate(urls,1):
      name=urllib.parse.unquote(f).rsplit('/',1)[-1]
      m=re.match(r'Hausa-Nigeria-(\d+)-(.+?)-',name)
      titles.append(m[2].replace('_',' ')+' — Najeriya' if m else 'Labari na '+str(i)+' — Nijar')
     r['desc']='Labarun Littafi Mai Tsarki a Hausa daga Najeriya da Nijar. Zaɓi labari don sauraro ko zazzagewa.'
    tracks(r,urls,titles);link(r,p.get('resolved',u),'Duba tushen sautin a DBS');r['dbsListedUrl']=u
 grn=next(r for r in resources if r['id'].startswith('hau-ac-hau_global'))
 savior=[]
 for u,row in {a['href']:a for a in audit['Links to Other Sites']['links']}.items():
  if u in excluded:continue
  p=media['publishers'].get(u,{})
  if '/Savior/' in u:savior.append(row);continue
  if 'find.bible' in u:
   code=urllib.parse.parse_qs(urllib.parse.urlparse(u).query)['abbr'][0]
   if code in ('HAUBSN','HAUPOR'):
    r=next(r for r in resources if r.get('play',{}).get('version')==code);r.setdefault('dbsListedUrls',[]).append(u);link(r,p['resolved'],'Duba bayanin wannan bugun')
   else:
    r=make('edition-hauajm','scripture',row,'Littafi Mai Tsarki a Hausa — rubutun Ajami','find.bible','Hausa (Ajami)');r['source']=p['resolved'];r['dbsListedUrl']=u;link(r,p['resolved'],'Duba bugun da hanyoyin samun sa')
    r['desc']='Bayanin bugun Littafi Mai Tsarki a Hausa da rubutun Ajami. Wannan Hausa ce, ba harshen Larabci ba. Duba hanyoyin mawallafin don karantawa ko samun littafin.'
  elif 'arc.gt' in u:
   r=make('film-magdalena-directors-cut','film',row,'Magdalena — bugun darakta','Jesus Film Project');r['dbsListedUrl']=u;r['source']=p['resolved'];r['play']={'kind':'file','sd':p['resolved']};download(r,p['resolved'],'Cikakken fim (MP4) · HD');link(r,p['resolved'],'Buɗe fim ɗin')
  elif 'globalrecordings.net' in u:
   ident=u.rsplit('/',1)[-1];items=[i for i in grn['play']['items'] if programme(i['file'])==ident]
   if items:
    dialect=next((d for d in ['Kurfey','Kano','Sokoto','Ghana','Arewa'] if d in SERIES[ident]),None)
    r=make('grn-'+ident,'audio',row,SERIES[ident],'Global Recordings Network','Hausa'+(': '+dialect if dialect else ''));tracks(r,[i['file'] for i in items],[i['title'] for i in items])
   else:
    published=[a['url'] for a in p['playlist']];urls=[f for f in published if re.search(r'\d{3} حَوْسَ ',urllib.parse.unquote(f))]
    if urls:
     name=({'550':'Bauchi: Madaka','600':'Gyere','610':'Siri: Miya','611':'Siri: Ningi'} | MIXED)[ident]
     r=make('grn-'+ident,'audio',row,'Kalmomin Rai a Hausa — daga shirin '+name,'Global Recordings Network')
     r['desc']='Shirin mawallafin ya haɗa da wasu harsuna. A nan, an zaɓi fayilolin da mawallafin ya bayyana a matsayin Hausa kaɗai.'
     tracks(r,urls,['Saƙo na '+str(i) for i in range(1,len(urls)+1)])
    else:
     name=MIXED[ident];r=make('grn-'+ident,'audio',row,'Kalmomin Rai — '+name+' da Hausa','Global Recordings Network',name+' + Hausa')
     r['desc']='Wannan sautin ya haɗa da '+name+' da saƙonni ko waƙoƙi a Hausa. Ba Hausa kaɗai ba ne.'
     tracks(r,published,['Saƙonni a '+name+' da Hausa · Sashe '+str(i) for i in range(1,len(published)+1)])
   link(r,u,'Duba shirin da sauran nau’o’insa a GRN')
  elif 'rockintl.org' in u:
   audio='/rock-audio/' in u;r=make('rock-'+('audio' if audio else 'book'),'audio' if audio else 'scripture',row,'Hanyar Adalci — '+('darussa 100 a sauti' if audio else 'littafin darussa 100'),'ROCK International')
   r['desc']='Darussa 100 daga Littafi Mai Tsarki, daga halittar duniya zuwa Yesu Almasihu, mutuwarsa da tashinsa daga matattu.'
   if audio:
    urls=[f for f in files(p,'.mp3') if 'Hausa' in f];titles=[re.sub(r'^\d+\.\s*TWOR_Hausa\s*-\s*\d+\s*-\s*','',next(a['label'] for a in p['links'] if a['url']==f)) for f in urls];assert len(urls)==100;tracks(r,urls,titles)
   else:
    pdf=next(f for f in files(p,'.pdf') if 'Hausa' in f);r['read']={'kind':'pdf','url':pdf};download(r,pdf,'Hanyar Adalci — darussa 1–100 (PDF)')
   link(r,u,'Duba a shafin mawallafin')
  elif 'pcloud' in u:
   r=next(r for r in resources if r['id'].startswith('hau-ac-hau_storyset'));r.setdefault('dbsListedUrls',[]).append(u);link(r,p['resolved'],'Ƙarin labarun Hausa daga Nijar — shafin StoryRunners')
  elif '/PS/' in u:
   dest=secure(u);r=make('film-prophets-story-publisher','film',row,'Labarin Annabawa — bugun Create International','Create International');r['dbsListedUrl']=u;r['source']=dest;r['play']={'kind':'file','sd':dest};download(r,dest,'Fim (MP4)');link(r,dest,'Buɗe fim ɗin')
  else:raise ValueError('Unaccounted source: '+u)
 savior.sort(key=lambda r:int(re.search(r'Hausa_(\d+)',r['href'])[1]));assert len(savior)==9
 r=make('film-savior-parts','film',savior[0],'Mai Ceto — tallan fim da sassa 8','Create International');r['source']=secure(r['source']);r['dbsListedUrls']=[x['href'] for x in savior]
 r['play']={'kind':'chapters','base':'','items':[{'n':i+1,'file':secure(row['href']),'title':SAVIOR[i]} for i,row in enumerate(savior)]}
 for i in r['play']['items']:download(r,i['file'],i['title']+' (MP4)')
 media['excluded']=excluded
 save(f'catalog/source/dbs-media-hausa-{DATE}.json',media)
 save(f'catalog/source/dbs-hausa-external-{DATE}.json',{'language':'hau','verified':DATE,'urls':sorted(external),'excluded':excluded})
 save(f'catalog/source/dbs-direct-files-hausa-{DATE}.json',{'verified':DATE,'alive_files':sorted(archives|{u for u,p in probes.items() if p['valid'] and urllib.parse.urlparse(u).path.endswith(('.pdf','.epub','.zip'))}),'playable_audio_filesets':[r['play']['fileset'] for r in resources if r['type']=='audio-bible']})
 save('catalog/hausa.json',{'generated':'DBS rendered Hausa inventory — '+DATE,'languages':{'hau':{'code':'hau','name':'Hausa','native':'Hausa','script':'latn','dir':'ltr','font':'latin','region':'Nigeria, Niger, West Africa','blurb':'Littafi Mai Tsarki, fina-finai da koyarwar Kirista a Hausa.'}},'resources':resources})
 print(len(resources),'Hausa resources;',len(excluded),'excluded source URLs')
if __name__=='__main__':main()
