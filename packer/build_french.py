#!/usr/bin/env python3
"""Rebuild the French shelf from DBS's rendered inventory and published files."""
import json,pathlib,re,urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'catalog/source';DATE='2026-10-03'
def load(name):return json.loads((SOURCE/name).read_text())
def save(name,data):(ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=1)+'\n')
def files(p,ext):return list(dict.fromkeys(a['url'] for a in p.get('links',[]) if urllib.parse.urlparse(a['url']).path.lower().endswith(ext)))
BOOK_NAMES=dict(zip('Genesis Exodus Leviticus Numbers Deuteronomy Joshua Judges Ruth 1Samuel 2Samuel 1Kings 2Kings 1Chronicles 2Chronicles Ezra Nehemiah Esther Job Psalms Proverbs Ecclesiastes SongofSongs Isaiah Jeremiah Lamentations Ezekiel Daniel Hosea Joel Amos Obadiah Jonah Micah Nahum Habakkuk Zephaniah Haggai Zechariah Malachi Matthew Mark Luke John Acts Romans 1Corinthians 2Corinthians Galatians Ephesians Philippians Colossians 1Thessalonians 2Thessalonians 1Timothy 2Timothy Titus Philemon Hebrews James 1Peter 2Peter 1John 2John 3John Jude Revelation'.split(),'Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|1 Samuel|2 Samuel|1 Rois|2 Rois|1 Chroniques|2 Chroniques|Esdras|Néhémie|Esther|Job|Psaumes|Proverbes|Ecclésiaste|Cantique des cantiques|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Actes|Romains|1 Corinthiens|2 Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|1 Thessaloniciens|2 Thessaloniciens|1 Timothée|2 Timothée|Tite|Philémon|Hébreux|Jacques|1 Pierre|2 Pierre|1 Jean|2 Jean|3 Jean|Jude|Apocalypse'.split('|')))
TEXT_NAMES={'FRABAC':'Bible Crampon — 1923','FRALSG':'Bible Louis Segond — 1910','FRALCF':'Bible Louis-Claude Fillion — 1888','FRADBY':'Bible Darby — 1885','FRAM44':'Bible Roques-Martin — 1744','FRAOST':'Bible Ostervald — 1744','FRASAC':'Bible de Sacy (Port-Royal) — 1696'}
DIRECTORY_NAMES=dict(zip('FRAOSTY FRANEG FRASTDY FRAALX FRNTLS FRAGNF FRAP17 FRACAN FRAEMT FRAPEI FRABCF FRADOVE FRABTR FRASTA FRAPLD FRANFC FRAJERU FREBBB FRAZEB FRASWR FRAPBB FRAPDV FRAACT FRASYN FRAPPL FRASG21 FRALSB FRANBS FRATOB FRAO74 FRAPGR FRAZZZP FRARAB FRAOLI FRAMRD FRAG69 FRAMAR FRAJCF'.split(),'Bible Osty — 1973|Nouvelle Édition de Genève — 1979|La Bible expliquée — 2004|La Bible d’Alexandrie : le Pentateuque|Bible Louis Segond — enregistrement Trésorsonore|Évangile selon Matthieu — français de Guernesey (1863)|Bible Parole de Vie — 2017|Bible Parole de Vie — français canadien (2000)|Traduction œcuménique de la Bible — 2010|Bible illustrée pour enfants|Bible en français courant — 1982|Bible à la Colombe — 1978|Bible : nouvelle traduction (Bayard) — 2001|Nouveau Testament Stapfer — 1889|Bible de la Pléiade — 1971|Nouvelle Français courant — 2019|Bible de Jérusalem — 1956|Bible Bovet-Bonnet — 1900|ZeBible — 2011|Bible du Semeur — 1992|Bible Pierre de Beaumont — 1981|Bible Parole de Vie — 2000|Bible Chouraqui — 1985|Nouveau Testament et Psaumes — version synodale|Bible des peuples — 1998|Bible Segond 21 — 2007|Bible Louis Segond — 1904|Nouvelle Bible Segond — 2002|Traduction œcuménique de la Bible — 1975|Nouveau Testament Oltramare — 1874|Bible Perret-Gentil et Rilliet — 1858|Bible française : modèle de catalogue|Bible du Rabbinat|Bible d’Olivétan — 1535|Bible de Maredsous — 1950|Nouveau Testament de Genève — 1669|Bible David Martin — 1839|Bible du Jubilé (français courant) — 2010'.split('|')))
FILM_NAMES=['L’Histoire de Jésus pour les enfants — français d’Afrique','L’Évangile selon Jean — La Bible en images','JÉSUS','Magdalena','L’Histoire de Jésus pour les enfants','Le Sauveur','L’Histoire des prophètes','Roi de gloire','De la création à Christ — français d’Afrique de l’Ouest','BibleProject : panorama des livres bibliques','BibleProject : thèmes et études bibliques','LUMO : l’Évangile selon Jean','LUMO : l’Évangile selon Luc','LUMO : l’Évangile selon Marc','LUMO : l’Évangile selon Matthieu','LUMO : les Actes des apôtres','LUMO : l’Alliance','La Bible en images : les Actes des apôtres','L’Espoir','iBible : l’histoire du salut','iBible : l’histoire du salut — français canadien','La Bible en images : l’Évangile selon Matthieu','Rescue Project : l’Évangile pour les personnes sourdes']
HISTORIC_NAMES=['Bible ancienne — 1525 (date indiquée par DBS)','Bible d’Olivétan — 1535','Bible à l’Épée — moyen français (1540)','Saurin : discours historiques, critiques, théologiques et moraux — 1731','Bible Martin — 1744','Ancien Testament Ostervald — 1771','Bible Ostervald — 1801','Nouveau Testament de Sacy — 1831','Bible David Martin — 1839','Nouveau Testament de Genoude — 1839','Nouveau Testament du père de Carrières — 1846','Évangiles de Louis-Claude Fillion — 1896','Nouveau Testament — 1896','Bible Louis Segond — 1899','Bible polyglotte — français, grec, hébreu et latin (1900)','Évangiles de Jefferson — 1904','Extrait de la Genèse — 1988','Nouveau Testament français-breton — Ostervald (1886)','Nouveau Testament français-anglais — 1817','Genèse — extrait d’une Bible ancienne']
STORY_TITLES='La création du monde|Le monde invisible|La désobéissance|Noé et le déluge|Dieu appelle Abraham|La promesse faite à Abraham s’accomplit|David est oint roi|Élie et les faux prophètes|Dieu est avec nous|La souffrance du Sauveur|La naissance de Jésus|Le baptême de Jésus|Jésus et la Samaritaine|Jésus guérit un paralytique|Jésus et la femme pécheresse|La parabole du semeur|La parabole de l’ivraie|Jésus calme la tempête|Jésus délivre un homme possédé|La fille de Jaïrus et la femme malade|Jésus marche sur l’eau|Qui est Jésus ?|Comment prier|Jésus entre à Jérusalem|Le dernier repas|L’arrestation de Jésus|La crucifixion de Jésus|La résurrection de Jésus|L’ascension et la mission des disciples|Le Saint-Esprit vient sur les disciples|Pierre et Jean guérissent un homme boiteux|Pierre et Jean devant les autorités|La mort d’Étienne|Philippe et l’Éthiopien|La conversion de Paul|Pierre chez Corneille|L’Église à Antioche|La mission de Paul et Barnabas|L’Esprit guide Paul|Les chaînes sont brisées|Dieu agit à Éphèse|Un nouveau ciel et une nouvelle terre'.split('|')
THEME_TITLES='Qu’est-ce que la Bible ?|L’histoire racontée par la Bible|Les styles littéraires de la Bible|La méditation des textes bibliques dans l’Antiquité|La Torah|Les prophètes|Les écrits|L’intrigue dans les récits bibliques|Les personnages dans les récits bibliques|Le cadre des récits bibliques|Les motifs récurrents des récits bibliques|La poésie biblique|Les métaphores bibliques|Les Psaumes|La littérature apocalyptique|Les paraboles de Jésus|Les Évangiles|Les lettres du Nouveau Testament|Le contexte des lettres du Nouveau Testament|Dieu|La justice|Le Messie|Le Saint-Esprit|L’image de Dieu|L’arbre de vie|L’eau de la vie|Le ciel et la terre|Le temple|Le sabbat|La sainteté|Le sacrifice et l’expiation|Le jour du Seigneur|La loi|La grâce|Le Fils de l’homme|L’Évangile du Royaume|L’alliance|L’exil|La générosité|La bénédiction et la malédiction|Le désert|La rédemption|L’Exode et le chemin du salut|Le dragon du chaos|La ville|L’onction|La vie éternelle|Les derniers seront les premiers|L’épreuve|La lecture publique des Écritures|Vivre en exil|Les prêtres royaux d’Éden|Abraham et Melchisédek|Moïse et Aaron|David, roi et prêtre|Jésus, prêtre royal|Le sacerdoce royal|Shalom : la paix|Agapè : l’amour|Euangelion : la bonne nouvelle|Khata : le péché|Avon : l’iniquité|Pesha : la transgression|YHWH : le nom de Dieu|Hesed : l’amour fidèle|Rakham : la compassion|Khanun : la grâce|Erekh Apayim : la patience|Emet : la fidélité|Shema : écouter|Ahav : aimer|Levav : le cœur|Nephesh : l’âme|Me’od : la force|Yakhal : l’espérance|Chara : la joie|Martus : le témoin|Exode 34.6-7|Les êtres spirituels : introduction|Elohim|Le conseil divin|Les anges et les chérubins|L’ange du Seigneur|Satan et les démons|L’adversaire : Satan|La nouvelle humanité'.split('|')

def overview_title(ref):
    special={'TaNaK / Old Testament Overview':'Panorama de l’Ancien Testament','New Testament Overview':'Panorama du Nouveau Testament','1 & 2 Kings':'1 et 2 Rois','1 & 2 Chronicles':'1 et 2 Chroniques','Ezra-Nehemiah':'Esdras et Néhémie','Song of Songs':'Cantique des cantiques','1-3 John':'1 à 3 Jean'}
    if ref in special:return special[ref]
    for name,native in sorted(BOOK_NAMES.items(),key=lambda x:-len(x[0])):
        english=re.sub(r'^(\d)',r'\1 ',name)
        if ref==english or ref.startswith(english+' '):return native+ref[len(english):]
    raise ValueError('No French overview title: '+ref)

def programme_title(folder):
    match=re.search(r'LLL (\d)',folder)
    if match:return 'Regardez, écoutez et vivez '+match[1]+' : '+['Au commencement, Dieu','Des hommes puissants pour Dieu','La victoire grâce à Dieu','Les serviteurs de Dieu','Éprouvés pour Dieu','Jésus, enseignant et guérisseur','Jésus, Seigneur et Sauveur','Les actes du Saint-Esprit'][int(match[1])-1]
    for pattern,title in [('63299','Le Christ vivant'),('63337','Dieu vous aime'),('63302','L’Agneau de Dieu'),('37061','Bonne nouvelle pour les femmes'),('66692','Jésus-Christ est-il musulman ?'),('68181','Le cœur de l’homme'),('27311','Témoignage chrétien')]:
        if pattern in folder:return title
    return 'Bonne nouvelle' if any(x in folder for x in ['63303','63935','63035','37060']) else 'Paroles de vie'

def variety(folder):
    return 'Afrique centrale' if "Afrique centrale" in folder else 'Afrique du Nord' if 'Afrique du Nord' in folder else 'Canada' if 'Canadien' in folder else 'Gitan' if 'Gitan' in folder else 'Afrique' if 'Afrique' in folder else 'France'

def main():
    audit=load(f'dbs-rendered-french-{DATE}.json')['fra'];media=load(f'dbs-media-french-{DATE}.json');probes=media['verified_files'];resources=[];external=set();excluded={};records={}
    def valid(u):return probes.get(u,{}).get('valid') or probes.get(u,{}).get('status') in [403,406] # Published anti-bot protected URLs remain on the original source page.
    def resource(slug,kind,title,native,source,var='France',org='Digital Bible Society'):
        r={'id':'fra-'+slug,'lang':'fra','type':kind,'title':title,'native':native,'scope':var,'langName':'Français'+(' · '+var if var!='France' else ''),'source':source,'org':org,'desc':'','downloads':[],'links':[]};resources.append(r);records[source]=r;return r
    def download(r,urls,label):
        for n,u in enumerate(urls,1):
            if not valid(u):continue
            r['downloads'].append({'url':u,'label':label(u,n)})
            if not urllib.parse.urlparse(u).netloc.endswith('dbs.org'):external.add(u)
    def tracks(r,urls,titles):
        paired=[(u,t) for u,t in zip(urls,titles) if valid(u)]
        if not paired:raise ValueError('No recordings: '+r['source'])
        r['play']={'kind':'audio-collection','sample':paired[0][0],'items':[{'n':n,'file':u,'title':t} for n,(u,t) in enumerate(paired,1)]};download(r,[u for u,t in paired],lambda u,n:paired[n-1][1]+' (MP3)')
    def film(r,p,titles=None):
        mp4=files(p,'.mp4');chapterfiles=[u for u in mp4 if '/chapters/' in u or ('/Lumo-' in u and '/films_low/' in u)]
        if p.get('episodes'):
            chapterfiles=[next(a['url'] for a in e['links'] if urllib.parse.urlparse(a['url']).path.endswith('.mp4')) for e in p['episodes']]
            mp4=chapterfiles
        if chapterfiles:
            ts=titles or [('Film complet' if '_full_' in u.lower() else 'Partie '+str(int(re.search(r'_(\d\d)_360',u)[1])) if '/Lumo-Acts/' in u else 'Chapitre '+str(n)) for n,u in enumerate(chapterfiles,1)]
            r['play']={'kind':'chapters','base':'','items':[{'n':n,'file':u,'title':t} for n,(u,t) in enumerate(zip(chapterfiles,ts),1) if valid(u)]};download(r,chapterfiles,lambda u,n:ts[n-1]+' (MP4)')
        else:
            sd=next((a['url'] for a in p.get('links',[]) if ('SD' in a['label'] or 'Compressed' in a['label']) and a['url'] in mp4),next((u for u in mp4 if '_low.' in u or '-sd.' in u),mp4[0] if mp4 else None))
            hd=next((a['url'] for a in p.get('links',[]) if ('HD' in a['label'] or 'High Quality' in a['label']) and a['url'] in mp4),None)
            if sd and valid(sd):r['play']={'kind':'file','sd':sd,**({'hd':hd} if hd and valid(hd) else {})}
        def film_label(u,n):
            part=re.search(r'(?:_part_?|_PART_)(\d+)',u)
            name='Partie '+part[1] if part else 'Film complet'
            published=next((a['label'] for a in p.get('links',[]) if a['url']==u),'')
            quality=' · SD' if '_low.' in u or '-sd.' in u or 'SD' in published or '/270p.' in u else ' · HD' if 'High' in published or 'HD' in published or '/720p.' in u else ''
            return name+' (MP4)'+quality
        download(r,[u for u in mp4 if u not in chapterfiles],film_label)
        # ZIPs are offered only after a complete archive was checked; chapter files can always be saved individually.
        checked={a['url'] for a in media.get('browser_archives',[]) if a.get('crc_valid')};download(r,[u for u in files(p,'.zip') if u in checked],lambda u,n:'Tous les chapitres (ZIP)')
    for section,g in audit.items():
        if section=='Links to Other Sites':continue
        for idx,row in enumerate(g['links']):
            u=row['href'];p=media['pages'][u];slug=urllib.parse.urlparse(u).path.split('/')[-1]
            if 'has moved' in p['text']:excluded[u]='Retired audio edition; DBS links current editions.';continue
            if section=='Bibles' and '/audio/' in u:continue
            if section=='Bibles':
                r=resource('text-'+slug.lower(),'scripture',row['title'],TEXT_NAMES[slug],u);r['desc']='Texte biblique en français. Vous pouvez le lire en ligne ou enregistrer un fichier disponible ci-dessous.'
                r['links']=[{'label':'Lire la Bible sur DBS','url':a['url']} for a in p['links'] if 'app-json-study/index.html' in a['url']][:1]
                pdf=next((u for u in files(p,'.pdf') if probes.get(u,{}).get('valid')),None)
                if pdf:r['read']={'kind':'pdf','url':pdf};download(r,[pdf],lambda u,n:'Bible (PDF)')
                checked={a['url'] for a in media.get('browser_archives',[]) if a.get('crc_valid')};download(r,[u for u in files(p,'.zip') if u in checked],lambda u,n:'Bible HTML pour lecture hors ligne (ZIP)')
                download(r,[u for u in files(p,'.epub') if probes.get(u,{}).get('valid')],lambda u,n:'Bible (EPUB)')
            elif section=='Historic Bible (Scans)':
                if 'Jefferson' in row['title']:excluded[u]='Jefferson removes portions of Scripture; edition not carried.';continue
                r=resource('scan-'+re.sub(r'[^a-z0-9]+','-',slug.lower()).strip('-'),'historic',row['title'],HISTORIC_NAMES[idx],u);pdf=next((f for f in files(p,'.pdf') if probes.get(f,{}).get('valid')),None)
                if pdf:r['read']={'kind':'pdf','url':pdf};download(r,[pdf],lambda u,n:'Fac-similé (PDF)')
                else:r['links']=[{'label':'Consulter le document sur DBS','url':u}]
                r['desc']='Fac-similé d’une édition ancienne. L’orthographe et la langue peuvent différer du français actuel.'
            elif section=='Films':
                native=FILM_NAMES[idx];var='Afrique' if 'french-african' in slug else 'Afrique de l’Ouest' if 'west_african' in slug else 'Canada' if 'canadian' in slug else 'France';r=resource('film-'+slug,'film',row['title'],native,u,var,row['cells'][1])
                ts=THEME_TITLES if slug.endswith('-themes') else [overview_title(e['reference']) for e in p['episodes']] if p.get('episodes') else None
                if ts:assert len(ts)==len(p['episodes'])
                film(r,p,ts)
                if not r.get('play'):r['links']=[{'label':'Regarder sur DBS','url':u}]
                if '/deafproject/' in u:r['desc']='L’Évangile présenté par des gestes et des images pour les personnes sourdes.'
            elif section=='Audio Collections':
                native=['Global Recordings : enregistrements en français','L’Histoire de Jésus — audio','StoryRunners : 42 récits bibliques'][idx];r=resource('ac-'+slug.lower(),'audio',row['title'],native,u,org=['Global Recordings Network','The Story of Jesus','StoryRunners'][idx]);mp3=files(p,'.mp3')
                if idx==0:
                    blocked={'67496','66688','66690','62771'};filtered=[];ts=[];counts={}
                    for f in mp3:
                        folder=urllib.parse.unquote(f).split('/')[-2];ident=re.search(r'(\d{5})$',folder)[1]
                        if ident in blocked:media.setdefault('excluded_recordings',{})[f]='Public-service recording; Christian content not confirmed.';continue
                        if ident=='63302' and re.search(r'[\u0600-\u06ff]',urllib.parse.unquote(f)):media.setdefault('excluded_recordings',{})[f]='Arabic recording on French shelf.';continue
                        counts[folder]=counts.get(folder,0)+1;filtered.append(f);ts.append(programme_title(folder)+' · '+variety(folder)+' — piste '+str(counts[folder]))
                    tracks(r,filtered,ts);r['desc']='Enregistrements chrétiens en français, avec les variantes régionales indiquées. Les programmes dont le contenu chrétien n’est pas confirmé sont exclus.'
                else:tracks(r,mp3,['Récit complet']+['Partie '+str(n) for n in range(1,9)] if idx==1 else STORY_TITLES)
                checked={a['url'] for a in media.get('browser_archives',[]) if a.get('crc_valid')};download(r,[u for u in files(p,'.zip') if u in checked and idx!=0],lambda u,n:'Tous les récits (ZIP)')
    for u,p in media['pages'].items():
        if '/bibles/audio/' not in u or not p.get('media'):continue
        fs=u.split('/')[-1];native='Bible Chouraqui — audio (1985)' if fs.startswith('FRAACT') else 'Ancien Testament Louis Segond — Trésorsonore' if '_OT_' in fs else 'Bible Louis Segond — audio ('+('Trésorsonore' if 'FCBH' in fs else 'ISA')+')';r=resource('ab-'+fs.lower().replace('_','-'),'audio-bible',native,native,u,org='Davar Partners International' if 'DAVR' in fs else 'Faith Comes By Hearing' if 'FCBH' in fs else 'International Scripture Audio')
        r['play']={'kind':'audio-bible','fileset':fs,'version':fs.split('_')[0],'testaments':['OT'] if '_OT_' in fs else ['OT','NT'],'bookNames':BOOK_NAMES,'saveChapter':True}
        missing={}
        for file,result in probes.items():
            if '/'+fs+'/' in file and result.get('status')==404:
                match=re.search(r'/\d+_([A-Za-z0-9]+)_(\d+)\.mp3',file)
                if match:missing.setdefault(match[1],[]).append(int(match[2]))
        if missing:r['play']['missingChapters']=missing;r['desc']='DBS ne fournit pas de fichier séparé pour Malachie 4 dans cet enregistrement. Ce chapitre n’est donc pas proposé comme fichier audio distinct.'
    collection=next(r for r in resources if r['id'].startswith('fra-ac-fra_global'))
    rows={r['href']:r for r in audit['Links to Other Sites']['links']}
    legacy_titles=['La Bonne Nouvelle','Questions essentielles','Questions fréquentes','Questions sur Dieu','Questions sur Jésus-Christ','Questions sur le Saint-Esprit','Questions sur le salut','Questions sur la Bible','Questions sur l’Église','Questions sur la fin des temps','Questions sur les anges et les démons','Questions sur l’humanité','Questions sur la théologie','Questions sur la vie chrétienne','Questions sur la prière','Questions sur le péché','Questions sur le ciel et l’enfer','Questions sur le mariage','Questions sur les relations','Questions sur la famille','Questions sur la création','Questions sur les religions et les sectes','Questions sur les fausses doctrines','Questions sur les décisions fondamentales','Questions bibliques diverses','Questions d’actualité sur la Bible']
    for u,row in rows.items():
        p=media['publishers'].get(u,{});native=None
        if 'find.bible' in u:
            code=urllib.parse.parse_qs(urllib.parse.urlparse(u).query)['abbr'][0]
            if code in ['FRAZZZP','FRARAB','FRAPEI','FRAALX']:
                excluded[u]={'FRAZZZP':'Placeholder without an actual edition record.','FRARAB':'Rabbinat Hebrew Bible: Jewish OT-only edition, outside Christian shelf.','FRAPEI':'Illustrated children’s edition; complete Scripture text not confirmed.','FRAALX':'Academic Pentateuch edition; Christian resource scope not confirmed.'}[code];continue
            dest=p['resolved'];external.add(dest)
            if code=='FRNTLS':r=records['https://dbs.org/bibles/audio/FRNTLS_FCBH_OT_D'];r.setdefault('dbsListedUrls',[]).append(u);r['links'].append({'label':'Voir la fiche de cette édition','url':dest});continue
            r=resource('edition-'+code.lower(),'scripture','Segond 21 Bible' if code=='FRASG21' else row['title'],DIRECTORY_NAMES[code],dest,'Guernesey' if code=='FRAGNF' else 'Canada' if code=='FRACAN' else 'France','find.bible');r['dbsListedUrl']=u;r['links']=[{'label':'Voir la fiche d’édition et les liens de l’éditeur','url':dest}];r['desc']='Fiche d’édition : consultez les liens de l’éditeur pour lire, écouter ou obtenir cette Bible. Aucun fichier à télécharger n’est hébergé ici pour cette édition.'
        elif 'globalrecordings.net' in u:
            ident=u.split('/')[-1];matched=[i for i in collection['play']['items'] if re.search(r'\b0*'+ident+r'\b',urllib.parse.unquote(i['file']).split('/')[-2])]
            if not matched:excluded[u]='No confirmed Christian French recordings available for this programme.';continue
            f=urllib.parse.unquote(matched[0]['file']).split('/')[-2];native=programme_title(f);v=variety(f)
            r=resource('grn-'+ident,'audio',row['title'],native+' — '+v,u if 'UNKNOWN' not in p.get('title','') else collection['source'],v,'Global Recordings Network');r['dbsListedUrl']=u
            if 'UNKNOWN' not in p.get('title',''):external.add(u);r['links']=[{'label':'Ouvrir le programme chez l’éditeur','url':u}]
            tracks(r,[i['file'] for i in matched],[i['title'] for i in matched])
        elif 'rockintl' in u:
            external.add(u)
            if '/rock-video/' in u:r=records['https://dbs.org/video/rock/fra-french'];r.setdefault('dbsListedUrls',[]).append(u);r['links'].append({'label':'Voir aussi chez ROCK International','url':u});continue
            native='Le Chemin de la justice' if 'righteousness' in u else 'Roi de gloire' if 'gloire' in u else 'Ton histoire' if 'ton-histoire' in u else 'Un seul Dieu, un seul message';r=resource('rock-'+('audio-' if '/rock-audio/' in u else 'livre-')+re.sub(r'[^a-z0-9]+','-',native.lower()).strip('-'),'audio' if '/rock-audio/' in u else 'book',row['title'],native,u,org='ROCK International')
            mp3=files(p,'.mp3');pdf=files(p,'.pdf')
            if mp3:tracks(r,mp3,[re.sub(r'^\d+\.\s*TWOR_French\s*-\s*\d+\s*-\s*','',next(a['label'] for a in p['links'] if a['url']==f)) for f in mp3])
            if pdf and valid(pdf[0]):r['read']={'kind':'pdf','url':pdf[0]};download(r,pdf[:1],lambda u,n:'Livre (PDF)')
            if not r.get('play') and not r.get('read'):r['links']=[{'label':'Lire ou écouter chez l’éditeur','url':u}]
        elif 'pcloud' in u:
            # DBS identifies this exact folder as StoryRunners' French West African stories.
            # Keep its public download interface; do not invent expiring file URLs.
            external.add(u);r=resource('storyrunners-west-africa','audio',row['title'],'StoryRunners : récits bibliques — français d’Afrique de l’Ouest',u,'Afrique de l’Ouest','StoryRunners')
            r['links']=[{'label':'Ouvrir le dossier des récits bibliques','url':u}];r['desc']='Enregistrements hébergés dans un dossier pCloud. Une connexion Internet est nécessaire pour ouvrir le dossier et télécharger les fichiers.'
        elif 'lifewords' in u:excluded[u]='Retired product URL; the Christian resource is no longer identifiable at the listed address.'
        elif 'bibleproject' in u:external.add(p.get('resolved') or u);r=resource('bibleproject-site','link',row['title'],'BibleProject en français',p.get('resolved') or u,org='BibleProject');r['dbsListedUrl']=u;r['links']=[{'label':'Découvrir BibleProject en français','url':r['source']}]
        elif 'mars-hill' in u:r=records['https://dbs.org/video/hope/fra_french_the_hope'];r.setdefault('dbsListedUrls',[]).append(u);r['links'].append({'label':'Voir chez Mars Hill','url':u});external.add(u)
        elif 'createinternational' in u:r=records['https://dbs.org/video/ps/fra_ps_lhistoire_des_prophetes_frenchfrancais'];r.setdefault('dbsListedUrls',[]).append(u)
        elif '/StudyBible/content/texts/' in u:
            code=u.split('/')[-2]
            if code not in TEXT_NAMES:excluded[u]='English, Greek or Hebrew study text, not French.';continue
            r=records['https://dbs.org/bibles/'+code];r.setdefault('dbsListedUrls',[]).append(u);r['links'].append({'label':'Autre lecteur DBS en français','url':u})
        elif '/Bible/Images/' in u:excluded[u]='DBS returns a missing page for this legacy directory.'
        elif 'libraries.dbs.org' in u:
            path=urllib.parse.urlparse(u).path;slug=path.split('/')[-1];kind='book'
            if '/FRA_GQM_' in u:native=legacy_titles[int(re.search(r'_GQM_(\d+)',u)[1])-1]
            elif '_COH_' in u:native={'01':'Comment prier','02':'La vie du Messie','03':'Que pensez-vous du Christ ?'}[re.search(r'_COH_(\d+)',u)[1]]
            elif '/WordBob/' in u:native={'VOL01':'Comment tout a commencé : Genèse 1 à 11','VOL02':'L’Évangile selon l’apôtre Pierre : Marc et 1–2 Pierre','VOL03':'Commentaire sur les Actes des apôtres'}[slug[:5]]
            elif '/APC/' in u:
                lesson=int(re.search(r'APC(\d)',slug)[1]);native='Le Symbole des apôtres (Credo) — leçon '+str(lesson)+' : '+['Les articles de la foi','Dieu le Père','Jésus-Christ','Le Saint-Esprit','L’Église','Le salut'][lesson-1]
            elif '/Video/' in u:native={'001':'JÉSUS — archive DBS','002':'Dieu devenu homme','003':'L’Histoire de Jésus — archive DBS','004':'Magdalena — archive DBS'}[slug[:3]];kind='film'
            else:raise ValueError(u)
            if path.endswith(('.pdf','.mp4')) and not valid(u):excluded[u]='Legacy file failed the direct availability check.';continue
            r=resource('legacy-'+re.sub(r'[^a-z0-9]+','-',slug.lower()).strip('-'),kind,row['title'],native,u,org='GotQuestions' if '_GQM_' in u else 'Digital Bible Society')
            if '/APC/' in u:r['title']='The Apostles’ Creed — Lesson '+str(lesson);r['org']='Third Millennium Ministries'
            if '/WordBob/' in u:r['title']=native;r['org']='Bob Utley'
            if path.endswith('.pdf'):r['read']={'kind':'pdf','url':u};download(r,[u],lambda u,n:'Document (PDF)')
            elif path.endswith('.mp4'):r['play']={'kind':'file','sd':u};download(r,[u],lambda u,n:'Film (MP4)')
            else:r['links']=[{'label':'Lire en ligne sur DBS','url':u}]
        else:raise ValueError('Unaccounted source '+u)
    positions=[n for n,r in enumerate(resources) if '/APC/' in r['source']]
    lessons=sorted([resources[n] for n in positions],key=lambda r:int(re.search(r'APC(\d)',r['source'])[1]))
    for n,r in zip(positions,lessons):resources[n]=r
    media['excluded']=excluded;save(f'catalog/source/dbs-media-french-{DATE}.json',media)
    save(f'catalog/source/dbs-french-external-{DATE}.json',{'language':'fra','verified':DATE,'urls':sorted(external),'excluded':excluded})
    save(f'catalog/source/dbs-direct-files-french-{DATE}.json',{'verified':DATE,'alive_files':sorted(u for u,p in probes.items() if p.get('valid') and urllib.parse.urlparse(u).path.endswith(('.pdf','.epub','.zip'))),'playable_audio_filesets':[r['play']['fileset'] for r in resources if r['type']=='audio-bible']})
    save('catalog/french.json',{'generated':'DBS rendered French inventory — '+DATE,'languages':{'fra':{'code':'fra','name':'French','native':'Français','script':'latn','dir':'ltr','font':'latin','region':'France et pays francophones','blurb':'Bibles, films et enregistrements chrétiens en français, avec les variantes régionales indiquées.'}},'types':{'book':{'label':'Books and Guides','icon':'book','blurb':'Christian teaching, commentaries and study guides.'}},'resources':resources})
    print(len(resources),'French resources;',len(excluded),'excluded source URLs')
if __name__=='__main__':main()
