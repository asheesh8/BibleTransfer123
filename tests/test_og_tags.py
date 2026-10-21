"""Every library page carries its own link-preview card for Facebook and others."""
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app")
SITE = "https://www.bibletransfer123.org"


def meta(text, key):
    match = re.search(r'<meta (?:property|name)="%s" content="([^"]*)">' % re.escape(key), text)
    return match and match.group(1)


class OpenGraphTags(unittest.TestCase):
    def pages(self):
        for slug in sorted(os.listdir(APP)):
            path = os.path.join(APP, slug, "index.html")
            if os.path.isfile(path):
                text = open(path, encoding="utf-8").read()
                if "window.ET_SHARED_LIBRARY" in text:
                    yield slug, text

    def test_each_language_page_has_its_own_card(self):
        pages = list(self.pages())
        self.assertGreaterEqual(len(pages), 40)
        for slug, text in pages:
            with self.subTest(slug=slug):
                self.assertEqual(meta(text, "og:url"), SITE + "/" + slug)
                image = meta(text, "og:image")
                self.assertTrue(image and image.startswith(SITE + "/assets/og/" + slug + ".jpg"), image)
                self.assertTrue(os.path.isfile(os.path.join(APP, "assets/og", slug + ".jpg")))
                self.assertTrue(meta(text, "og:title") and meta(text, "og:description"))
                self.assertEqual(meta(text, "twitter:card"), "summary_large_image")
                self.assertNotIn("fbshare.", text)

    def test_home_and_launcher_use_the_whole_library_card(self):
        for page in ("index.html", "share-libraries/index.html"):
            text = open(os.path.join(APP, page), encoding="utf-8").read()
            self.assertTrue(meta(text, "og:image").startswith(SITE + "/assets/og/home.jpg"))
        self.assertTrue(os.path.isfile(os.path.join(APP, "assets/og/home.jpg")))


if __name__ == "__main__":
    unittest.main()
