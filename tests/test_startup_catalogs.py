"""Fast entry pages retain every shelf and the complete scoped media records."""
import gzip
import json
import pathlib
import re
import tempfile
import unittest

from packer.et.build import write_catalog

ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = ROOT / "app"


def read_catalog(path):
    return json.loads(path.read_text().split("window.LIBRARY = ", 1)[1].strip()[:-1])


class StartupCatalogTest(unittest.TestCase):
    def test_regeneration_preserves_home_shelves_and_complete_language_resources(self):
        library = read_catalog(APP / "data/catalog.js")
        before = json.dumps(library)
        with tempfile.TemporaryDirectory() as directory:
            write_catalog(directory, library)
            data = pathlib.Path(directory) / "data"
            self.assertEqual(read_catalog(data / "catalog.js"), library)
            home = read_catalog(data / "catalog-home.js")
            self.assertEqual(home["languages"], library["languages"])
            self.assertEqual(home["counts"], library["counts"])
            self.assertEqual(len(home["resources"]), len(library["resources"]))
            for full, small in zip(library["resources"], home["resources"]):
                for field in ("id", "title", "native", "lang", "type", "cover",
                              "coverOnline", "duration", "offline", "cardOnly"):
                    self.assertEqual(small.get(field), full.get(field))
                self.assertEqual(small["play"], bool(full.get("play")))
                self.assertEqual(small["read"], bool(full.get("read")))
            for lang in library["languages"]:
                scoped = read_catalog(data / ("catalog-" + lang + ".js"))
                expected = [r for r in library["resources"] if r["lang"] == lang]
                # Equality includes every chapter, download and offline path.
                self.assertEqual(scoped["resources"], expected)
                self.assertEqual(scoped["counts"]["total"], len(expected))
                self.assertEqual(scoped["counts"]["offline"],
                                 sum(bool(r.get("offline")) for r in expected))
            full_bytes = len(gzip.compress((data / "catalog.js").read_bytes()))
            self.assertLess(len(gzip.compress((data / "catalog-home.js").read_bytes())),
                            full_bytes // 2, "Home should not download full chapter lists")
        self.assertEqual(json.dumps(library), before, "Packing must not mutate the full catalogue")

    def test_packed_files_keep_their_offline_availability(self):
        library = {"languages": {"lug": {}}, "counts": {"offline": 1}, "resources": [
            {"id": "packed-film", "lang": "lug", "offline": True,
             "play": {"src": "../media/film.mp4"}, "read": None,
             "files": [{"href": "../media/film.mp4"}]}]}
        with tempfile.TemporaryDirectory() as directory:
            write_catalog(directory, library)
            data = pathlib.Path(directory) / "data"
            home = read_catalog(data / "catalog-home.js")["resources"][0]
            self.assertTrue(home["offline"])
            self.assertTrue(home["play"])
            self.assertEqual(read_catalog(data / "catalog-lug.js")["resources"],
                             library["resources"])

    def test_entry_pages_ship_the_correct_catalogues_and_cache_them_offline(self):
        worker = (APP / "sw.js").read_text()
        for page in [APP / "index.html", *APP.glob("*/index.html")]:
            html = page.read_text()
            scope = re.search(r"window\.ET_SHARED_LIBRARY = (\{[^\n]+\});", html)
            if scope:
                lang = json.loads(scope[1])["lang"]
                filename = "data/catalog-" + lang + ".js"
            elif page in (APP / "index.html", APP / "share-libraries/index.html"):
                filename = "data/catalog-home.js"
            else:
                continue
            self.assertIn('src="' + filename + '"', html)
            self.assertTrue((APP / filename).is_file())
            self.assertIn("'" + filename + "'", worker)
            if scope:
                self.assertTrue(all(r["lang"] == lang
                                    for r in read_catalog(APP / filename)["resources"]))
