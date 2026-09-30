"""Exercise consent, privacy, authentication, durable storage and metric meaning."""
import datetime as dt
import json
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch

from packer import analytics as api

NOW = dt.datetime(2026, 9, 30, 12, tzinfo=dt.timezone.utc).timestamp()


def event(index=1, kind="page_view", **metadata):
    return {"id": f"event-{index:08d}", "type": kind, "at": api.iso_at(NOW), "path": "/english", "visitorId": "visitor-00000001", "sessionId": "session-00000001", "language": "eng", **metadata}


class AnalyticsTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.db = pathlib.Path(self.directory.name) / "private" / "events.sqlite"
        self.environ = patch.dict(os.environ, {"EASYTRANSFER_ANALYTICS_DB": str(self.db), "EASYTRANSFER_ADMIN_PASSWORD": "test-only-unique-admin-password", "EASYTRANSFER_ADMIN_SECRET": "test-only-independent-signing-secret"}, clear=True)
        self.environ.start()
        self.headers = {"Host": "localhost:8095", "Origin": "http://localhost:8095", "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin"}

    def tearDown(self):
        self.environ.stop()
        self.directory.cleanup()

    def request(self, path="/api/analytics", method="POST", payload=None, headers=None, production=False, now=NOW):
        return api.dispatch(path, method, self.headers if headers is None else headers, json.dumps(payload).encode() if payload is not None else b"", "192.0.2.123", production, now=now)

    def collect(self, events):
        return self.request(payload={"consent": {"version": 1, "analytics": True}, "events": events})

    def login(self):
        code, body, headers = self.request("/api/admin", payload={"action": "login", "password": os.environ["EASYTRANSFER_ADMIN_PASSWORD"]})
        self.assertEqual((code, body), (200, {"ok": True}))
        return headers["Set-Cookie"]

    def admin(self, days=7, cookie=None):
        return self.request(f"/api/admin?days={days}", "GET", headers={**self.headers, "Cookie": cookie or self.login()})

    def test_rejects_without_specific_valid_consent_and_stores_nothing(self):
        for consent in (None, {}, {"version": 1, "analytics": False}, {"version": True, "analytics": True}, {"version": 1, "analytics": True, "extra": True}):
            with self.subTest(consent=consent):
                code, _, _ = self.request(payload={"consent": consent, "events": [event()]})
                self.assertEqual(code, 400)
        self.assertFalse(self.db.exists())

    def test_unknown_fields_identifiers_and_types_rejected(self):
        for metadata in ({"email": "person@example.test"}, {"latitude": 1}, {"id": "bad@example.test"}, {"type": []}, {"type": {}}, {"type": "secret_event"}, {"language": "visitor-0001"}, {"language": "ENG"}, {"resource": "Full resource name"}, {"channel": "a-private-email"}, {"bytes": True}, {"duration": float("nan")}, {"status": "recipient@example.test"}):
            with self.subTest(metadata=metadata):
                self.assertEqual(self.collect([event(**metadata)])[0], 400)

    def test_bounds_batches_body_timestamps_and_routes(self):
        self.assertEqual(self.collect([])[0], 400)
        self.assertEqual(self.collect([event(i) for i in range(41)])[0], 400)
        self.assertEqual(api.dispatch("/api/analytics", "POST", self.headers, b" " * (api.MAX_BODY + 1), now=NOW)[0], 413)
        self.assertEqual(api.dispatch("/api/analytics", "POST", self.headers, b"[" * 2000 + b"]" * 2000, now=NOW)[0], 400)
        for at in (api.iso_at(NOW - api.RETENTION_SECONDS), api.iso_at(NOW + 301), "2026-09-30T12:00:00", "nonsense"):
            self.assertEqual(self.collect([event(at=at)])[0], 400)
        for path in ("/admin", "/api/admin", "/../secret", "/english//private", "/person@example.test"):
            self.assertEqual(self.collect([event(path=path)])[0], 400)

    def test_query_referrer_and_private_fields_are_not_persisted(self):
        code, payload, _ = self.collect([event(path="/english?email=person@example.test#private", referrer="https://person:password@referral.example.test/private?email=secret@example.test#frag")])
        self.assertEqual((code, payload["accepted"]), (200, 1))
        stored, _ = api.SQLiteStore(self.db).read(0, NOW)
        self.assertEqual(stored[0]["path"], "/english")
        self.assertEqual(stored[0]["referrer"], "referral.example.test")
        text = self.db.read_bytes()
        for private in (b"person@example.test", b"secret@example.test", b"password@", b"192.0.2.123"):
            self.assertNotIn(private, text)
        self.assertEqual(stored[0]["country"], "")

    def test_country_is_only_taken_from_production_platform_header(self):
        headers = {**self.headers, "x-vercel-ip-country": "US"}
        self.assertEqual(self.request(payload={"consent": {"version": 1, "analytics": True}, "events": [event()]}, headers=headers)[0], 200)
        stored, _ = api.SQLiteStore(self.db).read(0, NOW)
        self.assertEqual(stored[0]["country"], "")
        with patch.object(api, "get_store", return_value=api.SQLiteStore(self.db)):
            headers.update({"Host": "demo.example.test", "Origin": "https://demo.example.test"})
            self.assertEqual(self.request(payload={"consent": {"version": 1, "analytics": True}, "events": [event(2)]}, headers=headers, production=True)[0], 200)
        self.assertEqual(api.SQLiteStore(self.db).read(0, NOW)[0][0]["country"], "US")

    def test_deduplication_retention_and_calendar_window(self):
        self.assertEqual(self.collect([event(), event()])[1], {"ok": True, "accepted": 1, "duplicates": 1})
        self.assertEqual(self.collect([event()])[1]["accepted"], 0)
        self.assertEqual(self.collect([event(2, at=api.iso_at(NOW - 7 * 86400))])[0], 200)
        self.assertEqual(self.admin()[1]["summary"]["pageViews"], 1)
        self.assertEqual(self.admin(30)[1]["summary"]["pageViews"], 2)
        store = api.SQLiteStore(self.db)
        store.append([event(3, at=api.iso_at(NOW - api.RETENTION_SECONDS - 1))], NOW)
        self.assertEqual(len(store.read(0, NOW)[0]), 2)

    def test_same_origin_on_both_post_endpoints(self):
        for path, payload in (("/api/analytics", {"consent": {"version": 1, "analytics": True}, "events": [event()]}), ("/api/admin", {"action": "login", "password": "guess"}), ("/api/admin", {"action": "logout"})):
            for headers in ({**self.headers, "Origin": "https://evil.example.test"}, {key: value for key, value in self.headers.items() if key != "Origin"}, {**self.headers, "Origin": "http://localhost:8095@evil.example.test"}, {**self.headers, "Sec-Fetch-Site": "cross-site"}):
                with self.subTest(path=path, origin=headers.get("Origin")):
                    self.assertEqual(self.request(path, payload=payload, headers=headers)[0], 403)
        self.assertEqual(self.request(payload={}, headers={**self.headers, "Content-Type": "text/plain"})[0], 415)

    def test_authentication_cookie_tamper_expiry_rotation_and_logout(self):
        self.assertEqual(self.request("/api/admin", "GET")[0], 401)
        self.assertEqual(self.request("/api/admin", payload={"action": "login", "password": "guess"})[0], 401)
        cookie = self.login()
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Strict", cookie)
        self.assertIn("Max-Age=43200", cookie)
        self.assertEqual(self.admin(cookie=cookie)[0], 200)
        tampered = cookie.replace("et_admin=", "et_admin=x")
        self.assertEqual(self.admin(cookie=tampered)[0], 401)
        self.assertEqual(self.request("/api/admin", "GET", headers={**self.headers, "Cookie": cookie}, now=NOW + api.SESSION_SECONDS + 1)[0], 401)
        with patch.dict(os.environ, {"EASYTRANSFER_ADMIN_PASSWORD": "rotated-test-only-password"}):
            self.assertEqual(self.admin(cookie=cookie)[0], 401)
        code, _, headers = self.request("/api/admin", payload={"action": "logout"})
        self.assertEqual(code, 200)
        self.assertIn("Max-Age=0", headers["Set-Cookie"])
        self.assertIn("Secure", api.cookie_header("test", True))

    def test_unconfigured_admin_and_production_storage_fail_closed(self):
        with patch.dict(os.environ, {"EASYTRANSFER_ADMIN_PASSWORD": ""}):
            self.assertEqual(self.request("/api/admin", "GET")[0], 503)
            self.assertEqual(self.request("/api/admin", payload={"action": "login", "password": ""})[0], 503)
        headers = {**self.headers, "Host": "demo.example.test", "Origin": "https://demo.example.test"}
        code, body, _ = self.request(payload={"consent": {"version": 1, "analytics": True}, "events": [event()]}, headers=headers, production=True)
        self.assertEqual(code, 503)
        self.assertIn("UPSTASH_REDIS", body["error"])
        self.assertFalse(self.db.exists())

    def test_login_and_ingestion_limits_are_enforced_and_expire(self):
        for _ in range(10):
            self.assertEqual(self.request("/api/admin", payload={"action": "login", "password": "guess"})[0], 401)
        self.assertEqual(self.request("/api/admin", payload={"action": "login", "password": "guess"})[0], 429)
        self.assertEqual(self.request("/api/admin", payload={"action": "login", "password": "guess"}, now=NOW + 601)[0], 401)
        for _ in range(120):
            self.assertEqual(self.collect([event()])[0], 200)
        self.assertEqual(self.collect([event()])[0], 429)
        self.assertEqual(self.request(payload={"consent": {"version": 1, "analytics": True}, "events": [event(2)]}, now=NOW + 61)[0], 200)

    def test_summary_does_not_claim_external_handoffs_or_sender_receipts(self):
        events = [event(1), event(2, "session_start"), event(3, "share_intent", channel="copy_link"), event(4, "share_complete", channel="copy_link", status="copied"), event(5, "share_complete", channel="native_share", status="handed_off"), event(6, "download_complete", status="saved"), event(7, "download_complete", status="browser_handoff"), event(8, "transfer_complete", status="sent"), event(9, "transfer_complete", status="received"), event(10, "resource_open", resource="eng-film-demo"), event(11, "shared_visit", shareId="share-00000001")]
        self.assertEqual(self.collect(events)[0], 200)
        code, data, headers = self.admin()
        self.assertEqual(code, 200)
        self.assertEqual(data["summary"], {"visitors": 1, "sessions": 1, "pageViews": 1, "shareIntents": 1, "shareCompletions": 1, "sharedVisits": 1, "downloads": 1, "transfers": 1})
        self.assertEqual(len(data["daily"]), 7)
        self.assertEqual(data["daily"][-1], {"date": "2026-09-30", "visits": 1, "shares": 1})
        self.assertEqual(data["resources"], [{"name": "eng-film-demo", "count": 1}])
        self.assertEqual(data["countries"], [{"name": "Unknown", "count": 1}])
        self.assertEqual(headers["Cache-Control"], "no-store")
        for days in ("1", "bad", "7&days=90", "30&extra=1"):
            self.assertEqual(self.admin(days)[0], 400)

    def test_aggregation_and_recent_list_truncation_are_distinct(self):
        store = api.SQLiteStore(self.db)
        store.append([event(i) for i in range(501)], NOW)
        code, result, _ = self.admin()
        self.assertEqual(code, 200)
        self.assertEqual(result["summary"]["pageViews"], 501)
        self.assertEqual(len(result["events"]), 500)
        self.assertFalse(result["truncated"])
        self.assertTrue(result["recentEventsTruncated"])
        with patch.object(api, "MAX_ANALYSIS_EVENTS", 100):
            result = self.admin()[1]
            self.assertTrue(result["truncated"])
            self.assertEqual(result["analyzedEvents"], 100)
            self.assertEqual(result["summary"]["pageViews"], 100)

    def test_refuses_a_public_database_path(self):
        with patch.dict(os.environ, {"EASYTRANSFER_ANALYTICS_DB": str(pathlib.Path(self.directory.name) / "public" / "events.sqlite")}):
            code, _, _ = api.dispatch("/api/analytics", "POST", self.headers, json.dumps({"consent": {"version": 1, "analytics": True}, "events": [event()]}).encode(), public_root=pathlib.Path(self.directory.name) / "public", now=NOW)
            self.assertEqual(code, 503)

    def test_redis_failures_are_safe_and_never_expose_credentials(self):
        store = api.RedisStore("https://storage.example.test", "private-storage-token")
        with patch("urllib.request.urlopen", side_effect=OSError("private-storage-token")):
            with self.assertRaises(api.APIError) as raised:
                store.read(0, NOW)
        self.assertEqual(raised.exception.status, 503)
        self.assertNotIn("private-storage-token", raised.exception.message)
        with self.assertRaises(api.APIError):
            api.RedisStore("http://storage.example.test", "private-storage-token")

    def test_local_maintenance_removes_expired_records_and_rate_keys(self):
        store = api.SQLiteStore(self.db)
        store.append([event()], NOW)
        store.rate("temporary-key", 1, 60, NOW)
        with patch.object(api.time, "time", return_value=NOW + api.RETENTION_SECONDS + 1):
            api.purge_local()
        with store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM events").fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM limits").fetchone()[0], 0)
        self.assertNotIn(b"visitor-00000001", self.db.read_bytes())

    def test_production_redis_http_commands_and_response_handling(self):
        import io
        store = api.RedisStore("https://storage.example.test", "test-only-token")
        cleaned = api.validate_events({"consent": {"version": 1, "analytics": True}, "events": [event()]}, NOW, "US")
        outgoing = []

        def response_for(data):
            def mock_urlopen(request, timeout):
                outgoing.append((request.full_url, json.loads(request.data), request.get_header("Authorization"), timeout))
                return io.BytesIO(json.dumps(data).encode())
            return mock_urlopen

        with patch("urllib.request.urlopen", side_effect=response_for({"result": 1})):
            self.assertEqual(store.append(cleaned, NOW), 1)
        url, command, auth, timeout = outgoing[-1]
        self.assertEqual(url, "https://storage.example.test")
        self.assertEqual(command[:1], ["EVAL"])
        self.assertIn("'NX'", command[1])
        self.assertIn("'ZADD'", command[1])
        self.assertIn("'EXPIRE'", command[1])
        self.assertEqual(command[2:4], [1, api.PREFIX + "index"])
        self.assertEqual(command[5:7], [NOW, api.RETENTION_SECONDS])
        entry = json.loads(command[4])[0]
        self.assertEqual(entry["id"], cleaned[0]["id"])
        self.assertEqual(json.loads(entry["body"]), cleaned[0])
        self.assertEqual((auth, timeout), ("Bearer test-only-token", 8))
        with patch("urllib.request.urlopen", side_effect=response_for({"result": 0})):
            self.assertEqual(store.append(cleaned, NOW), 0)
        with patch("urllib.request.urlopen", side_effect=response_for({"result": 121})):
            self.assertFalse(store.rate("opaque-test-key", 120, 60, NOW))
        responses = [io.BytesIO(json.dumps({"result": [cleaned[0]["id"]]}).encode()), io.BytesIO(json.dumps([{"result": [json.dumps(cleaned[0])]}]).encode())]
        with patch("urllib.request.urlopen", side_effect=responses) as network:
            loaded, truncated = store.read(NOW - 86400, NOW)
        self.assertEqual(loaded, cleaned)
        self.assertFalse(truncated)
        request = network.call_args_list[-1][0][0]
        self.assertEqual(request.full_url, "https://storage.example.test/pipeline")
        self.assertEqual(json.loads(request.data), [["MGET", api.PREFIX + "event:" + cleaned[0]["id"]]])
        for reply in ({"error": "secret service detail"}, [], {"result": None}):
            with patch("urllib.request.urlopen", side_effect=response_for(reply)):
                with self.assertRaises(api.APIError) as failure:
                    store.read(NOW - 86400, NOW)
                self.assertEqual(failure.exception.status, 503)


if __name__ == "__main__":
    unittest.main()
