"""Library switches: public to read, admin-only to change, never fatal to the app."""
import datetime as dt
import json
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch

from packer import analytics as api

NOW = dt.datetime(2026, 10, 12, 12, tzinfo=dt.timezone.utc).timestamp()


class VisibilityTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        db = pathlib.Path(self.directory.name) / "private" / "events.sqlite"
        self.environ = patch.dict(os.environ, {"EASYTRANSFER_ANALYTICS_DB": str(db), "EASYTRANSFER_ADMIN_PASSWORD": "test-only-unique-admin-password", "EASYTRANSFER_ADMIN_SECRET": "test-only-independent-signing-secret"}, clear=True)
        self.environ.start()
        self.headers = {"Host": "localhost:8095", "Origin": "http://localhost:8095", "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin"}

    def tearDown(self):
        self.environ.stop()
        self.directory.cleanup()

    def request(self, path, method="GET", payload=None, headers=None, raw=None):
        body = raw if raw is not None else (json.dumps(payload).encode() if payload is not None else b"")
        return api.dispatch(path, method, headers or self.headers, body, "192.0.2.1", False, now=NOW)

    def cookie(self):
        code, _, headers = self.request("/api/admin", "POST", {"action": "login", "password": os.environ["EASYTRANSFER_ADMIN_PASSWORD"]})
        self.assertEqual(code, 200)
        return {**self.headers, "Cookie": headers["Set-Cookie"].split(";")[0]}

    def test_script_is_public_and_empty_until_saved(self):
        code, body, headers = self.request("/api/visibility")
        self.assertEqual(code, 200)
        self.assertEqual(body, "window.ET_VISIBILITY_LIVE = null;\n")
        self.assertTrue(headers["Content-Type"].startswith("application/javascript"))
        self.assertIn("s-maxage", headers["Cache-Control"])

    def test_only_a_signed_in_admin_can_save(self):
        change = {"action": "save", "types": {"eng": {"historic": True}}, "items": {"eng-text-engkjv": False}}
        self.assertEqual(self.request("/api/visibility", "POST", change)[0], 401)
        self.assertEqual(self.request("/api/visibility", "POST", change, headers={**self.cookie(), "Origin": "https://evil.example"})[0], 403)
        code, body, _ = self.request("/api/visibility", "POST", change, headers=self.cookie())
        self.assertEqual(code, 200)
        self.assertEqual(body["state"]["types"], {"eng": {"historic": True}})
        _, script, _ = self.request("/api/visibility")
        live = json.loads(script[len("window.ET_VISIBILITY_LIVE = "):-2])
        self.assertEqual((live["v"], live["items"]), (1, {"eng-text-engkjv": False}))
        code, body, _ = self.request("/api/visibility?format=json", headers=self.cookie())
        self.assertEqual((code, body["admin"], body["state"]["types"]), (200, True, {"eng": {"historic": True}}))
        self.assertFalse(self.request("/api/visibility?format=json")[1]["admin"])

    def test_rejects_malformed_switches(self):
        headers = self.cookie()
        for bad in (
            {"action": "save", "types": {"english": {"film": True}}},
            {"action": "save", "types": {"eng": {"video": True}}},
            {"action": "save", "types": {"eng": {"film": "yes"}}},
            {"action": "save", "items": {"x": 1}},
            {"action": "save", "items": {"": True}},
            {"action": "save", "extra": {}},
            {"action": "delete"},
        ):
            self.assertEqual(self.request("/api/visibility", "POST", bad, headers=headers)[0], 400, bad)

    def test_large_item_lists_fit_and_apostrophes_are_allowed(self):
        items = {f"eng-scripture-item-{index:06d}-'nne": index % 2 == 0 for index in range(3000)}
        code, body, _ = self.request("/api/visibility", "POST", {"action": "save", "items": items}, headers=self.cookie())
        self.assertEqual(code, 200)
        self.assertEqual(len(body["state"]["items"]), 3000)

    def test_unavailable_storage_never_breaks_the_library(self):
        with patch.object(api, "get_store", side_effect=api.APIError(503, "down")):
            self.assertEqual(self.request("/api/visibility")[:2], (200, "window.ET_VISIBILITY_LIVE = null;\n"))


if __name__ == "__main__":
    unittest.main()
