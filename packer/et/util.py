"""Small shared helpers."""
import hashlib, pathlib, re, unicodedata, urllib.parse

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}

FILE_EXT = (".zip", ".pdf", ".epub", ".mp3", ".mp4", ".m4a", ".webp", ".jpg", ".jpeg", ".png")


def human(n):
    """1234567 -> '1.2 MB'. Unknown sizes come through as 0."""
    if not n:
        return "—"
    n = float(n)
    for u in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.0f} {u}" if u == "B" else f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} PB"


def safe_name(url, fallback="file"):
    """A filename that survives FAT32, every OS, and a field worker reading it aloud.

    Card filesystems are exFAT or FAT32, so : * ? " < > | \\ / are illegal and
    non-ASCII is a coin toss across Android file managers. Several DBS URLs carry
    percent-encoded Urdu and Sindhi in the filename, which is why this exists.
    """
    name = urllib.parse.unquote(url.split("?")[0].rsplit("/", 1)[-1])
    stem = name
    name = unicodedata.normalize("NFKD", name)
    name = name.encode("ascii", "ignore").decode("ascii")
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", name)
    name = re.sub(r"\s+", "-", name).strip("-. ")
    if not name or name.startswith("."):
        name = fallback + (name or "")
    name = name[:100] or fallback

    # Stripping non-ASCII can collapse two different files onto one name — several
    # DBS URLs differ only in their percent-encoded Urdu or Sindhi. Two assets
    # with the same rel path get deduplicated, so the collision would not error;
    # it would just quietly drop a file. Tag anything that lost characters with a
    # short digest of the original so distinct sources stay distinct.
    if stem != name:
        digest = hashlib.sha1(stem.encode("utf-8")).hexdigest()[:6]
        root, dot, ext = name.rpartition(".")
        name = f"{root}-{digest}.{ext}" if dot else f"{name}-{digest}"
    return name


def is_file_url(url):
    return url.lower().split("?")[0].endswith(FILE_EXT)


def safe_id(rid, fallback="item"):
    """A resource id is used as a folder name on the card, so it is not allowed
    to contain a path. A catalogue with an id of `../../../../tmp/x` otherwise
    writes straight out of the card and into the filesystem."""
    rid = re.sub(r"[^A-Za-z0-9._-]", "-", str(rid or "")).strip("-.")
    return rid[:80] or fallback


def inside(root, *parts):
    """Resolve a path under `root` and refuse anything that climbs out."""
    root = pathlib.Path(root).resolve()
    p = (root.joinpath(*parts)).resolve()
    if p != root and root not in p.parents:
        raise ValueError(f"path escapes {root}: {p}")
    return p


ALLOWED_SCHEMES = ("http", "https")
BLOCKED_HOSTS = re.compile(
    r"^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)",
    re.I)


def fetchable(url):
    """Only ordinary public web URLs. A catalogue is data, and data must not be
    able to point the packer at the machine it runs on or at a cloud metadata
    service."""
    try:
        u = urllib.parse.urlparse(url)
    except Exception:
        return False
    if u.scheme.lower() not in ALLOWED_SCHEMES:
        return False
    return not BLOCKED_HOSTS.match(u.hostname or "")
