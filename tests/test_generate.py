"""Every per-language file matches registry/languages.json.

If this fails, run `npm run generate` (python3 packer/et/generate.py) and commit
what it writes. Never edit a generated file by hand: the next build undoes it.
"""
import copy
import pathlib
import unittest

from packer.et import generate

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Generated(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = generate.load()
        cls.out = generate.outputs(cls.registry)

    def test_generated_files_are_up_to_date(self):
        stale = generate.stale(self.out)
        self.assertEqual(stale, [], "stale generated files; run `npm run generate` and commit the result")

    def test_every_language_folder_comes_from_the_registry(self):
        folders = {path.parent.name for path in (ROOT / "app").glob("*/index.html")}
        generated = {pathlib.PurePosixPath(path).parent.name for path in self.out if path.endswith("/index.html")}
        self.assertEqual(folders - generate.OTHER_PAGES, generated,
                         "a language page exists that registry/languages.json does not list")

    def test_registry_covers_every_page_type(self):
        languages = self.registry["languages"]
        self.assertEqual(len(languages), 57)
        self.assertTrue(any(e.get("dir") == "rtl" for e in languages))
        for entry in languages:
            with self.subTest(slug=entry["slug"]):
                self.assertTrue((ROOT / "app/assets/og" / (entry["slug"] + ".jpg")).is_file())

    def test_rtl_pages_say_so(self):
        for entry in self.registry["languages"]:
            page = self.out["app/%s/index.html" % entry["slug"]]
            self.assertIn('dir="%s"' % entry.get("dir", "ltr"), page.split("\n")[1])

    def test_vercel_keeps_every_language_url_and_hand_written_rewrites(self):
        vercel = self.out["vercel.json"]
        for entry in self.registry["languages"]:
            for path in [entry["slug"]] + entry["aliases"] + entry.get("stubs", []):
                self.assertIn('"source": "/%s", "destination": "/%s/index.html"' % (path, entry["slug"]), vercel)
        for path in ("/admin", "/admin/library", "/privacy", "/share-libraries"):
            self.assertIn('"source": "%s"' % path, vercel)

    def test_shell_version_follows_shell_contents(self):
        registry = copy.deepcopy(self.registry)
        registry["languages"][0]["lead"] += "!"
        version = lambda out: out["app/sw.js"].split("var VERSION = '")[1].split("'")[0]
        self.assertNotEqual(version(generate.outputs(registry)), version(self.out))

    def test_registry_refuses_a_reused_url(self):
        registry = copy.deepcopy(self.registry)
        registry["languages"][1]["aliases"].append(registry["languages"][0]["slug"])
        with self.assertRaises(SystemExit):
            generate.validate(registry)

    def test_registry_refuses_unknown_fields(self):
        registry = copy.deepcopy(self.registry)
        registry["languages"][0]["titel"] = "typo"
        with self.assertRaises(SystemExit):
            generate.validate(registry)


if __name__ == "__main__":
    unittest.main()
