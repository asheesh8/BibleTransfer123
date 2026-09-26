"""Series cover art, shared by every language.

DBS draws one cover per film series — JESUS, The HOPE, LUMO: Mark — and uses
it on that film's page in every language. English had them written in by hand;
this gives the same cover to any resource, in any language, that points at a
DBS film page of that series. Read off dbs.org's film pages, 2026-09-25.
"""
import re

M = "https://meta.dbs.org/data/data-video/covers"
G = "https://dbs.org/video/covers"

SERIES = {
    "jesus": f"{M}/Jesus/jesus.jpg",
    "john": f"{M}/John/gospel_of_john.jpg",
    "magdalena": f"{M}/Magdalena/magdalena.jpg",
    "storyjesus": f"{M}/StoryJesus/story_of_jesus_for_children.jpg",
    "savior": f"{M}/Savior/the_savior.jpg",
    "matthew": f"{M}/Matthew/matthew.webp",
    "acts_vb": f"{M}/Acts_VB/book_of_acts.webp",
    "deafproject": f"{M}/DeafProject/rescue_project_deaf_gospel.jpg",
    "lumo-mark": f"{M}/Lumo-Mark/lumo_mark.webp",
    "lumo-john": f"{M}/Lumo-John/lumo_john.webp",
    "lumo-luke": f"{M}/Lumo-Luke/lumo_luke.webp",
    "lumo-matthew": f"{M}/Lumo-Matthew/lumo_matthew.webp",
    "lumo-acts": f"{M}/Lumo-Acts/acts.webp",
    "lumo-covenant": f"{M}/Lumo-Covenant/covenant.webp",
    "creator": f"{M}/Creator/a_day_and_night_with_creator.jpg",
    "augustine": f"{M}/Augustine/augustine.jpg",
    "john_slides": f"{M}/John_Slides/john_slides.webp",
    "bible_slides": f"{M}/Bible_Slides/bible_slides.webp",
    # These four have per-language artwork on DBS with the title lettered in;
    # the series cover is the language-neutral one.
    "hope": f"{G}/hope.webp",
    "ibible": f"{G}/ibible.webp",
    "c2c": f"{G}/c2c.webp",
    "ps": f"{G}/ps.webp",
    "rock": f"{G}/k.webp",
}
BP = {"overview": f"{G}/bn.webp", "themes": f"{G}/bt.webp"}

PAGE = re.compile(r"https://dbs\.org/video/([^/\"]+)/([^/\"?#]+)")


def series_cover(r):
    """The series cover for a resource, or None. Only films are matched."""
    if r.get("type") != "film":
        return None
    urls = [r.get("source") or ""] + [l.get("url", "") for l in (r.get("links") or [])]
    for u in urls:
        m = PAGE.match(u or "")
        if not m:
            continue
        series, slug = m.group(1).lower(), m.group(2).lower()
        if series == "bp":
            return BP["themes" if "theme" in slug else "overview"]
        if series in SERIES:
            return SERIES[series]
    return None
