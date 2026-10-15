#!/usr/bin/env python3
"""Build Spanish from its browser audit: one shelf for Spain and Latin America.

    python3 packer/build_dbs_spanish.py
    python3 packer/build_dbs_audit.py spa       # the same

DBS's Spanish page (dbs.org/discover/languages/spa) and every DBS page it
lists were rendered in a real browser on 2026-10-15
(catalog/source/dbs-audit-spanish-2026-10-15.json). DBS lists five text
Bibles, five audio Bibles, 28 films, a Global Recordings collection, two Story
of Jesus recordings and 13 historic scans. Two more audio Bibles (Reina-Valera
1909 and La Palabra de Dios para Todos) are linked from their text Bible's
page and not from the language page; they are carried and keep that page as
dbsListedUrl.

Reina-Valera 1909 leads, as the one classic text the simple library shows;
the other Reina-Valera revisions follow, then the easy-to-read editions.
Every film DBS has in both Castilian (Spain) and Latin American Spanish is
carried in both, each naming its variety. No inclusive-language or
LGBTQ-affirming edition appears on DBS's Spanish page.

DBS mistakes handled rather than copied:

  · The Latin American JESUS page lists the Visual Bible Acts chapter files
    under the JESUS chapter titles, and the Castilian chapter ZIPs; only files
    named as JESUS chapters in the page's own folder are taken, so that page
    carries its full film as one file (Acts has its own page).
  · LUMO's Gospel pages list each film three times, once per Bible text
    (NVI, Biblia de América, Reina Valera Contemporánea); the Reina Valera
    Contemporánea recording is carried.
  · DBS's English titles for the BibleProject themes carry two stray
    YouTube titles in their "vernacular" field; the theme names are given in
    Spanish here.

Left out: the three GRN "Diagnostic" recordings (dialect comprehension tests,
not teaching) and GRN's resettlement welcome, as on the other shelves, and
links to other sites. Each is listed with its reason in notCarried.
"""
import collections
import re
import urllib.parse

import build_dbs_audit as base
from build_dbs_audit import BOOKS, LOCAL, Shelf

ES = LOCAL['es']
DATE = '2026-10-15'

base.LANGS['spa'] = dict(
    slug='spanish', ui='es', name='Spanish', native='Español', region='Latin America & Spain',
    speakers='~480 million', date=DATE,
    blurb='La Biblia, películas y grabaciones cristianas en español.',
    chapter='Capítulo', part='Parte', view='Ver en DBS',
    full='Película completa (MP4)', chapters_zip='Todos los capítulos (ZIP)',
    tracks_zip='Todas las grabaciones (ZIP)', pdf='Libro (PDF)',
    film_desc='Una película basada en la Biblia, en español.',
    film_desc_chapters='Una película basada en la Biblia, en español. Elija el capítulo que quiere ver o guardar.',
    deaf_desc='El Evangelio en lengua de señas para personas sordas, publicado en DBS junto con el español.',
    historic_desc='Una edición antigua impresa, escaneada en PDF. La ortografía de algunas palabras puede ser distinta de la actual.',
    grn_desc='Historias de la Biblia, cantos y mensajes cristianos grabados por Global Recordings Network.',
    plain=('espanol', 'spanish'),
)
L = base.LANGS['spa']

# Variety: (English name, Spanish name). Plain Spanish has none.
VARIETY = {
    'castilian': ('Castilian', 'castellano'),
    'latin': ('Latin American', 'Latinoamérica'),
    'afro-ecuadorian': ('Afro-Ecuadorian', 'afroecuatoriano'),
    'cuba': ('Cuban', 'Cuba'),
}

# Text Bibles: English title, Spanish title, publisher, what it is (for the description).
TEXT = {
    'SPARV09': ('Reina-Valera 1909', 'Reina Valera 1909', 'British and Foreign Bible Society',
                'La Biblia completa en la revisión Reina-Valera de 1909 (dominio público)'),
    'SPAWTC': ('The Word of God for All', 'La Palabra de Dios para Todos', 'Bible League International',
               'La Biblia completa en un español claro y sencillo'),
    'SPABES': ('Holy Bible in Simple Spanish', 'La Biblia en Español Sencillo', 'AudioBiblia.org',
               'La Biblia completa en un español fácil de entender'),
    'SPAVBL': ('Spanish Free Bible Version', 'Versión Biblia Libre', 'Free Bible Ministry',
               'La Biblia completa, traducida del hebreo y del griego'),
    'SPAPDDPT': ('The Word of God for You', 'Palabra de Dios para ti', 'Asociación Bíblica Latinoamericana',
                 'La Biblia completa con los libros deuterocanónicos, en español latinoamericano'),
}

# Audio Bibles: English title, Spanish title, publisher, variety.
AUDIO = {
    'SPARV09_ISA_FB_N': ('Reina-Valera 1909', 'Reina Valera 1909', 'International Scripture Association', None),
    'SPARV00_ASM_FB_N': ('Reina-Valera 2000', 'Reina Valera 2000', 'Audio Scripture Ministries', None),
    'SPAR60_ASM_OT_N': ('Reina-Valera 1960: Old Testament', 'Reina-Valera 1960: Antiguo Testamento',
                        'Audio Scripture Ministries', None),
    'SPAR95_ASM-FCBH_NT_D': ('Reina-Valera 1995: New Testament (dramatized)',
                             'Reina Valera 1995: Nuevo Testamento (dramatizado)',
                             'Audio Scripture Ministries · Faith Comes By Hearing', None),
    'SPAWTC_ASM-FCBH_FB_N': ('The Word of God for All', 'La Palabra de Dios para Todos',
                             'Audio Scripture Ministries · Faith Comes By Hearing', None),
    'SPATLA_ASM_NT_D': ('Contemporary Spanish Version: New Testament (dramatized)',
                        'Traducción en lenguaje actual: Nuevo Testamento (dramatizado)',
                        'Audio Scripture Ministries', None),
    'SPAESP_FCBH_NT_N': ('La Palabra (Spain): New Testament', 'La Palabra (España): Nuevo Testamento',
                         'Faith Comes By Hearing', 'castilian'),
}

# Reina-Valera first, then the easy-to-read editions.
ORDER = ['https://dbs.org/bibles/SPARV09', 'https://dbs.org/bibles/audio/SPARV09_ISA_FB_N',
         'https://dbs.org/bibles/audio/SPARV00_ASM_FB_N', 'https://dbs.org/bibles/audio/SPAR60_ASM_OT_N',
         'https://dbs.org/bibles/audio/SPAR95_ASM-FCBH_NT_D', 'https://dbs.org/bibles/SPAWTC',
         'https://dbs.org/bibles/audio/SPAWTC_ASM-FCBH_FB_N', 'https://dbs.org/bibles/audio/SPATLA_ASM_NT_D',
         'https://dbs.org/bibles/audio/SPAESP_FCBH_NT_N', 'https://dbs.org/bibles/SPABES',
         'https://dbs.org/bibles/SPAVBL', 'https://dbs.org/bibles/SPAPDDPT']

# Films: Spanish title by DBS film series.
FILM_NATIVE = {
    'jesus': 'JESÚS', 'magdalena': 'Magdalena', 'storyjesus': 'La historia de Jesús para niños',
    'john': 'La vida de Jesús (Evangelio de Juan)', 'savior': 'El Salvador', 'rock': 'Rey de Gloria',
    'c2c': 'De la creación a Cristo', 'lumo-covenant': 'LUMO: El Pacto',
    'acts_vb': 'La Biblia Visual: Hechos de los Apóstoles', 'matthew': 'La Biblia Visual: Mateo',
    'creation': 'Los días de la creación', 'genesis': 'El libro de Génesis', 'hope': 'La Esperanza',
    'ibible': 'iBible: La verdadera historia de Jesús', 'deafproject': 'Proyecto Rescate: el Evangelio en lengua de señas',
}
FILM_TITLE = {'storyjesus': 'Story of Jesus for Children', 'rock': 'King of Glory', 'c2c': 'Creation to Christ',
              'genesis': 'The Book of Genesis', 'ibible': 'iBible: The Real Story of Jesus'}

C2C = ['El Dios Altísimo y su creación', 'El pecado y la separación de Dios',
       'Dios da los Diez Mandamientos y los sacrificios', 'Dios da a Jesús', 'La muerte y la resurrección de Jesús',
       'El hijo pródigo', 'El regreso a Dios']
ROCK = ['El Rey anuncia su plan', 'El Rey cumple su plan']

# BibleProject theme videos, in DBS's order within each group.
BP_THEMES = {
    'God': 'Dios', 'Justice': 'La justicia', 'The Messiah': 'El Mesías', 'Holy Spirit': 'El Espíritu Santo',
    'Image of God': 'La imagen de Dios', 'Tree of Life': 'El árbol de la vida', 'Water of Life': 'El agua de vida',
    'Heaven and Earth': 'El cielo y la tierra', 'Temple': 'El templo', 'Sabbath': 'El día de reposo',
    'Holiness': 'La santidad', 'Sacrifice and Atonement': 'Sacrificio y expiación', 'Day of the Lord': 'El día del Señor',
    'The Law': 'La Ley', 'Grace': 'La gracia', 'Son of Man': 'El Hijo del Hombre',
    'Gospel of the Kingdom': 'El evangelio del Reino', 'Covenant': 'El pacto', 'Exile': 'El exilio',
    'Generosity': 'La generosidad', 'Blessing and Curse': 'Bendición y maldición', 'The Wilderness': 'El desierto',
    'Redemption': 'La redención', 'The Exodus Way': 'El camino del éxodo', 'The Mountain': 'La montaña',
    'Chaos Dragon': 'El dragón del caos', 'The City': 'La ciudad', 'Anointing': 'La unción',
    'Eternal Life': 'La vida eterna', 'The Last Will Be First': 'Los últimos serán los primeros', 'The Test': 'La prueba',
    'Public Reading of Scripture': 'La lectura pública de las Escrituras', 'The Way of the Exile': 'El camino del exiliado',
    'Royal Priests of Eden': 'Sacerdotes reales del Edén', 'Abraham and Melchizedek': 'Abraham y Melquisedec',
    'Moses and Aaron': 'Moisés y Aarón', 'David and the Priestly King': 'David y el rey sacerdote',
    'Jesus the Royal Priest': 'Jesús, el sacerdote real', 'The Royal Priesthood': 'El sacerdocio real',
    'What is the Bible?': '¿Qué es la Biblia?', 'The Story of the Bible': 'La historia de la Biblia',
    'Literary Styles in the Bible': 'Los estilos literarios de la Biblia',
    'Ancient Jewish Meditation Literature': 'La literatura judía antigua de meditación',
    'The Book of Psalms': 'El libro de los Salmos',
    'Intro to Spiritual Beings': 'Introducción a los seres espirituales', 'Elohim': 'Elohim',
    'Divine Council': 'El consejo divino', 'Angels and Cherubim': 'Ángeles y querubines',
    'The Angel of the Lord': 'El ángel del Señor', 'Satan and Demons': 'Satanás y los demonios',
    'The New Humanity': 'La nueva humanidad',
    'Shalom': 'Shalom', 'Agape': 'Ágape', 'Euangelion': 'Euangelion', 'Khata': 'Jatá', 'Avon': 'Avón',
    'Pesha': 'Pesha', 'YHWH': 'YHWH', 'Khesed': 'Jésed', 'Rakham': 'Rajam', 'Erekh Apayim': 'Erej apayim',
    'Emet': 'Emet', 'Shema': 'Shemá', 'Ahav': 'Ahav', 'Levav': 'Levav', 'Nephesh': 'Néfesh', 'Meod': 'Meod',
    'Yakhal': 'Yajal', 'Chara': 'Jará', 'Martus': 'Martus', 'Exodus 34 6-7': 'Éxodo 34:6-7',
}
BP_GROUPS = {'How to Read the Bible': 'Cómo leer la Biblia', 'Spiritual Beings': 'Seres espirituales',
             'Word Studies': 'Estudios de palabras', 'Biblical Themes': 'Temas bíblicos'}
# BibleProject joins some books in one overview.
BOOK_EXTRA = {'1 & 2 Kings': '1 y 2 Reyes', '1 & 2 Chronicles': '1 y 2 Crónicas', 'Ezra-Nehemiah': 'Esdras y Nehemías',
              'Song of Songs': 'Cantares', '1-3 John': '1, 2 y 3 Juan'}

# Global Recordings programmes: (English, Spanish), by the series name in the folder.
GRN_NAMES = {
    'Audiovisual Buenas Nuevas': ('Good News (audiovisual)', 'Buenas Nuevas (audiovisual)'),
    'Good News': ('Good News', 'Buenas Nuevas'),
    'Buenas Nuevas de las Santas Esc': ('Good News from the Holy Scriptures', 'Buenas Nuevas de las Santas Escrituras'),
    'Historias Biblicas Libres': ('Free Bible Stories', 'Historias bíblicas libres'),
    'Jesus el Refugiado': ('Jesus the Refugee', 'Jesús, el refugiado'),
    'Portrait of Jesus': ('Portrait of Jesus', 'Retrato de Jesús'),
    'Words of Life': ('Words of Life', 'Palabras de Vida'),
    'Words of Life for Children': ('Words of Life for Children', 'Palabras de Vida para niños'),
    'Conciendo Mas De Dios': ('Knowing More About God', 'Conociendo más de Dios'),
    'Devocionales para Ninos': ('Devotionals for Children', 'Devocionales para niños'),
    'Devociones': ('Devotionals', 'Devociones'),
    'Devotionals': ('Devotionals', 'Devocionales'),
    'The Living Christ': ('The Living Christ', 'El Cristo viviente'),
}
LLL = ('Look, Listen & Live', 'Mira, escucha y vive', [
    'Comenzando con Dios', 'Hombres poderosos de Dios', 'Victoria por medio de Dios', 'Siervos de Dios',
    'A juicio por causa de Dios', 'Jesús, Maestro y Sanador', 'Jesús, Señor y Salvador', 'Los hechos del Espíritu Santo'])
GRN_VARIETY = {'Espanol America Latina': 'latin', 'Spanish Cuba': 'cuba'}
GRN_LEFT_OUT = {
    'Norte Diagnostic': 'GRN “Norte Diagnostic” is a dialect comprehension test recording, not a teaching resource.',
    'Sur Diagnostic': 'GRN “Sur Diagnostic” is a dialect comprehension test recording, not a teaching resource.',
    'Otros Diagnostic': 'GRN “Otros Diagnostic” is a dialect comprehension test recording, not a teaching resource.',
    'Bienvenidos a los Estados Unidos': 'GRN “Bienvenidos a los Estados Unidos” is a resettlement welcome, not a Christian resource.',
}

# Historic scans: Spanish title, by the scan's DBS name.
SCANS = {
    'Spanish-1560-Bible-La-Biblia-Qve-Es-Los-Sacros-Libros-Del-Vieio-Y-Nvevo-Testamento-Cassiodoro-de-Reyna-facsimilie':
        'La Biblia, Casiodoro de Reina (facsímil de 1569)',
    'Spanish-1569-Reina-Valera-Bible': 'Biblia Reina (1569)',
    'Spanish-1569-Spanish-Bear-Bible': 'Biblia del Oso (1569)',
    'Spanish-1622-Bible-La-Biblia-que-es-los-sacros-libros-del-Vieio-y-Nueuo-Testamento': 'La Biblia (1622)',
    'Spanish-1824-La-Biblia-Sagrada-Felipe-Scio-de-San-Miguel': 'La Biblia Sagrada, Felipe Scío de San Miguel (1824)',
    'Spanish-1854-La-Biblia-Sagrada-Bible': 'La Biblia Sagrada (1854)',
    'Spanish-1856-Cotejada-Cuidadosamente-Biblia': 'Biblia cotejada cuidadosamente (1856)',
    'Spanish-1870-Santa-Biblia-Revisada-y-Corregida-Cipriano-de-Valera': 'Santa Biblia revisada y corregida, Cipriano de Valera (1870)',
    'Spanish-1884-Santa-Biblia-Revisada': 'Santa Biblia revisada (1884)',
    'Spanish-1900-Santa-Biblia-Antigua-Version-Referencias': 'Santa Biblia, Antigua Versión, con referencias (1900)',
    'Spanish-1964-New-Testmant-Study-La-Sagrada-Escritura-texto-y-comentario-por-profesores-de-la-Compaa-de-Jesus':
        'La Sagrada Escritura: Nuevo Testamento, texto y comentario (1964)',
    'Spanish-1994-Dios-Habla-Hoy-New-Testament': 'Dios Habla Hoy: Nuevo Testamento (1994)',
    'Spanish-2012-RVI-and-RV1909-New-Testament-Diglot': 'Nuevo Testamento bilingüe RVI y RV1909 (2012)',
}

COMPLETE = 'La historia completa'


def book_ref(text):
    """'Genesis 1-11' → 'Génesis 1-11', with the interface's book names."""
    text = text.strip()
    for en, es in BOOK_EXTRA.items():
        if text.startswith(en):
            return es + text[len(en):]
    m = re.match(r'((?:[123] )?[A-Z][a-z]+)(.*)$', text)
    key = m[1].replace(' ', '')
    return ES[key] + m[2].replace('–', '-')


class SpanishShelf(Shelf):
    def __init__(self):
        super().__init__('spa')
        self.left_out = {}

    def tag(self, r, key):
        if not key:
            return
        eng, es = VARIETY[key]
        r['scope'] = eng
        r['langName'] = f"{L['native']} · {es}"
        r['title'] += f' ({eng})'
        r['native'] += f' ({es})'

    def listed_from(self, url):
        row = next((row for row in self.audit['sections']['Bibles'] if row['url'] == url), {})
        return row.get('linkedFrom')

    def pick(self, u):
        """The file, or DBS's own copy of it (video.dbs.org fails for some files DBS serves via dbs.org/cdn/video)."""
        if not u:
            return None
        if self.ok(u):
            return u
        cdn = u.replace('https://video.dbs.org/', 'https://dbs.org/cdn/video/')
        return cdn if cdn != u and self.ok(cdn) else None

    def media(self, item):
        m = item.get('media') or {}
        return next((self.pick(u) for u in (m.get('low'), m.get('high')) if self.pick(u)), None)

    # ------------------------------------------------------------ Bibles
    def text_bible(self, url, page):
        abbr = url.rsplit('/', 1)[1]
        title, native, org, what = TEXT[abbr]
        files = [f'https://bibles.dbs.org/{abbr}/pdf/{abbr}.pdf', f'https://bibles.dbs.org/{abbr}/epub/{abbr}.epub',
                 f'https://bibles.dbs.org/{abbr}/html_{abbr}.zip']
        year = int(re.search(r'\n(1[89]\d\d|20\d\d)\n·\n', page['text'])[1])
        r = self.make('text-' + abbr.lower(), 'scripture', title, native, url, org,
                      what + '. Léala en la aplicación o guárdela para leerla sin internet.', year=year)
        if self.ok(files[0]):
            r['read'] = {'kind': 'pdf', 'url': files[0]}
            self.download(r, files[0], 'La Biblia (PDF)')
        if self.ok(files[1]):
            self.download(r, files[1], 'La Biblia (EPUB)')
        if self.ok(files[2]):
            self.download(r, files[2], 'La Biblia para leer sin internet (HTML ZIP)')
        assert r['downloads'], url
        study = f'https://bibles.dbs.org/{abbr}/app-json-study/index.html'
        if any(l['url'] == study for l in page['links']):
            r['links'].append({'url': study, 'label': 'Leer en internet'})

    def audio_bible(self, url, page):
        info = self.audit['audio_bibles'][url]
        assert info['books'] and not info['bad'], url
        fileset = url.rsplit('/', 1)[1]
        title, native, org, key = AUDIO[fileset]
        dirs, filesets, keys = {}, {}, []
        for b in info['books']:
            m = re.search(r'/cdn/audio/([^/]+)/((OT|NT)_[^/]+)/(\d\d)_([^/]+)/', b['sample'])
            filesets[m[3]], dirs[m[3]] = m[1], m[2]
            k = BOOKS[int(m[4]) - 1]
            assert m[5] == k, (m[5], k)
            keys.append(k)
        testaments = [t for t in ('OT', 'NT') if t in dirs]
        version = dirs[testaments[0]].split('_', 1)[1]
        total = info['chapters_verified']
        what = ('La Biblia completa' if len(keys) == 66 else 'El Antiguo Testamento' if testaments == ['OT']
                else 'El Nuevo Testamento')
        desc = f'{what} en audio: {len(keys)} libros, {total} capítulos. Elija el libro y el capítulo que quiere escuchar o guardar.'
        year = int(re.search(r'\d{4}', native)[0]) if re.search(r'\d{4}', native) else None
        r = self.make('ab-' + fileset.lower().replace('_', '-'), 'audio-bible', title, native, url, org, desc, year=year)
        if self.listed_from(url):
            r['dbsListedUrl'] = self.listed_from(url)
        self.tag(r, key)
        play = {'kind': 'audio-bible', 'fileset': fileset, 'version': version, 'testaments': testaments,
                'bookNames': {k: ES[k] for k in keys}, 'saveChapter': True}
        if any(d != f'{t}_{version}' for t, d in dirs.items()):
            play['dirs'] = dirs
        if any(f != fileset for f in filesets.values()):
            # The full-Bible record names one fileset; DBS keeps each testament under its own.
            play['filesets'] = filesets
        r['play'] = play
        for l in page['links']:
            if l['url'].endswith('.zip') and self.ok(l['url']):
                self.download(r, l['url'], 'Todos los capítulos (ZIP)')
        return True

    # ------------------------------------------------------------ films
    def film(self, url, page):
        meta = self.audit['films'][url]
        series, ident = url.split('/video/', 1)[1].split('/', 1)
        key = ('castilian' if 'castilian' in ident else 'latin' if re.search(r'latin', ident) else
               'afro-ecuadorian' if 'afro-ecuadorian' in ident else None)
        title = FILM_TITLE.get(series, meta['title'])
        if series.startswith('lumo-') and not title.startswith('LUMO'):
            title = 'LUMO: ' + title
        native = FILM_NATIVE.get(series)
        if re.match(r'lumo-(matthew|mark|luke|john)$', series):
            native = 'LUMO: El Evangelio según ' + ES[series[5:].title()]
        if series == 'bp':
            overview = 'overview' in ident
            title = 'BibleProject: ' + ('Book Overviews' if overview else 'Themes')
            native = 'BibleProject: ' + ('Resúmenes de los libros de la Biblia' if overview else 'Temas bíblicos')
        if series == 'genesis' and ident.startswith('spab_'):
            title += ' (second recording)'
            native += ' (segunda grabación)'

        sections = meta['sections']
        if series.startswith('lumo-') and len(sections) > 1:
            sections = [next(s for s in sections if 'Reina Valera' in (s.get('title') or ''))]
        own_folder = '/' + ident.rsplit('_', 1)[0] + '/' if series == 'jesus' else None
        items, seen = [], set()
        for s in sections:
            for i in s['items']:
                u = self.media(i)
                if not u or u in seen:
                    continue
                if series == 'jesus' and ('_jesus_chapter_' not in u or own_folder not in u):
                    continue      # Visual Bible Acts chapters, misfiled on this page
                seen.add(u)
                items.append((s, i, u))
        chapters = [(n, u, self.item_title(series, s, i, n)) for n, (s, i, u) in enumerate(items, 1)]

        full = meta['full'][0]['media'] if meta.get('full') else {}
        sd = self.pick((full.get('low') or {}).get('url'))
        hd = self.pick((full.get('high') or {}).get('url'))
        if not (chapters or sd or hd):
            self.left_out[url] = 'DBS’s server returned an error or “not found” for every file this page lists; nothing here plays.'
            return
        if series == 'deafproject':
            desc = L['deaf_desc']
        elif series == 'bp':
            desc = ('Videos animados de BibleProject que resumen cada libro de la Biblia. Elija el video que quiere ver o guardar.'
                    if 'overview' in ident else
                    'Videos animados de BibleProject sobre los grandes temas de la Biblia, cómo leerla y sus palabras clave. '
                    'Elija el video que quiere ver o guardar.')
        else:
            desc = L['film_desc_chapters'] if len(chapters) > 1 else L['film_desc']
        duration = (meta.get('summary') or {}).get('duration_human')
        slug = re.sub(r'[^a-z0-9]+', '-', ident.lower()).strip('-')
        r = self.make('film-' + slug, 'film', title, native, url, meta['org'] or 'Digital Bible Society', desc,
                      duration=duration, year=meta.get('year'))
        self.tag(r, key)
        if chapters:
            r['play'] = {'kind': 'chapters', 'base': '', 'items': [
                {'n': n, 'file': u, 'title': t} for n, u, t in chapters]}
            for i in r['play']['items']:
                self.download(r, i['file'], i['title'] + ' (MP4)')
        else:
            r['play'] = {'kind': 'file', **({'sd': sd} if sd else {}), **({'hd': hd} if hd else {})}
        for d in meta.get('downloads') or []:
            u = self.pick(d['url'])
            if u and (not own_folder or own_folder in u):
                self.download(r, u, L['chapters_zip'] if 'chapter' in u else L['full'].replace('MP4', 'ZIP'))
        for u, q in ((sd, 'SD'), (hd, 'HD')):
            if u:
                self.download(r, u, f"{L['full']} · {q}")

    def item_title(self, series, section, i, n):
        en = (i.get('title') or '').strip()
        if series == 'jesus':
            return f'{n}. {JESUS[n - 1]}' if n <= len(JESUS) else f"{L['chapter']} {n}"
        if series == 'bp':
            ref = i.get('reference') or ''
            if ref == 'Complete OT':
                return f'{n}. Resumen: Antiguo Testamento (TaNaK)'
            if ref == 'Complete NT':
                return f'{n}. Resumen: Nuevo Testamento'
            if ref:
                return f'{n}. Resumen: {book_ref(en)}'
            return f"{n}. {BP_GROUPS[section['title']]}: {BP_THEMES[en]}"
        if series == 'genesis':
            return f"{n}. {book_ref(i['reference']).replace('-', '–')}"
        if series == 'c2c':
            return f'{n}. {C2C[n - 1]}'
        if series == 'rock':
            return f"{L['part']} {n}: {ROCK[n - 1]}"
        if series == 'lumo-covenant':
            return f"{n}. {i['title_vernacular']}"
        if series in ('john', 'acts_vb', 'matthew') or re.match(r'lumo-(matthew|mark|luke|john)$', series):
            return f'{n}. {en.rstrip(".")}'
        return f"{L['chapter']} {n}"

    # ------------------------------------------------------------ scans
    def historic(self, url, page):
        name = url.rsplit('/', 1)[1]
        pdf = next(l['url'] for l in page['links'] if l['url'].endswith('.pdf'))
        row = next(row for row in self.audit['sections']['Historic Bible (Scans)'] if row['url'] == url)
        title = re.match(r'(Spanish \(\d{4}\) .+?) Español \(', row['label'])[1].replace('Testmant', 'Testament').replace('facsimilie', 'facsimile')
        year = int(re.search(r'\((\d{4})\)', title)[1])
        r = self.make('scan-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:60].rstrip('-'), 'historic', title,
                      SCANS[name], url, 'Digital Bible Society', L['historic_desc'], year=year)
        r['read'] = {'kind': 'pdf', 'url': pdf}
        self.download(r, pdf, L['pdf'])

    # ------------------------------------------------------------ recordings
    def grn(self, url, page):
        mp3 = list(dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')))
        groups = collections.OrderedDict()
        for u in mp3:
            parts = urllib.parse.unquote(u).split('/')
            groups.setdefault((parts[-3], parts[-2]), []).append(u)
        carried = 0
        for (folder, programme), urls in groups.items():
            ident = programme.rsplit(' ', 1)[1].lstrip('0') or '0'
            series = programme[len(folder) + 1:].rsplit(' ', 1)[0]
            if series in GRN_LEFT_OUT:
                self.left_out['https://globalrecordings.net/en/program/' + ident] = GRN_LEFT_OUT[series]
                continue
            urls = [u for u in urls if self.ok(u)]
            if not urls:
                self.left_out['https://globalrecordings.net/en/program/' + ident] = (
                    f'GRN programme {ident}: DBS’s server returned an error for every file.')
                continue
            carried += 1
            lll = re.match(r'LLL ?(\d)', series)
            if lll:
                k = int(lll[1])
                en, es = f'{LLL[0]} {k}', f'{LLL[1]} {k}: {LLL[2][k - 1]}'
            else:
                en, es = GRN_NAMES[series]
            r = self.make('grn-' + ident, 'audio', en, es, page['resolved'], 'Global Recordings Network', L['grn_desc'])
            r['dbsListedUrl'] = url
            self.tag(r, GRN_VARIETY.get(folder))
            r['stats'] = str(len(urls))
            self.tracks(r, [(u, f"{es} · {L['part']} {n}") for n, u in enumerate(urls, 1)])
        return carried

    def story_of_jesus(self, url, page):
        key = 'castilian' if url.endswith('_castilian') else 'latin'
        mp3 = [u for u in dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')) if self.ok(u)]
        entries = [(u, COMPLETE if u.endswith('_full.mp3') else
                    f"{L['part']} {int(re.search(r'Part_(\d+)\.mp3$', u)[1])}") for u in mp3]
        r = self.make('story-jesus-' + key, 'audio', 'Story of Jesus', 'La historia de Jesús en audio', page['resolved'],
                      'Story of Jesus', 'La historia de Jesús en audio: una grabación completa y sus partes. '
                                        'Escuche o guarde lo que quiera.')
        r['dbsListedUrl'] = url
        self.tag(r, key)
        self.tracks(r, entries)
        for l in page['links']:
            if l['url'].endswith('.zip') and self.ok(l['url']):
                self.download(r, l['url'], COMPLETE + ' (ZIP)' if l['url'].endswith('_full.zip') else L['tracks_zip'])

    # ------------------------------------------------------------ build
    def build(self):
        # Bibles in ORDER (two audio Bibles are linked from their text page, not the language page).
        self.audit['sections']['Bibles'].sort(key=lambda row: ORDER.index(row['url']))
        self.missing = self.left_out
        super().build()

    def finish(self):
        # Base build puts Bibles first in section order; keep ORDER within them.
        pass


# JESUS chapter titles, from DBS's Castilian record (both recordings follow the same 61 chapters).
JESUS = []


def main():
    shelf = SpanishShelf()
    cast = shelf.audit['films']['https://dbs.org/video/jesus/spa_spanish-castilian_jesus']
    JESUS[:] = [i['title'].strip() for i in cast['sections'][0]['items']]
    shelf.build()


if __name__ == '__main__':
    main()
