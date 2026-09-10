#!/usr/bin/env python3
"""Build catalog/english.json — the English counterpart of the Sindhi and Urdu
library, so that choosing English in the app plays English.

    python3 packer/build_english.py

The Sindhi and Urdu catalogue comes from GawahiiTV. It has no English at all,
which meant an English-speaking visitor tapped "JESUS", saw an English title,
and heard Sindhi. The same films exist in English on the same DBS CDN under the
same URL patterns with the language code swapped, so this builds the matching
set and then *probes every URL*, keeping only what the server actually serves.
Nothing here is guessed into the catalogue.
"""
import concurrent.futures, json, pathlib, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "catalog" / "english.json"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

D = "https://download.dbs.org"
S = "https://scripture.dbs.org"
M = "https://media.dbs.org"
B = "https://bibles.dbs.org"
COV = "https://meta.dbs.org/data/data-video/covers"

# Chapter slugs shared with the Sindhi/Urdu builds in GawahiiTV.
sys.path.insert(0, str(ROOT / "packer"))
from et.slugs import JESUS_SLUGS, JOHN_SLUGS, titlecase  # noqa: E402

LANGUAGE = {"code": "eng", "name": "English", "native": "English", "script": "latn",
            "dir": "ltr", "font": "latin", "speakers": "~1.5 billion",
            "region": "Worldwide",
            "blurb": "The same films, Scripture and audio, in English."}


def jesus():
    base = "https://video.dbs.org/Jesus/chapters/eng_english/"
    return {"kind": "chapters", "base": base, "items": [
        {"n": i + 1, "title": titlecase(s),
         "file": f"eng_jesus_chapter_{i+1:02d}_{s}_1_jf61{i+1:02d}_0_0_low.mp4"}
        for i, s in enumerate(JESUS_SLUGS)]}


def john():
    base = "https://video.dbs.org/John/chapters/eng_english/"
    return {"kind": "chapters", "base": base, "items": [
        {"n": i + 1, "title": titlecase(s),
         "file": f"eng_Gospel_of_John_chapter_{i+1:02d}_{s}_2_GOJ49{i+1:02d}_0_0_low.mp4"}
        for i, s in enumerate(JOHN_SLUGS)]}


R = []


def add(**kw):
    kw.setdefault("lang", "eng")
    kw.setdefault("langName", "English")
    kw.setdefault("downloads", [])
    kw.setdefault("play", None)
    kw.setdefault("read", None)
    for k in ("native", "duration", "year", "cover", "stats", "license", "scope"):
        kw.setdefault(k, None)
    R.append(kw)


TYPE_LABEL = {"film": "Films", "audio": "Audio Collections", "scripture": "Scripture Text",
              "historic": "Historic Scans", "audio-bible": "Audio Bibles", "link": "Partner Links"}

# ------------------------------------------------------------------ films
add(id="eng-film-jesus", type="film", title="JESUS", org="Jesus Film Project",
    duration="2:07:53", year="1979", cover=f"{COV}/Jesus/jesus.jpg",
    desc="The life of Jesus told from the Gospel of Luke — the most translated film in history. 61 chapters.",
    play=jesus(),
    downloads=[{"label": "All chapters — SD", "url": f"{D}/Jesus/eng_english/eng_jesus_chapters_low.zip"}],
    source="https://dbs.org/video/jesus/eng_english_jesus")

add(id="eng-film-john", type="film", title="Gospel of John", org="Visual Bible Int.",
    duration="3:03:13", cover=f"{COV}/John/gospel_of_john.jpg",
    desc="The Gospel of John filmed in full, word for word. 49 chapters.",
    play=john(),
    downloads=[{"label": "All chapters — SD", "url": f"{D}/John/eng_english/eng_Gospel_of_John_chapters_low.zip"}],
    source="https://dbs.org/video/john/eng_english_gospel_of_john")

add(id="eng-film-hope", type="film", title="The HOPE", org="Mars Hill Productions",
    duration="1:19:21", cover=f"{COV}/HOPE/eng_english.webp",
    desc="The whole biblical story from creation to Christ in one film — a survey of Scripture in 36 scenes.",
    play={"kind": "file",
          "hd": "https://dbs.org/cdn/video/HOPE/films/eng_english_the_hope.mp4",
          "sd": "https://dbs.org/cdn/video/HOPE/films_low/eng_english_the_hope_low.mp4"},
    source="https://dbs.org/video/hope/eng_english_the_hope")

add(id="eng-film-ibible", type="film", title="iBible: Salvation Story", org="RevelationMedia",
    duration="9:17", cover=f"{COV}/ibible/eng-english-ibible_salvation.webp",
    desc="A short animated overview of the story of salvation, from Genesis to the resurrection.",
    play={"kind": "file",
          "hd": "https://dbs.org/cdn/video/ibible/films/eng-english-ibible_salvation-hd.mp4",
          "sd": "https://dbs.org/cdn/video/ibible/films_low/eng-english-ibible_salvation-sd.mp4"},
    downloads=[{"label": "Download (ZIP)", "url": f"{D}/ibible/eng-english-ibible_salvation.zip"}],
    source="https://dbs.org/video/ibible/eng-english-ibible_salvation")

# ------------------------------------------------------------------ audio
add(id="eng-ac-soj", type="audio", title="Story of Jesus", org="Story of Jesus",
    stats="8 recordings",
    desc="The life of Jesus as a narrated audio drama, in eight parts plus a continuous version.",
    play={"kind": "audio-collection", "sample": f"{M}/audio/soj/eng_StoryJesus_english_full.mp3"},
    downloads=[{"label": "All eight parts (ZIP)", "url": f"{M}/audio/soj/eng_StoryJesus_english.zip"}],
    source="https://dbs.org/audio/collections/soj/eng_StoryJesus_english")

add(id="eng-ac-grn", type="audio", title="Global Recordings — English", org="Global Recordings Network",
    desc="Scripture-based audio programmes and songs in simple English. The complete set is several gigabytes, so it is offered as a download rather than packed onto cards.",
    downloads=[{"label": "Complete collection (ZIP, ~6 GB)",
                "url": f"{M}/audio/grn/eng_GlobalRecordings_english_high.zip"}],
    source="https://dbs.org/audio/collections/grn/eng_GlobalRecordings_english")

# ------------------------------------------------------------------ scripture
for bid, title, org, year, note, lic in [
    ("ENGWEB", "World English Bible", "eBible.org", "2000",
     "A modern English translation in the public domain — free to copy, print and share without restriction.",
     "Public Domain"),
    ("ENGBSB", "Berean Standard Bible", "Bible Hub", "2022",
     "A clear, accurate modern translation, released to the public domain in 2023.",
     "Public Domain"),
    ("ENGKJV", "King James Version", "Public Domain", "1611",
     "The classic 1769 standardised text of the Authorised Version.",
     "Public Domain")]:
    add(id=f"eng-text-{bid.lower()}", type="scripture", title=title, org=org, year=year,
        desc=note, license=lic,
        read={"kind": "pdf", "url": f"{B}/{bid}/pdf/{bid}.pdf"},
        downloads=[{"label": "PDF", "url": f"{B}/{bid}/pdf/{bid}.pdf"},
                   {"label": "EPUB", "url": f"{B}/{bid}/epub/{bid}.epub"}],
        source=f"https://dbs.org/bibles/{bid}")

# ------------------------------------------------------------------ historic
for slug, title, year, note in [
    ("English-1425-Wycliffe-New-Testament", "Wycliffe New Testament (1425)", "1425",
     "A hand-copied manuscript of the first complete English New Testament."),
    ("English-1390-Wycliffe-Bible-NT", "Wycliffe Bible — New Testament (1390)", "1390",
     "One of the earliest English Scripture manuscripts. A large, high-resolution scan.")]:
    add(id=f"eng-hist-{slug.lower()}", type="historic", title=title, year=year,
        org="Digital Bible Society Archive", cover=f"{S}/covers/small/{slug}.webp",
        desc=note + " Read in the browser or download the PDF.",
        read={"kind": "pdf", "url": f"{S}/pdfs/{slug}.pdf"},
        downloads=[{"label": "PDF", "url": f"{S}/pdfs/{slug}.pdf"}],
        source=f"https://dbs.org/bibles/historic/{slug}")


# ------------------------------------------------------------------ verify
def alive(url):
    for method in ("HEAD", "GET"):
        try:
            h = dict(UA)
            if method == "GET":
                h["Range"] = "bytes=0-0"
            with urllib.request.urlopen(urllib.request.Request(url, headers=h, method=method),
                                        timeout=25) as r:
                return r.status in (200, 206)
        except Exception:
            continue
    return False


def urls(r):
    """Every URL a resource depends on, tagged with what to do if it is dead."""
    out = []
    p = r.get("play") or {}
    if p.get("kind") == "chapters":
        out += [("chapter", p["base"] + it["file"]) for it in p["items"]]
    elif p.get("kind") == "file":
        out += [(q, p[q]) for q in ("hd", "sd") if p.get(q)]
    elif p.get("kind") == "audio-collection":
        out.append(("sample", p["sample"]))
    if (r.get("read") or {}).get("url"):
        out.append(("read", r["read"]["url"]))
    out += [("download", d["url"]) for d in r["downloads"]]
    if r.get("cover"):
        out.append(("cover", r["cover"]))
    return out


def main():
    jobs = [(r, kind, u) for r in R for kind, u in urls(r)]
    print(f"  probing {len(jobs)} URLs across {len(R)} English resources…")
    with concurrent.futures.ThreadPoolExecutor(12) as pool:
        ok = dict(zip([u for _, _, u in jobs], pool.map(alive, [u for _, _, u in jobs])))

    kept, dropped = [], []
    for r in R:
        p = r.get("play") or {}
        if p.get("kind") == "chapters":
            p["items"] = [it for it in p["items"] if ok.get(p["base"] + it["file"])]
            if not p["items"]:
                r["play"] = None
        elif p.get("kind") == "file":
            for q in ("hd", "sd"):
                if p.get(q) and not ok.get(p[q]):
                    del p[q]
            if not (p.get("hd") or p.get("sd")):
                r["play"] = None
        elif p.get("kind") == "audio-collection" and not ok.get(p["sample"]):
            r["play"] = None
        if r.get("read") and not ok.get(r["read"]["url"]):
            r["read"] = None
        r["downloads"] = [d for d in r["downloads"] if ok.get(d["url"])]
        if r.get("cover") and not ok.get(r["cover"]):
            r["cover"] = None
        r["typeLabel"] = TYPE_LABEL[r["type"]]

        if r["play"] or r["read"] or r["downloads"]:
            kept.append(r)
        else:
            dropped.append(r["id"])

    dead = sum(1 for v in ok.values() if not v)
    OUT.write_text(json.dumps({
        "generated": "Digital Bible Society (dbs.org) — English, built to match the Sindhi & Urdu collections",
        "languages": {"eng": LANGUAGE},
        "resources": kept,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"  kept {len(kept)} resources · {dead} dead URLs removed · dropped {dropped or 'none'}")
    print(f"  wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
