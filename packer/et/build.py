"""Assemble the card: the app, the catalogue it reads, the media, the paperwork."""
import datetime, hashlib, json, pathlib, re, shutil

APP_DIRNAME = "app"
MEDIA_DIRNAME = "media"

# Two different paths to the same folder, and they are not interchangeable.
#
# MEDIA_HREF is what the app links to. The pages live in app/, the media sits
# beside it at the card root, so every href has to climb one level. This is
# correct both off a card (file://…/app/item.html) and off a Raspberry Pi
# serving the card as its web root (/app/item.html).
#
# MEDIA_SHOWN is what a human is told to look for in a file manager, where the
# card root is what they are standing in and "../" would be nonsense.
MEDIA_HREF = "../" + MEDIA_DIRNAME
MEDIA_SHOWN = MEDIA_DIRNAME


def card_catalog(catalog, chosen, profile, all_index):
    """The `window.LIBRARY` object the app reads.

    Written as a .js file that assigns a global, not as .json — a card opened
    straight from a file manager runs the app over file://, where fetch() of a
    local .json is blocked as a cross-origin request in every current browser.
    A <script> tag has no such problem. This one decision is what lets the same
    build work off a microSD card and off a Raspberry Pi.
    """
    packed = {r["id"]: assets for r, assets in chosen}
    out = []

    for r in catalog["resources"]:
        rid = r["id"]
        mine = {a.rel: a for a in packed.get(rid, [])}
        # Offline means something on the card can be opened or saved — not only
        # something the app can play inline. An audio Bible that ships as one
        # ZIP is fully on the card; calling it "needs internet" was false.
        offline = any(a.role in ("view", "download") for a in mine.values())

        def local(url):
            for a in mine.values():
                if a.url == url:
                    return f"{MEDIA_HREF}/{a.rel}"
            return None

        cover = next((f"{MEDIA_HREF}/{a.rel}" for a in mine.values()
                      if a.role == "cover"), None)

        play, src_play = None, (r.get("play") or {})
        if src_play.get("kind") == "chapters":
            items = [{"n": a.n, "title": a.title, "file": f"{MEDIA_HREF}/{a.rel}"}
                     for a in sorted(mine.values(), key=lambda x: x.n)
                     if a.role == "view" and a.n]
            if items:
                play = {"kind": "chapters", "items": items}
        elif src_play.get("kind") == "file":
            f = next((f"{MEDIA_HREF}/{a.rel}" for a in mine.values()
                      if a.role == "view" and a.label in ("HD", "SD")), None)
            if f:
                play = {"kind": "video", "file": f}
        elif src_play.get("kind") == "audio-collection":
            f = local(src_play.get("sample", ""))
            if f:
                play = {"kind": "audio", "file": f}

        read = None
        src_read = r.get("read") or {}
        if src_read.get("url"):
            f = local(src_read["url"])
            if f:
                read = {"kind": "pdf", "file": f}

        files = [{"label": a.label or "Download",
                  "file": f"{MEDIA_HREF}/{a.rel}",
                  "bytes": a.nbytes}
                 for a in mine.values() if a.role in ("view", "download") and not a.n]
        # A chaptered film saves as its whole folder, not 61 separate buttons.
        if play and play["kind"] == "chapters":
            files.insert(0, {"label": f"All {len(play['items'])} chapters",
                             "file": f"{MEDIA_SHOWN}/{rid}/",
                             "bytes": sum(a.nbytes for a in mine.values() if a.n),
                             "folder": True})

        out.append({
            "id": rid, "lang": r["lang"], "type": r["type"],
            "title": r["title"], "native": r.get("native"),
            "org": r.get("org"), "year": r.get("year"),
            "duration": r.get("duration"), "desc": r.get("desc"),
            "license": r.get("license"), "scope": r.get("scope"),
            "langName": r.get("langName"), "typeLabel": r.get("typeLabel"),
            "cover": cover,
            # The publisher's own cover URL, kept even when the file is not on
            # the card: a Raspberry Pi with an uplink then shows real artwork
            # instead of a placeholder, and a card with no signal loses nothing.
            "coverOnline": r.get("cover") or None,
            "offline": offline,
            "play": play, "read": read, "files": files,
            "online": {
                "source": r.get("source"),
                "downloads": [d for d in (r.get("downloads") or [])],
            },
        })

    return {
        "built": datetime.date.today().isoformat(),
        "profile": profile.name,
        "source": catalog.get("generated", ""),
        "note": catalog.get("note", ""),
        "languages": catalog["languages"],
        "types": catalog["types"],
        "counts": {
            "total": len(out),
            "offline": sum(1 for r in out if r["offline"]),
        },
        "resources": out,
    }


def write_app(root, app_src, stamp=None):
    """Copy the app onto the card, replacing any previous build of it."""
    dest = pathlib.Path(root) / APP_DIRNAME
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(app_src, dest,
                    ignore=shutil.ignore_patterns("data", "media", ".DS_Store"))
    (dest / "data").mkdir(exist_ok=True)

    # Stamp the service worker's cache name. Without this, a phone that
    # installed an earlier card keeps serving that card's shell from its own
    # cache and never sees the rebuild — the one failure mode of shipping a
    # service worker at all.
    sw = dest / "sw.js"
    if sw.exists():
        v = stamp or datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        text = sw.read_text(encoding="utf-8")
        text = re.sub(r"var VERSION = '[^']*';",
                      "var VERSION = 'shell-%s';" % v, text, count=1)
        sw.write_text(text, encoding="utf-8")

    # index.html at the card root as well: a Raspberry Pi serving the card wants
    # a root index, and a file manager shows the shortest name first.
    for name in ("index.html", "START-HERE.html"):
        (pathlib.Path(root) / name).write_text(_root_redirect(), encoding="utf-8")
    return dest


def _root_redirect():
    return (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        "<title>Open the Library</title>"
        "<meta http-equiv=\"refresh\" content=\"0; url=app/index.html\">"
        "<style>body{font:16px/1.6 system-ui,sans-serif;margin:12vh auto;max-width:30rem;"
        "padding:0 1.5rem;text-align:center;background:#FFFBF2;color:#2A1B33}"
        "a{display:inline-block;margin-top:1rem;padding:1rem 2rem;border-radius:1rem;"
        "background:#6B2E86;color:#fff;text-decoration:none;font-weight:700}</style>"
        "</head><body><h1>The Library</h1>"
        "<p>Opening&hellip; if nothing happens, tap the button.</p>"
        "<a href=\"app/index.html\">Open the Library</a></body></html>\n"
    )


def write_catalog(app_dir, library):
    data = pathlib.Path(app_dir) / "data"
    data.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(library, ensure_ascii=False, separators=(",", ":"))
    (data / "catalog.js").write_text(
        "/* Generated by EasyTransfer. Do not edit — rebuild instead. */\n"
        "window.LIBRARY = " + payload + ";\n", encoding="utf-8")
    return len(payload)


def write_manifest(root, chosen, library):
    """What is meant to be here, so `verify` can tell what went missing."""
    entries = []
    for _, assets in chosen:
        for a in assets:
            entries.append({"rel": a.rel, "bytes": a.nbytes, "url": a.url})
    m = {"built": library["built"], "profile": library["profile"],
         "resources": len(chosen), "files": len(entries), "entries": entries}
    p = pathlib.Path(root) / "manifest.json"
    p.write_text(json.dumps(m, indent=1), encoding="utf-8")
    return p


def sha256(path, limit=None):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            b = fh.read(1 << 20)
            if not b:
                break
            h.update(b)
            if limit and fh.tell() > limit:
                break
    return h.hexdigest()
