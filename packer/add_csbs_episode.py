#!/usr/bin/env python3
"""Add a Craft Stick Bible Stories episode to the English library.

    python3 packer/add_csbs_episode.py "E1 Doubting Thomas ....mp4" \\
        --slug doubting-thomas --title "Doubting Thomas" --episode 1 \\
        --scripture "John 20:19-29" --desc "Jesus appeared to ..." [--poster-at 60]
    npm run catalog

Jimmy Henault at Waking Word Inc. (wakingword.org) sends each episode as a 4K
master with its original script, which gives the title, Scripture and
description. The 4K file is far too big for a phone on a slow connection, so
this makes a 720p web copy and a cover picture in app/assets/library/csbs/,
then adds (or updates) the episode in catalog/english-local.json. The Library
hosts the copy itself, so it plays on the website and a card build carries it.

Waking Word asked to be credited as "Waking Word Inc." with a link to
wakingword.org; every episode carries both.
"""
import argparse, json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "packer"))
from et.curation import LIBRARY_HOST  # noqa: E402

CATALOG = ROOT / "catalog" / "english-local.json"
FOLDER = ROOT / "app" / "assets" / "library" / "csbs"
SERIES = "Craft Stick Bible Stories"
CREDIT = {"label": "Waking Word Inc. · wakingword.org", "url": "https://wakingword.org"}


def encode(src, dest, poster, poster_at):
    # Same recipe as the Village Server film: 720p H.264, capped bitrate,
    # moov atom first so the browser starts playing before the download ends.
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-i", str(src),
                    "-map", "0:v:0", "-map", "0:a:0", "-vf", "scale=-2:720",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "26",
                    "-maxrate", "1200k", "-bufsize", "2400k", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k", "-ac", "2",
                    "-movflags", "+faststart", str(dest)], check=True)
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", "-ss", str(poster_at),
                    "-i", str(src), "-frames:v", "1", "-vf", "scale=640:-2",
                    "-q:v", "4", str(poster)], check=True)


def duration(path):
    secs = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True).stdout)
    m, s = divmod(round(secs), 60)
    return f"{m}:{s:02d}"


def entry(a, dur):
    url = f"https://{LIBRARY_HOST}/assets/library/csbs/{a.slug}"
    return {
        "id": f"eng-film-csbs-{a.slug}",
        "type": "film",
        "title": f"{a.title} — {SERIES}",
        "org": "Waking Word Inc.",
        "year": a.year,
        "duration": dur,
        "cover": f"{url}.jpg",
        "desc": f"{a.desc} ({a.scripture}) Episode {a.episode} of {SERIES}, "
                "a children's series told with craft-stick puppets.",
        "play": {"kind": "file", "sd": f"{url}.mp4"},
        "links": [CREDIT],
        "source": f"{url}.mp4",
        "lang": "eng",
        "langName": "English",
        "downloads": [],
        "read": None,
        "native": None,
        "stats": f"Episode {a.episode}",
        "license": "© Waking Word Inc. Shared with the VillageServer Initiative by permission.",
        "scope": a.scripture,
        "typeLabel": "Films",
        "series": SERIES,
        "episode": a.episode,
    }


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    p.add_argument("master", help="the 4K episode file from Waking Word")
    p.add_argument("--slug", required=True, help="file name, e.g. doubting-thomas")
    p.add_argument("--title", required=True)
    p.add_argument("--episode", type=int, required=True)
    p.add_argument("--scripture", required=True)
    p.add_argument("--desc", required=True, help="EPISODE DESCRIPTION from the script")
    p.add_argument("--year", help="year the episode was made, if Waking Word says")
    p.add_argument("--poster-at", type=float, default=60, help="seconds in for the cover")
    p.add_argument("--skip-encode", action="store_true", help="the web copy already exists")
    a = p.parse_args()

    FOLDER.mkdir(parents=True, exist_ok=True)
    mp4, jpg = FOLDER / f"{a.slug}.mp4", FOLDER / f"{a.slug}.jpg"
    if not a.skip_encode:
        encode(a.master, mp4, jpg, a.poster_at)
    if mp4.stat().st_size > 95 * 2**20:
        sys.exit(f"{mp4} is over 95 MB; GitHub refuses files over 100 MB. Lower -crf/-maxrate.")

    cat = json.loads(CATALOG.read_text())
    new = entry(a, duration(mp4))
    rest = [r for r in cat["resources"] if r["id"] != new["id"]]
    eps = sorted([r for r in rest if r.get("series") == SERIES] + [new], key=lambda r: r["episode"])
    cat["resources"] = [r for r in rest if r.get("series") != SERIES] + eps
    CATALOG.write_text(json.dumps(cat, indent=1, ensure_ascii=False) + "\n")
    print(f"{new['id']}: {mp4.stat().st_size / 2**20:.1f} MB, {new['duration']}. Now run: npm run catalog")


if __name__ == "__main__":
    main()
