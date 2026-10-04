#!/usr/bin/env python3
"""Build Yoruba from the complete DBS inventory and observed publisher links."""
import json
import pathlib
import re
import urllib.parse
from et.build import secure

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'catalog/source'
DATE = '2026-10-04'
BOOK_NAMES = dict(zip(
 'Genesis Exodus Leviticus Numbers Deuteronomy Joshua Judges Ruth 1Samuel 2Samuel 1Kings 2Kings 1Chronicles 2Chronicles Ezra Nehemiah Esther Job Psalms Proverbs Ecclesiastes SongofSongs Isaiah Jeremiah Lamentations Ezekiel Daniel Hosea Joel Amos Obadiah Jonah Micah Nahum Habakkuk Zephaniah Haggai Zechariah Malachi Matthew Mark Luke John Acts Romans 1Corinthians 2Corinthians Galatians Ephesians Philippians Colossians 1Thessalonians 2Thessalonians 1Timothy 2Timothy Titus Philemon Hebrews James 1Peter 2Peter 1John 2John 3John Jude Revelation'.split(),
 'Gẹnẹsisi|Eksodu|Lefitiku|Numeri|Deuteronomi|Joṣua|Onidajọ|Rutu|1 Samuẹli|2 Samuẹli|1 Ọba|2 Ọba|1 Kronika|2 Kronika|Esra|Nehemiah|Esteri|Jobu|Saamu|Òwe|Oniwaasu|Orin Solomoni|Isaiah|Jeremiah|Ẹkún Jeremiah|Esekiẹli|Daniẹli|Hosea|Joẹli|Amosi|Obadiah|Jona|Mika|Nahumu|Habakuku|Sefaniah|Hagai|Sekariah|Malaki|Matiu|Marku|Luku|Johanu|Ìṣe àwọn Aposteli|Romu|1 Kọrinti|2 Kọrinti|Galatia|Efesu|Filipi|Kolose|1 Tẹsalonika|2 Tẹsalonika|1 Timotiu|2 Timotiu|Titu|Filemoni|Heberu|Jakọbu|1 Peteru|2 Peteru|1 Johanu|2 Johanu|3 Johanu|Juda|Ìfihàn'.split('|')))
FILMS = 'JÉSÙ|Ìtàn Jésù fún àwọn ọmọdé|LUMO: Ìhìnrere Johanu|LUMO: Ìhìnrere Luku|LUMO: Ìhìnrere Marku|LUMO: Ìhìnrere Matiu|LUMO: Ìṣe àwọn Aposteli|LUMO: Májẹ̀mú|iBible: Ìtàn ìgbàlà|Bíbélì nínú fíìmù: Matiu|Bíbélì nínú fíìmù: Ìṣe àwọn Aposteli|Rescue Project: Ìhìnrere fún àwọn adití'.split('|')
SCANS = 'Ìwé àdúrà, Saamu àti àwọn apá Bíbélì — 1879|Má jẹ̀mú Tuntun — 1887|Bíbélì Mímọ́ — 1900|Gẹnẹsisi — 1959|Bíbélì Mímọ́ — àtẹ̀jáde 2004|Má jẹ̀mú Tuntun — àtẹ̀jáde 2004'.replace('Má jẹ̀mú','Májẹ̀mú').split('|')
AUDIO = {'YORBSN.31308':'Bíbélì Mímọ́ — Májẹ̀mú Tuntun ní ohùn (2004)', 'YORBSN':'Bíbélì Mímọ́ ní ohùn — 2004', 'YOROBV':'Májẹ̀mú Tuntun ní ohùn — Okun', 'YOROLD.18623':'Bíbélì Mímọ́ ní ohùn — àtẹ̀jáde àtijọ́ (1879)'}
STORIES = [
 "Ìṣẹ̀dá",
 "Ayé àwọn ẹ̀mí",
 "Ẹ̀ṣẹ̀ wọ ayé",
 "Noa àti ìkún omi",
 "Àwọn ìlérí fún Abraham",
 "Abraham fi Isaaki rú ẹbọ",
 "A fi òróró yan Dafidi gẹ́gẹ́ bí ọba",
 "Elija àti àwọn wòlíì èké",
 "Ìbí Jésù",
 "Ìrìbọmi Jésù",
 "Jésù àti obìnrin Samaria lẹ́gbẹ̀ẹ́ kànga",
 "Jésù wo ọkùnrin tí a sọ̀kalẹ̀ láti orí òrùlé sàn",
 "Jésù, Simoni àti obìnrin ẹlẹ́ṣẹ̀",
 "Jésù sọ ìtàn àlìkámà àti èpò",
 "Jésù dá ìjì dúró",
 "Jésù lé àwọn ẹ̀mí èṣù jáde",
 "Jésù, Jairu àti obìnrin tó ń ṣàn ẹ̀jẹ̀",
 "Jésù rìn lórí omi",
 "Jésù béèrè pé: Ta ni àwọn ènìyàn ń pè mí?",
 "Jésù kọ́ni nípa àdúrà",
 "Jésù sọ ìtàn ọmọ onínàákúnàá",
 "Jésù rán àwọn méjìléláàádọ́rin jáde",
 "Jésù wọ Jerusalẹmu gẹ́gẹ́ bí ọba",
 "Oúnjẹ alẹ́ ìkẹyìn Jésù",
 "Mímú Jésù àti ìgbẹ́jọ́ rẹ̀",
 "Kíkàn Jésù mọ́ àgbélébùú",
 "Àjíǹde Jésù",
 "Jésù sọ fún àwọn ọmọ ẹ̀yìn rẹ̀ láti sọ gbogbo orílẹ̀-èdè di ọmọ ẹ̀yìn",
 "Ẹ̀mí Ọlọ́run kún àwọn ènìyàn rẹ̀",
 "Peteru àti Johanu wo ọkùnrin tí kò lè rìn sàn",
 "Àwọn olórí ẹ̀sìn halẹ̀ mọ́ Peteru àti Johanu",
 "A pa Stefanu nítorí ìgbàgbọ́ rẹ̀ nínú Jésù",
 "Filipi àti ará Etiopia",
 "Paulu di ọmọ ẹ̀yìn Jésù",
 "Ẹ̀mí Ọlọ́run darí Paulu",
 "Ọlọ́run ṣiṣẹ́ ní Efesu nípasẹ̀ Paulu",
 "Ọ̀run tuntun àti ayé tuntun",
 "Láti ìṣẹ̀dá títí dé ìpadàbọ̀ Jésù"
]
SONG_STORIES = [1, 5, 7, 8, 11, 12, 13, 14, 15, 17]


def save(path, value):
 (ROOT/path).write_text(json.dumps(value,ensure_ascii=False,indent=1)+'\n')


def files(page, suffix):
 return list(dict.fromkeys(a['url'] for a in page.get('links',[]) if urllib.parse.urlparse(a['url']).path.lower().endswith(suffix)))


def programme(folder):
 if 'Good News' in folder: return 'Ìhìnrere'
 if 'Lukes' in folder: return 'Àwọn apá Ìhìnrere Luku'
 if 'Arinrin' in folder: return 'Ikíni sí arìnrìn-àjò'
 m=re.search(r'Words of Life (\d)\b',folder)
 return 'Ọ̀rọ̀ Ìyè'+(' '+m[1] if m else '')


def main():
 audit=json.loads((SOURCE/f'dbs-rendered-yoruba-{DATE}.json').read_text())['yor']
 media=json.loads((SOURCE/f'dbs-media-yoruba-{DATE}.json').read_text())
 probes=media['verified_files']; resources=[]; records={}; external=set(); excluded={}
 media['book_names']=BOOK_NAMES
 archives={a['url'] for a in media['browser_archives'] if a['crc_valid']}
 def available(u):
  p=probes.get(secure(u),{})
  return u in archives or p.get('valid') or p.get('status') in (403,406)
 def make(slug,kind,row,native,u,org='Digital Bible Society',scope='Èdè Yorùbá'):
  r={'id':'yor-'+slug,'lang':'yor','type':kind,'title':row['title'],'native':native,'langName':scope,'scope':scope,'source':u,'org':org,'desc':'','downloads':[],'links':[]}
  resources.append(r);records[u]=r;return r
 def link(r,u,label):
  u=secure(u);r['links'].append({'url':u,'label':label})
  if not urllib.parse.urlparse(u).netloc.endswith('dbs.org'):external.add(u)
 def download(r,u,label):
  if available(u):
   r['downloads'].append({'url':secure(u),'label':label})
   if not urllib.parse.urlparse(u).netloc.endswith('dbs.org'):external.add(u)
 def tracks(r,urls,titles):
  items=[{'n':n,'file':secure(u),'title':t} for n,(u,t) in enumerate(zip(urls,titles),1) if available(u)]
  if not items:raise ValueError('No tracks: '+r['source'])
  r['play']={'kind':'audio-collection','sample':items[0]['file'],'items':items}
  for i in items:download(r,i['file'],i['title']+' (MP3)')
 def film(r,p):
  urls=files(p,'.mp4')
  chapters=[u for u in urls if '/chapters/' in u or '/Lumo-' in u]
  if chapters:
   items=[]
   for n,u in enumerate(chapters,1):
    part=re.search(r'_(\d\d)_360',u)
    title='Fíìmù kíkún' if '_full_' in u else 'Apá '+str(int(part[1])) if '/Lumo-Acts/' in u and part else 'Orí '+str(n)
    if available(u):items.append({'n':n,'file':secure(u),'title':title});download(r,u,title+' (MP4)')
   r['play']={'kind':'chapters','base':'','items':items}
  else:
   sd=next((u for u in urls if '_low.' in u or '-sd.' in u or '/270p.' in u),urls[0] if urls else None)
   hd=next((u for u in urls if '_high.' in u or '-hd.' in u or '/720p.' in u),None)
   if sd and available(sd):r['play']={'kind':'file','sd':secure(sd),**({'hd':secure(hd)} if hd and available(hd) else {})}
  for u in urls:
   if u not in chapters:download(r,u,'Fíìmù kíkún (MP4) · '+('HD' if '_high.' in u or '-hd.' in u or '/720p.' in u else 'SD'))
  if not r.get('play'):link(r,r['source'],'Wo lórí DBS')
 for section,g in audit.items():
  if section=='Links to Other Sites':continue
  for n,row in enumerate(g['links']):
   u=row['href'];p=media['pages'][u];slug=urllib.parse.urlparse(u).path.split('/')[-1]
   if 'YORBIB_DAVR' in u:
    excluded[u]='DBS has retired this audio edition and lists different replacement editions.';continue
   if section=='Bibles' and '/audio/' in u:
    version=slug.split('_')[0];scope='Okun' if version=='YOROBV' else 'Èdè Yorùbá'
    r=make('ab-'+slug.lower().replace('_','-'),'audio-bible',row,AUDIO[version],u,'Davar Partners International' if '_DAVR_' in slug else 'Faith Comes By Hearing',scope)
    r['play']={'kind':'audio-bible','fileset':slug,'version':version,'testaments':['NT'] if '_NT_' in slug else ['OT','NT'],'bookNames':BOOK_NAMES,'saveChapter':True}
    if version=='YOROBV':r['desc']='Ìgbàsílẹ̀ yìí wà ní èdè Okun, gẹ́gẹ́ bí DBS ṣe sọ.'
    if version.startswith('YOROLD'):
     r['play']['missingChapters']={'1Chronicles':list(range(1,16))}
     r['desc']='Àtẹ̀jáde àtijọ́ ní ohùn. Orí 1 sí 15 nínú 1 Kronika kò sí nínú ìgbàsílẹ̀ DBS yìí. Yan àtẹ̀jáde mìíràn láti gbọ́ àwọn orí wọ̀nyẹn.'
   elif section=='Bibles':
    r=make('text-yorycb','scripture',row,'Bíbélì Mímọ́ ní Èdè Yorùbá Òde-Òní',u,'Biblica')
    pdf=files(p,'.pdf')[0];r['read']={'kind':'pdf','url':pdf};download(r,pdf,'Bíbélì kíkún (PDF)')
    for ext,label in [('.zip','Bíbélì láìsí ìntánẹ́ẹ̀tì (HTML ZIP)'),('.epub','Bíbélì kíkún (EPUB)')]:
     for f in files(p,ext):
      if f in archives:download(r,f,label)
    for a in p['links']:
     if 'inscript.org/' in a['url']:link(r,a['url'],'Ka Bíbélì lórí ìntánẹ́ẹ̀tì')
   elif section=='Films':
    r=make('film-'+slug,'film',row,FILMS[n],u,row['cells'][1]);film(r,p)
    if '/deafproject/' in u:r['desc']='Ìhìnrere tí a fi àwòrán gbé kalẹ̀ fún àwọn adití.'
   elif section=='Historic Bible (Scans)':
    r=make('scan-'+slug.lower(),'historic',row,SCANS[n],u);pdf=files(p,'.pdf')[0]
    r['read']={'kind':'pdf','url':pdf};download(r,pdf,'Àtẹ̀jáde tí a ṣe ẹ̀dà rẹ̀ (PDF)')
   elif section=='Audio Collections':
    grn='/grn/' in u;story='/soj/' in u
    native='Global Recordings: Yorùbá àti àwọn èdè agbègbè' if grn else 'Ìtàn Jésù ní ohùn' if story else 'Àwọn ìtàn Bíbélì ní ohùn'
    r=make('ac-'+slug.lower(),'audio',row,native,u,row['cells'][1]);urls=files(p,'.mp3')
    if grn:
     titles=[];counts={}
     for f in urls:
      parts=urllib.parse.unquote(f).split('/');folder=parts[-2];region=parts[-3];ident=str(int(re.search(r'(\d+)$',folder)[1]));counts[ident]=counts.get(ident,0)+1
      titles.append(programme(folder)+' — '+region.replace('Yoruba','Yorùbá')+' · Ìgbàsílẹ̀ '+str(counts[ident]))
     r['desc']='DBS ṣàkójọ Yorùbá, Abunu, Aworo, Ekiti, Igbomina, Yagba àti Iyara: Ijumu síbí. Èdè tàbí agbègbè tí ìgbàsílẹ̀ kọ̀ọ̀kan wà ni a kọ sí orúkọ rẹ̀.'
    elif story:titles=['Ìtàn kíkún']+['Apá '+str(i) for i in range(1,9)]
    else:
     # Publisher filenames identify 38 stories followed by ten related songs.
     titles=['Ìtàn '+str(i)+': '+title for i,title in enumerate(STORIES,1)]
     titles+=['Orin '+str(i)+': '+STORIES[story-1] for i,story in enumerate(SONG_STORIES,1)]
     assert len(urls)==len(titles)==48
    tracks(r,urls,titles)
    for f in files(p,'.zip'):
     if f in archives:download(r,f,'Gbogbo àwọn ìgbàsílẹ̀ (ZIP) · '+('Dídára gíga' if '_high.zip' in f else 'Dátà díẹ̀'))
 collection=next(r for r in resources if r['id'].startswith('yor-ac-yor_global'))
 aliases={'YORBSN':next(r for r in resources if r['id']=='yor-ab-yorbsn-davr-fb-n'),'YOROLD':next(r for r in resources if 'yorold.18623' in r['id'] and r['type']=='audio-bible')}
 for u,row in {a['href']:a for a in audit['Links to Other Sites']['links']}.items():
  p=media['publishers'][u]
  if 'find.bible' in u:
   code=urllib.parse.parse_qs(urllib.parse.urlparse(u).query)['abbr'][0];dest=p['resolved']
   if code in aliases:r=aliases[code];r.setdefault('dbsListedUrls',[]).append(u);link(r,dest,'Wo àlàyé àtẹ̀jáde yìí')
   else:
    r=make('edition-'+code.lower(),'scripture',row,'Bíbélì Mímọ́ — àtẹ̀jáde 1960' if code=='YORUBS' else 'Bíbélì Yorùbá Àtọ́ka — 1980',dest,'find.bible');r['dbsListedUrl']=u;link(r,dest,'Wo àtẹ̀jáde àti àwọn ojúlé akéde')
    r['desc']='Ojúlé yìí ní àlàyé àtẹ̀jáde àti àwọn ojúlé akéde. Tẹ àwọn ojúlé akéde láti ka tàbí gbọ́ ohun tí wọ́n pèsè.'
  elif 'globalrecordings.net' in u:
   ident=u.rsplit('/',1)[-1];items=[i for i in collection['play']['items'] if str(int(re.search(r'(\d+)$',urllib.parse.unquote(i['file']).split('/')[-2])[1]))==ident]
   if not items:raise ValueError('Programme not found: '+u)
   region=p['title'].rsplit(' - ',1)[-1].replace('Yoruba','Yorùbá')
   r=make('grn-'+ident,'audio',row,programme(urllib.parse.unquote(items[0]['file']).split('/')[-2])+' — '+region,u,'Global Recordings Network',region)
   link(r,u,'Wo ìgbàsílẹ̀ lórí ojúlé akéde');tracks(r,[i['file'] for i in items],[i['title'] for i in items])
  elif 'arc.gt' in u:
   # Legacy short URL is blocked, but its DBS-listed children's film is retained.
   excluded[u]='Legacy short-link redirect is blocked in the browser. The DBS Story of Jesus for Children film is included through its working DBS page.'
  else:raise ValueError('Unaccounted source: '+u)
 media['excluded']=excluded
 save(f'catalog/source/dbs-media-yoruba-{DATE}.json',media)
 save(f'catalog/source/dbs-yoruba-external-{DATE}.json',{'language':'yor','verified':DATE,'urls':sorted(external),'excluded':excluded})
 save(f'catalog/source/dbs-direct-files-yoruba-{DATE}.json',{'verified':DATE,'alive_files':sorted(archives|{u for u,p in probes.items() if p.get('valid') and urllib.parse.urlparse(u).path.endswith(('.pdf','.epub','.zip'))}),'playable_audio_filesets':[r['play']['fileset'] for r in resources if r['type']=='audio-bible']})
 save('catalog/yoruba.json',{'generated':'DBS rendered Yoruba inventory — '+DATE,'languages':{'yor':{'code':'yor','name':'Yoruba','native':'Èdè Yorùbá','script':'latn','dir':'ltr','font':'latin','region':'Nigeria, Benin àti àwọn agbègbè míì','blurb':'Bíbélì, fíìmù àti àwọn ìgbàsílẹ̀ Kristẹni ní èdè Yorùbá. A fi àwọn èdè agbègbè hàn ní kedere.'}},'resources':resources})
 print(len(resources),'Yoruba resources;',len(excluded),'excluded source URLs')


if __name__=='__main__':main()
