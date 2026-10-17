"""Craft Stick Bible Stories: Waking Word Inc.'s episodes, hosted by the Library."""
import json, pathlib, sys, unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "packer"))
from et import catalog as C  # noqa: E402
from et.curation import LIBRARY_HOST  # noqa: E402


class CraftStickBibleStories(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        lib = C.load(ROOT / "catalog" / "resources.json")
        cls.eps = [r for r in lib["resources"] if r["id"].startswith("eng-film-csbs-")]

    def test_episodes_survive_curation_on_the_english_shelf(self):
        self.assertGreaterEqual(len(self.eps), 2)
        for r in self.eps:
            self.assertEqual((r["lang"], r["type"]), ("eng", "film"))

    def test_every_episode_credits_waking_word(self):
        for r in self.eps:
            self.assertEqual(r["org"], "Waking Word Inc.")
            self.assertIn("https://wakingword.org", [l["url"] for l in r["links"]], r["id"])

    def test_files_are_the_librarys_own_and_committed(self):
        for r in self.eps:
            for url in (r["play"]["sd"], r["cover"]):
                self.assertTrue(url.startswith(f"https://{LIBRARY_HOST}/assets/library/csbs/"), url)
                local = ROOT / "app" / url.split(f"https://{LIBRARY_HOST}/", 1)[1]
                self.assertTrue(local.exists(), local)
                self.assertLess(local.stat().st_size, 95 * 2**20, local)


if __name__ == "__main__":
    unittest.main()
