#!/usr/bin/env python3
"""Import a language that is already on disk, rather than one to download.

    python3 packer/import_folder.py cmn "/path/to/LarryLanguages/Mandarin"
    python3 packer/import_folder.py --list

The other builders start from the Digital Bible Society's catalogue and fetch
what it points at. This one starts from files someone has already gathered and
arranged — Larry's Chinese library is 24 GB of it, in folders a person can read:

    1 - Movies/JESUS - The Life of Jesus (61 parts)/01 - The Beginning.mp4
    2 - Audio/The Story of Jesus/Part 01.mp3
    3 - Bibles to Read/Chinese Union Version (Simplified) 1919.pdf
    4 - Old Bible Scans/1822 - Pentateuch.pdf

That arrangement is already the right one, so this reads it as it stands: a
film folder becomes one resource with its parts as chapters, a PDF and its
matching EPUB become one Bible with two ways to save it, and each scan becomes
one item dated from its filename.

Nothing is downloaded and nothing is probed — the files are right there, so
sizes are read off disk. The catalogue records where each file came from, and
the packer copies rather than fetches.
"""
import argparse, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "packer"))
from et.util import safe_id  # noqa: E402

MEDIA = (".mp4", ".m4v", ".webm", ".mp3", ".m4a", ".wav")
READABLE = (".pdf", ".epub")

LANGUAGES = {
    "cmn": {"name": "Mandarin", "native": "普通话", "script": "hani", "dir": "ltr",
            "font": "han", "speakers": "~918 million", "region": "China & Taiwan",
            "blurb": "The official spoken language of China and Taiwan, and the one most Chinese speakers outside Hong Kong will want."},
    "yue": {"name": "Cantonese", "native": "廣東話", "script": "hani", "dir": "ltr",
            "font": "han", "speakers": "~85 million", "region": "Hong Kong, Macau & southern China",
            "blurb": "Spoken in Hong Kong, Macau and southern China."},
}

TYPE_LABEL = {"film": "Films", "audio": "Audio Collections", "scripture": "Scripture Text",
              "historic": "Historic Scans", "audio-bible": "Audio Bibles", "link": "Partner Links"}

SECTIONS = {"1 - Movies": "film", "2 - Audio": "audio",
            "3 - Bibles to Read": "scripture", "4 - Old Bible Scans": "historic"}


def numbered(name):
    """Sort key that puts 01, 02 … 10 in the order a person means."""
    return [int(x) if x.isdigit() else x.lower()
            for x in re.split(r"(\d+)", name)]


def part_title(path, n):
    """A readable chapter name from a filename.

    "01 - The Beginning.mp4" is already one. "Mark 01.mp4" and the handful that
    kept their CDN names ("cmn-matthew-vb-mandarin-chinese-01-chapter-01.mp4")
    are not, and become "Part 3" rather than something unreadable.
    """
    stem = path.stem
    m = re.match(r"^\s*(\d{1,3})\s*[-–—.]\s*(.+)$", stem)
    if m:
        return f"{int(m.group(1))}. {m.group(2).strip()}"
    m = re.match(r"^([A-Za-z ]{3,20})\s+(\d{1,3})$", stem)
    if m:
        return f"{m.group(1).strip()} {int(m.group(2))}"
    if re.search(r"[a-z]{2,}-[a-z]{2,}-", stem):        # a leftover CDN filename
        return f"Part {n}"
    return stem


def blurb_from(folder):
    """The human note Larry's layout already puts in every film folder."""
    note = folder / "What is in here.txt"
    if not note.exists():
        return ""
    lines = [l.rstrip() for l in note.read_text(errors="replace").splitlines()]
    out = []
    for l in lines:
        if not l.strip() or set(l.strip()) <= set("=-"):
            if out:
                break
            continue
        if not out and l.strip().lower() == folder.name.split(" (")[0].strip().lower():
            continue                                    # the title again
        out.append(l.strip())
    return " ".join(out).strip()


def clean_title(name):
    return re.sub(r"\s*\(\d+\s*parts?\)\s*$", "", name).strip()


def build(code, folder):
    spec = LANGUAGES[code]
    folder = pathlib.Path(folder).resolve()
    if not folder.is_dir():
        sys.exit(f"  not a folder: {folder}")

    out, skipped = [], []

    for section, kind in SECTIONS.items():
        base = folder / section
        if not base.is_dir():
            continue

        for entry in sorted(base.iterdir(), key=lambda p: numbered(p.name)):
            if entry.name.startswith("."):
                continue

            # ---- a folder of parts: one film, or one audio collection
            if entry.is_dir():
                files = sorted([f for f in entry.iterdir()
                                if f.suffix.lower() in MEDIA], key=lambda p: numbered(p.name))
                if not files:
                    skipped.append(f"{section}/{entry.name} — empty")
                    continue
                title = clean_title(entry.name)
                rid = f"{code}-{'film' if kind == 'film' else 'audio'}-{safe_id(title.lower())}"
                rel = [str(f.relative_to(folder)) for f in files]
                total = sum(f.stat().st_size for f in files)

                if kind == "film":
                    play = {"kind": "chapters", "base": "", "items": [
                        {"n": i + 1, "title": part_title(f, i + 1), "local": rel[i]}
                        for i, f in enumerate(files)]}
                    res = dict(id=rid, type="film", title=title, play=play,
                               stats=f"{len(files)} parts", desc=blurb_from(entry))
                else:
                    # "The whole story in one piece" is the one to play first.
                    whole = next((i for i, f in enumerate(files)
                                  if "whole" in f.stem.lower() or "full" in f.stem.lower()), 0)
                    play = {"kind": "audio-collection", "local": rel[whole]}
                    res = dict(id=rid, type="audio", title=title, play=play,
                               stats=f"{len(files)} recordings", desc=blurb_from(entry),
                               downloads=[{"label": part_title(f, i + 1), "local": rel[i]}
                                          for i, f in enumerate(files)])
                res["bytes"] = total
                out.append(res)
                continue

            # ---- a loose file: a Bible to read, or a scan
            if entry.suffix.lower() not in READABLE:
                continue
            stem = entry.stem
            rid = f"{code}-{'text' if kind == 'scripture' else 'hist'}-{safe_id(stem.lower())}"
            if any(r["id"] == rid for r in out):
                continue                                 # the .epub of a pair already did it

            pdf = entry.with_suffix(".pdf")
            epub = entry.with_suffix(".epub")
            downloads = []
            for f, label in ((pdf, "PDF"), (epub, "EPUB")):
                if f.exists():
                    downloads.append({"label": label, "local": str(f.relative_to(folder)),
                                      "bytes": f.stat().st_size})
            if not downloads:
                continue

            year = (re.search(r"\b(1[5-9]\d\d|20\d\d)\b", stem) or [None])[0]
            title = re.sub(r"^\s*\d{4}\s*[-–—]\s*", "", stem).strip()
            res = dict(id=rid, type=kind, title=title, year=year, downloads=downloads,
                       bytes=sum(d["bytes"] for d in downloads))
            if pdf.exists():
                res["read"] = {"kind": "pdf", "local": str(pdf.relative_to(folder))}
            res["desc"] = ("Scanned pages of a printed edition." if kind == "historic"
                           else "The full text, to read in the app or save.")
            out.append(res)

    # ---- fill in the fields every resource carries
    for r in out:
        r["lang"] = code
        r["langName"] = spec["name"]
        r["typeLabel"] = TYPE_LABEL[r["type"]]
        r["source_root"] = str(folder)
        for k in ("native", "org", "duration", "cover", "license", "scope", "links", "source", "stats", "year"):
            r.setdefault(k, None)
        r.setdefault("desc", "")
        r.setdefault("play", None)
        r.setdefault("read", None)
        r.setdefault("downloads", [])
        r.setdefault("org", "Digital Bible Society")

    lang = {k: spec[k] for k in ("name", "native", "script", "dir", "font", "speakers", "region", "blurb")}
    lang["code"] = code
    path = ROOT / "catalog" / f"{code}.json"
    path.write_text(json.dumps({
        "generated": f"{spec['name']} — imported from files already on disk",
        "source_root": str(folder),
        "languages": {code: lang},
        "resources": out,
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    import collections
    by = collections.Counter(r["type"] for r in out)
    gb = sum(r["bytes"] for r in out) / 2**30
    print(f"  {len(out)} resources ({dict(by)}) · {gb:.1f} GB on disk")
    for s in skipped:
        print(f"  skipped: {s}")
    print(f"  wrote {path.relative_to(ROOT)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("code", nargs="?")
    ap.add_argument("folder", nargs="?")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    if a.list or not a.code:
        for c, s in LANGUAGES.items():
            print(f"  {c:<5}{s['name']:<12}{s['native']}")
        return
    if a.code not in LANGUAGES:
        sys.exit(f"  unknown language: {a.code}")
    if not a.folder:
        sys.exit("  give the folder to import")
    print(f"\n  Importing {LANGUAGES[a.code]['name']} from {a.folder}")
    build(a.code, a.folder)


if __name__ == "__main__":
    main()
