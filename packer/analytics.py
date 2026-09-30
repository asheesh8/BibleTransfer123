"""Consent-gated, first-party event collection shared by local and Vercel APIs.

Only validated event metadata is stored. Network addresses are never event data;
short-lived HMAC keys provide abuse limits. Production never uses a local file.
"""
import base64
import collections
import datetime as dt
import hashlib
import hmac
import http.cookies
import json
import math
import os
import pathlib
import re
import secrets
import sqlite3
import time
import urllib.parse
import urllib.request

RETENTION_DAYS = 90
RETENTION_SECONDS = RETENTION_DAYS * 86400
MAX_BODY = 64 * 1024
MAX_BATCH = 40
MAX_ANALYSIS_EVENTS = 20000
MAX_RECENT_EVENTS = 500
COOKIE_NAME = "et_admin"
SESSION_SECONDS = 12 * 3600
PREFIX = "easytransfer:analytics:v1:"
EVENT_TYPES = frozenset((
    "page_view", "session_start", "share_intent", "share_complete", "share_cancel",
    "shared_visit", "resource_open", "play", "pause", "play_complete",
    "download_start", "download_complete", "download_cancel", "download_error",
    "transfer_start", "transfer_complete", "transfer_error", "language_change",
    "install", "external_open",
))
CHANNELS = frozenset((
    "native", "web-share", "native_share", "copy", "copy-link", "copy_link", "link",
    "qr", "whatsapp", "facebook", "telegram", "email", "sms", "nearby", "bluetooth",
    "wifi", "sd_card", "usb", "download", "other", "unknown",
))
STATUSES = frozenset((
    "pending", "started", "completed", "cancelled", "error", "opened", "success",
    "failed", "saved", "browser_handoff", "copied", "handed_off", "guide_opened",
    "sent", "received", "declined", "offered", "accepted",
))
FIELDS = frozenset((
    "id", "type", "at", "path", "language", "resource", "channel", "status",
    "referrer", "shareId", "visitorId", "sessionId", "bytes", "duration",
))
IDENTIFIER = re.compile(r"^[A-Za-z0-9_-]{8,80}$")
SLUG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$")
PATH = re.compile(r"^/[A-Za-z0-9/_.-]{0,199}$")
HOSTNAME = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$")
_EPHEMERAL_KEY = secrets.token_bytes(32)


class APIError(Exception):
    def __init__(self, status, message, retry_after=60):
        self.status, self.message, self.retry_after = status, message, retry_after


def timestamp(value):
    """Accept browser ISO dates, require a timezone, and normalize to UTC."""
    if not isinstance(value, str) or len(value) > 40:
        raise APIError(400, "Invalid event timestamp.")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError()
        return parsed.timestamp()
    except (ValueError, OverflowError):
        raise APIError(400, "Invalid event timestamp.") from None


def iso_at(epoch):
    return dt.datetime.fromtimestamp(epoch, dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def clean_referrer(value):
    if not value:
        return ""
    if not isinstance(value, str) or len(value) > 2048:
        raise APIError(400, "Invalid referrer.")
    try:
        parsed = urllib.parse.urlsplit(value if "://" in value else "https://" + value)
        hostname = parsed.hostname or ""
    except ValueError:
        raise APIError(400, "Invalid referrer.") from None
    if parsed.scheme not in ("http", "https") or not HOSTNAME.fullmatch(hostname):
        raise APIError(400, "Invalid referrer.")
    # Paths, usernames, queries, fragments and ports are deliberately discarded.
    return hostname.lower()


def validate_events(payload, now, country=""):
    if not isinstance(payload, dict) or set(payload) != {"consent", "events"}:
        raise APIError(400, "Expected consent and events only.")
    consent = payload["consent"]
    if not isinstance(consent, dict) or set(consent) != {"version", "analytics"}:
        raise APIError(400, "Invalid consent.")
    if type(consent["version"]) is not int or consent["version"] != 1 or consent["analytics"] is not True:
        raise APIError(400, "Analytics consent is required.")
    events = payload["events"]
    if not isinstance(events, list) or not 1 <= len(events) <= MAX_BATCH:
        raise APIError(400, "Send between 1 and 40 events.")
    cleaned = []
    for event in events:
        if not isinstance(event, dict) or set(event) - FIELDS:
            raise APIError(400, "Unknown event fields.")
        if not {"id", "type", "at", "path", "visitorId", "sessionId"} <= set(event):
            raise APIError(400, "Event identifiers, timestamp, type and path are required.")
        if not isinstance(event["type"], str) or event["type"] not in EVENT_TYPES:
            raise APIError(400, "Unknown event type.")
        result = {"type": event["type"]}
        for field in ("id", "visitorId", "sessionId", "shareId"):
            value = event.get(field, "")
            if value == "" and field == "shareId":
                result[field] = ""
            elif not isinstance(value, str) or not IDENTIFIER.fullmatch(value):
                raise APIError(400, "Invalid event identifier.")
            else:
                result[field] = value
        at = timestamp(event["at"])
        if at <= now - RETENTION_SECONDS or at > now + 300:
            raise APIError(400, "Event timestamp is outside the retention window.")
        result["at"] = iso_at(at)
        path = event["path"]
        if not isinstance(path, str) or len(path) > 2048:
            raise APIError(400, "Invalid event path.")
        path = path.split("?", 1)[0].split("#", 1)[0]
        if not PATH.fullmatch(path) or ".." in path or "//" in path or path.startswith("/admin") or path.startswith("/api/"):
            raise APIError(400, "Invalid event path.")
        result["path"] = path
        language = event.get("language", "")
        if not isinstance(language, str) or (language and not re.fullmatch(r"[a-z]{3}", language)):
            raise APIError(400, "Invalid language code.")
        result["language"] = language
        resource = event.get("resource", "")
        if not isinstance(resource, str) or (resource and not SLUG.fullmatch(resource)):
            raise APIError(400, "Invalid resource identifier.")
        result["resource"] = resource
        for field, allowed in (("channel", CHANNELS), ("status", STATUSES)):
            value = event.get(field, "")
            if not isinstance(value, str) or (value and value not in allowed):
                raise APIError(400, "Invalid event metadata.")
            result[field] = value
        result["referrer"] = clean_referrer(event.get("referrer", ""))
        result["country"] = country if re.fullmatch(r"[A-Z]{2}", country) else ""
        if "bytes" in event:
            if type(event["bytes"]) is not int or not 0 <= event["bytes"] <= 1024 ** 4:
                raise APIError(400, "Invalid byte count.")
            result["bytes"] = event["bytes"]
        if "duration" in event:
            value = event["duration"]
            if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 86400:
                raise APIError(400, "Invalid duration.")
            result["duration"] = round(value, 3)
        cleaned.append(result)
    return cleaned


class SQLiteStore:
    def __init__(self, path):
        self.path = pathlib.Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, at REAL NOT NULL, body TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS event_time ON events(at);
                CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires REAL NOT NULL);
            """)
        try:
            self.path.chmod(0o600)
        except OSError:
            pass

    def connect(self):
        db = sqlite3.connect(self.path, timeout=5)
        # Expired metadata is overwritten rather than left in SQLite free pages.
        db.execute("PRAGMA secure_delete = ON")
        return db

    def purge(self, now):
        with self.connect() as db:
            db.execute("DELETE FROM events WHERE at <= ?", (now - RETENTION_SECONDS,))
            db.execute("DELETE FROM limits WHERE expires <= ?", (now,))

    def rate(self, key, maximum, window, now):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM limits WHERE expires <= ?", (now,))
            db.execute("INSERT INTO limits VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET hits = hits + 1", (key, now + window))
            return db.execute("SELECT hits FROM limits WHERE key = ?", (key,)).fetchone()[0] <= maximum

    def append(self, events, now):
        with self.connect() as db:
            db.execute("DELETE FROM events WHERE at <= ?", (now - RETENTION_SECONDS,))
            inserted = 0
            for event in events:
                inserted += db.execute("INSERT OR IGNORE INTO events VALUES (?, ?, ?)", (event["id"], timestamp(event["at"]), json.dumps(event, separators=(",", ":")))).rowcount
            return inserted

    def read(self, start, now):
        with self.connect() as db:
            db.execute("DELETE FROM events WHERE at <= ?", (now - RETENTION_SECONDS,))
            rows = db.execute("SELECT body FROM events WHERE at >= ? AND at <= ? ORDER BY at DESC, id DESC LIMIT ?", (start, now + 300, MAX_ANALYSIS_EVENTS + 1)).fetchall()
            return [json.loads(row[0]) for row in rows[:MAX_ANALYSIS_EVENTS]], len(rows) > MAX_ANALYSIS_EVENTS


class RedisStore:
    # Scripts make deduplication and indexing atomic across function instances.
    APPEND = """
        local events = cjson.decode(ARGV[1])
        local now = tonumber(ARGV[2])
        local retention = tonumber(ARGV[3])
        local prefix = ARGV[4]
        local inserted = 0
        redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now-retention)
        for _, event in ipairs(events) do
            local ttl = math.max(1, math.ceil(event.score + retention - now))
            if redis.call('SET', prefix .. event.id, event.body, 'NX', 'EX', ttl) then
                redis.call('ZADD', KEYS[1], event.score, event.id)
                inserted = inserted + 1
            end
        end
        redis.call('EXPIRE', KEYS[1], retention + 300)
        return inserted
    """
    RATE = """
        local hits = redis.call('INCR', KEYS[1])
        if hits == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
        return hits
    """
    READ = """
        redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
        return redis.call('ZREVRANGEBYSCORE', KEYS[1], ARGV[2], ARGV[3], 'LIMIT', 0, ARGV[4])
    """

    def __init__(self, url, token):
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise APIError(503, "Analytics storage configuration is invalid.")
        self.url, self.token = url.rstrip("/"), token

    def request(self, commands, pipeline=False):
        request = urllib.request.Request(self.url + ("/pipeline" if pipeline else ""), data=json.dumps(commands).encode(), headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json", "User-Agent": "EasyTransfer-Analytics/1"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                data = json.load(response)
            results = data if pipeline else [data]
            if not isinstance(results, list) or (pipeline and len(results) != len(commands)) or any(not isinstance(item, dict) or "error" in item or "result" not in item for item in results):
                raise ValueError()
            return [item["result"] for item in results] if pipeline else results[0]["result"]
        except (OSError, ValueError, TypeError, RecursionError):
            raise APIError(503, "Analytics storage is temporarily unavailable.") from None

    def rate(self, key, maximum, window, now):
        return int(self.request(["EVAL", self.RATE, 1, PREFIX + "rate:" + key, window])) <= maximum

    def append(self, events, now):
        entries = [{"id": event["id"], "score": timestamp(event["at"]), "body": json.dumps(event, separators=(",", ":"))} for event in events]
        return int(self.request(["EVAL", self.APPEND, 1, PREFIX + "index", json.dumps(entries), now, RETENTION_SECONDS, PREFIX + "event:"]))

    def read(self, start, now):
        ids = self.request(["EVAL", self.READ, 1, PREFIX + "index", now - RETENTION_SECONDS, now + 300, start, MAX_ANALYSIS_EVENTS + 1])
        if not isinstance(ids, list):
            raise APIError(503, "Analytics storage is temporarily unavailable.")
        truncated = len(ids) > MAX_ANALYSIS_EVENTS
        ids = ids[:MAX_ANALYSIS_EVENTS]
        commands = [["MGET"] + [PREFIX + "event:" + event_id for event_id in ids[offset:offset + 500]] for offset in range(0, len(ids), 500)]
        groups = self.request(commands, pipeline=True) if commands else []
        try:
            if any(not isinstance(group, list) for group in groups):
                raise ValueError()
            events = [json.loads(body) for group in groups for body in group if body is not None]
            if any(not isinstance(event, dict) for event in events):
                raise ValueError()
        except (ValueError, TypeError):
            raise APIError(503, "Analytics storage is temporarily unavailable.") from None
        return events, truncated


def local_db_path(public_root=None):
    path = pathlib.Path(os.environ.get("EASYTRANSFER_ANALYTICS_DB", str(pathlib.Path(__file__).resolve().parent.parent / ".cache" / "analytics" / "events.sqlite"))).expanduser().resolve()
    public = pathlib.Path(public_root or pathlib.Path(__file__).resolve().parent.parent / "app").resolve()
    if path == public or public in path.parents:
        raise APIError(503, "Local analytics storage must be outside the public folder.")
    return path


def get_store(production, public_root=None):
    if production:
        for url_name, token_name in (
            ("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"),
            ("KV_REST_API_URL", "KV_REST_API_TOKEN"),
        ):
            url, token = os.environ.get(url_name, ""), os.environ.get(token_name, "")
            if url and token:
                return RedisStore(url, token)
        raise APIError(503, "Analytics storage is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or connect Upstash with KV_REST_API_URL and KV_REST_API_TOKEN.")
    return SQLiteStore(local_db_path(public_root))


def purge_local(public_root=None):
    """Server startup/hourly maintenance; don't create a database just to purge."""
    try:
        path = local_db_path(public_root)
        if path.exists():
            SQLiteStore(path).purge(time.time())
    except (APIError, OSError, sqlite3.Error):
        # API calls report configuration/storage failures to the administrator.
        pass


def secret_key():
    configured = os.environ.get("EASYTRANSFER_ADMIN_SECRET") or os.environ.get("EASYTRANSFER_ADMIN_PASSWORD") or os.environ.get("UPSTASH_REDIS_REST_TOKEN") or os.environ.get("KV_REST_API_TOKEN")
    return hashlib.sha256(("EasyTransfer authentication v1:" + configured).encode()).digest() if configured else _EPHEMERAL_KEY


def rate_key(kind, client_ip, now):
    # This digest is only a short-lived abuse counter; raw addresses are discarded.
    material = f"{kind}:{int(now // 86400)}:{client_ip}".encode()
    return kind + ":" + hmac.new(secret_key(), material, hashlib.sha256).hexdigest()


def _encode(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def issue_session(now):
    password_tag = _encode(hmac.new(secret_key(), os.environ.get("EASYTRANSFER_ADMIN_PASSWORD", "").encode(), hashlib.sha256).digest())
    payload = _encode(json.dumps({"v": 1, "exp": int(now + SESSION_SECONDS), "nonce": secrets.token_urlsafe(16), "auth": password_tag}, separators=(",", ":")).encode())
    signature = _encode(hmac.new(secret_key(), payload.encode(), hashlib.sha256).digest())
    return payload + "." + signature


def authenticated(headers, now):
    if not os.environ.get("EASYTRANSFER_ADMIN_PASSWORD"):
        return False
    try:
        cookies = http.cookies.SimpleCookie()
        cookies.load(headers.get("cookie", ""))
        token = cookies[COOKIE_NAME].value
        if len(token) > 512:
            return False
        payload, signature = token.split(".")
        expected = _encode(hmac.new(secret_key(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return False
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        password_tag = _encode(hmac.new(secret_key(), os.environ["EASYTRANSFER_ADMIN_PASSWORD"].encode(), hashlib.sha256).digest())
        return data.get("v") == 1 and type(data.get("exp")) is int and now < data["exp"] <= now + SESSION_SECONDS and hmac.compare_digest(data.get("auth", ""), password_tag)
    except (KeyError, ValueError, TypeError, http.cookies.CookieError):
        return False


def cookie_header(value, production, expires=False):
    return f"{COOKIE_NAME}={value}; Path=/; HttpOnly; SameSite=Strict; Max-Age={0 if expires else SESSION_SECONDS}" + ("; Secure" if production else "")


def require_same_origin(headers, production):
    origin = headers.get("origin", "")
    configured = os.environ.get("EASYTRANSFER_PUBLIC_ORIGIN", "")
    scheme = "https" if production else "http"
    host = headers.get("host", "")
    expected = configured.rstrip("/") if configured else scheme + "://" + host
    try:
        actual = urllib.parse.urlsplit(origin)
        target = urllib.parse.urlsplit(expected)
        if actual.username or actual.password or target.username or target.password:
            raise ValueError()
        if actual.path or actual.query or actual.fragment or target.path or target.query or target.fragment:
            raise ValueError()
        if actual.scheme not in ("http", "https") or not actual.hostname or not target.hostname:
            raise ValueError()
        canonical = lambda value: (value.scheme, value.hostname.lower(), value.port or (443 if value.scheme == "https" else 80))
        if canonical(actual) != canonical(target) or (production and actual.scheme != "https"):
            raise ValueError()
        if headers.get("sec-fetch-site", "") not in ("", "same-origin", "none"):
            raise ValueError()
    except ValueError:
        raise APIError(403, "A same-origin request is required.") from None


def aggregate(events, days, now, truncated=False):
    today = dt.datetime.fromtimestamp(now, dt.timezone.utc).date()
    daily = {str(today - dt.timedelta(days=offset)): {"date": str(today - dt.timedelta(days=offset)), "visits": 0, "shares": 0} for offset in reversed(range(days))}
    summary = {"visitors": len({event["visitorId"] for event in events}), "sessions": len({event["sessionId"] for event in events}), "pageViews": 0, "shareIntents": 0, "shareCompletions": 0, "sharedVisits": 0, "downloads": 0, "transfers": 0}
    channels, countries, languages, resources = (collections.Counter() for _ in range(4))
    for event in events:
        kind, status = event["type"], event.get("status", "")
        day = daily.get(event["at"][:10])
        if kind == "page_view":
            summary["pageViews"] += 1
            if day:
                day["visits"] += 1
            countries[event.get("country") or "Unknown"] += 1
            languages[event.get("language") or "Unspecified"] += 1
        if kind == "share_intent":
            summary["shareIntents"] += 1
            channels[event.get("channel") or "unknown"] += 1
            if day:
                day["shares"] += 1
        if kind == "share_complete" and status in ("copied", "completed", "success"):
            summary["shareCompletions"] += 1
        if kind == "shared_visit":
            summary["sharedVisits"] += 1
        if kind == "download_complete" and status == "saved":
            summary["downloads"] += 1
        if kind == "transfer_complete" and status == "received":
            summary["transfers"] += 1
        if kind == "resource_open" and event.get("resource"):
            resources[event["resource"]] += 1
    def breakdown(counts):
        return [{"name": name, "count": count} for name, count in sorted(counts.items(), key=lambda entry: (-entry[1], entry[0]))[:100]]
    return {"summary": summary, "daily": list(daily.values()), "channels": breakdown(channels), "countries": breakdown(countries), "languages": breakdown(languages), "resources": breakdown(resources), "events": events[:MAX_RECENT_EVENTS], "retentionDays": RETENTION_DAYS, "truncated": truncated, "recentEventsTruncated": len(events) > MAX_RECENT_EVENTS, "analyzedEvents": len(events), "analysisLimit": MAX_ANALYSIS_EVENTS}


def dispatch(path, method, headers, raw=b"", client_ip="", production=False, public_root=None, now=None):
    """Return status, JSON object and response headers without leaking errors."""
    now = time.time() if now is None else now
    headers = {key.lower(): value for key, value in headers.items()}
    output_headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
    try:
        route = urllib.parse.urlsplit(path)
        if route.path not in ("/api/analytics", "/api/admin"):
            raise APIError(404, "API not found.")
        if method not in (("POST",) if route.path == "/api/analytics" else ("GET", "POST")):
            raise APIError(405, "Method not allowed.")
        payload = None
        if method == "POST":
            require_same_origin(headers, production)
            if headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
                raise APIError(415, "Use application/json.")
            if len(raw) > MAX_BODY:
                raise APIError(413, "Request body is too large.")
            try:
                payload = json.loads(raw)
            except (ValueError, UnicodeError, RecursionError):
                raise APIError(400, "Invalid JSON.") from None
        if route.path == "/api/analytics":
            country = headers.get("x-vercel-ip-country", "") if production else ""
            events = validate_events(payload, now, country)
            store = get_store(production, public_root)
            if not store.rate(rate_key("events", client_ip, now), 120, 60, now):
                raise APIError(429, "Too many analytics requests. Try again shortly.")
            inserted = store.append(events, now)
            return 200, {"ok": True, "accepted": inserted, "duplicates": len(events) - inserted}, output_headers
        if not os.environ.get("EASYTRANSFER_ADMIN_PASSWORD"):
            raise APIError(503, "Admin access is not configured. Set EASYTRANSFER_ADMIN_PASSWORD.")
        if method == "POST":
            if not isinstance(payload, dict) or payload.get("action") not in ("login", "logout"):
                raise APIError(400, "Unknown admin action.")
            if payload["action"] == "logout":
                if set(payload) != {"action"}:
                    raise APIError(400, "Invalid logout request.")
                output_headers["Set-Cookie"] = cookie_header("", production, expires=True)
                return 200, {"ok": True}, output_headers
            if set(payload) != {"action", "password"} or not isinstance(payload["password"], str) or len(payload["password"]) > 1024:
                raise APIError(400, "Invalid login request.")
            store = get_store(production, public_root)
            if not store.rate(rate_key("login", client_ip, now), 10, 600, now):
                raise APIError(429, "Too many login attempts. Try again later.", retry_after=600)
            if not hmac.compare_digest(payload["password"].encode(), os.environ["EASYTRANSFER_ADMIN_PASSWORD"].encode()):
                raise APIError(401, "Invalid admin credentials.")
            output_headers["Set-Cookie"] = cookie_header(issue_session(now), production)
            return 200, {"ok": True}, output_headers
        if not authenticated(headers, now):
            raise APIError(401, "Admin sign-in is required.")
        query = urllib.parse.parse_qs(route.query, keep_blank_values=True)
        if set(query) - {"days"} or len(query.get("days", ["30"])) != 1 or query.get("days", ["30"])[0] not in ("7", "30", "90"):
            raise APIError(400, "Choose a 7, 30 or 90 day period.")
        days = int(query.get("days", ["30"])[0])
        today = dt.datetime.fromtimestamp(now, dt.timezone.utc).date()
        start = dt.datetime.combine(today - dt.timedelta(days=days - 1), dt.time(), dt.timezone.utc).timestamp()
        events, truncated = get_store(production, public_root).read(start, now)
        return 200, aggregate(events, days, now, truncated), output_headers
    except APIError as error:
        if error.status == 429:
            output_headers["Retry-After"] = str(error.retry_after)
        return error.status, {"error": error.message}, output_headers
    except (OSError, sqlite3.Error, ValueError, TypeError, OverflowError):
        return 503, {"error": "Analytics is temporarily unavailable."}, output_headers


def handle_http(handler, production=False, public_root=None):
    """Small HTTP adapter, also used by Vercel's BaseHTTPRequestHandler."""
    raw = b""
    try:
        if handler.command == "POST":
            length = int(handler.headers.get("Content-Length", "0"))
            if length < 0 or length > MAX_BODY:
                raise APIError(413, "Request body is too large.")
            raw = handler.rfile.read(length)
        address = handler.headers.get("x-real-ip", "") if production else handler.client_address[0]
        code, payload, headers = dispatch(handler.path, handler.command, dict(handler.headers), raw, address, production, public_root)
    except (ValueError, APIError) as error:
        code, payload = (error.status, {"error": error.message}) if isinstance(error, APIError) else (400, {"error": "Invalid request length."})
        headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
    body = json.dumps(payload, separators=(",", ":")).encode()
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    for key, value in headers.items():
        handler.send_header(key, value)
    handler.end_headers()
    handler.wfile.write(body)
