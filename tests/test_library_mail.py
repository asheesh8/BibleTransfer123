"""Emailing a language library: fixed template, validated input, rate limits."""
import datetime as dt
import glob
import json
import os
import pathlib
import re
import tempfile
import unittest
from unittest.mock import patch

from packer import library_mail as mail

NOW = dt.datetime(2026, 10, 14, 12, tzinfo=dt.timezone.utc).timestamp()
ROOT = pathlib.Path(__file__).resolve().parent.parent
SMTP = {"OUTREACH_SMTP_HOST": "smtp.example.org", "OUTREACH_SMTP_USER": "outreach@example.org", "OUTREACH_SMTP_PASSWORD": "test-only-password"}


class LibraryMailTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        db = pathlib.Path(self.directory.name) / "private" / "events.sqlite"
        self.environ = patch.dict(os.environ, {"EASYTRANSFER_ANALYTICS_DB": str(db), "EASYTRANSFER_ADMIN_SECRET": "test-only-secret", **SMTP}, clear=True)
        self.environ.start()
        self.headers = {"Host": "localhost:8095", "Origin": "http://localhost:8095", "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin"}
        self.sent = []

    def tearDown(self):
        self.environ.stop()
        self.directory.cleanup()

    def request(self, payload, headers=None, ip="192.0.2.1", method="POST"):
        return mail.dispatch("/api/send-library", method, headers or self.headers, json.dumps(payload).encode(), ip, False, now=NOW,
                             send=lambda settings, message: self.sent.append((settings, message)))

    def test_sends_the_fixed_library_message(self):
        code, body, _ = self.request({"to": "friend@example.com", "library": "english", "shareId": "abcdef123456"})
        self.assertEqual((code, body), (200, {"ok": True}))
        settings, message = self.sent[0]
        self.assertEqual(message["To"], "friend@example.com")
        self.assertEqual(message["Subject"], "English Bible Library")
        self.assertIn("VillageServer Outreach", message["From"])
        text = message.get_body(("plain",)).get_content()
        self.assertIn("http://localhost:8095/english?et_share=abcdef123456&et_channel=email", text)

    def test_native_name_and_configured_sender(self):
        with patch.dict(os.environ, {"OUTREACH_FROM_NAME": "Village Team", "OUTREACH_FROM_EMAIL": "hello@example.org", "EASYTRANSFER_PUBLIC_ORIGIN": "https://site.example"}):
            headers = {**self.headers, "Origin": "https://site.example"}
            self.assertEqual(self.request({"to": "a@example.com", "library": "french"}, headers=headers)[0], 200)
        message = self.sent[0][1]
        self.assertEqual(message["Subject"], "French (Français) Bible Library")
        self.assertEqual(message["From"], "Village Team <hello@example.org>")
        self.assertIn("https://site.example/french\n", message.get_body(("plain",)).get_content())

    def test_rejects_bad_input_without_sending(self):
        for payload in ({"to": "not-an-address", "library": "english"},
                        {"to": "a@example.com\r\nBcc: b@example.com", "library": "english"},
                        {"to": "a@example.com", "library": "../admin"},
                        {"to": "a@example.com", "library": "english", "message": "spam"},
                        {"to": "a@example.com", "library": "english", "shareId": "<bad>"}):
            self.assertEqual(self.request(payload)[0], 400, payload)
        self.assertEqual(self.sent, [])

    def test_requires_same_origin_post(self):
        self.assertEqual(self.request({"to": "a@example.com", "library": "english"}, headers={**self.headers, "Origin": "https://evil.example"})[0], 403)
        self.assertEqual(self.request({"to": "a@example.com", "library": "english"}, method="GET")[0], 405)
        self.assertEqual(self.sent, [])

    def test_unconfigured_smtp_reports_503_so_the_page_falls_back(self):
        with patch.dict(os.environ, {"OUTREACH_SMTP_PASSWORD": ""}):
            self.assertEqual(self.request({"to": "a@example.com", "library": "english"})[0], 503)

    def test_rate_limits_per_recipient_and_visitor(self):
        codes = [self.request({"to": "same@example.com", "library": "english"})[0] for _ in range(6)]
        self.assertEqual(codes, [200] * 5 + [429])
        codes = [self.request({"to": f"p{n}@example.com", "library": "english"}, ip="192.0.2.9")[0] for n in range(21)]
        self.assertEqual(codes, [200] * 20 + [429])

    def test_one_address_cannot_spend_the_whole_day_by_waiting_out_the_hour(self):
        send = lambda settings, message: self.sent.append(message)
        codes = [mail.dispatch("/api/send-library", "POST", self.headers, json.dumps({"to": f"p{n}@example.com", "library": "english"}).encode(),
                               "192.0.2.10", False, now=NOW + 3601 * (n // 20), send=send)[0] for n in range(41)]
        self.assertEqual(codes, [200] * 40 + [429])

    def test_send_failure_does_not_describe_the_mail_setup(self):
        def refuse(settings, port, message, context, progress):
            raise mail.smtplib.SMTPServerDisconnected()
        with patch.object(mail, "_send_once", refuse), patch("sys.stderr"):
            with self.assertRaises(mail.APIError) as failure:
                mail.deliver({"port": 587, "host": "smtp.example.org"}, None)
        self.assertEqual(failure.exception.status, 502)
        self.assertEqual(failure.exception.message, "The email could not be sent right now.")

    def test_wrong_port_falls_back_to_the_other_standard_port(self):
        tried = []
        def attempt(settings, port, message, context, progress):
            tried.append(port)
            if port == 465:
                raise mail.smtplib.SMTPServerDisconnected()
        with patch.object(mail, "_send_once", attempt):
            mail.deliver({"port": 465}, None)
        self.assertEqual(tried, [465, 587])

    def test_app_password_spaces_are_removed(self):
        with patch.dict(os.environ, {"OUTREACH_SMTP_PASSWORD": " abcd efgh ijkl mnop "}):
            self.assertEqual(mail.smtp_settings()["password"], "abcdefghijklmnop")

    def test_every_language_page_is_known(self):
        pages = {}
        for path in glob.glob(str(ROOT / "app" / "*" / "index.html")):
            found = re.search(r"ET_SHARED_LIBRARY = (\{[^;]*\})", pathlib.Path(path).read_text(encoding="utf-8"))
            if found:
                data = json.loads(found.group(1))
                pages[data["slug"]] = (data["name"], data["native"])
        self.assertEqual(mail.LIBRARIES, pages)


if __name__ == "__main__":
    unittest.main()
