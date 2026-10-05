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

For the requested complete Luo, Oromo, Igbo and French inventories, exact audited publisher
pages and media URLs are also carried for their respective languages. Luo
adds Dholuo programme and Bible directory pages; Oromo adds its programme,
Bible directory, ROCK and film links; Igbo adds its audited programmes, Bible directory and full-film files. French adds its checked programme, Bible directory, ROCK and film URLs. The explicit allowlists do not change
any other language's curation or permit arbitrary files on those hosts.

Applied in catalog.load(), so every build and every fresh DBS import passes
through it, and a removed item cannot drift back in.
"""
import json
import pathlib
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
    "https://dbs.org/bibles/audio/FRABSF_DAVR_FB_N",
    # Igbo’s rendered moved-edition notice links to current editions.
    "https://dbs.org/bibles/audio/IBOBSN_DAVR_FB_N",
    # Rendered Oromo pages explicitly point to their current editions.
    "https://dbs.org/bibles/audio/GAZBSE_DAVR_OT_N",
    "https://dbs.org/bibles/audio/GAXBSK01440_DAVR_OT_N",
    "https://dbs.org/bibles/audio/GAXWFW01446_DAVR_FB_N",
    # Both rendered Dholuo pages redirect readers to LUOGEN, 2026-10-02.
    "https://dbs.org/bibles/audio/LUOBIB_DAVR_FB_N",
    "https://dbs.org/bibles/audio/LUOBSK_DAVR_OT_N",
    # DBS's Luganda page offers three current editions instead, 2026-10-02.
    "https://dbs.org/bibles/audio/LUGREVBSU_DAVR_FB_N",
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
    "https://dbs.org/bibles/audio/MASBSK_DAVR_FB_N",   # "no longer at this address", 2026-09-27
    "https://dbs.org/bibles/MASTBN",                  # not in DBS site index, 2026-09-27
    "https://dbs.org/bibles/MASBST",
    "https://dbs.org/bibles/MASMAS",
    # DBS's moved-edition pages point readers to KIKKIK / MAROLD / MARWTC.
    # Confirmed on the rendered audio pages, 2026-10-01.
    "https://dbs.org/bibles/audio/KIKBSK_DAVR_OT_N",
    "https://dbs.org/bibles/audio/MARBCS_DAVR_FB_N",
    # Legacy dataset text records return DBS's 404 page (2026-10-01).
    "https://dbs.org/bibles/KIUBSK",
    "https://dbs.org/bibles/KIKKIK",
    "https://dbs.org/bibles/MARMRV",
    "https://dbs.org/bibles/MARZZZP",
    "https://dbs.org/bibles/MARRVV",
    "https://dbs.org/bibles/MARTBN",
    "https://dbs.org/bibles/MAROLD",
    "https://dbs.org/bibles/MARWTC",
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
    if r.get("lang") == "mlg":
        for url in _urls(r):
            if url in MALAGASY_EXCLUDED:
                return MALAGASY_EXCLUDED[url]
    if r.get("lang") == "hau":
        for url in _urls(r):
            if url in HAUSA_EXCLUDED:
                return HAUSA_EXCLUDED[url]
    if r.get("lang") == "lin":
        for url in _urls(r):
            if url in LINGALA_EXCLUDED:
                return LINGALA_EXCLUDED[url]
    if r.get("lang") == "pcm":
        for url in _urls(r):
            if url in PIDGIN_EXCLUDED:
                return PIDGIN_EXCLUDED[url]
    if r.get("lang") == "yor":
        for url in _urls(r):
            if url in YORUBA_EXCLUDED:
                return YORUBA_EXCLUDED[url]
    if r.get("lang") == "por":
        for url in _urls(r):
            if url in PORTUGUESE_EXCLUDED:
                return PORTUGUESE_EXCLUDED[url]
    if r.get("lang") == "amh":
        for url in _urls(r):
            if url in AMHARIC_EXCLUDED:
                return AMHARIC_EXCLUDED[url]
    if r.get("lang") == "fra":
        for url in _urls(r):
            if url in FRENCH_EXCLUDED:
                return FRENCH_EXCLUDED[url]
        if re.search(r"\b(inclusi(?:ve|f)|queen james|traduction du monde nouveau)\b",
                     title + " " + (r.get("native") or ""), re.I):
            return "translation not carried"
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

# Explicitly requested complete Luo inventory. Publisher pages were checked
# individually; 9460 and 82771 are Luhya Lunyore and intentionally absent.
LUO_PUBLISHERS = {
    "https://globalrecordings.net/en/program/" + str(n)
    for n in (62736, 24360, 73551, 73520, 73530, 73540, 73560, 73570,
              73580, 73590, 24351, 220, 221, 11241)
} | {
    "https://find.bible/bibles/LUOUBS/index.html",
    "https://find.bible/bibles/LUOGEN/index.html",
}

# Exact files and programme pages captured from the four requested Oromo
# inventories. This exception is scoped to the Oromo shelf; it cannot widen
# the source policy of another language or allow arbitrary publisher URLs.
OROMO_EXTERNAL = set(json.loads((pathlib.Path(__file__).resolve().parents[2] /
    "catalog/source/dbs-oromo-external-2026-10-03.json").read_text())["urls"])

IGBO_EXTERNAL = set(json.loads((pathlib.Path(__file__).resolve().parents[2] /
    "catalog/source/dbs-igbo-external-2026-10-03.json").read_text())["urls"])

# French publisher pages and media were captured from the DBS inventory.
# Both the exception and the audited exclusions apply only to French.
_FRENCH_POLICY = json.loads((pathlib.Path(__file__).resolve().parents[2] /
    "catalog/source/dbs-french-external-2026-10-03.json").read_text())
FRENCH_EXTERNAL = set(_FRENCH_POLICY["urls"])
FRENCH_EXCLUDED = _FRENCH_POLICY["excluded"]


# Exact Amharic publisher pages and files captured from its DBS inventory.
_AMHARIC_POLICY = json.loads((pathlib.Path(__file__).resolve().parents[2] /
    "catalog/source/dbs-amharic-external-2026-10-03.json").read_text())
AMHARIC_EXTERNAL = set(_AMHARIC_POLICY["urls"])
AMHARIC_EXCLUDED = _AMHARIC_POLICY["excluded"]

# Exact Portuguese publisher pages and files captured from the DBS inventory.
_PORTUGUESE_POLICY = json.loads((pathlib.Path(__file__).resolve().parents[2] /
    "catalog/source/dbs-portuguese-external-2026-10-03.json").read_text())
PORTUGUESE_EXTERNAL = set(_PORTUGUESE_POLICY["urls"])
PORTUGUESE_EXCLUDED = _PORTUGUESE_POLICY["excluded"]

# Exact Yoruba publisher pages and media observed in the DBS inventory.
_YORUBA_POLICY = json.loads((pathlib.Path(__file__).resolve().parents[2] /
    "catalog/source/dbs-yoruba-external-2026-10-04.json").read_text())
YORUBA_EXTERNAL = set(_YORUBA_POLICY["urls"])
YORUBA_EXCLUDED = _YORUBA_POLICY["excluded"]


_PIDGIN_POLICY = json.loads((pathlib.Path(__file__).resolve().parents[2] /
    "catalog/source/dbs-nigerian-pidgin-external-2026-10-04.json").read_text())
PIDGIN_EXTERNAL = set(_PIDGIN_POLICY["urls"])
PIDGIN_EXCLUDED = _PIDGIN_POLICY["excluded"]


# Exact Lingala publisher pages and media from the complete DBS inventory.
_LINGALA_POLICY = json.loads((pathlib.Path(__file__).resolve().parents[2] /
    "catalog/source/dbs-lingala-external-2026-10-04.json").read_text())
LINGALA_EXTERNAL = set(_LINGALA_POLICY["urls"])
LINGALA_EXCLUDED = _LINGALA_POLICY["excluded"]


# Exact Hausa publisher pages and files verified from the DBS inventory.
_HAUSA_POLICY = json.loads((pathlib.Path(__file__).resolve().parents[2] /
    "catalog/source/dbs-hausa-external-2026-10-04.json").read_text())
HAUSA_EXTERNAL = set(_HAUSA_POLICY["urls"])
HAUSA_EXCLUDED = _HAUSA_POLICY["excluded"]


# Exact Malagasy publisher pages verified from the complete DBS inventory.
_MALAGASY_POLICY = json.loads((pathlib.Path(__file__).resolve().parents[2] /
    "catalog/source/dbs-malagasy-external-2026-10-04.json").read_text())
MALAGASY_EXTERNAL = set(_MALAGASY_POLICY["urls"])
MALAGASY_EXCLUDED = _MALAGASY_POLICY["excluded"]

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
    def allowed(url):
        return (_dbs(url) or (r.get("lang") == "luo" and url in LUO_PUBLISHERS)
                or (r.get("lang") == "orm" and url in OROMO_EXTERNAL)
                or (r.get("lang") == "pcm" and url in PIDGIN_EXTERNAL)
                or (r.get("lang") == "hau" and url in HAUSA_EXTERNAL)
                or (r.get("lang") == "mlg" and url in MALAGASY_EXTERNAL)
                or (r.get("lang") == "lin" and url in LINGALA_EXTERNAL)
                or (r.get("lang") == "yor" and url in YORUBA_EXTERNAL)
                or (r.get("lang") == "por" and url in PORTUGUESE_EXTERNAL)
                or (r.get("lang") == "amh" and url in AMHARIC_EXTERNAL)
                or (r.get("lang") == "fra" and url in FRENCH_EXTERNAL)
                or (r.get("lang") == "ibo" and url in IGBO_EXTERNAL))
    def allowed_file(url):
        return (_dbs(url) or (r.get("lang") == "orm" and url in OROMO_EXTERNAL)
                or (r.get("lang") == "pcm" and url in PIDGIN_EXTERNAL)
                or (r.get("lang") == "hau" and url in HAUSA_EXTERNAL)
                or (r.get("lang") == "mlg" and url in MALAGASY_EXTERNAL)
                or (r.get("lang") == "lin" and url in LINGALA_EXTERNAL)
                or (r.get("lang") == "yor" and url in YORUBA_EXTERNAL)
                or (r.get("lang") == "por" and url in PORTUGUESE_EXTERNAL)
                or (r.get("lang") == "amh" and url in AMHARIC_EXTERNAL)
                or (r.get("lang") == "fra" and url in FRENCH_EXTERNAL)
                or (r.get("lang") == "ibo" and url in IGBO_EXTERNAL))
    for k in ("play", "read"):
        v = r.get(k)
        if v and _has_url(v) and not all(allowed_file(u) for u in re.findall(r"https?://[^\"\s]+", json.dumps(v))):
            r[k] = None
    r["downloads"] = [d for d in (r.get("downloads") or []) if d.get("local") or allowed_file(d.get("url"))]
    r["links"] = [l for l in (r.get("links") or []) if allowed(l.get("url"))]
    if r.get("source") and not allowed(r["source"]):
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
        if r.get("lang") in ("fra", "amh", "por", "yor", "pcm", "lin", "hau", "mlg") and excluded(r):
            dropped.append((r, excluded(r)))
            continue
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
        # This exact programme is now confirmed as Christian songs on GRN.
        if (why == "not confirmed as Christian" and r.get("lang") == "luo"
                and any(l.get("url") == "https://globalrecordings.net/en/program/24351"
                        for l in r.get("links", []))):
            why = None
        (dropped if why else kept).append((r, why))
    return [r for r, _ in kept], [(r, w) for r, w in dropped]
