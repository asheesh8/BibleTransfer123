"""Card profiles — what goes on an 8 GB card versus a 128 GB one.

A field card is not "the whole library minus whatever didn't fit". It is a
deliberate selection: Scripture and audio first, because they are small and get
used daily; films last, because one film in HD costs more than every PDF on the
card put together.
"""
import dataclasses

GB = 1 << 30

# Cards never hand over their whole nominal size. An "8 GB" card formats to about
# 7.4 GB, and a card packed to the rim fails to copy on some Android file managers.
USABLE = 0.90

# Packed first to last. Within a type, resources keep catalogue order.
PRIORITY = ("scripture", "historic", "audio", "audio-bible", "film", "link")


@dataclasses.dataclass
class Profile:
    name: str
    capacity: int              # nominal card size in bytes; 0 = no limit
    types: tuple               # which resource types are eligible
    quality: str               # 'sd' prefers low-bandwidth video, 'hd' prefers high
    blurb: str

    @property
    def budget(self):
        return int(self.capacity * USABLE) if self.capacity else 0


PROFILES = {
    "pocket": Profile(
        "pocket", 8 * GB,
        ("scripture", "historic", "audio", "audio-bible", "film"), "sd",
        "8 GB card — all Scripture, scans and audio, plus the films that fit."),
    "standard": Profile(
        "standard", 32 * GB,
        ("scripture", "historic", "audio", "audio-bible", "film"), "sd",
        "32 GB card — the working field library. The usual choice."),
    "full": Profile(
        "full", 64 * GB,
        ("scripture", "historic", "audio", "audio-bible", "film"), "sd",
        "64 GB card — everything packable at low bandwidth."),
    "everything": Profile(
        "everything", 0,
        ("scripture", "historic", "audio", "audio-bible", "film"), "hd",
        "No cap — HD where it exists. Hundreds of gigabytes. Size it first."),
}


def rank(resource):
    try:
        return PRIORITY.index(resource["type"])
    except ValueError:
        return len(PRIORITY)


def select(catalog, assets, profile, langs=None, only=None):
    """Choose what fits, whole resources at a time.

    A half-packed film is worse than an absent one — a visitor who taps chapter 12
    and gets nothing stops trusting the card. So a resource is included only if
    every one of its assets fits in what is left.
    """
    langs = set(langs) if langs else None
    resources = sorted(catalog["resources"], key=lambda r: (rank(r), r["id"]))

    chosen, skipped, used = [], [], 0
    for r in resources:
        rid = r["id"]
        if only and rid not in only:
            continue
        if r["type"] not in profile.types:
            skipped.append((r, "type not in profile"))
            continue
        if langs and r["lang"] not in langs:
            continue

        want = [a for a in assets.get(rid, []) if _wanted(a, r, profile)]
        if not want:
            skipped.append((r, "nothing packable — needs internet"))
            continue

        cost = sum(a.nbytes for a in want)
        if profile.budget and used + cost > profile.budget:
            skipped.append((r, f"would not fit ({_mb(cost)})"))
            continue

        chosen.append((r, want))
        used += cost
    return chosen, skipped, used


def _wanted(asset, resource, profile):
    """Drop the video quality this profile does not want, keep everything else."""
    if asset.role == "cover":
        return True
    play = resource.get("play") or {}
    if play.get("kind") == "file" and asset.label in ("HD", "SD"):
        other = "SD" if profile.quality == "hd" else "HD"
        has_both = play.get("hd") and play.get("sd")
        if has_both and asset.label == other:
            return False
    # For chaptered films the catalogue only lists the low-bandwidth chapter files;
    # the HD equivalent ships as a download ZIP, which `everything` keeps and the
    # capped profiles drop for being an offline duplicate of what already plays.
    if asset.role == "download" and profile.capacity and asset.nbytes > 512 * (1 << 20):
        return False
    return True


def _mb(n):
    return f"{n / (1 << 20):.0f} MB"
