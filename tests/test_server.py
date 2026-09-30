"""Verify analytics routes coexist with offline signalling and media ranges."""
import functools
import http.client
import json
import os
import pathlib
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from packer import analytics
from packer.serve import Handler, Server


class ServerIntegrationTest(unittest.TestCase):
    def test_http_auth_analytics_ranges_and_local_signalling(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory) / "public"
            root.mkdir()
            (root / "index.html").write_text("<html>offline library</html>")
            (root / "privacy.html").write_text("<html>privacy notice</html>")
            (root / "media.mp4").write_bytes(b"0123456789")
            environment = {"EASYTRANSFER_ADMIN_PASSWORD": "test-only-http-password", "EASYTRANSFER_ADMIN_SECRET": "test-only-http-secret", "EASYTRANSFER_ANALYTICS_DB": str(pathlib.Path(directory) / "private" / "events.sqlite")}
            with patch.dict(os.environ, environment, clear=True), Server(("127.0.0.1", 0), functools.partial(Handler, directory=str(root))) as server:
                worker = threading.Thread(target=server.serve_forever, daemon=True)
                worker.start()
                host = f"127.0.0.1:{server.server_address[1]}"
                connection = http.client.HTTPConnection(host)

                def request(method, path, payload=None, headers=None):
                    supplied = {"Origin": "http://" + host, "Content-Type": "application/json", **(headers or {})}
                    connection.request(method, path, json.dumps(payload) if payload is not None else None, supplied)
                    response = connection.getresponse()
                    return response.status, response.read(), dict(response.getheaders())

                try:
                    code, body, _ = request("GET", "/")
                    self.assertEqual(code, 200)
                    self.assertIn(b"offline library", body)
                    self.assertEqual(request("GET", "/privacy")[:2], (200, b"<html>privacy notice</html>"))
                    code, body, headers = request("GET", "/media.mp4", headers={"Range": "bytes=2-5"})
                    self.assertEqual((code, body), (206, b"2345"))
                    self.assertEqual(headers["Content-Range"], "bytes 2-5/10")
                    self.assertEqual(headers["Content-Type"], "video/mp4")
                    self.assertEqual(request("GET", "/media.mp4", headers={"Range": "bytes=-3"})[:2], (206, b"789"))
                    self.assertEqual(request("GET", "/media.mp4", headers={"Range": "bytes=20-30"})[:2], (416, b""))
                    self.assertEqual(request("GET", "/api/admin")[0], 401)
                    code, body, headers = request("POST", "/api/admin", {"action": "login", "password": environment["EASYTRANSFER_ADMIN_PASSWORD"]})
                    self.assertEqual(code, 200)
                    cookie = headers["Set-Cookie"]
                    event = {"id": "event-00000001", "type": "page_view", "at": analytics.iso_at(time.time()), "path": "/english", "visitorId": "visitor-00000001", "sessionId": "session-00000001", "language": "eng"}
                    code, body, _ = request("POST", "/api/analytics", {"consent": {"version": 1, "analytics": True}, "events": [event]})
                    self.assertEqual((code, json.loads(body)["accepted"]), (200, 1))
                    code, body, _ = request("GET", "/api/admin?days=7", headers={"Cookie": cookie})
                    self.assertEqual((code, json.loads(body)["summary"]["pageViews"]), (200, 1))
                    self.assertEqual(json.loads(request("GET", "/signal/ping")[1]), {"ok": True, "kind": "local"})
                    self.assertEqual(request("POST", "/signal/123456/receiver", {"kind": "offer", "test": True})[0], 200)
                    self.assertEqual(json.loads(request("GET", "/signal/123456/receiver?wait=0")[1]), [{"kind": "offer", "test": True}])
                    self.assertEqual(request("POST", "/api/admin", {"action": "logout"})[0], 200)
                finally:
                    connection.close()
                    server.shutdown()
                    worker.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
