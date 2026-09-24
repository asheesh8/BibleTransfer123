#!/usr/bin/env python3
"""Add verified DBS web fallbacks to resources originally imported from folders.

Mandarin and Cantonese were first imported from Larry's local media folders.
Those entries work on a packed card, but without an online fallback the preview
site could only say "Only on the card". This script pairs them with the same
resources on DBS's rendered pages so the same row streams over Wi-Fi.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAPTURE = ROOT / "catalog/source/dbs-online-fallbacks-2026-09-24.json"
VERIFIED = ROOT / "catalog/source/dbs-online-files-2026-09-24.json"
SUPPLEMENT = ROOT / "catalog/zz-dbs-all.json"
TARGETS = [ROOT / "catalog/cmn.json", ROOT / "catalog/yue.json"]

# Local folder record -> exhaustive DBS record with verified read/download URLs.
DOCUMENT_MATCHES = {
    "cmn-text-chinese-king-james-version-simplified-1992": "cmn-scripture-dbs-chinese-king-james-version-88cfb7657",
    "cmn-text-chinese-king-james-version-traditional-1992": "cmn-scripture-dbs-chinese-king-james-version-traditional-script-98574e506",
    "cmn-text-chinese-union-version-simplified-1919": "cmn-scripture-dbs-chinese-union-version-d7890dd49",
    "cmn-text-chinese-union-version-traditional-1919": "cmn-scripture-dbs-traditional-chinese-union-version-8d368f4e9",
    "cmn-text-griffith-john-new-testament-1887": "cmn-scripture-dbs-the-griffith-new-testament-6df76c6c1",
    "cmn-text-griffith-john-new-testament-simplified-1887": "cmn-scripture-dbs-the-griffith-new-testament-in-simplified-chinese-41dc9c052",
    "cmn-text-gury-orthodox-new-testament-1879": "cmn-scripture-dbs-the-gury-orthodox-new-testament-505dadf86",
    "cmn-text-morrison-milne-version-1824": "cmn-scripture-dbs-morrison-milne-version-434a834cc",
    "cmn-text-new-chinese-version-simplified-1992": "cmn-scripture-dbs-new-chinese-version-simplified-4fa0bd17e",
    "cmn-text-new-chinese-version-traditional-1992": "cmn-scripture-dbs-new-chinese-version-c36659591",
    "cmn-hist-1822-pentateuch": "cmn-historic-dbs-chinese-1822-pentateuch-6031d549d",
    "cmn-hist-1823-morrison-new-testament": "cmn-historic-dbs-chinese-1823-morrison-new-testmant-3d4ed4204",
    "cmn-hist-1840-new-testament-vol.-1-4": "cmn-historic-dbs-chinese-1840-new-testament-vol-1-4-wdl-19487-f0b0e7e5f",
    "cmn-hist-1850-new-testament": "cmn-historic-dbs-chinese-1850-new-testament-5ae931869",
    "cmn-hist-1862-bible-portion": "cmn-historic-dbs-chinese-1862-bible-portion-80e57be51",
    "cmn-hist-1875-new-testament": "cmn-historic-dbs-chinese-1875-new-testament-be7bc9f12",
    "cmn-hist-1885-mandarin-kjv-new-testament-chinese-english": "cmn-historic-dbs-chinese-english-1885-mandarin-kjv-diglot-new-tes-6df451414",
    "cmn-hist-1902-new-testament-chinese-english": "cmn-historic-dbs-chinese-english-1902-new-testament-e27f13ecb",
    "cmn-hist-1902-wenli-holy-scriptures-of-the-old-and-new-testaments": "cmn-historic-dbs-chinese-1902-wenli-holy-scriptures-of-the-old-an-8b7cdd572",
    "yue-text-studium-biblicum-version-1999": "yue-scripture-dbs-studium-biblicum-version-catholic-414c14322",
    "yue-hist-1997-genesis-portion-new-cantonese-bible": "yue-historic-dbs-yue-1997-genesis-portion-f4de23d42",
}


def media_online(resource, captured, alive_files):
    urls = [u for u in captured["urls"] if u in alive_files]
    mp4 = [u for u in urls if u.lower().split("?")[0].endswith(".mp4")]
    mp3 = [u for u in urls if u.lower().split("?")[0].endswith(".mp3")]
    zips = [u for u in urls if u.lower().split("?")[0].endswith(".zip")]
    old = resource.get("play") or {}
    online = {"source": captured["page"], "downloads": []}

    if old.get("kind") == "audio-collection":
        full = next((u for u in mp3 if u.lower().endswith("_full.mp3")), mp3[0] if mp3 else None)
        if not full:
            raise ValueError(f"no online audio for {resource['id']}")
        online["play"] = {"kind": "audio-collection", "sample": full}
        online["downloads"] = [{"label": "Complete audio (ZIP)", "url": u} for u in zips]
        return online

    items = old.get("items") or []
    expected = len(items)
    if expected == 1 and len(mp4) >= 1:
        low = next((u for u in mp4 if "films_low" in u or "-sd." in u), mp4[-1])
        high = next((u for u in mp4 if "/films/" in u or "-hd." in u), None)
        online["play"] = {"kind": "file", "sd": low, "hd": high}
    else:
        # Visual Bible pages also expose a complete film; chapter URLs are under
        # /chapters/. HOPE exposes each event twice, so prefer chapters_low.
        chapters = [u for u in mp4 if "/chapters/" in u or "/chapters_low/" in u]
        low_chapters = [u for u in chapters if "/chapters_low/" in u]
        if len(low_chapters) == expected:
            chapters = low_chapters
        elif len(mp4) == expected:
            chapters = mp4
        elif len(chapters) != expected:
            regular = [u for u in chapters if "/chapters/" in u]
            if len(regular) == expected:
                chapters = regular
        if len(chapters) != expected:
            raise ValueError(f"{resource['id']}: expected {expected} chapters, found {len(chapters)}")
        online["play"] = {"kind": "chapters", "base": "", "items": [
            {"n": old_item["n"], "title": old_item["title"], "file": url}
            for old_item, url in zip(items, chapters)
        ]}
    online["downloads"] = [
        {"label": "Complete video (ZIP)" if len(zips) == 1 else
                  ("Low data chapters (ZIP)" if "low" in u.lower() else "High quality chapters (ZIP)"),
         "url": u} for u in zips
    ]
    return online


def main():
    captures = json.loads(CAPTURE.read_text(encoding="utf-8"))
    verified = json.loads(VERIFIED.read_text(encoding="utf-8"))
    alive_files = set(verified["alive_files"])
    supplement = json.loads(SUPPLEMENT.read_text(encoding="utf-8"))
    by_id = {r["id"]: r for r in supplement["resources"]}
    enriched = []

    for target in TARGETS:
        data = json.loads(target.read_text(encoding="utf-8"))
        for resource in data["resources"]:
            rid = resource["id"]
            if rid in captures:
                resource["online"] = media_online(resource, captures[rid], alive_files)
            elif rid in DOCUMENT_MATCHES:
                match = by_id[DOCUMENT_MATCHES[rid]]
                resource["online"] = {
                    "source": match.get("source"),
                    "read": match.get("read"),
                    "downloads": match.get("downloads") or [],
                }
            else:
                raise ValueError(f"no online fallback for local resource {rid}")
            enriched.append(rid)
        target.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"  added verified Wi-Fi fallbacks to {len(enriched)} local resources")


if __name__ == "__main__":
    main()
