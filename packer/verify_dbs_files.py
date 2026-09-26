#!/usr/bin/env python3
"""Probe the file URLs a rendered DBS audit implies, and record the live ones.

    python3 packer/verify_dbs_files.py catalog/source/dbs-rendered-2026-09-25.json

import_dbs_rendered.py only offers a PDF, EPUB or audio Bible in the app when
its URL is listed in catalog/source/dbs-direct-files-*.json. This builds that
list for a new audit, so adding a language never means guessing.
"""
import concurrent.futures, datetime, json, pathlib, sys, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "packer"))
from import_dbs_rendered import AUDIO_DIRS  # noqa: E402
UA = {"User-Agent": "Mozilla/5.0 (EasyTransfer packer)"}


def alive(url):
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers={**UA, "Range": "bytes=0-0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                if r.status in (200, 206):
                    ctype = r.headers.get("Content-Type", "")
                    return "text/html" not in ctype
        except Exception:
            continue
    return False


def candidates(audit):
    files, audio = set(), {}
    for sections in audit.values():
        for group in sections.values():
            for item in group["links"]:
                p = urllib.parse.urlparse(item["href"])
                if p.netloc != "dbs.org":
                    continue
                path = p.path.rstrip("/")
                ident = urllib.parse.unquote(path.split("/")[-1])
                if "/bibles/historic/" in path:
                    files.add(f"https://scripture.dbs.org/pdfs/{ident}.pdf")
                elif "/bibles/audio/" in path:
                    version = ident.split("_", 1)[0]
                    t, num, book = (("OT", 1, "Genesis") if "_OT_" in ident else ("NT", 40, "Matthew"))
                    folder = urllib.parse.quote(AUDIO_DIRS.get(ident, {}).get(t, f"{t}_{version}"))
                    audio[ident] = (f"https://dbs.org/cdn/audio/{ident}/{folder}/"
                                    f"{num:02d}_{book}/{num:02d}_{book}_001.mp3")
                    files.add(f"https://scripture.dbs.org/audio_zip/{urllib.parse.quote(ident)}.zip")
                elif path.startswith("/bibles/") and path.count("/") == 2:
                    files.add(f"https://bibles.dbs.org/{ident}/pdf/{ident}.pdf")
                    files.add(f"https://bibles.dbs.org/{ident}/epub/{ident}.epub")
    return files, audio


def main():
    src = pathlib.Path(sys.argv[1]).resolve()
    files, audio = candidates(json.loads(src.read_text(encoding="utf-8")))
    urls = sorted(files) + sorted(audio.values())
    with concurrent.futures.ThreadPoolExecutor(12) as ex:
        ok = dict(zip(urls, ex.map(alive, urls)))
    out = {
        "verified": datetime.date.today().isoformat(),
        "alive_files": sorted(u for u in files if ok[u]),
        "playable_audio_filesets": sorted(f for f, u in audio.items() if ok[u]),
    }
    dest = src.with_name(src.name.replace("dbs-rendered-", "dbs-direct-files-"))
    dest.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"  {len(out['alive_files'])}/{len(files)} files alive · "
          f"{len(out['playable_audio_filesets'])}/{len(audio)} audio Bibles play")
    for u in urls:
        if not ok[u]:
            print("  dead:", u)
    print(f"  wrote {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
