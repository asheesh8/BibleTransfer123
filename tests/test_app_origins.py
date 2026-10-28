"""The iPhone and Android apps may call the public POST endpoints, never admin."""
import datetime as dt
import json
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch

from packer import analytics as api
from packer import item_mail, library_mail

NOW = dt.datetime(2026, 10, 28, 12, tzinfo=dt.timezone.utc).timestamp()
SMTP = {"OUTREACH_SMTP_HOST": "smtp.example.org", "OUTREACH_SMTP_USER": "outreach@example.org", "OUTREACH_SMTP_PASSWORD": "test-only-password"}
IOS, ANDROID = "capacitor://localhost", "https://localhost"


def app_headers(origin):
    # A WebView calling the site from bundled pages: cross-site, with the site as Host.
    return {"Host": "www.bibletransfer123.org", "Origin": origin, "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site"}


def preflight_headers(origin):
    return {"Host": "www.bibletransfer123.org", "Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"}


def event():
    return {"id": "event-00000001", "type": "page_view", "at": api.iso_at(NOW), "path": "/english", "visitorId": "visitor-00000001", "sessionId": "session-00000001"}


class AppOriginTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        db = pathlib.Path(self.directory.name) / "private" / "events.sqlite"
        self.environ = patch.dict(os.environ, {"EASYTRANSFER_ANALYTICS_DB": str(db), "EASYTRANSFER_ADMIN_PASSWORD": "test-only-admin-password",
                                               "EASYTRANSFER_ADMIN_SECRET": "test-only-secret", **SMTP}, clear=True)
        self.environ.start()
        self.sent = []

    def tearDown(self):
        self.environ.stop()
        self.directory.cleanup()

    def analytics(self, method, headers, payload=None):
        return api.dispatch("/api/analytics", method, headers, json.dumps(payload).encode() if payload else b"", "192.0.2.1", True, now=NOW)

    def library(self, method, headers):
        return library_mail.dispatch("/api/send-library", method, headers, json.dumps({"to": "friend@example.com", "library": "english"}).encode(),
                                     "192.0.2.1", True, now=NOW, send=lambda settings, message: self.sent.append(message))

    def test_preflight_from_the_apps_is_answered_for_public_endpoints(self):
        for origin in (IOS, ANDROID):
            for code, body, headers in (self.analytics("OPTIONS", preflight_headers(origin)), self.library("OPTIONS", preflight_headers(origin)),
                                        item_mail.dispatch("/api/send-item", "OPTIONS", preflight_headers(origin), b"", "192.0.2.1", True, now=NOW)):
                self.assertEqual((code, body), (204, ""))
                self.assertEqual(headers["Access-Control-Allow-Origin"], origin)
                self.assertEqual(headers["Access-Control-Allow-Headers"], "Content-Type")
                self.assertEqual(headers["Vary"], "Origin")

    def test_preflight_from_any_other_origin_is_refused(self):
        for origin in ("https://evil.example", "capacitor://evil", "http://localhost", ""):
            code, _, headers = self.library("OPTIONS", preflight_headers(origin))
            self.assertEqual(code, 403, origin)
            self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_apps_can_send_analytics_and_emails(self):
        store = api.SQLiteStore(api.local_db_path())
        with patch("packer.analytics.get_store", return_value=store), patch("packer.library_mail.get_store", return_value=store):
            code, _, headers = self.analytics("POST", app_headers(IOS), {"consent": {"version": 1, "analytics": True}, "events": [event()]})
            self.assertEqual(code, 200)
            self.assertEqual(headers["Access-Control-Allow-Origin"], IOS)
            code, _, headers = self.library("POST", app_headers(ANDROID))
        self.assertEqual(code, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], ANDROID)
        self.assertIn("https://www.bibletransfer123.org/english", self.sent[0].get_body(("plain",)).get_content())

    def test_apps_cannot_use_admin_endpoints(self):
        login = json.dumps({"action": "login", "password": os.environ["EASYTRANSFER_ADMIN_PASSWORD"]}).encode()
        for path in ("/api/admin", "/api/visibility"):
            code, _, headers = api.dispatch(path, "POST", app_headers(IOS), login, "192.0.2.1", True, now=NOW)
            self.assertEqual(code, 403, path)
            self.assertNotIn("Access-Control-Allow-Origin", headers)
        self.assertEqual(api.dispatch("/api/admin", "OPTIONS", preflight_headers(IOS), b"", "192.0.2.1", True, now=NOW)[0], 405)

    def test_other_sites_are_still_refused(self):
        self.assertEqual(self.library("POST", app_headers("https://evil.example"))[0], 403)
        self.assertEqual(self.sent, [])


if __name__ == "__main__":
    unittest.main()
