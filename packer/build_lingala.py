#!/usr/bin/env python3
"""Build Lingala from the complete rendered DBS inventory and publisher audit."""
import json
import pathlib
import re
import urllib.parse
from et.build import secure
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'catalog/source'
DATE='2026-10-04'
FILMS=['YESU','Magdalena','LUMO: Nsango Malamu ya Yoane','LUMO: Nsango Malamu ya Luka',
 'LUMO: Nsango Malamu ya Malako','LUMO: Nsango Malamu ya Matayo','LUMO: Misala ya Bantoma',
 'LUMO: Boyokani','iBible: Lisolo ya solo ya Yesu','Biblia na filme: Misala ya Bantoma',
 'Rescue Project: Nsango Malamu na bilili mpo na bato oyo bayokaka te']
SERIES={'34561':'Kokoma moninga ya Nzambe','1821':'Maloba ya bomoi 1 — Lingála: Brazzaville',
 '1820':'Maloba ya bomoi 1','13061':'Maloba ya bomoi 2','22100':'Maloba ya bomoi 3',
 '22101':'Maloba ya bomoi 4','32210':'Nsango Malamu','22091':'Nsango Malamu',
 '82760':'Kindoki — mateya ya Bakristo','71950':'Tala, yoka mpe zala na bomoi 1 — Ebandeli elongo na Nzambe',
 '71960':'Tala, yoka mpe zala na bomoi 2 — Bato ya Nzambe ya nguya',
 '74739':'Tala, yoka mpe zala na bomoi 3 — Elonga na nzela ya Nzambe',
 '74738':'Tala, yoka mpe zala na bomoi 4 — Basali ya Nzambe',
 '74737':'Tala, yoka mpe zala na bomoi 5 — Komekama mpo na Nzambe',
 '71970':'Tala, yoka mpe zala na bomoi 6 — Yesu, Moteyi mpe Mobikisi ya bato ya maladi',
 '74736':'Tala, yoka mpe zala na bomoi 7 — Yesu, Nkolo mpe Mobikisi',
 '71980':'Tala, yoka mpe zala na bomoi 8 — Misala ya Molimo Mosantu'}

def save(path,value):
 (ROOT/path).write_text(json.dumps(value,ensure_ascii=False,indent=1)+'\n')

def files(p,suffix):
 return list(dict.fromkeys(a['url'] for a in p.get('links',[]) if urllib.parse.urlparse(a['url']).path.lower().endswith(suffix)))

def programme(u):
 return str(int(re.search(r'(\d+)$',urllib.parse.unquote(u).split('/')[-2])[1]))

def main():
 audit=json.loads((SOURCE/f'dbs-rendered-lingala-{DATE}.json').read_text())['lin']
 media=json.loads((SOURCE/f'dbs-media-lingala-{DATE}.json').read_text())
 probes=media['verified_files']; books=media['book_names']; resources=[]; external=set()
 excluded=dict(media['excluded']); archives={a['url'] for a in media['browser_archives'] if a['crc_valid']}
 excluded['https://globalrecordings.net/en/program/81699']='Publisher identifies this as public-health education, not a Christian Bible resource.'
 def available(u):
  p=probes.get(secure(u),{});return u in archives or p.get('valid') or p.get('status') in (403,406)
 def make(slug,kind,row,native,org='Digital Bible Society',scope='Lingála'):
  r={'id':'lin-'+slug,'lang':'lin','type':kind,'title':row['title'],'native':native,'langName':scope,'scope':scope,'source':row['href'],'org':org,'desc':'','downloads':[],'links':[]};resources.append(r);return r
 def link(r,u,label):
  u=secure(u);r['links'].append({'url':u,'label':label})
  if not urllib.parse.urlparse(u).netloc.endswith('dbs.org'):external.add(u)
 def download(r,u,label):
  if available(u):
   u=secure(u);r['downloads'].append({'url':u,'label':label})
   if not urllib.parse.urlparse(u).netloc.endswith('dbs.org'):external.add(u)
 def tracks(r,urls,titles):
  assert len(urls)==len(titles)
  items=[{'n':n,'file':secure(u),'title':t} for n,(u,t) in enumerate(zip(urls,titles),1) if available(u)]
  assert len(items)==len(urls) and items
  r['play']={'kind':'audio-collection','sample':items[0]['file'],'items':items}
  for i in items:download(r,i['file'],i['title']+' (MP3)')
 for section,g in audit.items():
  if section=='Links to Other Sites':continue
  for n,row in enumerate(g['links']):
   u=row['href'];p=media['pages'][u];slug=u.rsplit('/',1)[-1]
   if u in excluded:continue
   if section=='Bibles' and '/audio/' in u:
    version=slug.split('_')[0];r=make('ab-'+slug.lower().replace('_','-'),'audio-bible',row,'Biblia na mongongo — '+version+(' (1982)' if version=='LINDRC' else ' (1942)'),'Davar Partners International')
    assert p['malachi']['chapters']==['1','2','3']
    r['play']={'kind':'audio-bible','fileset':slug,'version':version,'testaments':['OT','NT'],'bookNames':books,'chapterCounts':{'Malachi':3},'saveChapter':True}
    r['desc']='Biblia mobimba na mongongo. Edition oyo ekaboli mokanda ya Malashi na mikapo 3, ndenge DBS elakisi.'
    r['year']=1982 if version=='LINDRC' else 1942
    link(r,u,'Tala Biblia oyo mpe baformat mosusu na DBS')
   elif section=='Bibles':
    r=make('text-linocb','scripture',row,'Mokanda na Bomoi — Biblia mobimba','Biblica');r['year']=2002
    pdf=files(p,'.pdf')[0];r['read']={'kind':'pdf','url':pdf};download(r,pdf,'Biblia mobimba (PDF)')
    for ext,label in [('.zip','Biblia kozanga internet (HTML ZIP)'),('.epub','Biblia mobimba (EPUB)')]:
     for f in files(p,ext):
      if f in archives:download(r,f,label)
    for a in p['links']:
     if 'inscript.org/' in a['url']:link(r,a['url'],'Tanga Biblia na internet')
     if 'bible.com/versions/' in a['url']:link(r,a['url'],'Tala edition oyo na YouVersion')
    r['desc']='Biblia mobimba na Lingála ya mikolo oyo. © 2002, 2020 Biblica. Soki obombi HTML ZIP, fungola ZIP mpe tanga na html/index.html kozanga internet.'
   elif section=='Films':
    r=make('film-'+slug,'film',row,FILMS[n],row['cells'][1]);urls=files(p,'.mp4');parts=[f for f in urls if ('/chapters/' in f or '/Lumo-' in f) and '_full_' not in f]
    if parts:
     items=[{'n':i,'file':secure(f),'title':('Eteni ' if n in (6,7) else 'Mokapo ')+str(i)} for i,f in enumerate(parts,1) if available(f)]
     assert len(items)==len(parts);r['play']={'kind':'chapters','base':'','items':items}
     for i in items:download(r,i['file'],i['title']+' (MP4)')
    else:
     sd=next((f for f in urls if '_low.' in f or '-sd.' in f or '/270p.' in f),urls[0]);hd=next((f for f in urls if '_high.' in f or '-hd.' in f or '/720p.' in f),None)
     r['play']={'kind':'file','sd':secure(sd),**({'hd':secure(hd)} if hd and hd!=sd else {})}
    for f in urls:
     if f not in parts:download(r,f,'Filme mobimba (MP4) · '+('HD' if '_high.' in f or '-hd.' in f or '/720p.' in f else 'SD'))
    link(r,u,'Tala filme mpe baformat mosusu na DBS')
   elif section=='Historic Bible (Scans)':
    r=make('scan-'+slug.lower(),'historic',row,['Boyokani ya Sika — scan ya mokanda (2000)','Banzembo — scan ya mokanda (2000)'][n]);r['year']=2000
    pdf=files(p,'.pdf')[0];r['read']={'kind':'pdf','url':pdf};download(r,pdf,'Scan ya mokanda (PDF)');link(r,u,'Tala mokanda na DBS')
   elif section=='Audio Collections':
    grn='/grn/' in u;r=make('ac-'+slug.lower(),'audio',row,'GRN: Mateya ya Biblia na Lingála' if grn else 'Lisolo ya Yesu na mongongo',row['cells'][1]);urls=files(p,'.mp3')
    if grn:
     urls=[f for f in urls if programme(f)!='81699'];counts={};titles=[]
     for f in urls:
      ident=programme(f);counts[ident]=counts.get(ident,0)+1;titles.append(SERIES[ident]+' · Eteni '+str(counts[ident]))
     assert len(urls)==332
     r['desc']='Mateya ya Biblia mpe banzembo ya Bakristo na Lingála, ata mpe Lingála ya Brazzaville. Programme ya mateya ya bokolongono ezali na lisanga oyo te.'
    else:titles=['Lisolo mobimba']+['Eteni '+str(i) for i in range(1,9)]
    tracks(r,urls,titles)
    for f in files(p,'.zip'):
     if not grn and f in archives:download(r,f,'Biteni nyonso (ZIP)')
    link(r,u,'Tala source ya baenregistrement na DBS')
 collection=next(r for r in resources if r['id'].startswith('lin-ac-lin_global'))
 for u,row in {a['href']:a for a in audit['Links to Other Sites']['links']}.items():
  if u in excluded:continue
  p=media['publishers'][u]
  if 'find.bible' in u:
   code=urllib.parse.parse_qs(urllib.parse.urlparse(u).query)['abbr'][0]
   if code in ('LINBSC','LINDRC'):
    r=next(r for r in resources if r.get('play',{}).get('version')==code);r.setdefault('dbsListedUrls',[]).append(u);link(r,p['resolved'],'Tala makambo ya edition oyo')
   else:
    r=make('edition-'+code.lower(),'scripture',row,'Biblia na Lingála — LINCLV (2000)','find.bible');r['source']=p['resolved'];r['dbsListedUrl']=u;link(r,p['resolved'],'Tala edition mpe baéditeur')
    r['desc']='Page oyo elakisi makambo ya edition mpe baéditeur. Fungola lien ya éditeur mpo na kotanga to koyoka oyo ezali.'
  elif 'arc.gt' in u:
   r=make('film-magdalena-directors-cut','film',row,'Magdalena — version ya réalisateur','Jesus Film Project');r['dbsListedUrl']=u;r['source']=p['resolved'];r['play']={'kind':'file','sd':p['resolved']};download(r,p['resolved'],'Filme mobimba (MP4) · HD');link(r,p['resolved'],'Fungola filme');external.add(p['resolved'])
  elif 'globalrecordings.net' in u:
   ident=u.rsplit('/',1)[-1];items=[i for i in collection['play']['items'] if programme(i['file'])==ident]
   if items:
    r=make('grn-'+ident,'audio',row,SERIES[ident],'Global Recordings Network','Lingála: Brazzaville' if ident=='1821' else 'Lingála');tracks(r,[i['file'] for i in items],[i['title'] for i in items])
   else:
    urls=files(p,'.mp3');urls=[f for f in urls if '/Audio_MP3/' in f]
    if ident in ('24940','2460'):
     urls=[f for f in urls if re.search(r'\d{3} Lingala ',urllib.parse.unquote(f).rsplit('/',1)[-1])]
     r=make('grn-'+ident,'audio',row,'Nzembo na Lingála — '+('Monjombo' if ident=='24940' else 'Pomo'),'Global Recordings Network');titles=['Yesu, nayei' if ident=='24940' else 'Nzembo na Lingála']
     r['desc']='Programme ya éditeur ezali na minoko mosusu mpe na Lingála. Awa, tobombi nzembo oyo fichier na yango elakisi polele ete ezali na Lingála.'
    elif ident=='9981':
     r=make('grn-'+ident,'audio',row,'Maloba ya bomoi — Kiyansi: Banningville mpe nzembo na Lingála','Global Recordings Network','Kiyansi: Banningville + Lingála');titles=['Mateya na Kiyansi mpe nzembo na Lingála · Eteni '+str(i) for i in range(1,len(urls)+1)];r['desc']='Baenregistrement oyo esangisi mateya na Kiyansi: Banningville mpe nzembo na Lingála. Ezali na Lingála kaka te.'
    else:raise ValueError('Unaccounted programme: '+u)
    tracks(r,urls,titles)
   if not p.get('error'):link(r,u,'Tala programme mpe baformat mosusu na GRN')
   else:
    r['source']=collection['source'];r['dbsListedUrl']=u
    r['desc']='Enregistrement oyo ezali na lisanga ya DBS. Page ya GRN efungwamaki te ntango tozalaki kotala.'
  else:raise ValueError('Unaccounted source: '+u)
 media['excluded']=excluded
 save(f'catalog/source/dbs-media-lingala-{DATE}.json',media)
 save(f'catalog/source/dbs-lingala-external-{DATE}.json',{'language':'lin','verified':DATE,'urls':sorted(external),'excluded':excluded})
 save(f'catalog/source/dbs-direct-files-lingala-{DATE}.json',{'verified':DATE,'alive_files':sorted(archives|{u for u,p in probes.items() if p['valid'] and urllib.parse.urlparse(u).path.endswith(('.pdf','.epub','.zip'))}),'playable_audio_filesets':[r['play']['fileset'] for r in resources if r['type']=='audio-bible']})
 save('catalog/lingala.json',{'generated':'DBS rendered Lingala inventory — '+DATE,'languages':{'lin':{'code':'lin','name':'Lingala','native':'Lingála','script':'latn','dir':'ltr','font':'latin','region':'RDC, Congo','blurb':'Biblia, bafilme mpe mateya ya Bakristo na Lingála.'}},'resources':resources})
 print(len(resources),'Lingala resources;',len(excluded),'excluded source URLs')
if __name__=='__main__':main()
