"""Small shared helpers."""
import hashlib, re, unicodedata, urllib.parse

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
