"""What the store apps need from the site: version check, app analytics, data deletion, policy pages."""
import datetime as dt
import json
import os
import pathlib
import tempfile
import unittest
from unittest.mock import patch

from packer import analytics as api
from packer import app_config

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOW = dt.datetime(2026, 10, 29, 12, tzinfo=dt.timezone.utc).timestamp()
SITE = {"Host": "www.bibletransfer123.org", "Origin": "https://www.bibletransfer123.org", "Content-Type": "application/json"}


def event(number, visitor="visitor-00000001", **fields):
    return {"id": "event-%08d" % number, "type": "page_view", "at": api.iso_at(NOW), "path": "/english",
            "visitorId": visitor, "sessionId": "session-00000001", **fields}


class AppConfigTest(unittest.TestCase):
    def get(self, query, method="GET"):
        return app_config.dispatch("/api/app-config" + query, method)

    def test_the_committed_config_is_valid(self):
        config = app_config.load()
        self.assertEqual(set(config["platforms"]), {"ios", "android"})

    def test_update_states(self):
        config = app_config.load()
        for platform in ("ios", "android"):
            entry = config["platforms"][platform]
            code, body, headers = self.get("?platform=%s&version=%s" % (platform, entry["latest"]))
            self.assertEqual((code, body["update"]), (200, "none"))
            self.assertEqual(headers["Access-Control-Allow-Origin"], "*")
            self.assertIn("max-age=300", headers["Cache-Control"])
        self.assertEqual(self.get("?platform=ios&version=0.0.1")[1]["update"], "required")
        self.assertEqual(self.get("?platform=android")[1]["update"], "unknown")
        self.assertEqual(self.get("?platform=android&version=99.0")[1]["update"], "none")

    def test_an_older_but_allowed_version_is_offered_an_update(self):
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder) / "app-config.json"
            config = app_config.load()
            config["platforms"]["android"].update(latest="1.2.0", minimum="1.0", store="https://play.google.com/store/apps/details?id=org.villageservers.library")
            path.write_text(json.dumps(config))
            self.assertEqual(app_config.dispatch("/api/app-config?platform=android&version=1.1.9", "GET", config_path=path)[1]["update"], "available")
            self.assertEqual(app_config.dispatch("/api/app-config?platform=android&version=0.9.9", "GET", config_path=path)[1]["update"], "required")
            config["platforms"]["android"]["minimum"] = "2.0.0"
            path.write_text(json.dumps(config))
            self.assertEqual(app_config.dispatch("/api/app-config?platform=android&version=1.0", "GET", config_path=path)[0], 503)

    def test_links_point_at_pages_that_exist(self):
        body = self.get("?platform=ios")[1]
        rewrites = {r["source"]: r["destination"] for r in json.loads((ROOT / "vercel.json").read_text())["rewrites"]}
        for name in ("privacy", "deleteData", "support"):
            path = body["links"][name].replace(app_config.PUBLIC_ORIGIN, "")
            self.assertTrue((ROOT / "app" / rewrites[path].lstrip("/")).is_file(), name)

    def test_bad_requests(self):
        for query in ("", "?platform=windows", "?platform=ios&version=one", "?platform=ios&platform=android", "?platform=ios&x=1"):
            self.assertEqual(self.get(query)[0], 400, query)
        self.assertEqual(self.get("?platform=ios", "POST")[0], 405)
        self.assertEqual(self.get("", "OPTIONS")[0], 204)
        self.assertEqual(app_config.dispatch("/api/other", "GET")[0], 404)

    def test_vercel_bundles_the_config(self):
        functions = json.loads((ROOT / "vercel.json").read_text())["functions"]["api/*.py"]
        self.assertIn("registry/app-config.json", functions["includeFiles"])


class AppAnalyticsAndDeletionTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.store = api.SQLiteStore(pathlib.Path(self.directory.name) / "events.sqlite")
        self.patch = patch("packer.analytics.get_store", return_value=self.store)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.directory.cleanup()

    def post(self, payload):
        return api.dispatch("/api/analytics", "POST", SITE, json.dumps(payload).encode(), "192.0.2.1", True, now=NOW)

    def send(self, *events):
        return self.post({"consent": {"version": 1, "analytics": True}, "events": list(events)})

    def test_events_say_which_app_and_version(self):
        code, body, _ = self.send(event(1), event(2, platform="ios", appVersion="0.6.0"), event(3, platform="android", appVersion="1.2"),
                                  event(4, platform="web", appVersion="1.0"), event(5, platform="windows"))
        self.assertEqual((code, body["accepted"], body["rejected"]), (200, 3, 2))
        events, _ = self.store.read(NOW - 86400, NOW)
        self.assertEqual(sorted(e["platform"] for e in events), ["android", "ios", "web"])
        result = api.aggregate(events, 7, NOW)
        self.assertEqual({row["name"]: row["count"] for row in result["platforms"]}, {"web": 1, "ios": 1, "android": 1})
        self.assertEqual({row["name"] for row in result["appVersions"]}, {"ios 0.6.0", "android 1.2"})

    def test_delete_my_data_removes_only_that_visitors_events(self):
        self.send(event(1), event(2), event(3, visitor="visitor-00000002"))
        code, body, _ = self.post({"forget": {"visitorId": "visitor-00000001"}})
        self.assertEqual((code, body), (200, {"ok": True, "deleted": 2}))
        events, _ = self.store.read(NOW - 86400, NOW)
        self.assertEqual([e["visitorId"] for e in events], ["visitor-00000002"])
        self.assertEqual(self.post({"forget": {"visitorId": "visitor-00000001"}})[1]["deleted"], 0)

    def test_delete_requests_are_checked_and_limited(self):
        for bad in ({"forget": "visitor-00000001"}, {"forget": {"visitorId": "x"}}, {"forget": {"visitorId": "visitor-00000001", "all": True}}):
            self.assertEqual(self.post(bad)[0], 400)
        codes = [self.post({"forget": {"visitorId": "visitor-00000001"}})[0] for _ in range(11)]
        self.assertEqual(codes[-1], 429)
        other_site = dict(SITE, Origin="https://evil.example")
        self.assertEqual(api.dispatch("/api/analytics", "POST", other_site, b'{"forget":{"visitorId":"visitor-00000001"}}', "192.0.2.9", True, now=NOW)[0], 403)

    def test_the_redis_store_deletes_matching_events(self):
        calls = []
        redis = api.RedisStore("https://example.upstash.io", "token")
        stored = [event(1), event(2, visitor="visitor-00000002"), event(3)]
        with patch.object(api.RedisStore, "read", return_value=(stored, False)), patch.object(api.RedisStore, "request", side_effect=lambda c, pipeline=False: calls.append(c)):
            self.assertEqual(redis.forget("visitor-00000001", NOW), 2)
        self.assertEqual(calls[0][0], ["DEL", api.PREFIX + "event:event-00000001", api.PREFIX + "event:event-00000003"])
        self.assertEqual(calls[0][1], ["ZREM", api.PREFIX + "index", "event-00000001", "event-00000003"])


class StorePagesTest(unittest.TestCase):
    def test_policy_pages_are_public_and_cached_offline(self):
        rewrites = {r["source"]: r["destination"] for r in json.loads((ROOT / "vercel.json").read_text())["rewrites"]}
        for path, page in (("/privacy", "/privacy.html"), ("/privacy-policy", "/privacy.html"), ("/delete-data", "/delete-data.html"),
                           ("/data-deletion", "/delete-data.html"), ("/support", "/support.html"), ("/contact", "/support.html")):
            self.assertEqual(rewrites[path], page)
        sw = (ROOT / "app" / "sw.js").read_text()
        for page in ("privacy.html", "delete-data.html", "support.html"):
            self.assertIn("'%s'" % page, sw)
            html = (ROOT / "app" / page).read_text()
            self.assertIn("villageserverinitiative@gmail.com", html)

    def test_privacy_policy_covers_what_the_stores_ask(self):
        html = (ROOT / "app" / "privacy.html").read_text()
        for phrase in ("Last updated", "VillageServer Initiative", "Camera", "Location", "Children", "delete-data.html", "never sell"):
            self.assertIn(phrase, html)

    def test_delete_page_uses_the_analytics_forget_call(self):
        self.assertIn("ET.analytics.forget()", (ROOT / "app" / "delete-data.html").read_text())
        self.assertIn("forget: forget", (ROOT / "app" / "assets" / "js" / "analytics.js").read_text())


if __name__ == "__main__":
    unittest.main()
