"""Emailing one item to a friend: who sent it, the sharing chain, validated input."""
import datetime as dt
import json
import os
import pathlib
import shutil
import tempfile
import unittest
import urllib.parse
from unittest.mock import patch

from packer import item_mail as mail
from packer import write_item_mail_copy
from packer.item_mail_copy import COPY

NOW = dt.datetime(2026, 10, 21, 12, tzinfo=dt.timezone.utc).timestamp()
ROOT = pathlib.Path(__file__).resolve().parent.parent
SMTP = {"OUTREACH_SMTP_HOST": "smtp.example.org", "OUTREACH_SMTP_USER": "outreach@example.org", "OUTREACH_SMTP_PASSWORD": "test-only-password"}
LIBRARY = {"resources": [
    {"id": "eng-film-jesus", "title": "JESUS", "lang": "eng", "type": "film"},
    {"id": "hau-film-jesus", "title": "YESU", "lang": "hau", "type": "film"},
]}


class ItemMailTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        root = pathlib.Path(self.directory.name) / "public"
        (root / "data").mkdir(parents=True)
        (root / "data" / "catalog.js").write_text("/* test */\nwindow.LIBRARY = " + json.dumps(LIBRARY) + ";\n", encoding="utf-8")
        self.root = str(root)
        db = pathlib.Path(self.directory.name) / "private" / "events.sqlite"
        self.environ = patch.dict(os.environ, {"EASYTRANSFER_ANALYTICS_DB": str(db), "EASYTRANSFER_ADMIN_SECRET": "test-only-secret", **SMTP}, clear=True)
        self.environ.start()
        self.headers = {"Host": "localhost:8095", "Origin": "http://localhost:8095", "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin"}
        self.sent = []

    def tearDown(self):
        self.environ.stop()
        self.directory.cleanup()

    def request(self, payload, headers=None, ip="192.0.2.1", method="POST"):
        return mail.dispatch("/api/send-item", method, headers or self.headers, json.dumps(payload).encode(), ip, False,
                             public_root=self.root, now=NOW, send=lambda settings, message: self.sent.append((settings, message)))

    def link(self, message):
        text = message.get_body(("plain",)).get_content()
        url = next(line for line in text.splitlines() if line.startswith("http"))
        return url, dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query))

    def test_says_who_shared_it_and_links_the_next_step_of_the_chain(self):
        code, body, _ = self.request({"to": "grace@example.com", "item": "eng-film-jesus", "from": "Ashish", "toName": "Grace", "hop": 2, "shareId": "abcdef123456"})
        self.assertEqual((code, body), (200, {"ok": True}))
        message = self.sent[0][1]
        self.assertEqual(message["Subject"], "Ashish shared “JESUS” with you")
        self.assertEqual(message["To"], "Grace <grace@example.com>")
        self.assertIn("Ashish via VillageServer Outreach", message["From"])
        text = message.get_body(("plain",)).get_content()
        self.assertIn("Hi Grace,", text)
        self.assertIn("From: Ashish → To: Grace", text)
        self.assertIn("pass it on", text)
        url, query = self.link(message)
        self.assertTrue(url.startswith("http://localhost:8095/item.html?id=eng-film-jesus&"))
        self.assertEqual(query, {"id": "eng-film-jesus", "et_from": "Ashish", "et_hop": "2", "et_share": "abcdef123456", "et_channel": "email"})

    def test_writes_in_the_senders_language_and_keeps_a_one_language_library(self):
        self.assertEqual(self.request({"to": "a@example.com", "item": "hau-film-jesus", "from": "Musa", "lang": "ha", "library": "hausa"})[0], 200)
        message = self.sent[0][1]
        self.assertEqual(message["Subject"], "Musa ya raba “YESU” da kai")
        text = message.get_body(("plain",)).get_content()
        self.assertIn("Sannu,", text)
        self.assertIn("Daga: Musa", text)
        self.assertNotIn("Zuwa:", text)
        _, query = self.link(message)
        self.assertEqual((query["only"], query["ui"], query["share"], query["name"], query["et_hop"]), ("hau", "ha", "hausa", "Hausa", "1"))
        self.assertIn('dir="ltr"', message.get_body(("html",)).get_content())

    def test_names_cannot_carry_links_or_markup(self):
        for payload in ({"from": "www.spam.example"}, {"from": "Visit http"[:5] + "://x"}, {"from": "<b>Bo</b>"},
                        {"from": "Ann 123"}, {"from": ""}, {"from": "a" * 41}, {"from": "Ann", "toName": "Click.me"},
                        {"from": 7}):
            data = {"to": "a@example.com", "item": "eng-film-jesus", **payload}
            self.assertEqual(self.request(data)[0], 400, payload)
        self.assertEqual(self.request({"to": "a@example.com", "item": "eng-film-jesus", "from": "  Mary-Jane   O’Neil "})[0], 200)
        self.assertIn("Mary-Jane O’Neil shared", self.sent[0][1]["Subject"])
        self.assertEqual(self.request({"to": "b@example.com", "item": "eng-film-jesus", "from": "አበበ"})[0], 200)

    def test_rejects_bad_input_without_sending(self):
        base = {"to": "a@example.com", "item": "eng-film-jesus", "from": "Ann"}
        for change in ({"to": "not-an-address"}, {"to": "a@example.com\r\nBcc: b@example.com"}, {"item": "eng-missing"},
                       {"lang": "xx"}, {"library": "../admin"}, {"hop": 0}, {"hop": 1000}, {"hop": "2"},
                       {"shareId": "<bad>"}, {"message": "spam"}, {"title": "Free money"}):
            self.assertEqual(self.request({**base, **change})[0], 400, change)
        self.assertEqual(self.sent, [])

    def test_requires_same_origin_post_and_configured_smtp(self):
        base = {"to": "a@example.com", "item": "eng-film-jesus", "from": "Ann"}
        self.assertEqual(self.request(base, headers={**self.headers, "Origin": "https://evil.example"})[0], 403)
        self.assertEqual(self.request(base, method="GET")[0], 405)
        with patch.dict(os.environ, {"OUTREACH_SMTP_PASSWORD": ""}):
            self.assertEqual(self.request(base)[0], 503)
        self.assertEqual(self.sent, [])

    def test_shares_the_library_email_rate_limits(self):
        codes = [self.request({"to": "same@example.com", "item": "eng-film-jesus", "from": "Ann"})[0] for _ in range(6)]
        self.assertEqual(codes, [200] * 5 + [429])

    def test_missing_catalogue_reports_503_so_the_page_falls_back(self):
        shutil.rmtree(pathlib.Path(self.root) / "data")
        mail._catalogs.clear()
        self.root = self.root + "/elsewhere"
        self.assertEqual(self.request({"to": "a@example.com", "item": "eng-film-jesus", "from": "Ann"})[0], 503)

    def test_real_catalogue_titles_are_found(self):
        catalog = mail.catalog()
        self.assertGreater(len(catalog), 1000)
        self.assertTrue(all(title for title, _ in catalog.values()))

    def test_email_copy_matches_the_interface_strings(self):
        self.assertEqual(COPY, write_item_mail_copy.extract(), "run python3 packer/write_item_mail_copy.py")
        self.assertEqual(set(COPY["en"]), {"subject", "hello", "hello.anon", "line", "fromto", "from", "open", "pass", "footer"})
        for code, strings in COPY.items():
            self.assertEqual(set(strings), set(COPY["en"]), code)


if __name__ == "__main__":
    unittest.main()
