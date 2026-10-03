"""Keep the Kikuyu, Marathi and Luganda shelves complete and usable after regeneration.

These checks use the captured DBS inventory and saved file probes, so they run
offline and exercise the same merged, curated catalogue that the app packs.
"""
import json
import pathlib
import unittest
import urllib.parse

from packer.et import catalog
from packer.et.curation import RETIRED


ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "catalog" / "source"
AUDIT = SOURCE / "dbs-rendered-2026-10-01.json"
VERIFIED = SOURCE / "dbs-direct-files-2026-10-01.json"
LANGUAGES = {"kik": ("Kikuyu", "Gĩkũyũ", "latn"),
             "mar": ("Marathi", "मराठी", "deva"),
             "lug": ("Luganda", "Luganda", "latn")}
CURRENT_AUDIO = {
    "lug": {"LUGBSU_DAVR_FB_N": ["OT", "NT"],
            "LUGRPA_DAVR_FB_N": ["OT", "NT"],
            "LUGBIB_FCBH_FB_N": ["OT", "NT"]},
    "kik": {"KIKKIK_DAVR_OT_N": ["OT"]},
    "mar": {"MAROLD_DAVR_FB_N": ["OT", "NT"],
            "MARWTC_FCBH_NT_N": ["NT"]},
}


def urls_in(value):
    """All explicit source, player, reader and download URLs in a record."""
    if isinstance(value, dict):
        for child in value.values():
            yield from urls_in(child)
    elif isinstance(value, list):
        for child in value:
            yield from urls_in(child)
    elif isinstance(value, str) and value.startswith(("http://", "https://")):
        yield value.rstrip("/")


def on_dbs(url):
    host = urllib.parse.urlparse(url).hostname or ""
    return host == "dbs.org" or host.endswith(".dbs.org")


class DbsLanguagesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.audit = json.loads(AUDIT.read_text(encoding="utf-8"))
        cls.verified = json.loads(VERIFIED.read_text(encoding="utf-8"))
        cls.audit.update(json.loads((SOURCE / "dbs-rendered-2026-10-02.json").read_text()))
        current = json.loads((SOURCE / "dbs-direct-files-2026-10-02.json").read_text())
        for key in ("alive_files", "playable_audio_filesets"):
            cls.verified[key].extend(current[key])
        cls.media = json.loads((SOURCE / "dbs-media-2026-10-02.json").read_text())
        cls.library = catalog.load(ROOT / "catalog" / "resources.json")
        cls.resources = {
            lang: [r for r in cls.library["resources"] if r["lang"] == lang]
            for lang in LANGUAGES
        }

    def test_language_metadata_and_unique_resource_ids(self):
        for lang, (name, native, script) in LANGUAGES.items():
            with self.subTest(language=lang):
                metadata = self.library["languages"][lang]
                self.assertEqual(metadata["name"], name)
                self.assertEqual(metadata["native"], native)
                self.assertEqual(metadata["script"], script)
                self.assertEqual(metadata["dir"], "ltr")
                self.assertEqual(metadata["code"], lang)
                self.assertTrue(self.resources[lang])
                # Check the source catalogues too: load() would otherwise hide
                # colliding IDs by silently keeping the first record.
                raw_ids = []
                for path in (ROOT / "catalog").glob("*.json"):
                    data = json.loads(path.read_text(encoding="utf-8"))
                    if isinstance(data, dict):
                        raw_ids.extend(r["id"] for r in data.get("resources", [])
                                       if r.get("lang") == lang)
                self.assertEqual(len(raw_ids), len(set(raw_ids)))
        ids = [r["id"] for r in self.library["resources"]]
        self.assertEqual(len(ids), len(set(ids)))

    def test_every_current_dbs_inventory_link_reaches_its_language_shelf(self):
        for lang, sections in self.audit.items():
            if lang not in LANGUAGES:
                continue
            with self.subTest(language=lang):
                captured = {item["href"].rstrip("/")
                            for group in sections.values() for item in group["links"]}
                current = {url for url in captured if on_dbs(url) and url not in RETIRED}
                represented = set(urls_in(self.resources[lang]))
                self.assertTrue(current)
                self.assertEqual(current - represented, set(), "Current DBS resources were lost")
                self.assertEqual(captured.intersection(RETIRED).intersection(represented), set())

    def test_publisher_links_stay_out_of_the_dbs_only_library(self):
        for lang, sections in self.audit.items():
            if lang not in LANGUAGES:
                continue
            with self.subTest(language=lang):
                external = {item["href"].rstrip("/")
                            for group in sections.values() for item in group["links"]
                            if not on_dbs(item["href"])}
                represented = set(urls_in(self.resources[lang]))
                self.assertTrue(external)
                self.assertEqual(external.intersection(represented), set())
                self.assertTrue(all(on_dbs(url) for url in represented))

    def test_all_captured_films_have_packable_media(self):
        for lang, count in (("kik", 5), ("mar", 13), ("lug", 13)):
            expected = {item["href"] for item in self.audit[lang]["Films"]["links"]}
            if lang == "lug":
                expected.add("https://dbs.org/video/lumo-mark/lug_luganda_mark/Luganda-Contemporary-Bible")
            films = [r for r in self.resources[lang] if r["type"] == "film"]
            self.assertEqual(len(expected), count)
            self.assertEqual(len(films), count)
            self.assertEqual({r["source"] for r in films}, expected)
            for film in films:
                with self.subTest(language=lang, film=film["title"]):
                    media = [a for a in catalog.assets_for(film)
                             if a.role in ("view", "download")
                             and urllib.parse.urlparse(a.url).path.lower().endswith((".mp4", ".zip"))]
                    self.assertTrue(media, "A film must offer playable media or a file to pack")
                    for asset in media:
                        self.assertTrue(on_dbs(asset.url))
                        self.assertNotIn("{", asset.url, "Unexpanded chapter template")
                    if "/video/bp/" in film["source"]:
                        self.assertTrue(any(a.role == "download" for a in media))
                    else:
                        self.assertTrue(any(a.role == "view" for a in media))

    def test_chaptered_films_have_complete_ordered_language_media(self):
        # Counts shown on the captured DBS film pages. Contiguous numbering
        # alone would still pass if a rebuild accidentally lost the final parts.
        expected_counts = {
            "lug-film-jesus": 61, "lug-film-lumo-john": 21,
            "lug-film-lumo-luke": 24, "lug-film-lumo-mark-bsu": 16,
            "lug-film-lumo-mark-contemporary": 16, "lug-film-lumo-matthew": 28,
            "lug-film-lumo-acts": 4, "lug-film-lumo-covenant": 12,
            "lug-film-acts-vb": 28,
            "kik-film-jesus": 61, "kik-film-lumo-luke": 24,
            "kik-film-lumo-acts": 4, "kik-film-vb-kik-matthew-vb-kikuyu": 28,
            "kik-film-vb-kik-acts-vb-kikuyu": 28,
            "mar-film-john": 49, "mar-film-jesus": 61,
            "mar-film-lumo-mark": 16, "mar-film-lumo-acts": 4,
            "mar-film-lumo-covenant": 12,
            "mar-film-vb-mar-matthew-vb-marathi": 28,
            "mar-film-vb-mar-acts-vb-marathi": 28,
        }
        chaptered = []
        for lang, resources in self.resources.items():
            for resource in resources:
                play = resource.get("play") or {}
                if resource["type"] != "film" or play.get("kind") != "chapters":
                    continue
                chaptered.append(resource)
                with self.subTest(language=lang, film=resource["title"]):
                    items = play["items"]
                    self.assertTrue(items)
                    self.assertEqual(len(items), expected_counts[resource["id"]])
                    self.assertEqual([item["n"] for item in items], list(range(1, len(items) + 1)))
                    media_urls = [play["base"] + item["file"] for item in items]
                    self.assertEqual(len(media_urls), len(set(media_urls)))
                    for item, url in zip(items, media_urls):
                        self.assertTrue(item["title"].strip())
                        self.assertTrue(on_dbs(url))
                        self.assertTrue(urllib.parse.urlparse(url).path.lower().endswith(".mp4"))
                        self.assertRegex(urllib.parse.unquote(url), rf"(?<![a-z]){lang}(?=[_-])")
        self.assertEqual({r["id"] for r in chaptered}, set(expected_counts))

    def test_current_audio_bibles_are_verified_and_keep_their_testaments(self):
        verified = set(self.verified["playable_audio_filesets"])
        for lang, expected in CURRENT_AUDIO.items():
            audio = [r for r in self.resources[lang] if r["type"] == "audio-bible"]
            self.assertEqual(len(audio), len(expected))
            actual = {(r.get("play") or {}).get("fileset"): r for r in audio}
            self.assertEqual(set(actual), set(expected))
            self.assertTrue(set(actual).issubset(verified))
            for fileset, testaments in expected.items():
                with self.subTest(fileset=fileset):
                    play = actual[fileset]["play"]
                    self.assertEqual(play["kind"], "audio-bible")
                    self.assertEqual(play["testaments"], testaments)

    def test_bible_files_are_backed_by_saved_probes_and_packable(self):
        verified = set(self.verified["alive_files"])
        packed = set()
        for resources in [*self.resources.values(),
                          [r for r in self.library["resources"] if r["lang"] == "luo"]]:
            for resource in resources:
                if resource["type"] not in ("scripture", "historic", "audio-bible"):
                    continue
                with self.subTest(resource=resource["id"]):
                    read_url = (resource.get("read") or {}).get("url")
                    files = {d["url"] for d in resource.get("downloads", [])}
                    if read_url:
                        files.add(read_url)
                    self.assertTrue(files.issubset(verified), "Unverified Bible file was advertised")
                    assets = {a.url for a in catalog.assets_for(resource) if a.role != "cover"}
                    self.assertTrue(files.issubset(assets), "Advertised Bible file cannot be packed")
                    packed.update(assets)
        # Covers and online landing pages cannot satisfy this requirement.
        self.assertTrue(any(url.endswith(".pdf") for url in verified))
        self.assertTrue(verified.issubset(packed), "A verified Bible download was omitted")

    def test_luganda_media_matches_every_captured_file_and_recording(self):
        resources = {r["id"]: r for r in self.resources["lug"]}
        for captured in self.media["resources"]:
            resource = resources[captured["id"]]
            play = resource.get("play") or {}
            if play.get("kind") == "chapters":
                self.assertEqual(play["items"], captured["play"]["items"],
                                 "A captured film chapter was dropped or replaced")
            if play.get("kind") == "file":
                self.assertEqual(play, captured["play"])
        collection = resources["lug-ac-grn"]
        tracks = self.media["pages"][collection["source"]]["tracks"]
        self.assertEqual(len(tracks), 215)
        archives = {d["url"] for d in self.media["verified_downloads"]}
        self.assertEqual(len(archives), 2)
        self.assertTrue(all(d["mp3_files"] == 215 for d in self.media["verified_downloads"]))
        self.assertEqual({d["url"] for d in collection["downloads"]}, set(tracks) | archives)
        packed = {a.url for a in catalog.assets_for(collection)}
        self.assertTrue(set(tracks).issubset(packed), "A recording cannot be packed")
        self.assertEqual(len(self.media["book_names"]), 66)
        self.assertEqual(self.media["book_names"][0], "Olubereberye")
        self.assertEqual(self.media["book_names"][-1], "Okubikkulirwa")


if __name__ == "__main__":
    unittest.main()
