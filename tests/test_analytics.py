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
        for at in ("2026-09-30T12:00:00", "nonsense"):
            self.assertEqual(self.collect([event(at=at)])[0], 400)
        # A phone with a wrong clock is still counted, at the time the event arrives.
        for index, at in enumerate((api.iso_at(NOW - api.RETENTION_SECONDS), api.iso_at(NOW + 301)), 50):
            code, payload, _ = self.collect([event(index, at=at)])
            self.assertEqual((code, payload["accepted"]), (200, 1))
        stored, _ = api.SQLiteStore(self.db).read(0, NOW + 1)
        self.assertEqual({row["at"] for row in stored if row["id"] in ("event-00000050", "event-00000051")}, {api.iso_at(NOW)})
        for path in ("/admin", "/api/admin", "/../secret", "/english//private", "/person@example.test"):
            self.assertEqual(self.collect([event(path=path)])[0], 400)

    def test_one_bad_event_does_not_drop_the_rest_of_the_batch(self):
        code, payload, _ = self.collect([event(1), event(2, status="recipient@example.test"), event(3, "resource_open", resource="cmn-hist-1840-new-testament-vol.-1-4")])
        self.assertEqual((code, payload["accepted"], payload["rejected"]), (200, 2, 1))

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
        self.assertEqual(self.collect([event(), event()])[1], {"ok": True, "accepted": 1, "duplicates": 1, "rejected": 0})
        self.assertEqual(self.collect([event()])[1]["accepted"], 0)
        self.assertEqual(self.collect([event(2, at=api.iso_at(NOW - 7 * 86400))])[0], 200)
        self.assertEqual(self.admin()[1]["summary"]["pageViews"], 1)
        self.assertEqual(self.admin(30)[1]["summary"]["pageViews"], 2)
        store = api.SQLiteStore(self.db)
        store.append([event(3, at=api.iso_at(NOW - api.RETENTION_SECONDS - 1))], NOW)
        self.assertEqual(len(store.read(0, NOW)[0]), 2)

    def test_filters_comparison_heatmap_and_people(self):
        cookie = self.login()
        # Country only ever comes from the platform header, so store directly.
        api.SQLiteStore(self.db).append([
            event(1, country="KE"),
            event(2, "resource_open", resource="jesus-film", country="KE"),
            event(3, "play", resource="jesus-film", country="KE"),
            event(4, visitorId="visitor-00000002", sessionId="session-00000002", language="spa"),
            event(5, "shared_visit", visitorId="visitor-00000002", sessionId="session-00000002", language="spa", channel="copy_link"),
            event(6, at=api.iso_at(NOW - 9 * 86400)),
        ], NOW)
        get = lambda query: self.request("/api/admin?" + query, "GET", headers={**self.headers, "Cookie": cookie})
        code, body = get("days=7")[:2]
        self.assertEqual(code, 200)
        self.assertEqual(body["totals"]["visitors"], 2)
        self.assertEqual(body["totals"]["plays"], 1)
        self.assertEqual(body["previous"]["pageViews"], 1)
        self.assertEqual(body["filters"], {})
        wednesday = [row for row in body["weekHours"] if row["day"] == "Wed"][0]
        self.assertEqual(wednesday["hours"][12], 2)
        people = {row["id"]: row for row in body["visitorTable"]}
        self.assertEqual(people["visitor-00000001"]["opens"], 1)
        self.assertEqual(people["visitor-00000001"]["plays"], 1)
        self.assertEqual(people["visitor-00000001"]["lastResource"], "jesus-film")
        self.assertTrue(people["visitor-00000002"]["arrivedByShare"])
        self.assertEqual(people["visitor-00000002"]["language"], "spa")
        filtered = get("days=7&language=spa")[1]
        self.assertEqual((filtered["totals"]["visitors"], filtered["filters"]), (1, {"language": "spa"}))
        self.assertEqual(filtered["previous"]["pageViews"], 0)
        self.assertEqual(get("days=7&country=Unknown")[1]["totals"]["pageViews"], 1)
        self.assertEqual(get("days=7&resource=jesus-film")[1]["totals"]["opens"], 1)
        self.assertEqual(len(get("days=7&visitor=visitor-00000002")[1]["events"]), 2)
        self.assertIsNone(get("days=90")[1]["previous"])
        for query in ("days=7&country=kenya", "days=7&language=eng&language=spa", "days=7&color=red", "days=7&visitor=x"):
            self.assertEqual(get(query)[0], 400)

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

    def test_production_storage_resolves_only_complete_credential_pairs(self):
        direct = {"UPSTASH_REDIS_REST_URL": "https://direct.example.test", "UPSTASH_REDIS_REST_TOKEN": "test-direct-write-token"}
        native = {"KV_REST_API_URL": "https://native.example.test", "KV_REST_API_TOKEN": "test-native-write-token"}
        cases = (
            (direct, (direct["UPSTASH_REDIS_REST_URL"], direct["UPSTASH_REDIS_REST_TOKEN"])),
            (native, (native["KV_REST_API_URL"], native["KV_REST_API_TOKEN"])),
            ({**native, **direct}, (direct["UPSTASH_REDIS_REST_URL"], direct["UPSTASH_REDIS_REST_TOKEN"])),
            ({**native, "UPSTASH_REDIS_REST_URL": direct["UPSTASH_REDIS_REST_URL"]}, (native["KV_REST_API_URL"], native["KV_REST_API_TOKEN"])),
            ({**native, "KV_REST_API_READ_ONLY_TOKEN": "test-readonly-token"}, (native["KV_REST_API_URL"], native["KV_REST_API_TOKEN"])),
        )
        for environment, expected in cases:
            with self.subTest(keys=sorted(environment)), patch.dict(os.environ, environment, clear=True), patch.object(api, "RedisStore") as constructor:
                self.assertIs(api.get_store(True), constructor.return_value)
                constructor.assert_called_once_with(*expected)
        incomplete = (
            {},
            {"UPSTASH_REDIS_REST_URL": direct["UPSTASH_REDIS_REST_URL"], "KV_REST_API_TOKEN": native["KV_REST_API_TOKEN"]},
            {"KV_REST_API_URL": native["KV_REST_API_URL"], "UPSTASH_REDIS_REST_TOKEN": direct["UPSTASH_REDIS_REST_TOKEN"]},
            {"KV_REST_API_URL": native["KV_REST_API_URL"], "KV_REST_API_READ_ONLY_TOKEN": "test-readonly-token"},
            {"KV_REST_API_URL": native["KV_REST_API_URL"], "KV_REST_API_TOKEN": ""},
        )
        for environment in incomplete:
            with self.subTest(keys=sorted(environment)), patch.dict(os.environ, environment, clear=True), patch.object(api, "RedisStore") as constructor:
                with self.assertRaises(api.APIError) as failure:
                    api.get_store(True)
                self.assertEqual(failure.exception.status, 503)
                self.assertIn("KV_REST_API_URL", failure.exception.message)
                constructor.assert_not_called()

    def test_native_write_token_stabilizes_abuse_keys_without_admin_configuration(self):
        with patch.dict(os.environ, {"KV_REST_API_TOKEN": "test-native-write-token"}, clear=True):
            first = api.rate_key("events", "192.0.2.123", NOW)
            with patch.object(api, "_EPHEMERAL_KEY", b"different-function-instance"):
                self.assertEqual(api.rate_key("events", "192.0.2.123", NOW), first)

    def test_login_and_ingestion_limits_are_enforced_and_expire(self):
        for _ in range(10):
            self.assertEqual(self.request("/api/admin", payload={"action": "login", "password": "guess"})[0], 401)
        self.assertEqual(self.request("/api/admin", payload={"action": "login", "password": "guess"})[0], 429)
        self.assertEqual(self.request("/api/admin", payload={"action": "login", "password": "guess"}, now=NOW + 601)[0], 401)
        for _ in range(120):
            self.assertEqual(self.collect([event()])[0], 200)
        self.assertEqual(self.collect([event()])[0], 429)
        self.assertEqual(self.request(payload={"consent": {"version": 1, "analytics": True}, "events": [event(2)]}, now=NOW + 61)[0], 200)

    def test_password_guesses_from_many_addresses_hit_a_site_wide_ceiling(self):
        guess = json.dumps({"action": "login", "password": "guess"}).encode()
        codes = [api.dispatch("/api/admin", "POST", self.headers, guess, f"198.51.100.{n}", now=NOW)[0] for n in range(101)]
        self.assertEqual(codes, [401] * 100 + [429])
        # Even the right password waits out the hour, so a botnet gains nothing.
        right = json.dumps({"action": "login", "password": os.environ["EASYTRANSFER_ADMIN_PASSWORD"]}).encode()
        self.assertEqual(api.dispatch("/api/admin", "POST", self.headers, right, "203.0.113.1", now=NOW)[0], 429)
        self.assertEqual(api.dispatch("/api/admin", "POST", self.headers, right, "203.0.113.1", now=NOW + 3601)[0], 200)

    def test_one_address_has_a_daily_ceiling_on_analytics_requests(self):
        self.assertIn(("events-day", 3000, 86400, "ip"), api.EVENT_LIMITS)
        body = lambda n: json.dumps({"consent": {"version": 1, "analytics": True}, "events": [event(n)]}).encode()
        with patch.object(api, "EVENT_LIMITS", (("events", 4, 60, "ip"), ("events-day", 10, 86400, "ip"))):
            codes = [api.dispatch("/api/analytics", "POST", self.headers, body(n), "192.0.2.50", now=NOW + 61 * (n // 4))[0] for n in range(11)]
        self.assertEqual(codes, [200] * 10 + [429])

    def test_events_from_every_address_together_have_a_daily_ceiling(self):
        batch = lambda n: json.dumps({"consent": {"version": 1, "analytics": True}, "events": [event(n * 10 + k) for k in range(10)]}).encode()
        with patch.object(api, "SITE_EVENTS_PER_DAY", 25):
            codes = [api.dispatch("/api/analytics", "POST", self.headers, batch(n), f"198.51.100.{n}", now=NOW)[0] for n in range(3)]
        self.assertEqual(codes, [200, 200, 429])
        with api.SQLiteStore(self.db).connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM events").fetchone()[0], 20)

    def test_sharing_chain_follows_passed_on_links_back_to_the_first_share(self):
        visitor = lambda n: {"visitorId": f"visitor-{n:08d}", "sessionId": f"session-{n:08d}"}
        events = [
            event(1, "share_intent", channel="whatsapp", resource="eng-film-jesus", shareId="share-00000001", depth=1, **visitor(1)),
            event(2, "shared_visit", shareId="share-00000001", **visitor(2)),
            event(3, "share_intent", channel="email", resource="eng-film-jesus", shareId="share-00000002", parentShareId="share-00000001", depth=2, **visitor(2)),
            event(4, "shared_visit", shareId="share-00000002", **visitor(3)),
            event(5, "share_intent", channel="whatsapp", resource="eng-film-jesus", shareId="share-00000003", parentShareId="share-00000002", depth=3, **visitor(3)),
            # Someone in between declined analytics: the link still says step 4.
            event(6, "share_intent", channel="copy_link", resource="eng-film-jesus", shareId="share-00000004", parentShareId="share-00000099", depth=4, **visitor(4)),
            event(7, "share_intent", channel="copy_link", resource="eng-book-x", shareId="share-00000005", **visitor(5)),
        ]
        self.assertEqual(self.collect(events)[0], 200)
        chains = self.admin()[1]["shareChains"]
        self.assertEqual((chains["shares"], chains["passedOn"], chains["longest"], chains["chains"]), (5, 3, 4, 2))
        self.assertEqual(chains["byDepth"], [{"name": "1", "count": 2}, {"name": "2", "count": 1}, {"name": "3", "count": 1}, {"name": "4", "count": 1}])
        top = chains["top"][0]
        self.assertEqual((top["root"], top["resource"], top["shares"], top["depth"], top["sharers"], top["visits"]), ("share-00000001", "eng-film-jesus", 3, 3, 3, 2))

    def test_chain_fields_are_validated(self):
        for metadata in ({"depth": 0}, {"depth": 1000}, {"depth": "2"}, {"depth": True}, {"parentShareId": "<bad>"},
                         {"shareId": "share-00000001", "parentShareId": "share-00000001"}):
            with self.assertRaises(api.APIError, msg=metadata):
                api.clean_event(event(1, "share_intent", **metadata), NOW, "")
        self.assertEqual(api.clean_event(event(1, "share_intent", depth=3, parentShareId="share-00000001"), NOW, "")["depth"], 3)

    def test_summary_does_not_claim_external_handoffs_or_sender_receipts(self):
        events = [event(1), event(2, "session_start"), event(3, "share_intent", channel="copy_link"), event(4, "share_complete", channel="copy_link", status="copied"), event(5, "share_complete", channel="native_share", status="handed_off"), event(6, "download_complete", status="saved"), event(7, "download_complete", status="browser_handoff"), event(8, "transfer_complete", status="sent"), event(9, "transfer_complete", status="received"), event(10, "resource_open", resource="eng-film-demo"), event(11, "shared_visit", shareId="share-00000001")]
        self.assertEqual(self.collect(events)[0], 200)
        code, data, headers = self.admin()
        self.assertEqual(code, 200)
        self.assertEqual(data["summary"], {"visitors": 1, "sessions": 1, "pageViews": 1, "shareIntents": 1, "shareCompletions": 1, "sharedVisits": 1, "downloads": 1, "transfers": 1})
        self.assertEqual(len(data["daily"]), 7)
        self.assertEqual(data["daily"][-1], {"date": "2026-09-30", "visits": 1, "shares": 1, "visitors": 1, "opens": 1, "plays": 0, "saves": 3})
        self.assertEqual(data["resources"], [{"name": "eng-film-demo", "count": 1}])
        self.assertEqual(data["resourceTable"], [{"name": "eng-film-demo", "visitors": 1, "opens": 1, "plays": 0, "saves": 0, "shares": 0}])
        self.assertEqual(data["engagement"], {"openedVisitors": 1, "engagedVisitors": 1, "sharedVisitors": 1, "arrivedBySharedLink": 1, "returningVisitors": 0, "plays": 0, "playCompletes": 0})
        self.assertEqual(data["countryTable"], [{"name": "Unknown", "visitors": 1, "pageViews": 1, "opens": 1, "shares": 1}])
        self.assertEqual(len(data["hours"]), 24)
        self.assertEqual(sum(data["hours"]), 1)
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

    def test_expanded_breakdowns_preserve_denominators_and_terminal_statuses(self):
        records = [
            event(1, referrer="referral.example.test"),
            event(2, path="/", language=""),
            event(3, "resource_open", resource="eng-film-demo"),
            event(4, "play", resource="eng-film-demo"),
            event(5, "share_intent", channel="native_share", status="started"),
            event(6, "share_complete", channel="native_share", status="handed_off"),
            event(7, "share_complete", channel="copy_link", status="copied"),
            event(8, "share_cancel", status="failed"),
            event(9, "share_cancel", status="cancelled"),
            event(10, "download_start", status="started"),
            event(11, "download_complete", status="browser_handoff"),
            event(12, "download_complete", status="saved"),
            event(13, "download_cancel", status="cancelled"),
            event(14, "download_error", status="error"),
            event(15, "transfer_start", status="started"),
            event(16, "transfer_complete", status="sent"),
            event(17, "transfer_complete", status="received"),
            event(18, "transfer_error"),
            event(19, "shared_visit", shareId="share-00000001"),
            event(20, "shared_visit"),
            event(21, "session_start"),
        ]
        cleaned = api.validate_events({"consent": {"version": 1, "analytics": True}, "events": records}, NOW)
        cleaned[0]["country"] = "US"
        api.SQLiteStore(self.db).append(cleaned, NOW)
        code, result, _ = self.admin()
        self.assertEqual(code, 200)
        rows = lambda name: {row["name"]: row["count"] for row in result[name]}
        self.assertEqual(rows("referrers"), {"referral.example.test": 1, "Direct / unknown": 1})
        self.assertEqual(rows("pages"), {"/english": 1, "/": 1})
        self.assertEqual(rows("shareOutcomes"), {"handed_off": 1, "copied": 1, "failed": 1, "cancelled": 1})
        self.assertEqual(rows("downloadOutcomes"), {"browser_handoff": 1, "saved": 1, "cancelled": 1, "error": 1})
        self.assertEqual(rows("transferOutcomes"), {"sent": 1, "received": 1, "unspecified": 1})
        self.assertEqual(result["breakdownTotals"], {"channels": 1, "countries": 2, "languages": 2, "resources": 1, "referrers": 2, "pages": 2, "eventTypes": 21, "statuses": 21, "shareOutcomes": 4, "downloadOutcomes": 4, "transferOutcomes": 3})
        self.assertEqual(result["coverage"], {"pageViewsWithCountry": 1, "pageViewsWithReferrer": 1, "sharedVisitsWithShareId": 1, "errorEvents": 3, "cancelledEvents": 2, "distinctResources": 1})
        self.assertEqual(rows("eventTypes")["share_intent"], 1)
        self.assertEqual(rows("eventTypes")["transfer_complete"], 2)
        self.assertEqual(rows("statuses")["started"], 3)
        self.assertFalse(any(result["breakdownTruncated"].values()))
        self.assertEqual((result["periodDays"], result["reportingTimezone"], result["generatedAt"]), (7, "UTC", api.iso_at(NOW)))
        self.assertEqual((result["summary"]["shareCompletions"], result["summary"]["downloads"], result["summary"]["transfers"]), (1, 1, 1))

    def test_referrer_and_type_breakdowns_include_events_beyond_recent_500(self):
        records = [event(0, referrer="older.example.test", path="/")]
        records.extend(event(index, referrer="recent.example.test") for index in range(1, 501))
        api.SQLiteStore(self.db).append(records, NOW)
        result = self.admin()[1]
        self.assertEqual(len(result["events"]), 500)
        self.assertTrue(all(row["referrer"] == "recent.example.test" for row in result["events"]))
        self.assertEqual(result["referrers"], [{"name": "recent.example.test", "count": 500}, {"name": "older.example.test", "count": 1}])
        self.assertEqual(result["eventTypes"], [{"name": "page_view", "count": 501}])
        self.assertEqual(result["breakdownTotals"]["pages"], 501)
        self.assertTrue(result["recentEventsTruncated"])
        self.assertFalse(result["truncated"])

    def test_breakdown_caps_expose_full_denominators_with_partial_report_metadata(self):
        records = [event(index, path=f"/page-{index:03d}", referrer=f"referral-{index:03d}.example.test", country="US") for index in range(105)]
        records.extend(event(105 + index, "resource_open", resource=f"resource-{index:03d}") for index in range(105))
        result = api.aggregate(records, 7, NOW, truncated=True)
        for collection in ("pages", "referrers", "resources"):
            self.assertEqual(len(result[collection]), 100)
            self.assertTrue(result["breakdownTruncated"][collection])
            self.assertEqual(result["breakdownTotals"][collection], 105)
            self.assertEqual(result["breakdownTotals"][collection] - sum(row["count"] for row in result[collection]), 5)
        self.assertEqual(result["breakdownTotals"]["countries"], 105)
        self.assertFalse(result["breakdownTruncated"]["countries"])
        self.assertEqual(result["breakdownTotals"]["eventTypes"], 210)
        self.assertEqual(result["analyzedEvents"], 210)
        self.assertTrue(result["truncated"])

    def test_empty_extended_breakdowns_have_zero_totals(self):
        result = api.aggregate([], 30, NOW)
        self.assertEqual(result["periodDays"], 30)
        self.assertTrue(all(total == 0 for total in result["breakdownTotals"].values()))
        self.assertTrue(all(not flag for flag in result["breakdownTruncated"].values()))
        self.assertTrue(all(value == 0 for value in result["coverage"].values()))
        for name in result["breakdownTotals"]:
            self.assertEqual(result[name], [])

    def test_explicit_cancellation_overrides_error_suffix_in_coverage(self):
        cases = (
            ("transfer_error", "cancelled", 0, 1),
            ("transfer_error", "declined", 0, 1),
            ("transfer_error", "failed", 1, 0),
            ("transfer_error", "error", 1, 0),
            ("transfer_error", "", 1, 0),
            ("share_cancel", "failed", 1, 0),
            ("download_cancel", "error", 1, 0),
            ("share_cancel", "", 0, 1),
            ("download_cancel", "cancelled", 0, 1),
        )
        records = []
        for index, (kind, status, errors, cancellations) in enumerate(cases):
            record = event(index, kind, status=status)
            records.append(record)
            with self.subTest(kind=kind, status=status):
                coverage = api.aggregate([record], 7, NOW)["coverage"]
                self.assertEqual((coverage["errorEvents"], coverage["cancelledEvents"]), (errors, cancellations))
        result = api.aggregate(records, 7, NOW)
        self.assertEqual((result["coverage"]["errorEvents"], result["coverage"]["cancelledEvents"]), (5, 4))
        self.assertEqual({row["name"]: row["count"] for row in result["transferOutcomes"]}, {"cancelled": 1, "declined": 1, "failed": 1, "error": 1, "unspecified": 1})

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
        self.assertIn("'INCRBY'", outgoing[-1][1][1])
        self.assertEqual(outgoing[-1][1][-2:], [60, 1])
        with patch("urllib.request.urlopen", side_effect=response_for({"result": 40})):
            self.assertTrue(store.rate("opaque-test-key", 120, 60, NOW, amount=40))
        self.assertEqual(outgoing[-1][1][-2:], [60, 40])
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


    def test_qr_scans_redirect_count_without_identifiers_and_report_by_language(self):
        code, body, headers = self.request("/api/qr?l=swahili&src=qr", "GET", headers={"X-Vercel-IP-Country": "KE"}, production=False)
        self.assertEqual((code, body, headers["Location"]), (302, "", "/swahili"))
        self.request("/api/qr?l=swahili&src=qr", "GET", headers={})
        self.request("/api/qr?l=english&src=qr", "GET", headers={})
        self.request("/api/qr?l=english&src=qr", "GET", headers={}, now=NOW - 8 * 86400)
        for path in ("/api/qr?l=../admin", "/api/qr", "/api/qr?l=item.html"):
            with self.subTest(path=path):
                code, _, headers = self.request(path, "GET", headers={})
                self.assertEqual((code, headers["Location"]), (302, "/"))
        self.assertEqual(self.request("/api/qr?l=english", "POST", payload={})[0], 405)
        cookie = self.login()
        report = self.admin(7, cookie)[1]["qrScans"]
        self.assertEqual(report["total"], 3)
        self.assertEqual(report["previous"], 1)
        self.assertEqual(report["languages"], [{"name": "swh", "count": 2}, {"name": "eng", "count": 1}])
        self.assertEqual(report["daily"][-1], {"date": "2026-09-30", "count": 3})
        # Nothing about the scanner reaches the event store.
        self.assertEqual(self.admin(7, cookie)[1]["summary"]["visitors"], 0)
        filtered = self.request("/api/admin?days=7&language=eng", "GET", headers={**self.headers, "Cookie": cookie})[1]["qrScans"]
        self.assertEqual(filtered["total"], 1)
        filtered = self.request("/api/admin?days=7&resource=some-item", "GET", headers={**self.headers, "Cookie": cookie})[1]["qrScans"]
        self.assertEqual(filtered["total"], 0)

    def test_qr_scans_are_rate_limited_and_never_block_the_redirect(self):
        for _ in range(35):
            code, _, headers = self.request("/api/qr?l=hausa", "GET", headers={})
            self.assertEqual((code, headers["Location"]), (302, "/hausa"))
        self.assertEqual(self.admin(7)[1]["qrScans"]["total"], 30)
        with patch.object(api, "local_db_path", side_effect=api.APIError(503, "down")):
            code, _, headers = self.request("/api/qr?l=hausa", "GET", headers={})
        self.assertEqual((code, headers["Location"]), (302, "/hausa"))

    def test_qr_libraries_match_the_public_library_list_and_vercel_rewrite(self):
        import re
        root = pathlib.Path(__file__).resolve().parent.parent
        routes = dict(re.findall(r"\['([a-z-]+)', '([a-z]{3})'", (root / "app/assets/js/share-libraries.js").read_text()))
        self.assertEqual(api.QR_LIBRARIES, routes)
        config = json.loads((root / "vercel.json").read_text())
        # A redirect, because Vercel serves the <slug>/ folder before any rewrite.
        self.assertFalse([r for r in config["rewrites"] if "/api/qr" in r.get("destination", "")])
        rule = [r for r in config["redirects"] if r.get("destination") == "/api/qr?l=:slug"]
        self.assertEqual(len(rule), 1)
        self.assertIs(config["redirects"][0], rule[0])
        self.assertIs(rule[0]["permanent"], False)
        self.assertEqual(rule[0]["has"], [{"type": "query", "key": "src", "value": "qr"}])
        self.assertEqual(set(re.fullmatch(r"/:slug\((.*)\)", rule[0]["source"]).group(1).split("|")), set(routes))

    def test_production_redis_qr_counters(self):
        import io
        store = api.RedisStore("https://storage.example.test", "test-only-token")
        with patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps([{"result": 1}, {"result": 1}]).encode())) as network:
            store.count_qr("2026-09-30", "swahili", "KE", NOW)
        self.assertEqual(json.loads(network.call_args[0][0].data), [["HINCRBY", api.PREFIX + "qr:2026-09-30", "swahili|KE", 1], ["EXPIRE", api.PREFIX + "qr:2026-09-30", api.RETENTION_SECONDS + 86400]])
        with patch("urllib.request.urlopen", return_value=io.BytesIO(json.dumps([{"result": ["swahili|KE", "4", "english|", "1"]}, {"result": []}]).encode())):
            self.assertEqual(store.read_qr(["2026-09-30", "2026-09-29"]), [("2026-09-30", "swahili", "KE", 4), ("2026-09-30", "english", "", 1)])


if __name__ == "__main__":
    unittest.main()
