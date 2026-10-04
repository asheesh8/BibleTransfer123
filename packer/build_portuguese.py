#!/usr/bin/env python3
"""Build Portuguese from DBS's rendered inventory and audited publisher pages."""
import json
import pathlib
import re
import urllib.parse
from et.build import secure

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'catalog/source'
DATE = '2026-10-03'
BOOK_NAMES = dict(zip(
 'Genesis Exodus Leviticus Numbers Deuteronomy Joshua Judges Ruth 1Samuel 2Samuel 1Kings 2Kings 1Chronicles 2Chronicles Ezra Nehemiah Esther Job Psalms Proverbs Ecclesiastes SongofSongs Isaiah Jeremiah Lamentations Ezekiel Daniel Hosea Joel Amos Obadiah Jonah Micah Nahum Habakkuk Zephaniah Haggai Zechariah Malachi Matthew Mark Luke John Acts Romans 1Corinthians 2Corinthians Galatians Ephesians Philippians Colossians 1Thessalonians 2Thessalonians 1Timothy 2Timothy Titus Philemon Hebrews James 1Peter 2Peter 1John 2John 3John Jude Revelation'.split(),
 'Gênesis|Êxodo|Levítico|Números|Deuteronômio|Josué|Juízes|Rute|1 Samuel|2 Samuel|1 Reis|2 Reis|1 Crônicas|2 Crônicas|Esdras|Neemias|Ester|Jó|Salmos|Provérbios|Eclesiastes|Cântico dos Cânticos|Isaías|Jeremias|Lamentações|Ezequiel|Daniel|Oseias|Joel|Amós|Obadias|Jonas|Miqueias|Naum|Habacuque|Sofonias|Ageu|Zacarias|Malaquias|Mateus|Marcos|Lucas|João|Atos dos Apóstolos|Romanos|1 Coríntios|2 Coríntios|Gálatas|Efésios|Filipenses|Colossenses|1 Tessalonicenses|2 Tessalonicenses|1 Timóteo|2 Timóteo|Tito|Filemom|Hebreus|Tiago|1 Pedro|2 Pedro|1 João|2 João|3 João|Judas|Apocalipse'.split('|')))
FILMS = 'Evangelho de João — Brasil|JESUS — Brasil|Maria Madalena — Brasil|A história de Jesus para crianças — Brasil|O Salvador — Brasil|JESUS — Portugal|Maria Madalena — Portugal|A história de Jesus para crianças — Portugal|Rei da Glória|LUMO: Evangelho de João|LUMO: Evangelho de Lucas|LUMO: Evangelho de Marcos|LUMO: Evangelho de Mateus|LUMO: Atos dos Apóstolos|LUMO: A Aliança|A Bíblia em filme: Atos dos Apóstolos — Brasil|Os dias da criação|A Esperança — narração|A Esperança — com apresentadores|iBible: A história da salvação — Brasil|iBible: A história da salvação — Portugal|A Bíblia em filme: Mateus|Rescue Project: O Evangelho para surdos — Brasil|Rescue Project: O Evangelho para surdos — Moçambique|Rescue Project: O Evangelho para surdos — Portugal'.split('|')
SCANS = 'Novo Testamento de Almeida — 1681|Bíblia de Figueiredo — 1821|Bíblia Almeida Corrigida — 1848|Novo Testamento WBTC — Brasil (2006)|Novo Testamento bilíngue — português e inglês (1869)'.split('|')
AUDIO_NAMES = {
 'PORBBS':'Nova Almeida Atualizada — Bíblia em áudio',
 'PORWBT':'Versão Fácil de Ler — Bíblia em áudio',
 'PORNLH':'Nova Tradução na Linguagem de Hoje — Bíblia em áudio',
 'PORTLH':'Nova Tradução na Linguagem de Hoje — Novo Testamento em áudio dramatizado',
 'PORB09.00047':'Bíblia para todos — Bíblia em áudio',
 'PORB09':'Bíblia para todos — Antigo Testamento em áudio dramatizado'}
EDITIONS = dict(zip('PORARC PORBAR PORBNV PORCER PORFIE POREUR PORTB1 PORNVT PORABT PORBAS'.split(),
 'Almeida Revista e Corrigida — Portugal|Almeida Revista e Atualizada — Brasil|Nova Versão Internacional|Bíblia para todos — edição católica|Almeida Corrigida Fiel|O Livro — português europeu|Tradução Brasileira — 1917|Nova Versão Transformadora|Tradução Brasileira — 2010|Bíblia Almeida Século 21'.split('|')))
LLL = 'No princípio, Deus|Homens poderosos de Deus|Vitória com Deus|Servos de Deus|Julgados por causa de Deus|Jesus, Mestre e Médico|Jesus, Senhor e Salvador|Atos do Espírito Santo'.split('|')


def save(path, data):
 (ROOT / path).write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n')


def files(page, ext):
 return list(dict.fromkeys(a['url'] for a in page.get('links', []) if urllib.parse.urlparse(a['url']).path.lower().endswith(ext)))


def programme_title(folder):
 m = re.search(r'(?:LLL|Livro) (\d)', folder)
 if m:
  return 'Olhe, ouça e viva '+m[1]+': '+LLL[int(m[1])-1]
 if 'Good News with songs' in folder: return 'Boas Novas com músicas'
 if 'Good News' in folder: return 'Boas Novas'
 if 'Portrait' in folder: return 'Retrato de Jesus'
 if 'Living Christ' in folder: return 'O Cristo vivo'
 if 'Vida!' in folder: return 'Vida com Cristo'
 if 'Children' in folder: return 'Palavras de Vida para crianças'
 m = re.search(r'Words of Life (\d)\b', folder)
 return 'Palavras de Vida'+(' '+m[1] if m else '')


def main():
 audit = json.loads((SOURCE / f'dbs-rendered-portuguese-{DATE}.json').read_text())['por']
 media = json.loads((SOURCE / f'dbs-media-portuguese-{DATE}.json').read_text())
 probes = media.get('verified_files') or json.loads((ROOT / '.cache/portuguese-probes.json').read_text())
 resources, records, external, excluded = [], {}, set(), {}
 media['book_names'] = BOOK_NAMES
 media['verified_files'] = probes

 def available(url):
  p = probes.get(secure(url), {})
  # Published protected media are additionally exercised in the browser.
  return p.get('valid') or p.get('status') in (403,406)

 def resource(slug, kind, row, native, source, org='Digital Bible Society', region=''):
  r = {'id':'por-'+slug,'lang':'por','type':kind,'title':row['title'],'native':native,
       'langName':'Português'+(' · '+region if region else ''),'scope':region or 'Português',
       'source':source,'org':org,'desc':'','downloads':[],'links':[]}
  resources.append(r); records[source] = r
  return r

 def link(r, url, label):
  url = secure(url)
  r['links'].append({'url':url,'label':label})
  if not urllib.parse.urlparse(url).netloc.endswith('dbs.org'): external.add(url)

 def download(r, url, label):
  if available(url):
   r['downloads'].append({'url':secure(url),'label':label})
   if not urllib.parse.urlparse(url).netloc.endswith('dbs.org'): external.add(secure(url))

 def tracks(r, urls, titles):
  pairs = [(secure(u),t) for u,t in zip(urls,titles) if available(u)]
  if not pairs: raise ValueError('No recordings: '+r['source'])
  r['play'] = {'kind':'audio-collection','sample':pairs[0][0],
               'items':[{'n':n,'file':u,'title':t} for n,(u,t) in enumerate(pairs,1)]}
  for u,t in pairs: download(r,u,t+' (MP3)')

 def film(r, page):
  urls = files(page,'.mp4')
  chapters = [u for u in urls if '/chapters/' in u or '/films_low/' in u and '/Lumo-' in u]
  if '/jesus/' in r['source']:
   # Brazil's list contains Acts; Portugal's list points to the Brazil recording.
   # Keep each regional full film and omit those mismatched chapter lists.
   for u in chapters: media.setdefault('excluded_files',{})[u] = 'JESUS chapter list has the wrong film or regional recording.'
   urls = [u for u in urls if u not in chapters]; chapters = []
  if chapters:
   titles = []
   for n,u in enumerate(chapters,1):
    part = re.search(r'_(\d\d)_360',u)
    titles.append('Filme completo' if '_full_' in u.lower() else 'Parte '+str(int(part[1])) if '/Lumo-Acts/' in u and part else 'Capítulo '+str(n))
   r['play'] = {'kind':'chapters','base':'','items':[{'n':n,'file':secure(u),'title':t} for n,(u,t) in enumerate(zip(chapters,titles),1) if available(u)]}
   for u,t in zip(chapters,titles): download(r,u,t+' (MP4)')
  else:
   sd = next((a['url'] for a in page['links'] if a['url'] in urls and ('SD' in a['label'] or 'Compressed' in a['label'])),next((u for u in urls if '_low.' in u or '-sd.' in u),urls[0] if urls else None))
   hd = next((a['url'] for a in page['links'] if a['url'] in urls and ('HD' in a['label'] or 'High Quality' in a['label'])),None)
   if sd and available(sd): r['play'] = {'kind':'file','sd':secure(sd),**({'hd':secure(hd)} if hd and available(hd) else {})}
  for u in urls:
   if u in chapters: continue
   part = re.search(r'_part_?(\d+)',u,re.I)
   label = 'Parte '+part[1] if part else 'Filme completo'
   published = next(a['label'] for a in page['links'] if a['url']==u)
   quality = 'HD' if 'HD' in published or 'High Quality' in published or '/720p.' in u or '_high.' in u else 'SD'
   download(r,u,label+' (MP4) · '+quality)
  if not r.get('play'): link(r,r['source'],'Assistir no DBS')

 for section,group in audit.items():
  if section == 'Links to Other Sites': continue
  for n,row in enumerate(group['links']):
   u = row['href']; page = media['pages'][u]; slug = urllib.parse.urlparse(u).path.split('/')[-1]
   if section == 'Bibles' and '/audio/' in u:
    version = slug.split('_')[0]
    r = resource('ab-'+slug.lower().replace('_','-'),'audio-bible',row,AUDIO_NAMES[version],u,'International Scripture Audio' if '_ISA_' in slug else 'Faith Comes By Hearing')
    tt = ['NT'] if '_NT_' in slug else ['OT'] if '_OT_' in slug else ['OT','NT']
    r['play'] = {'kind':'audio-bible','fileset':slug,'version':version,'testaments':tt,'bookNames':BOOK_NAMES,'saveChapter':True}
    if slug == 'PORB09_FCBH_OT_D':
     r['play']['chapterCounts'] = {'Joel':4,'Malachi':3}
     r['desc'] = 'Esta edição divide Joel em 4 capítulos e Malaquias em 3 capítulos, conforme a numeração do editor.'
   elif section == 'Bibles':
    native = {'PORTFT':'Novo Testamento — Tradução para Tradutores (2018)','PORERV':'Bíblia Sagrada — Versão Fácil de Ler','PORBRB':'Bíblia Livre para Todos'}[slug]
    r = resource('text-'+slug.lower(),'scripture',row,native,u)
    if slug == 'PORTFT': r['desc'] = 'Tradução do Novo Testamento preparada como material de apoio para tradutores da Bíblia.'
    pdfs = files(page,'.pdf')
    if pdfs and available(pdfs[0]): r['read'] = {'kind':'pdf','url':pdfs[0]};download(r,pdfs[0],'Novo Testamento (PDF)' if slug=='PORTFT' else 'Bíblia (PDF)')
    for ext,label in [('.zip','Bíblia para leitura sem internet (HTML ZIP)'),('.epub','Novo Testamento (EPUB)')]:
     for f in files(page,ext):
      if any(a['url']==f and a.get('crc_valid') for a in media.get('browser_archives',[])): download(r,f,label)
    for a in page['links']:
     if 'app-json-study/index.html' in a['url']: link(r,a['url'],'Ler a Bíblia no DBS')
    if not r['links'] and not r.get('read'): link(r,u,'Ver a edição e os links de leitura no DBS')
   elif section == 'Films':
    region = 'Brasil' if 'brazil' in slug or 'brazilian' in slug else 'Portugal' if 'portugal' in slug or 'european' in slug else 'Moçambique' if 'mozambique' in slug else ''
    r = resource('film-'+slug,'film',row,FILMS[n],u,row['cells'][1],region)
    film(r,page)
    if '/deafproject/' in u: r['desc'] = 'Apresentação visual do Evangelho para pessoas surdas.'
   elif section == 'Historic Bible (Scans)':
    r = resource('scan-'+slug.lower(),'historic',row,SCANS[n],u)
    pdf = next(f for f in files(page,'.pdf') if available(f))
    r['read'] = {'kind':'pdf','url':pdf};download(r,pdf,'Edição digitalizada (PDF)')
   elif section == 'Audio Collections':
    grn = '/grn/' in u
    r = resource('ac-'+slug.lower(),'audio',row,'Global Recordings: gravações em português' if grn else 'A história de Jesus — áudio',u,row['cells'][1])
    urls = files(page,'.mp3')
    if grn:
     titles,eligible,counts = [],[],{}
     for f in urls:
      folder = urllib.parse.unquote(f).split('/')[-2];ident = str(int(re.search(r'(\d+)$',folder)[1]))
      if ident=='66644': media.setdefault('excluded_recordings',{})[f]='Public-service COVID recording; Christian content not confirmed.';continue
      counts[ident] = counts.get(ident,0)+1
      eligible.append(f);titles.append(programme_title(folder)+' — gravação '+str(counts[ident]))
     urls = eligible
    else: titles = ['História completa']+['Parte '+str(i) for i in range(1,9)]
    tracks(r,urls,titles)
 collection = next(r for r in resources if r['id'].startswith('por-ac-por_global'))
 aliases = {'PORB09':records['https://dbs.org/bibles/audio/PORB09.00047_FCBH_FB_N'],
            'PORTLH':records['https://dbs.org/bibles/audio/PORTLH_FCBH_NT_D'],
            'PORWBT':records['https://dbs.org/bibles/audio/PORWBT_ISA_FB_N']}
 for code,scan in [('PORBAP',0),('PORFIGU',1),('PORBARR',2)]:
  aliases[code] = records[audit['Historic Bible (Scans)']['links'][scan]['href']]
 for u,row in {a['href']:a for a in audit['Links to Other Sites']['links']}.items():
  p = media['publishers'].get(u,{})
  if 'mundocristao' in u:
   if p and ('não encontrada' in p.get('title','') or 'não foi encontrada' in p.get('text','')): excluded[u]='Retired product URL: publisher returns page not found.'
   elif p and ('produtos' in p.get('resolved','') or p.get('resolved','').rstrip('/')=='https://www.mundocristao.com.br'): excluded[u]='Retired product URL redirects to the general publisher storefront.'
   elif not p: excluded[u]='Legacy retailer URL awaiting availability verification.'
   else: raise ValueError('Inspect unexpected store page: '+u)
  elif 'find.bible' in u:
   code = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)['abbr'][0];dest=p['resolved'];external.add(dest)
   if code in aliases:
    r=aliases[code];r.setdefault('dbsListedUrls',[]).append(u);link(r,dest,'Ver detalhes desta edição')
   else:
    r=resource('edition-'+code.lower(),'scripture',row,EDITIONS[code],dest,'find.bible');r['dbsListedUrl']=u
    link(r,dest,'Ver a edição e os links do editor')
    r['desc']='Esta página apresenta os detalhes da edição. Use os links do editor para ler, ouvir ou baixar os arquivos disponíveis.'
  elif 'globalrecordings.net' in u:
   ident=u.rsplit('/',1)[-1]
   matches=[i for i in collection['play']['items'] if str(int(re.search(r'(\d+)$',urllib.parse.unquote(i['file']).split('/')[-2])[1]))==ident]
   if not matches:
    if ident!='63701': excluded[u]='Publisher identifies this recording as Umbundu or Kaiwa, without a separately identified Portuguese recording.';continue
    r=resource('grn-'+ident,'audio',row,'Testemunhos — tupari e português do interior do Brasil',u,'Global Recordings Network','Tupari e português')
    r['desc']='O editor informa que este programa em tupari contém alguns trechos em português do interior do Brasil. Não há uma lista separada dos trechos em português.'
    link(r,u,'Ouvir o programa multilíngue no site do editor');continue
   folder=urllib.parse.unquote(matches[0]['file']).split('/')[-2]
   region='Interior do Brasil' if 'Brasil Interior' in p['title'] else 'Moçambique' if 'Mozambique' in p['title'] else 'Brasil' if 'Brasil' in p['title'] else ''
   r=resource('grn-'+ident,'audio',row,programme_title(folder)+(' — '+region if region else ''),u,'Global Recordings Network',region)
   link(r,u,'Ver o programa no site do editor');tracks(r,[i['file'] for i in matches],[i['title'] for i in matches])
  elif 'lifewords' in u: excluded[u]='Publisher has retired this resource store; the listed booklet is no longer available at this address.'
  elif 'rockintl' in u: excluded[u]='The published URL is The Way of Righteousness in Pulaar, not Portuguese.'
  elif 'bibleproject' in u:
   dest=p['resolved'];r=resource('bibleproject-site','link',row,'BibleProject em português',dest,'BibleProject');r['dbsListedUrl']=u;link(r,dest,'Explorar os vídeos e estudos do BibleProject')
  elif 'youtu.be' in u:
   subject={'Matthew':'matthew','Mark':'mark','Luke':'luke','John':'john'}
   name=next(v for k,v in subject.items() if k.lower() in row['title'].lower())
   r=records['https://dbs.org/video/lumo-'+name+'/por_portuguese_'+name];r.setdefault('dbsListedUrls',[]).append(u)
  elif 'mars-hill' in u:
   suffix='por_portuguese-storytellers_the_hope' if 'storyteller' in u else 'por_portuguese_the_hope'
   r=records['https://dbs.org/video/hope/'+suffix];r.setdefault('dbsListedUrls',[]).append(u);link(r,u,'Ver também no site da Mars Hill')
  elif '/StudyBible/content/texts/' in u:
   if '/por_aav/' not in u: excluded[u]='English, Greek or Hebrew study text, not Portuguese.';continue
   r=resource('study-almeida-atualizada','scripture',row,'Almeida Atualizada — Bíblia de estudo',u);link(r,u,'Ler a Bíblia de estudo no DBS')
  elif '/AudioBible/' in u or '/Audio/Bible/' in u or '/Bible/Images/' in u: excluded[u]='DBS returns a missing page for this legacy directory.'
  elif '/Video/' in u:
   dest=secure(u)
   if not available(dest): excluded[u]='Legacy video failed the availability check.';continue
   native={'001':'JESUS — arquivo DBS','003':'A história de Jesus para crianças — arquivo DBS','007':'Meu último dia'}[u.rsplit('/',1)[-1][:3]]
   r=resource('legacy-film-'+u.rsplit('/',1)[-1][:3],'film',row,native,u)
   r['play']={'kind':'file','sd':dest};download(r,dest,'Filme (MP4)')
  elif '/Books/' in u:
   if re.search(r'VocÃ|BÃ|â€',p.get('text','')): excluded[u]='Legacy HTML is served with an incorrect character encoding, making its Portuguese text unreadable.';continue
   native=p['title'];slug=re.sub(r'[^a-z0-9]+','-',u.rsplit('/',1)[-1].lower()).strip('-')
   r=resource('study-'+slug,'book',row,native,u,'GotQuestions');link(r,u,'Ler o estudo em português no DBS')
  else: raise ValueError('Unaccounted source: '+u)
 media['excluded']=excluded
 save(f'catalog/source/dbs-media-portuguese-{DATE}.json',media)
 save(f'catalog/source/dbs-portuguese-external-{DATE}.json',{'language':'por','verified':DATE,'urls':sorted(external),'excluded':excluded})
 save(f'catalog/source/dbs-direct-files-portuguese-{DATE}.json',{'verified':DATE,'alive_files':sorted(u for u,p in probes.items() if p.get('valid') and urllib.parse.urlparse(u).path.endswith(('.pdf','.epub','.zip'))),'playable_audio_filesets':[r['play']['fileset'] for r in resources if r['type']=='audio-bible']})
 save('catalog/portuguese.json',{'generated':'DBS rendered Portuguese inventory — '+DATE,
      'languages':{'por':{'code':'por','name':'Portuguese','native':'Português','script':'latn','dir':'ltr','font':'latin','region':'Brasil, Portugal e países de língua portuguesa','blurb':'Bíblias, filmes, áudios e estudos cristãos em português, com as variantes regionais indicadas.'}},'resources':resources})
 print(len(resources),'Portuguese resources;',len(excluded),'excluded source URLs')


if __name__=='__main__':main()
