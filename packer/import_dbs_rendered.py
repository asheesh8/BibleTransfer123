#!/usr/bin/env python3
"""Turn the verified, rendered DBS language inventories into app resources.

DBS builds its language pages in the browser. Its older public JSON is useful,
but it does not contain the complete set shown to a visitor: hosted audio
Bibles, films, audio collections, scans, and publisher links can all be absent.

The browser audit lives in catalog/source/dbs-rendered-2026-09-24.json. This
script adds one searchable resource for every rendered link that is not already
represented by one of the richer hand-built catalogue entries.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import re
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
CATALOG = ROOT / "catalog"
SOURCE = CATALOG / "source" / "dbs-rendered-2026-09-24.json"
FILES = CATALOG / "source" / "dbs-direct-files-2026-09-24.json"
# Sort after the curated catalogues so the simplest playable choices stay at
# the top of each language page and the exhaustive archive follows them.
OUT = CATALOG / "zz-dbs-all.json"

LANGUAGES = {
    "eng": ("eng", "English", ""),
    "cmn": ("cmn", "Mandarin", ""),
    "yue": ("yue", "Cantonese", ""),
    "hin": ("hin", "Hindi", ""),
    "urd": ("urd", "Urdu", ""),
    "snd": ("snd", "Sindhi", ""),
    "guz": ("guz", "Gusii", ""),
    "swh": ("swh", "Swahili", "Coastal"),
    "swa": ("swh", "Swahili", "General"),
    "pbu": ("pus", "Pashto", "Northern"),
    "pbt": ("pus", "Pashto", "Southern"),
    "pst": ("pus", "Pashto", "Central"),
}

TYPE_LABEL = {
    "film": "Films",
    "audio-bible": "Audio Bibles",
    "audio": "Audio Collections",
    "scripture": "Scripture Text",
    "historic": "Historic Scans",
    "link": "Partner Links",
}

AUDIO_ORGS = {
    "grn": "Global Recordings Network",
    "soj": "Story of Jesus",
    "srun": "StoryRunners",
    "wbt": "Wycliffe Bible Translators",
}


def canonical(url: str) -> str:
    """Match equivalent URLs already normalised elsewhere in the packer."""
    url = (url or "").strip().rstrip("/")
    m = re.match(r"^https?://([a-z0-9.-]+\.[a-z0-9.-]+)\.s3\.amazonaws\.com/(.*)$", url, re.I)
    if m:
        url = f"https://s3.amazonaws.com/{m.group(1)}/{m.group(2)}"
    elif url.startswith("http://"):
        url = "https://" + url[7:]
    return url


def urls_in(value, skip_online=False):
    if isinstance(value, dict):
        for key, child in value.items():
            if skip_online and key == "online":
                continue
            yield from urls_in(child, skip_online=skip_online)
    elif isinstance(value, list):
        for child in value:
            yield from urls_in(child, skip_online=skip_online)
    elif isinstance(value, str) and value.startswith(("http://", "https://")):
        yield value


def existing_catalog():
    resources = []
    languages = {}
    for path in sorted(CATALOG.glob("*.json")):
        if path == OUT:
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or "resources" not in data:
            continue
        resources.extend(data["resources"])
        languages.update(data.get("languages") or {})
    return resources, languages


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "resource"


def resource_type(section: str, url: str) -> str:
    if section == "Bibles":
        return "audio-bible" if "/bibles/audio/" in url else "scripture"
    if section == "Films":
        return "film"
    if section == "Audio Collections":
        return "audio"
    if section == "Historic Bible (Scans)":
        return "historic"

    host = urllib.parse.urlparse(url).netloc.lower()
    path = urllib.parse.urlparse(url).path.lower()
    if host in {"find.bible", "www.bible.com", "bible.com"} or "bible" in host:
        return "scripture"
    if host == "globalrecordings.net" or path.endswith((".mp3", ".m4a", ".wav")):
        return "audio"
    if (host in {"youtu.be", "youtube.com", "www.youtube.com", "vimeo.com", "www.vimeo.com", "arc.gt"}
            or path.endswith((".mp4", ".mov", ".webm"))):
        return "film"
    if path.endswith((".pdf", ".epub")):
        return "scripture"
    return "link"


def bible_title(item, url: str) -> str:
    ident = urllib.parse.unquote(urllib.parse.urlparse(url).path.rstrip("/").split("/")[-1])
    ident = ident.split("_", 1)[0]
    row = item.get("row") or item.get("title") or ident
    marker = f" {ident} "
    if marker in row:
        return row.split(marker, 1)[0].strip(" ,")
    return (item.get("title") or ident).strip()


def audio_title(item, url: str, scope: str) -> tuple[str, str]:
    bits = urllib.parse.urlparse(url).path.strip("/").split("/")
    provider = bits[2] if len(bits) > 2 else ""
    org = AUDIO_ORGS.get(provider, provider.upper() or "Digital Bible Society")
    tail = urllib.parse.unquote(bits[-1]) if bits else ""
    if provider == "soj":
        title = "Story of Jesus"
    elif provider == "grn":
        title = "Scripture Recordings"
    elif provider == "srun":
        title = "Bible Story Set"
    else:
        title = re.sub(r"^[a-z]{3}_", "", tail, flags=re.I).replace("_", " ").strip()
        title = title or org
    if scope:
        title += f" ({scope})"
    return title, org


def film_scope(item, url: str, fallback: str) -> str:
    cells = item.get("cells") or []
    title = item.get("title") or ""
    if cells and cells[0].startswith(title):
        visible = cells[0][len(title):].strip()
        if visible and visible != title:
            return visible
    tail = urllib.parse.unquote(urllib.parse.urlparse(url).path.rstrip("/").split("/")[-1])
    tail = re.sub(r"^[a-z]{3}[_-]", "", tail, flags=re.I)
    return fallback or tail.replace("_", " ").replace("-", " ").strip().title()


def destination(r: dict) -> str:
    if r.get("source") and "/discover/languages/" not in r["source"]:
        return r["source"]
    return ((r.get("links") or [{}])[0].get("url") or r.get("source") or "")


def url_variant(url: str) -> str:
    tail = urllib.parse.unquote(urllib.parse.urlparse(url).path.rstrip("/").split("/")[-1])
    tail = re.sub(r"\.(?:mp4|mp3|m4a|mov|webm|pdf|epub)$", "", tail, flags=re.I)
    tail = re.sub(r"^[a-z]{3}[_-]", "", tail, flags=re.I)
    return re.sub(r"\s+", " ", tail.replace("_", " ").replace("-", " ")).strip().title()


def make_resource(source_code: str, section: str, item: dict) -> dict:
    lang, lang_name, base_scope = LANGUAGES[source_code]
    url = item["href"]
    rtype = resource_type(section, url)
    title = (item.get("title") or "Resource").strip()
    org = None
    scope = base_scope or None

    if section == "Bibles":
        title = bible_title(item, url)
        org = "Digital Bible Society"
    elif section == "Audio Collections":
        title, org = audio_title(item, url, base_scope)
    elif section == "Films":
        cells = item.get("cells") or []
        org = cells[1] if len(cells) > 1 else None
        scope = film_scope(item, url, base_scope) or None
    elif section == "Historic Bible (Scans)":
        org = "Digital Bible Society Archive"
    elif rtype == "scripture":
        org = "Bible publisher"
    elif rtype == "audio":
        org = "Scripture audio publisher"
    elif rtype == "film":
        org = "Bible media publisher"

    digest = hashlib.sha1(canonical(url).encode("utf-8")).hexdigest()[:9]
    rid = f"{lang}-{rtype}-dbs-{slug(title)[:48]}-{digest}"
    years = re.findall(r"\b(?:1[4-9]\d{2}|20\d{2})\b", item.get("row") or "")
    internal = urllib.parse.urlparse(url).netloc.lower() == "dbs.org"
    language_page = f"https://dbs.org/discover/languages/{source_code}"

    resource = {
        "id": rid,
        "lang": lang,
        "type": rtype,
        "title": title,
        "native": None,
        "org": org,
        "year": years[-1] if years else None,
        "duration": (item.get("cells") or [None, None, None])[2] if len(item.get("cells") or []) > 2 else None,
        "desc": (f"Listed by Digital Bible Society for {lang_name}"
                 + (f" ({base_scope})" if base_scope else "") + "."),
        "license": None,
        "scope": scope,
        "stats": None,
        "langName": lang_name,
        "typeLabel": TYPE_LABEL[rtype],
        "cover": None,
        "play": None,
        "read": None,
        "downloads": [],
        "links": [] if internal else [{"label": "Open at publisher", "url": url}],
        "source": url if internal else language_page,
    }

    # DBS's own Bible pages use stable public file paths. Make every hosted
    # text, scan, and audio Bible usable in the app itself, while retaining the
    # landing page as its source and fallback.
    path = urllib.parse.urlparse(url).path.rstrip("/")
    ident = path.split("/")[-1]
    if internal and "/bibles/historic/" in path:
        pdf = f"https://scripture.dbs.org/pdfs/{ident}.pdf"
        resource["read"] = {"kind": "pdf", "url": pdf}
        resource["downloads"] = [{"label": "PDF", "url": pdf}]
        resource["cover"] = f"https://scripture.dbs.org/covers/small/{ident}.webp"
    elif internal and "/bibles/audio/" in path:
        fileset = urllib.parse.unquote(ident)
        version = fileset.split("_", 1)[0]
        if "_FB_" in fileset:
            testaments = ["OT", "NT"]
        elif "_OT_" in fileset:
            testaments = ["OT"]
        else:
            testaments = ["NT"]
        resource["play"] = {
            "kind": "audio-bible", "fileset": fileset,
            "version": version, "testaments": testaments,
        }
        resource["downloads"] = [{
            "label": "Complete audio (ZIP)",
            "url": f"https://scripture.dbs.org/audio_zip/{urllib.parse.quote(fileset)}.zip",
        }]
    elif internal and re.match(r"^/bibles/[^/]+$", path):
        abbr = urllib.parse.unquote(ident)
        pdf = f"https://bibles.dbs.org/{abbr}/pdf/{abbr}.pdf"
        resource["read"] = {"kind": "pdf", "url": pdf}
        resource["downloads"] = [
            {"label": "PDF", "url": pdf},
            {"label": "EPUB", "url": f"https://bibles.dbs.org/{abbr}/epub/{abbr}.epub"},
        ]

    return resource


def main():
    audit = json.loads(SOURCE.read_text(encoding="utf-8"))
    verified = json.loads(FILES.read_text(encoding="utf-8"))
    alive_files = set(verified["alive_files"])
    playable_audio = set(verified["playable_audio_filesets"])
    existing, languages = existing_catalog()
    # `online` is a fallback for a richer local-folder record. Keep the normal
    # DBS entry too: it has the searchable DBS title and keeps regeneration
    # independent of whether a local folder was imported first.
    represented = {canonical(url) for r in existing for url in urls_in(r, skip_online=True)}
    added = []
    rendered = []

    for source_code, sections in audit.items():
        for section, group in sections.items():
            for item in group["links"]:
                url = item.get("href")
                if not url:
                    continue
                rendered.append(canonical(url))
                if canonical(url) in represented:
                    continue
                resource = make_resource(source_code, section, item)
                if resource.get("read") and resource["read"].get("url") not in alive_files:
                    resource["read"] = None
                resource["downloads"] = [
                    d for d in resource.get("downloads", []) if d.get("url") in alive_files
                ]
                play = resource.get("play") or {}
                if play.get("kind") == "audio-bible" and play.get("fileset") not in playable_audio:
                    resource["play"] = None
                added.append(resource)
                represented.update(canonical(u) for u in urls_in(resource))

    # A title can legitimately repeat for several DBS dubs. Show the scope on
    # those rows so the reader can tell which one they are opening.
    counts = {}
    for r in added:
        key = (r["lang"], r["type"], r["title"])
        counts[key] = counts.get(key, 0) + 1
    for r in added:
        key = (r["lang"], r["type"], r["title"])
        if counts[key] > 1 and r.get("scope"):
            r["title"] += f" ({r['scope']})"

    # Native labels can still leave several dubs with the same visible name.
    # Use the DBS slug as a final, deterministic disambiguator.
    final_counts = {}
    for r in added:
        key = (r["lang"], r["type"], r["title"])
        final_counts[key] = final_counts.get(key, 0) + 1
    for r in added:
        key = (r["lang"], r["type"], r["title"])
        if final_counts[key] > 1:
            variant = url_variant(destination(r))
            if variant:
                r["title"] += f" — {variant}"

    OUT.write_text(json.dumps({
        "generated": "Rendered Digital Bible Society language pages — verified 2026-09-24",
        "languages": {},
        "resources": added,
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    final_urls = represented
    missing = sorted(set(rendered) - final_urls)
    if missing:
        raise SystemExit(f"coverage failure: {len(missing)} rendered URLs are absent")

    by_lang = {}
    for r in added:
        by_lang[r["lang"]] = by_lang.get(r["lang"], 0) + 1
    print(f"  audited {len(rendered)} rendered links · 100% represented")
    print(f"  added {len(added)} searchable resources: {by_lang}")
    print(f"  wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
