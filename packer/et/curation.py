"""What the library will carry: Digital Bible Society's own Christian
resources, and nothing else.

Two rules, applied in order:

1. DBS-hosted only. A file, page or link stays only if it lives on DBS's own
   servers (dbs.org and its subdomains). DBS's "Links to Other Sites" — Create
   International films on Amazon S3, Global Recordings programme pages,
   find.bible, publisher sites — are someone else's material that DBS points
   to, and are dropped. A resource left with nothing to play, read, save or
   open is dropped whole. Files on Larry's own DBS cards (`local`) stay.
2. Christian only, among what remains (below).

DBS language pages list everything a language has, including links to other
people's material. Most of it is plainly Christian — Bibles, the JESUS film,
LUMO, Global Recordings' gospel programmes, Create International's
evangelistic films. Some of it is not, or cannot be confirmed from what DBS
says about it. The rule here is strict: an item stays only when its title,
publisher or DBS record shows it is Christian. Anything uncertain is left out
rather than guessed in.

Applied in catalog.load(), so every build and every fresh DBS import passes
through it, and a removed item cannot drift back in.
"""
import json
import re

# Jewish (not Messianic) translations of the Hebrew Bible. Respected texts, but
# not Christian resources. The Orthodox Jewish Brit Chadasha is a Messianic
# New Testament and stays.
_JEWISH = re.compile(r"\b(Tanakh|Tanach|Targum|Jewish School|Masoretic Bible)\b", re.I)

# Translations the library does not carry, at Larry's direction: nothing
# LGBTQ-affirming or gender-neutral, nothing sectarian, nothing that denies the
# Trinity or the divinity of Christ, nothing that cuts or rewrites Scripture.
# Matched against titles, case-insensitive. Each line says why.
_NOT_CARRIED = re.compile("|".join([
    r"\binclusive\b",                    # Inclusive Bible; NIV Inclusive Language Ed.
    r"\bopen english bible\b",           # gender-inclusive translation
    r"\bqueen james\b",                  # LGBTQ-affirming edition
    r"\bclear word\b",                   # Seventh-day Adventist paraphrase
    r"\bnew world translation\b",        # Jehovah's Witnesses
    r"\bemphatic diaglott\b",            # Christadelphian; used by Jehovah's Witnesses
    r"\binspired version\b|joseph smith translation",   # Latter-day Saints
    r"\bunity resource bible\b",         # Unity (New Thought) association; origin unconfirmed
    r"\bconcordant\b",                   # universalist
    r"\bsacred name\b",                  # sacred-name movement
    # Unitarian / Arian translators
    r"\bwakefield\b", r"\bbelsham\b", r"\bnewcomes? corrected\b", r"\bimproved version\b",
    r"\bpalfrey\b", r"\bnortan\b|\bnorton\b", r"\bwellbeloved\b", r"\bsharpe\b",
    r"\bfolsom\b", r"\bliberal translation\b", r"\bwhiston\b|\bprimitive new testament\b",
    r"\bsamuel clarke\b", r"\bheinfetter\b",
    # Universalist translators
    r"\bkneeland\b", r"\bhanson new testament\b",
    # Swedenborgian
    r"\bnew dispensation\b",
    # Scripture cut or rewritten
    r"\bjefferson\b", r"\bslave bible\b", r"\bshorter \(kent\)", r"\byawist\b",
]), re.I)

# Titles DBS lists without anything that says what they are, and whose
# publisher page could not be checked. Left out until someone confirms them.
_UNCONFIRMED = {
    # English page — Global Recordings programmes with no subject in the title
    "HIV & Aids Discussions", "HIV & Aids - straightforward about the basics",
    "Tumi - the Talking Tiger", "What Did That Animal Say?",
    "Songs Across Our Land", "We Are One", "Ali Curung Spinifex Band",
    "Yuṯa Manikay Mala '94 [New Songs of 1994]", "Eastwind", "Ngumpin Ngajiwu",
    "Ekshun Songs [Action Songs]", "Songs", "Messages w/ ENG.: Granada, etc",
    "No More", "No More Tears", "Broken Pieces - No More!", "The Bride",
    "My Divine Discovery",
    # English page — a film whose subject DBS does not give
    "I Against My Brother (English)",
    # Mandarin page — Global Recordings, subject not given
    "The Straight Path", "The Straight Path 01 - 30",
    # Hindi page — a single episode of a series DBS does not describe
    "Haqeeqat Episode 6",
}

# Link rows that point at a general host rather than a named Christian
# publisher, so what is behind them cannot be vouched for.
_GENERAL_HOSTS = re.compile(r"(^|//)(www\.)?(youtube\.com|youtu\.be|my\.pcloud\.com)/", re.I)

# Study texts DBS's Punjabi library bundles in English, Hebrew and Greek.
# Christian, but not in the language of the shelf they would sit on.
_OFF_LANGUAGE = re.compile(r"/StudyBible/content/texts/(ENGNAS|HBOWLC|GRCTIS)/", re.I)


# DBS pages and files that are no longer up. Checked 2026-09-26 against DBS's
# own site index (dbs.org/data/siteindex.json) and in the browser: the Bible
# pages return "not found", and the audio Bibles say "no longer at this
# address". The library only carries what DBS has up.
RETIRED = {
    "https://dbs.org/bibles/GUZGUZ",
    "https://dbs.org/bibles/GUZGUZR",
    "https://dbs.org/bibles/HINBSI",
    "https://dbs.org/bibles/HINHCV",
    "https://dbs.org/bibles/HINHKYM",
    "https://dbs.org/bibles/HINIRV",
    "https://dbs.org/bibles/HINPIL",
    "https://dbs.org/bibles/HINROM",
    "https://dbs.org/bibles/HINROV",
    "https://dbs.org/bibles/HINSKV",
    "https://dbs.org/bibles/HINTBN",
    "https://dbs.org/bibles/HINTGH",
    "https://dbs.org/bibles/NPIB08",
    "https://dbs.org/bibles/NPINCV",
    "https://dbs.org/bibles/NPINRV",
    "https://dbs.org/bibles/NPITBI",
    "https://dbs.org/bibles/NPIULV",
    "https://dbs.org/bibles/PANCLV",
    "https://dbs.org/bibles/PANOLD",
    "https://dbs.org/bibles/PANPOR",
    "https://dbs.org/bibles/PANTBN",
    "https://dbs.org/bibles/PANWTC",
    "https://dbs.org/bibles/PANZZZP",
    "https://dbs.org/bibles/PBTPNT",
    "https://dbs.org/bibles/PBULEYD",
    "https://dbs.org/bibles/PBUOLD",
    "https://dbs.org/bibles/PBUPBS",
    "https://dbs.org/bibles/PBUPRO",
    "https://dbs.org/bibles/PNBBFBS",
    "https://dbs.org/bibles/PNBCLV",
    "https://dbs.org/bibles/PNBPBS",
    "https://dbs.org/bibles/PNBPNT",
    "https://dbs.org/bibles/PSTBIB",
    "https://dbs.org/bibles/SWATBL",
    "https://dbs.org/bibles/SWH1909",
    "https://dbs.org/bibles/SWH1921",
    "https://dbs.org/bibles/SWH1937",
    "https://dbs.org/bibles/SWHBLI",
    "https://dbs.org/bibles/SWHKSB",
    "https://dbs.org/bibles/SWHRUV",
    "https://dbs.org/bibles/SWHSHN",
    "https://dbs.org/bibles/SWHSNT",
    "https://dbs.org/bibles/SWHSUV",
    "https://dbs.org/bibles/audio/ENGABS_DAVR_FB_N",
    "https://dbs.org/bibles/audio/GUZBSK_DAVR_FB_N",
    "https://dbs.org/bibles/audio/HINBIB_DAVR_FB_N",
    "https://dbs.org/bibles/audio/HINUW_DAVR_OT_N",
    "https://dbs.org/bibles/audio/NPIDWMC_DAVR_NT_N",
    "https://dbs.org/bibles/audio/PANUW_DAVR_FB_N",
    "https://dbs.org/bibles/audio/PBUPBS20_DAVR_OT_N",
    "https://dbs.org/bibles/audio/SNDPBS00854_DAVR_NT_N",
    "https://dbs.org/bibles/audio/URDBCS_DAVR_FB_N",
    "https://bibles.dbs.org/URDGEO/pdf/URDGEO.pdf",
}
# Directory pages on DBS's older library server, which no longer answer.
_RETIRED_PREFIX = ("https://content.dbs.org/libraries/PAN/Audio/Bible/",
                   "https://libraries.dbs.org//PAN/Bible/Images/",
                   "https://libraries.dbs.org//PAN/Audio/Bible/")


def _retired(u):
    return bool(u) and (u in RETIRED or u.startswith(_RETIRED_PREFIX))


def _urls(r):
    return re.findall(r"https?://[^\"\s]+", json.dumps(
        {k: r.get(k) for k in ("play", "read", "downloads", "links", "source")}))


def excluded(r):
    """The reason a resource is left out, or None if it stays."""
    title = (r.get("title") or "").strip()
    if _NOT_CARRIED.search(title):
        return "translation not carried"
    if _JEWISH.search(title):
        return "Jewish translation, not a Christian resource"
    if title in _UNCONFIRMED:
        return "not confirmed as Christian"
    urls = _urls(r)
    if r.get("type") == "link" and urls and all(_GENERAL_HOSTS.search(u) for u in urls):
        return "general video/file host, content not verifiable"
    if r.get("lang") != "eng" and any(_OFF_LANGUAGE.search(u) for u in urls):
        return "not in this shelf's language"
    return None


def _prune_links(r):
    """Drop the individual links inside a grouped row that fail the rule,
    keeping the rest of the row."""
    links = r.get("links") or []
    keep = [l for l in links
            if not _GENERAL_HOSTS.search(l.get("url", ""))
            and not (r.get("lang") != "eng" and _OFF_LANGUAGE.search(l.get("url", "")))
            and not _JEWISH.search(l.get("label", ""))
            and not _NOT_CARRIED.search(l.get("label", ""))
            and l.get("label", "").strip() not in _UNCONFIRMED]
    if len(keep) != len(links):
        r = dict(r, links=keep)
    return r


import urllib.parse


def _dbs(url):
    """On DBS's servers, and still up there."""
    host = urllib.parse.urlparse(url or "").netloc.lower()
    return (host == "dbs.org" or host.endswith(".dbs.org")) and not _retired(url)


def _has_url(v):
    return bool(re.search(r"https?://", json.dumps(v or {})))


def _dbs_only(r):
    """The resource with everything not on DBS's servers taken off it, or None
    if nothing DBS-hosted is left."""
    r = dict(r)
    for k in ("play", "read"):
        v = r.get(k)
        if v and _has_url(v) and not all(_dbs(u) for u in re.findall(r"https?://[^\"\s]+", json.dumps(v))):
            r[k] = None
    r["downloads"] = [d for d in (r.get("downloads") or []) if d.get("local") or _dbs(d.get("url"))]
    r["links"] = [l for l in (r.get("links") or []) if _dbs(l.get("url"))]
    if r.get("source") and not _dbs(r["source"]):
        r["source"] = None
    for k in ("cover", "coverOnline"):
        if r.get(k) and r[k].startswith("http") and not _dbs(r[k]):
            r[k] = None
    online = r.get("online")
    if isinstance(online, dict) and _has_url(online) and not all(
            _dbs(u) for u in re.findall(r"https?://[^\"\s]+", json.dumps(online))):
        r["online"] = None
    # A DBS film, collection or Bible page is DBS's own resource even when the
    # app has no direct file for it: keep it as a link to that page.
    src = r.get("source") or ""
    if (not (r.get("play") or r.get("read") or r["downloads"] or r["links"])
            and _dbs(src) and "/discover/languages/" not in src):
        r["links"] = [{"label": "Open on DBS", "url": src}]
    local = "local" in json.dumps({k: r.get(k) for k in ("play", "read", "downloads")})
    if not (r.get("play") or r.get("read") or r["downloads"] or r["links"] or local or r.get("online")):
        return None
    return r


def curate(resources):
    kept, dropped = [], []
    for r in resources:
        d = _dbs_only(r)
        if d is None:
            dropped.append((r, "not hosted by DBS"))
            continue
        r = d
        if r.get("type") == "link" and len(r.get("links") or []) > 1:
            r = _prune_links(r)
            if not r["links"]:
                dropped.append((r, "no links left after curation"))
                continue
        why = excluded(r)
        (dropped if why else kept).append((r, why))
    return [r for r, _ in kept], [(r, w) for r, w in dropped]
