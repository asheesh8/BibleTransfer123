"""Normalise a source catalogue into the flat asset list EasyTransfer packs.

The source today is GawahiiTV's `data/resources.json` (112 Digital Bible Society
resources in Sindhi and Urdu). Nothing here is specific to that file beyond
`from_gawahi()` — swap that one function to pack a different library.
"""
import dataclasses, json, pathlib
from .util import safe_name, safe_local, safe_id, is_file_url, fetchable

# Roles, in the order a resource is worth packing. `cover` is tiny and always
# worth it; `view` is what the app plays or reads; `download` is the bundle a
# visitor copies to their phone.
ROLES = ("cover", "view", "download")


@dataclasses.dataclass
class Asset:
    rid: str            # owning resource id
    role: str           # cover | view | download
    url: str            # where to fetch it from
    rel: str            # path under the card's media/ root
    label: str = ""     # shown in the app's download list
    n: int = 0          # chapter number, for chaptered films
    title: str = ""     # chapter title
    nbytes: int = 0     # filled in by sizes.probe(); 0 means unknown
    src: str = ""       # a file already on this machine, to copy not download

    @property
    def key(self):
        return self.rel


def load(path):
    """The source catalogue, plus every other catalogue sitting beside it.

    `resources.json` is GawahiiTV's Sindhi and Urdu library, copied verbatim.
    Other languages arrive as sibling files — `english.json`, written by
    `build_english.py` — and are merged in here rather than edited into the
    GawahiiTV copy, so that file can be refreshed from upstream at any time.
    """
    path = pathlib.Path(path)
    with open(path, encoding="utf-8") as fh:
        base = json.load(fh)
    seen = {r["id"] for r in base["resources"]}
    for extra in sorted(path.parent.glob("*.json")):
        if extra.resolve() == path.resolve():
            continue
        with open(extra, encoding="utf-8") as fh:
            more = json.load(fh)
        if not isinstance(more, dict) or "resources" not in more:
            continue
        base.setdefault("languages", {}).update(more.get("languages", {}))
        for r in more["resources"]:
            if r["id"] not in seen:
                base["resources"].append(r)
                seen.add(r["id"])
    return base


def _local(r, rel, role, folder, label="", n=0, title=""):
    """An asset that already exists on this machine.

    `url` carries a `local:` reference so everything downstream — the packed
    catalogue's lookups, the manifest — can keep matching on one field, while
    `src` says where to copy it from.
    """
    src = pathlib.Path(r["source_root"]) / rel
    return Asset(r["id"], role, "local:" + rel,
                 f"{folder}/{safe_local(pathlib.PurePath(rel).name)}",
                 label=label, n=n, title=title,
                 nbytes=src.stat().st_size if src.exists() else 0,
                 src=str(src))


def assets_for(r):
    """Every packable file a resource exposes, as Assets.

    Resources whose only links are landing pages (the 52 `link` partner entries)
    yield nothing but a cover — they stay in the app as "needs internet" cards
    rather than being dropped, because a Raspberry Pi with an uplink can still
    reach them.
    """
    rid = r["id"]
    folder = safe_id(rid)        # the id names a folder on the card
    out = []

    if r.get("cover"):
        ext = pathlib.PurePosixPath(r["cover"].split("?")[0]).suffix or ".jpg"
        out.append(Asset(rid, "cover", r["cover"], f"{folder}/cover{ext}", "Cover"))

    play = r.get("play") or {}
    kind = play.get("kind")

    # A language imported from a folder already has its files; nothing to fetch.
    if r.get("source_root"):
        if kind == "chapters":
            for it in play["items"]:
                out.append(_local(r, it["local"], "view", folder,
                                  label=it.get("title", ""), n=it["n"], title=it.get("title", "")))
        elif kind == "audio-collection" and play.get("local"):
            out.append(_local(r, play["local"], "view", folder, label="Audio"))
        if (r.get("read") or {}).get("local"):
            out.append(_local(r, r["read"]["local"], "view", folder, label="Read"))
        for d in (r.get("downloads") or []):
            if d.get("local"):
                out.append(_local(r, d["local"], "download", folder, label=d.get("label", "Download")))
        seen, uniq = set(), []
        for a in out:
            if a.rel in seen:
                continue
            seen.add(a.rel)
            uniq.append(a)
        return uniq

    if kind == "chapters":
        for it in play["items"]:
            out.append(Asset(rid, "view", play["base"] + it["file"],
                             f"{folder}/{safe_name(it['file'])}",
                             label=it["title"], n=it["n"], title=it["title"]))
    elif kind == "file":
        for q in ("hd", "sd"):
            if play.get(q):
                out.append(Asset(rid, "view", play[q],
                                 f"{folder}/{q}-{safe_name(play[q])}", label=q.upper()))
    elif kind == "audio-collection" and play.get("sample"):
        out.append(Asset(rid, "view", play["sample"],
                         f"{folder}/{safe_name(play['sample'])}", label="Audio"))
    # audio-bible chapters are generated from a fileset pattern — 1,189 files per
    # Bible. They are packed through their download ZIP instead, below.

    read = r.get("read") or {}
    if read.get("url"):
        out.append(Asset(rid, "view", read["url"],
                         f"{folder}/{safe_name(read['url'])}", label="Read"))

    for d in (r.get("downloads") or []):
        if not is_file_url(d["url"]) or not fetchable(d["url"]):
            continue                      # a landing page, or somewhere we will not go
        out.append(Asset(rid, "download", d["url"],
                         f"{folder}/{safe_name(d['url'])}", label=d["label"]))

    # Two links can resolve to the same file — a historic scan's `read` PDF is
    # usually also its only download. Keep the first, which carries the better role.
    seen, uniq = set(), []
    for a in out:
        if a.rel in seen:
            continue
        seen.add(a.rel)
        uniq.append(a)
    return uniq


def index(catalog):
    """resource id -> resource."""
    return {r["id"]: r for r in catalog["resources"]}


def all_assets(catalog):
    """resource id -> [Asset]."""
    return {r["id"]: assets_for(r) for r in catalog["resources"]}
