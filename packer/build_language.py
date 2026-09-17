#!/usr/bin/env python3
"""Build a language catalogue from the Digital Bible Society's open dataset.

    python3 packer/build_language.py pus          # Pashto -> catalog/pus.json
    python3 packer/build_language.py --list

DBS publishes its whole catalogue as JSON at github.com/digitalbiblesociety/data
(served through jsDelivr). This reads a language's record, turns it into the
shape the app uses, and then PROBES EVERY URL, keeping only what the servers
actually serve. Nothing is guessed into a catalogue.

Two things it does that matter for the app staying simple:

  · A series arrives from DBS as nine separate films — "The Savior 0", "The
    Savior 1"… Nine rows for one story is nine decisions where there should be
    one, so they are folded into a single resource with nine chapters.
  · Landing pages that cannot be downloaded (Global Recordings programmes,
    Jesus Film's arc.gt links) are collected onto ONE "needs internet" row per
    publisher instead of one row each.

`build_english.py` predates this and stays as it is: English needed
hand-written descriptions and specific chaptered films rather than a dataset
walk. Everything else should come through here.
"""
import argparse, concurrent.futures, json, pathlib, re, sys, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = "https://cdn.jsdelivr.net/gh/digitalbiblesociety/data@latest"
SCRIPTURE = "https://scripture.dbs.org"
BIBLES = "https://bibles.dbs.org"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

TYPE_LABEL = {"film": "Films", "audio": "Audio Collections", "scripture": "Scripture Text",
              "historic": "Historic Scans", "audio-bible": "Audio Bibles", "link": "Partner Links"}

# A display language can cover several ISO codes. Pashto is catalogued by DBS as
# Northern, Southern and Central; to a reader they are one language, and three
# near-identical shelves would be three ways to get lost.
LANGUAGES = {
    "pus": {
        "name": "Pashto", "native": "پښتو", "script": "arab", "dir": "rtl", "font": "naskh",
        "speakers": "~40 million", "region": "Afghanistan & Pakistan",
        "blurb": "The main language of southern and eastern Afghanistan and north-western Pakistan, written in an extended Arabic script.",
        "isos": ["pbu", "pbt", "pst"],
        "variants": {"pbu": "Northern", "pbt": "Southern", "pst": "Central"},
        "historic": "pashto",
    },
}

# Publishers whose pages are worth listing but cannot be downloaded.
PUBLISHER = {
    "globalrecordings.net": ("Global Recordings Network",
                             "Scripture-based recordings, told simply. Each programme plays on the publisher's own site."),
    "arc.gt": ("Jesus Film Project",
               "Full films on the publisher's own player."),
    "rockintl.org": ("ROCK International",
                     "Teaching and Scripture resources from the publisher."),
    "www.bible.com": ("YouVersion", "Read online at bible.com."),
    "bible.com": ("YouVersion", "Read online at bible.com."),
}


# ---------------------------------------------------------------- extra media
# DBS's public dataset lists a language's films by name but points them at the
# publisher's own site; the files it actually hosts only appear on dbs.org's
# rendered pages, which build their URLs in the browser. These were read off
# those pages once, then expressed as the patterns they follow so the chapter
# lists generate rather than sitting here as hundreds of literal links.
V = "https://video.dbs.org"
DL = "https://download.dbs.org"
MD = "https://media.dbs.org"

def _jesus(iso, folder):
    from et.slugs import JESUS_SLUGS, titlecase
    base = f"{V}/Jesus/chapters/{folder}/"
    # base stays empty: the items below are absolute, and the card builder
    # concatenates base + file. Setting both doubled every URL.
    return {"kind": "chapters", "base": "", "items": [
        {"n": i + 1, "title": titlecase(sl),
         "file": f"{base}{iso}_jesus_chapter_{i+1:02d}_{sl.replace('_','-')}_1_jf61{i+1:02d}-0-0_low.mp4"}
        for i, sl in enumerate(JESUS_SLUGS)]}

def _lumo(iso, gospel, tag, n):
    base = f"{V}/Lumo-{gospel}/films_low/{iso}_{tag}_{gospel}_Direct-Translation-FCBH_low/"
    return {"kind": "chapters", "base": "", "items": [
        {"n": i, "title": f"{gospel} {i}",
         "file": f"{base}{iso}_LUMO_{tag}_{gospel}_Direct-Translation-FCBH_{i:02d}_360.mp4"}
        for i in range(1, n + 1)]}

PS = "https://dbs.org/cdn/video/PS/films/"
EXTRA = {
    "pus": [
        dict(id="pus-film-jesus", type="film", title="JESUS", org="Jesus Film Project",
             duration="2:07:53", year="1979", scope="Eastern Afghan",
             desc="The life of Jesus told from the Gospel of Luke — the most translated film in history. 61 chapters.",
             play=_jesus("pbu", "pbu_pashto-eastern-afghan"),
             downloads=[{"label": "All chapters — SD", "url": f"{DL}/Jesus/pbu_pashto-eastern-afghan/pbu_jesus_chapters_low.zip"},
                        {"label": "All chapters — HD", "url": f"{DL}/Jesus/pbu_pashto-eastern-afghan/pbu_jesus_chapters_high.zip"}],
             source="https://dbs.org/video/jesus/pbu_pashto-eastern-afghan_jesus"),
        dict(id="pus-film-lumo-matthew", type="film", title="LUMO: The Gospel of Matthew",
             org="LUMO Project", scope="Yousafzai",
             desc="Matthew filmed word for word, with the Pashto Scripture text as the only narration. 28 parts.",
             play=_lumo("pbu", "Matthew", "Pashto-Yousafzai", 28),
             source="https://dbs.org/video/lumo-matthew/pbu_pashto-yousafzai_matthew"),
        dict(id="pus-film-lumo-mark", type="film", title="LUMO: The Gospel of Mark",
             org="LUMO Project", scope="Yousafzai",
             desc="Mark filmed word for word, narrated only by the Pashto Scripture text. 16 parts.",
             play=_lumo("pbu", "Mark", "Pashto-Yousafzai", 16),
             source="https://dbs.org/video/lumo-mark/pbu_pashto-yousafzai_mark"),
        dict(id="pus-film-lumo-luke", type="film", title="LUMO: The Gospel of Luke",
             org="LUMO Project", scope="Yousafzai",
             desc="Luke filmed word for word, narrated only by the Pashto Scripture text. 24 parts.",
             play=_lumo("pbu", "Luke", "Pashto-Yousafzai", 24),
             source="https://dbs.org/video/lumo-luke/pbu_pashto-yousafzai_luke"),
        dict(id="pus-film-lumo-john", type="film", title="LUMO: The Gospel of John",
             org="LUMO Project", scope="Yousafzai",
             desc="John filmed word for word, narrated only by the Pashto Scripture text. 21 parts.",
             play=_lumo("pbu", "John", "Pashto-Yousafzai", 21),
             source="https://dbs.org/video/lumo-john/pbu_pashto-yousafzai_john"),
        dict(id="pus-ab-pbupbs", type="audio-bible", title="Pakistani Yousafzai Pashto Bible",
             native="کِتابِ مقدس", org="Davar Partners", year="2019", scope="New Testament",
             stats="260 chapters · 25h 5m",
             desc="The Pashto New Testament read aloud in full, chapter by chapter.",
             downloads=[{"label": "Complete audio (ZIP)", "url": "https://scripture.dbs.org/audio_zip/PBUPBS_DAVR_NT_N.zip", "size": "582.8 MB"}],
             source="https://dbs.org/bibles/audio/PBUPBS_DAVR_NT_N"),
        dict(id="pus-ab-pbuleyd", type="audio-bible", title="Pashto John — Leyden",
             native="انجيل شريف", org="Davar Partners", year="1939",
             desc="The Leyden Pashto Scripture, read aloud.",
             downloads=[{"label": "Complete audio (ZIP)", "url": "https://scripture.dbs.org/audio_zip/PBULEYD_DAVR_FB_N.zip"}],
             source="https://dbs.org/bibles/audio/PBULEYD_DAVR_FB_N"),
        dict(id="pus-ac-grn", type="audio", title="Words of Life +1",
             org="Global Recordings Network", stats="54 recordings · 99.5 MB",
             desc="Scripture-based audio programmes in Northern Pashto, Khatak, Marwat and Dera Ismail Khan — Words of Life, Good News and more.",
             play={"kind": "audio-collection",
                   "sample": f"{MD}/audio/grn/pbu_GlobalRecordings_pashto_northern/Pashto%20Northern/Pashto%20Northern%20Good%20News%2065159/Pashto%20Northern%20Good%20News%20001%20Picture%201%20In%20the%20Beginning%2065159.mp3"},
             downloads=[{"label": "Complete collection — high quality", "url": f"{MD}/audio/grn/pbu_GlobalRecordings_pashto_northern_high.zip"},
                        {"label": "Complete collection — low bandwidth", "url": f"{MD}/audio/grn/pbu_GlobalRecordings_pashto_northern_low.zip"}],
             source="https://dbs.org/audio/collections/grn/pbu_GlobalRecordings_pashto_northern"),
        dict(id="pus-ac-soj", type="audio", title="Story of Jesus",
             org="Story of Jesus", stats="8 recordings · 123.2 MB",
             desc="The life of Jesus as a narrated audio drama, in eight parts plus a continuous version.",
             play={"kind": "audio-collection", "sample": f"{MD}/audio/soj/pbu_StoryJesus_pbu_full.mp3"},
             downloads=[{"label": "All eight parts (ZIP)", "url": f"{MD}/audio/soj/pbu_StoryJesus_pbu.zip"},
                        {"label": "Continuous version (ZIP)", "url": f"{MD}/audio/soj/pbu_StoryJesus_pbu_full.zip"}],
             source="https://dbs.org/audio/collections/soj/pbu_StoryJesus_pbu"),
    ]
}

SERIES = re.compile(r"^(?P<name>.+?)\s+(?P<n>\d+)\s*[-–—]\s*(?P<part>.+)$")


# ------------------------------------------------------------------ helpers
def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return json.loads(r.read())


def secure(url):
    """https, and path-style for S3 buckets whose dotted names break the cert."""
    if not url:
        return url
    m = re.match(r"^https?://([a-z0-9.-]+\.[a-z0-9.-]+)\.s3\.amazonaws\.com/(.*)$", url)
    if m:
        return f"https://s3.amazonaws.com/{m.group(1)}/{m.group(2)}"
    return "https://" + url[len("http://"):] if url.startswith("http://") else url


def is_file(url):
    return (url or "").lower().split("?")[0].endswith((".mp4", ".mp3", ".pdf", ".epub", ".zip", ".m4a"))


def alive(url):
    for method in ("HEAD", "GET"):
        try:
            h = dict(UA)
            if method == "GET":
                h["Range"] = "bytes=0-0"
            with urllib.request.urlopen(urllib.request.Request(url, headers=h, method=method),
                                        timeout=30) as r:
                return r.status in (200, 206)
        except Exception:
            continue
    return False


def probe_all(urls, workers=12):
    urls = sorted(set(u for u in urls if u))
    with concurrent.futures.ThreadPoolExecutor(workers) as pool:
        return dict(zip(urls, pool.map(alive, urls)))


# ------------------------------------------------------------------- build
def build(code, spec):
    records = {}
    for iso in spec["isos"]:
        try:
            records[iso] = fetch(f"{DATA}/languages/{iso}.json")
        except Exception as e:
            print(f"  ! {iso}: {e}")
    if not records:
        sys.exit(f"  no DBS record for any of {spec['isos']}")

    out = []
    seen_urls = set()

    # ---- films and downloadable resources, from every variant
    films = []          # (iso, title, url)
    pages = {}          # host -> [(title, url)]
    for iso, rec in records.items():
        rows = (rec.get("films") or []) + (rec.get("resources") or [])
        for row in rows:
            url = (row.get("url") or "").strip()
            title = (row.get("title") or row.get("tt") or "").strip()
            if not url or not title:
                continue
            key = secure(url)
            if key in seen_urls:
                continue          # the same film is listed as a film and a resource
            seen_urls.add(key)
            if is_file(url):
                films.append((iso, title, key))
            else:
                host = urllib.parse.urlparse(url).netloc
                pages.setdefault(host, []).append((title, url))

    # ---- fold numbered series into one resource
    groups, singles = {}, []
    for iso, title, url in films:
        m = SERIES.match(title)
        if m:
            groups.setdefault((iso, m.group("name").strip()), []).append(
                (int(m.group("n")), m.group("part").strip(), url))
        else:
            singles.append((iso, title, url))

    def variant(iso):
        v = spec.get("variants", {}).get(iso)
        return f"{v} Pashto" if v and code == "pus" else (v or "")

    for (iso, name), parts in sorted(groups.items()):
        parts.sort()
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        out.append(dict(
            id=f"{code}-film-{slug}-{iso}", lang=code, type="film", title=name,
            org="Create International", scope=variant(iso),
            desc=f"The life of Christ told in {len(parts)} short parts, made for {variant(iso) or 'Pashto'} audiences.",
            play={"kind": "chapters", "base": "",
                  "items": [{"n": n, "title": f"{n}. {p}", "file": u} for n, p, u in parts]},
            downloads=[{"label": f"{n}. {p}", "url": u} for n, p, u in parts],
        ))

    for iso, title, url in sorted(singles, key=lambda x: x[1]):
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40]
        kind = "audio" if url.lower().split("?")[0].endswith((".mp3", ".m4a")) else "film"
        play = ({"kind": "audio-collection", "sample": url} if kind == "audio"
                else {"kind": "file", "hd": url})
        out.append(dict(
            id=f"{code}-{kind}-{slug}-{iso}", lang=code, type=kind, title=title,
            org="Create International", scope=variant(iso),
            desc=f"A short film in {variant(iso) or 'Pashto'}." if kind == "film" else "",
            play=play, downloads=[{"label": "Video" if kind == "film" else "Audio", "url": url}],
        ))

    # ---- resources read off dbs.org's own pages (see EXTRA)
    for extra in EXTRA.get(code, []):
        r = dict(extra)
        r["lang"] = code
        out.append(r)
        for d in (r.get("downloads") or []):
            seen_urls.add(d["url"])

    # ---- historic scans, from the repo's own file list
    tree = ROOT / ".cache" / "dbs" / "tree.txt"
    scans = []
    if tree.exists() and spec.get("historic"):
        for line in tree.read_text().splitlines():
            if line.startswith("bible-historic/") and spec["historic"] in line.lower():
                scans.append(line.split("/", 1)[1].rsplit(".json", 1)[0])
    for slug in sorted(scans):
        year = (re.search(r"(1[6-9]\d\d|20\d\d)", slug) or [None])[0]
        # "Pashto-1890-Bible-Vol.-1-4" reads as a filename. Drop the language and
        # the year (both shown elsewhere), drop archive catalogue numbers, and
        # put the ranges back together: "Bible, Vol. 1–4".
        pretty = slug.replace("-", " ")
        pretty = re.sub(r"(?i)^" + re.escape(spec["name"]) + r"\s*", "", pretty)
        pretty = re.sub(r"\b(1[6-9]\d\d|20\d\d)\b", "", pretty)
        pretty = re.sub(r"\bWDL \d+\b", "", pretty)
        pretty = re.sub(r"\bVol\.? (\d+) (\d+)\b", r"Vol. \1–\2", pretty)
        pretty = re.sub(r"\bprint\b", "", pretty, flags=re.I)
        pretty = re.sub(r"\s{2,}", " ", pretty).strip(" -,")
        pretty = re.sub(r"\s+In Pashtu Northern\b", "", pretty, flags=re.I)
        pretty = pretty or spec["name"] + " Scripture"
        out.append(dict(
            id=f"{code}-hist-{slug.lower()}", lang=code, type="historic", title=pretty,
            org="Digital Bible Society Archive", year=year,
            cover=f"{SCRIPTURE}/covers/small/{slug}.webp",
            desc="Scanned pages of a printed edition. Read in the app or save the PDF.",
            read={"kind": "pdf", "url": f"{SCRIPTURE}/pdfs/{slug}.pdf"},
            downloads=[{"label": "PDF", "url": f"{SCRIPTURE}/pdfs/{slug}.pdf"}],
            source=f"https://dbs.org/bibles/historic/{slug}",
        ))

    # ---- Bible texts: a real file if DBS has one, otherwise the publisher's page
    bibles = []
    for iso, rec in records.items():
        for b in (rec.get("bibles") or []):
            bibles.append((b.get("abbr"), b.get("title"), b.get("year"), iso))
    pdfs = probe_all([f"{BIBLES}/{a}/pdf/{a}.pdf" for a, _, _, _ in bibles if a])
    hosted = [(a, t, y, iso) for a, t, y, iso in bibles if a and pdfs.get(f"{BIBLES}/{a}/pdf/{a}.pdf")]
    for a, t, y, iso in hosted:
        out.append(dict(
            id=f"{code}-text-{a.lower()}", lang=code, type="scripture", title=t, year=y,
            org="Digital Bible Society", scope=variant(iso),
            desc="The full text, to read in the app or save.",
            read={"kind": "pdf", "url": f"{BIBLES}/{a}/pdf/{a}.pdf"},
            downloads=[{"label": "PDF", "url": f"{BIBLES}/{a}/pdf/{a}.pdf"},
                       {"label": "EPUB", "url": f"{BIBLES}/{a}/epub/{a}.epub"}],
            source=f"https://dbs.org/bibles/{a}",
        ))
    rest = [(a, t, y, iso) for a, t, y, iso in bibles if (a, t, y, iso) not in hosted]
    if rest:
        # One row for every Bible that is only readable on someone else's site,
        # rather than one dead-end row each.
        out.append(dict(
            id=f"{code}-text-online", lang=code, type="scripture",
            title=f"{spec['name']} Bibles to read online", org="Various publishers",
            desc=f"{len(rest)} {spec['name']} translations that their publishers host themselves. They open in a browser and need a connection.",
            links=[{"label": f"{t}" + (f" ({y})" if y else ""),
                    "url": f"https://dbs.org/bibles/{a}"} for a, t, y, _ in rest],
            source=f"https://dbs.org/discover/languages/{spec['isos'][0]}",
        ))

    # ---- everything that is only a page, grouped by publisher
    for host, rows in sorted(pages.items()):
        label, blurb = PUBLISHER.get(host, (host, "Hosted by the publisher."))
        out.append(dict(
            id=f"{code}-link-{re.sub(r'[^a-z0-9]+', '-', host)}", lang=code, type="link",
            title=label, org=label, desc=f"{len(rows)} {spec['name']} items. {blurb}",
            links=[{"label": t, "url": u} for t, u in sorted(rows)],
        ))

    # ---- probe every media URL and drop what is not served
    def urls_of(r):
        u = []
        p = r.get("play") or {}
        if p.get("kind") == "chapters":
            u += [i["file"] for i in p["items"]]
        if p.get("kind") == "file":
            u += [p[q] for q in ("hd", "sd") if p.get(q)]
        if p.get("kind") == "audio-collection":
            u.append(p["sample"])
        if (r.get("read") or {}).get("url"):
            u.append(r["read"]["url"])
        u += [d["url"] for d in (r.get("downloads") or [])]
        if r.get("cover"):
            u.append(r["cover"])
        return u

    checked = probe_all([u for r in out for u in urls_of(r)])
    print(f"  probed {len(checked)} URLs · {sum(1 for v in checked.values() if v)} alive")

    keep = []
    for r in out:
        # Link-only rows carry no play/read/downloads at all.
        for k in ("play", "read"):
            r.setdefault(k, None)
        r.setdefault("downloads", [])
        p = r.get("play") or {}
        if p.get("kind") == "chapters":
            p["items"] = [i for i in p["items"] if checked.get(i["file"])]
            if not p["items"]:
                r["play"] = None
        elif p.get("kind") == "file":
            for q in ("hd", "sd"):
                if p.get(q) and not checked.get(p[q]):
                    p.pop(q)
            if not (p.get("hd") or p.get("sd")):
                r["play"] = None
        elif p.get("kind") == "audio-collection" and not checked.get(p["sample"]):
            r["play"] = None
        if r.get("read") and not checked.get(r["read"]["url"]):
            r["read"] = None
        r["downloads"] = [d for d in (r.get("downloads") or []) if checked.get(d["url"])]
        if r.get("cover") and not checked.get(r["cover"]):
            r["cover"] = None

        r.setdefault("native", None)
        for k in ("duration", "year", "cover", "stats", "license", "scope", "links", "source"):
            r.setdefault(k, None)
        r["langName"] = spec["name"]
        r["typeLabel"] = TYPE_LABEL[r["type"]]
        if r["play"] or r["read"] or r["downloads"] or r.get("links"):
            keep.append(r)

    # Two dubs of one film — Northern and Southern — must not appear as two
    # identical rows. Name the variant only where there is a clash.
    import collections as _c
    titles = _c.Counter(r["title"] for r in keep)
    for r in keep:
        if titles[r["title"]] > 1 and r.get("scope"):
            r["title"] = f"{r['title']} ({r['scope'].replace(' Pashto', '')})"

    lang = {k: spec[k] for k in ("name", "native", "script", "dir", "font", "speakers", "region", "blurb")}
    lang["code"] = code
    path = ROOT / "catalog" / f"{code}.json"
    path.write_text(json.dumps({
        "generated": f"Digital Bible Society (dbs.org) — {spec['name']}, built from the open dataset",
        "languages": {code: lang},
        "resources": keep,
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    import collections
    by = collections.Counter(r["type"] for r in keep)
    off = sum(1 for r in keep if r["play"] or r["read"])
    print(f"  {len(keep)} resources ({dict(by)}) · {off} play or read in the app")
    print(f"  wrote {path.relative_to(ROOT)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("code", nargs="?", help="display language code, e.g. pus")
    ap.add_argument("--list", action="store_true", help="show what can be built")
    a = ap.parse_args()
    if a.list or not a.code:
        for c, s in LANGUAGES.items():
            print(f"  {c:<6}{s['name']:<12}{s['native']:<12}DBS codes: {', '.join(s['isos'])}")
        return
    if a.code not in LANGUAGES:
        sys.exit(f"  unknown: {a.code}. Try --list.")
    print(f"\n  Building {LANGUAGES[a.code]['name']}…")
    build(a.code, LANGUAGES[a.code])


if __name__ == "__main__":
    main()
