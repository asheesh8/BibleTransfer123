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
# Abuse ceilings as (counter, maximum, window seconds). A per-address limit
# alone lets many addresses add up, so each path also has a site-wide ceiling:
# admin passwords cannot be guessed from a botnet faster than 100 an hour, and
# a flood of fake events cannot fill the shared Upstash database (which also
# holds the library switches and email limits) without bound.
LOGIN_LIMITS = (("login", 10, 600, "ip"), ("login-all", 100, 3600, "site"))
EVENT_LIMITS = (("events", 120, 60, "ip"), ("events-day", 3000, 86400, "ip"))
SITE_EVENTS_PER_DAY = 250000
PREFIX = "easytransfer:analytics:v1:"
VISIBILITY_KEY = "easytransfer:library:v1:visibility"
MAX_VISIBILITY_BODY = 512 * 1024
MAX_VISIBILITY_ITEMS = 10000
CONTENT_TYPES = frozenset(("film", "audio-bible", "audio", "scripture", "historic", "link", "book"))
LANGUAGE_CODE = re.compile(r"^[a-z]{3}$")
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
    "depth", "parentShareId",
))
# Printed QR codes open https://bibletransfer123.org/<slug>?src=qr. Vercel
# redirects those to /api/qr (a rewrite would lose to the <slug>/ folder),
# which adds one to a per-day count and redirects to the library. The count has no visitor ID, cookie or address, so it covers
# every scan, not only visitors who accept analytics. Mirrors share-libraries.js.
# Generated from registry/languages.json by packer/et/generate.py; edit the registry.
QR_LIBRARIES = {
    "english": "eng",
    "mandarin": "cmn",
    "hindi": "hin",
    "marathi": "mar",
    "urdu": "urd",
    "swahili": "swh",
    "zulu": "zul",
    "western-punjabi": "pnb",
    "cantonese": "yue",
    "pashto": "pus",
    "eastern-punjabi": "pan",
    "nepali": "npi",
    "sindhi": "snd",
    "luganda": "lug",
    "luo": "luo",
    "malagasy": "mlg",
    "kirundi": "run",
    "akan": "aka",
    "tigrinya": "tir",
    "arabic": "ara",
    "haitian": "hat",
    "spanish": "spa",
    "kuria": "kuj",
    "luhya": "luy",
    "bukusu": "bxk",
    "saamia": "lsm",
    "maragoli": "rag",
    "idakho": "ida",
    "tiriki": "ida",
    "kabras": "lkb",
    "tachoni": "lts",
    "banyala": "nle",
    "marachi": "lri",
    "kamba": "kam",
    "kalenjin": "kln",
    "giryama": "nyf",
    "digo": "dig",
    "duruma": "dug",
    "meru": "mer",
    "turkana": "tuv",
    "teso": "teo",
    "chichewa": "nya",
    "kinyarwanda": "kin",
    "xhosa": "xho",
    "shona": "sna",
    "hausa": "hau",
    "lingala": "lin",
    "nigerian-pidgin": "pcm",
    "yoruba": "yor",
    "portuguese": "por",
    "amharic": "amh",
    "french": "fra",
    "igbo": "ibo",
    "oromo": "orm",
    "kikuyu": "kik",
    "gusii": "guz",
    "maasai": "mas"
}
IDENTIFIER = re.compile(r"^[A-Za-z0-9_-]{8,80}$")
SLUG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$")
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
    # One malformed event must not discard the rest of a phone's batch: the
    # browser keeps retrying a rejected batch, which would block later events.
    cleaned = []
    for event in events:
        try:
            cleaned.append(clean_event(event, now, country))
        except APIError:
            continue
    if not cleaned:
        raise APIError(400, "No valid events.")
    return cleaned


def clean_event(event, now, country):
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
    # Browsers send within minutes of an action, so a time far outside that
    # means the phone's clock is wrong: record the event at arrival instead.
    if at <= now - RETENTION_SECONDS or at > now + 300:
        at = now
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
    # Sharing chain: the step a share is at, and the share it was passed on from.
    if "depth" in event:
        if type(event["depth"]) is not int or not 1 <= event["depth"] <= 999:
            raise APIError(400, "Invalid share depth.")
        result["depth"] = event["depth"]
    if "parentShareId" in event:
        value = event["parentShareId"]
        if not isinstance(value, str) or not IDENTIFIER.fullmatch(value) or value == result["shareId"]:
            raise APIError(400, "Invalid event identifier.")
        result["parentShareId"] = value
    if "bytes" in event:
        if type(event["bytes"]) is not int or not 0 <= event["bytes"] <= 1024 ** 4:
            raise APIError(400, "Invalid byte count.")
        result["bytes"] = event["bytes"]
    if "duration" in event:
        value = event["duration"]
        if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= 86400:
            raise APIError(400, "Invalid duration.")
        result["duration"] = round(value, 3)
    return result


class SQLiteStore:
    def __init__(self, path):
        self.path = pathlib.Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, at REAL NOT NULL, body TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS event_time ON events(at);
                CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, body TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS qr_scans (day TEXT NOT NULL, slug TEXT NOT NULL, country TEXT NOT NULL, hits INTEGER NOT NULL, PRIMARY KEY (day, slug, country));
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
            db.execute("DELETE FROM qr_scans WHERE day < ?", (qr_cutoff(now),))

    def rate(self, key, maximum, window, now, amount=1):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM limits WHERE expires <= ?", (now,))
            db.execute("INSERT INTO limits VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET hits = hits + excluded.hits", (key, amount, now + window))
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

    def count_qr(self, day, slug, country, now):
        with self.connect() as db:
            db.execute("DELETE FROM qr_scans WHERE day < ?", (qr_cutoff(now),))
            db.execute("INSERT INTO qr_scans VALUES (?, ?, ?, 1) ON CONFLICT(day, slug, country) DO UPDATE SET hits = hits + 1", (day, slug, country))

    def read_qr(self, days):
        with self.connect() as db:
            return db.execute("SELECT day, slug, country, hits FROM qr_scans WHERE day >= ? AND day <= ?", (min(days), max(days))).fetchall() if days else []

    def get_setting(self, key):
        with self.connect() as db:
            row = db.execute("SELECT body FROM settings WHERE key = ?", (key,)).fetchone()
            return row[0] if row else None

    def set_setting(self, key, body):
        with self.connect() as db:
            db.execute("INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET body = excluded.body", (key, body))


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
        local hits = redis.call('INCRBY', KEYS[1], ARGV[2])
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

    def rate(self, key, maximum, window, now, amount=1):
        return int(self.request(["EVAL", self.RATE, 1, PREFIX + "rate:" + key, window, amount])) <= maximum

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

    def count_qr(self, day, slug, country, now):
        key = PREFIX + "qr:" + day
        self.request([["HINCRBY", key, slug + "|" + country, 1], ["EXPIRE", key, RETENTION_SECONDS + 86400]], pipeline=True)

    def read_qr(self, days):
        groups = self.request([["HGETALL", PREFIX + "qr:" + day] for day in days], pipeline=True) if days else []
        rows = []
        try:
            for day, flat in zip(days, groups):
                for field, hits in zip(flat[::2], flat[1::2]):
                    slug, _, country = field.partition("|")
                    rows.append((day, slug, country, int(hits)))
        except (TypeError, ValueError, AttributeError):
            raise APIError(503, "Analytics storage is temporarily unavailable.") from None
        return rows

    def get_setting(self, key):
        body = self.request(["GET", key])
        if body is not None and not isinstance(body, str):
            raise APIError(503, "Library settings storage is temporarily unavailable.")
        return body

    def set_setting(self, key, body):
        self.request(["SET", key, body])


def qr_cutoff(now):
    return str(dt.datetime.fromtimestamp(now - RETENTION_SECONDS, dt.timezone.utc).date())


def dispatch_qr(route, headers, client_ip, production, public_root, now):
    """Count one printed-QR scan and send the phone on to its library.

    The redirect never depends on storage: a scan always reaches the library."""
    query = urllib.parse.parse_qs(route.query)
    slug = (query.get("l") or [""])[0]
    output_headers = {"Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer"}
    if slug not in QR_LIBRARIES:
        output_headers["Location"] = "/"
        return 302, "", output_headers
    output_headers["Location"] = "/" + slug
    country = headers.get("x-vercel-ip-country", "") if production else ""
    country = country if re.fullmatch(r"[A-Z]{2}", country) else ""
    try:
        store = get_store(production, public_root)
        if store.rate(rate_key("qr", client_ip, now), 30, 600, now):
            store.count_qr(str(dt.datetime.fromtimestamp(now, dt.timezone.utc).date()), slug, country, now)
    except (APIError, OSError, sqlite3.Error, ValueError, TypeError):
        pass
    return 302, "", output_headers


def qr_report(store, days, filters, now):
    """QR scans for the admin report: this period by language and day, and the
    previous period's total. Scans carry no item or visitor, so those filters
    leave nothing to count."""
    today = dt.datetime.fromtimestamp(now, dt.timezone.utc).date()
    current_days = [str(today - dt.timedelta(days=offset)) for offset in reversed(range(days))]
    previous_days = [str(today - dt.timedelta(days=offset)) for offset in reversed(range(days, 2 * days))]
    rows = store.read_qr(previous_days + current_days)
    if "resource" in filters or "visitor" in filters:
        rows = []
    if "country" in filters:
        rows = [row for row in rows if (row[2] or "Unknown") == filters["country"]]
    if "language" in filters:
        rows = [row for row in rows if QR_LIBRARIES.get(row[1]) == filters["language"]]
    current = set(current_days)
    daily, languages, previous = collections.Counter(), collections.Counter(), 0
    for day, slug, _country, hits in rows:
        if slug not in QR_LIBRARIES:
            continue
        if day in current:
            daily[day] += hits
            languages[QR_LIBRARIES[slug]] += hits
        else:
            previous += hits
    return {
        "total": sum(languages.values()),
        "languages": [{"name": name, "count": count} for name, count in sorted(languages.items(), key=lambda entry: (-entry[1], entry[0]))],
        "daily": [{"date": day, "count": daily[day]} for day in current_days],
        "previous": previous,
    }


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
    # Falls through to whichever server-side secret exists, so a deployment with
    # only a password set still signs sessions. With none set, an in-process
    # random key is used and every restart signs everyone out.
    configured = os.environ.get("EASYTRANSFER_ADMIN_SECRET") or os.environ.get("EASYTRANSFER_ADMIN_PASSWORD") or os.environ.get("UPSTASH_REDIS_REST_TOKEN") or os.environ.get("KV_REST_API_TOKEN")
    return hashlib.sha256(("EasyTransfer authentication v1:" + configured).encode()).digest() if configured else _EPHEMERAL_KEY


def rate_key(kind, client_ip, now):
    # This digest is only a short-lived abuse counter; raw addresses are discarded.
    material = f"{kind}:{int(now // 86400)}:{client_ip}".encode()
    return kind + ":" + hmac.new(secret_key(), material, hashlib.sha256).hexdigest()


def check_limits(store, limits, client_ip, now, message):
    for kind, maximum, window, scope in limits:
        if not store.rate(rate_key(kind, client_ip if scope == "ip" else "site", now), maximum, window, now):
            raise APIError(429, message, retry_after=window)


def _encode(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def issue_session(now):
    # Stateless signed cookie: serverless functions share no memory, so there is
    # no session table. The payload carries an HMAC of the current password, so
    # changing EASYTRANSFER_ADMIN_PASSWORD invalidates every existing session.
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
    # CSRF guard for state-changing requests (admin actions, library emails): any
    # request whose Origin is not exactly this site is refused, so another page
    # cannot drive these endpoints from a visitor's browser.
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


# Admin report filters. Country and language use the same placeholder names
# the breakdowns show for events that carry no value.
FILTERS = {
    "country": re.compile(r"^(?:[A-Z]{2}|Unknown)$"),
    "language": re.compile(r"^(?:[a-z]{3}|Unspecified)$"),
    "resource": SLUG,
    "visitor": IDENTIFIER,
}
FILTER_FIELDS = {"country": ("country", "Unknown"), "language": ("language", "Unspecified"), "resource": ("resource", None), "visitor": ("visitorId", None)}
WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def apply_filters(events, filters):
    for name, value in filters.items():
        field, blank = FILTER_FIELDS[name]
        events = [event for event in events if (event.get(field) or blank) == value]
    return events


def is_saved(event):
    # Most phones can't confirm a save and hand the file to the browser's
    # downloader instead, so a download counts once the browser has it.
    kind, status = event["type"], event.get("status", "")
    return (kind == "download_complete" and status in ("saved", "browser_handoff")) or (kind == "transfer_complete" and status == "received")


def totals(events):
    """Headline numbers for one period, used for period-over-period change."""
    kinds = collections.Counter(event["type"] for event in events)
    return {
        "visitors": len({event["visitorId"] for event in events}),
        "sessions": len({event["sessionId"] for event in events}),
        "pageViews": kinds["page_view"],
        "opens": kinds["resource_open"],
        "plays": kinds["play"],
        "saves": sum(1 for event in events if is_saved(event)),
        "shares": kinds["share_intent"],
        "sharedVisits": kinds["shared_visit"],
    }


def share_chains(events):
    """Follow passed-on links back to the first share, to show how far sharing spreads.

    A share's depth is the step it is at: 1 for someone sharing what they found
    themselves, 2 for passing on a link they were sent, and so on. Links carry
    the step, so depth survives a person in the middle who declined analytics;
    the parent links only join chains whose every step was counted.
    """
    shares = {}
    for event in events:
        if event["type"] == "share_intent" and event.get("shareId"):
            shares.setdefault(event["shareId"], event)
    visits = collections.Counter(event["shareId"] for event in events if event["type"] == "shared_visit" and event.get("shareId"))
    chains, by_depth = {}, collections.Counter()
    for share_id, event in shares.items():
        root, steps, seen = share_id, 1, {share_id}
        while True:
            parent = shares[root].get("parentShareId")
            if not parent or parent not in shares or parent in seen:
                break
            seen.add(parent)
            root, steps = parent, steps + 1
        depth = max(event.get("depth") or 1, steps)
        by_depth[depth] += 1
        chain = chains.setdefault(root, {"root": root, "resource": shares[root].get("resource") or "", "started": shares[root]["at"], "shares": 0, "sharers": set(), "visits": 0, "depth": 0})
        chain["shares"] += 1
        chain["sharers"].add(event["visitorId"])
        chain["visits"] += visits[share_id]
        chain["depth"] = max(chain["depth"], depth)
    for chain in chains.values():
        chain["sharers"] = len(chain["sharers"])
    ranked = sorted(chains.values(), key=lambda chain: (-chain["shares"], -chain["depth"], -chain["visits"], chain["started"]))
    return {
        "shares": len(shares),
        "passedOn": sum(count for depth, count in by_depth.items() if depth >= 2),
        "longest": max(by_depth, default=0),
        "chains": sum(1 for chain in chains.values() if chain["shares"] > 1 or chain["depth"] > 1),
        "byDepth": [{"name": str(depth), "count": by_depth[depth]} for depth in sorted(by_depth)],
        "top": ranked[:20],
    }


def aggregate(events, days, now, truncated=False):
    today = dt.datetime.fromtimestamp(now, dt.timezone.utc).date()
    daily = {str(today - dt.timedelta(days=offset)): {"date": str(today - dt.timedelta(days=offset)), "visits": 0, "shares": 0, "visitors": 0, "opens": 0, "plays": 0, "saves": 0} for offset in reversed(range(days))}
    day_visitors = collections.defaultdict(set)
    # Per-row tables for the CRM-style breakdowns: one row per resource,
    # language and country, each with its own unique-visitor count.
    tables = {name: {} for name in ("resourceTable", "languageTable", "countryTable")}
    table_fields = {
        "resourceTable": ("opens", "plays", "saves", "shares"),
        "languageTable": ("pageViews", "opens", "shares", "saves"),
        "countryTable": ("pageViews", "opens", "shares"),
    }
    visitor_sessions = collections.defaultdict(set)
    stages = {name: set() for name in ("openedVisitors", "engagedVisitors", "sharedVisitors", "arrivedBySharedLink")}
    hours = [0] * 24
    week_hours = [[0] * 24 for _ in WEEKDAYS]
    people = {}
    plays = play_completes = 0
    summary = {"visitors": len({event["visitorId"] for event in events}), "sessions": len({event["sessionId"] for event in events}), "pageViews": 0, "shareIntents": 0, "shareCompletions": 0, "sharedVisits": 0, "downloads": 0, "transfers": 0}
    counts = {name: collections.Counter() for name in (
        "channels", "countries", "languages", "resources", "referrers", "pages",
        "eventTypes", "statuses", "shareOutcomes", "downloadOutcomes", "transferOutcomes",
    )}
    channels, countries, languages, resources = (counts[name] for name in ("channels", "countries", "languages", "resources"))
    coverage = {"pageViewsWithCountry": 0, "pageViewsWithReferrer": 0, "sharedVisitsWithShareId": 0, "errorEvents": 0, "cancelledEvents": 0, "distinctResources": 0}
    resource_ids = set()
    for event in events:
        kind, status = event["type"], event.get("status", "")
        counts["eventTypes"][kind] += 1
        counts["statuses"][status or "unspecified"] += 1
        explicit_cancel = status in ("cancelled", "declined")
        is_error = not explicit_cancel and (status in ("failed", "error") or kind.endswith("_error"))
        coverage["errorEvents"] += int(is_error)
        coverage["cancelledEvents"] += int(explicit_cancel or (not is_error and kind.endswith("_cancel")))
        if event.get("resource"):
            resource_ids.add(event["resource"])
        if kind in ("share_complete", "share_cancel"):
            counts["shareOutcomes"][status or "unspecified"] += 1
        if kind in ("download_complete", "download_cancel", "download_error"):
            counts["downloadOutcomes"][status or "unspecified"] += 1
        if kind in ("transfer_complete", "transfer_error"):
            counts["transferOutcomes"][status or "unspecified"] += 1
        day = daily.get(event["at"][:10])
        visitor = event["visitorId"]
        visitor_sessions[visitor].add(event["sessionId"])
        if day:
            day_visitors[day["date"]].add(visitor)
        rows = []
        for table, key in (("resourceTable", event.get("resource")), ("languageTable", event.get("language") or "Unspecified"), ("countryTable", event.get("country") or "Unknown")):
            if key:
                row = tables[table].setdefault(key, dict({"name": key, "visitors": set()}, **{field: 0 for field in table_fields[table]}))
                row["visitors"].add(visitor)
                rows.append(row)
        saved = is_saved(event)
        person = people.get(visitor)
        if person is None:
            # Events arrive newest first, so the first one seen is the latest.
            person = people[visitor] = {"id": visitor, "firstSeen": event["at"], "lastSeen": event["at"], "sessions": set(), "events": 0, "pageViews": 0, "opens": 0, "plays": 0, "saves": 0, "shares": 0, "arrivedByShare": False, "country": event.get("country") or "", "language": event.get("language") or "", "lastResource": event.get("resource") or ""}
        person["firstSeen"] = min(person["firstSeen"], event["at"])
        person["lastSeen"] = max(person["lastSeen"], event["at"])
        person["sessions"].add(event["sessionId"])
        person["events"] += 1
        person["country"] = person["country"] or event.get("country") or ""
        person["language"] = person["language"] or event.get("language") or ""
        person["lastResource"] = person["lastResource"] or event.get("resource") or ""
        person["arrivedByShare"] = person["arrivedByShare"] or kind == "shared_visit"
        increments = {"pageViews": kind == "page_view", "opens": kind == "resource_open", "plays": kind == "play", "saves": saved, "shares": kind == "share_intent"}
        for row in rows + [person]:
            for field, hit in increments.items():
                if field in row:
                    row[field] += int(hit)
        if kind == "resource_open":
            stages["openedVisitors"].add(visitor)
            if day:
                day["opens"] += 1
        if kind in ("play", "download_start", "download_complete", "transfer_complete"):
            stages["engagedVisitors"].add(visitor)
        if kind == "share_intent":
            stages["sharedVisitors"].add(visitor)
        if kind == "shared_visit":
            stages["arrivedBySharedLink"].add(visitor)
        if saved and day:
            day["saves"] += 1
        plays += int(kind == "play")
        if kind == "play" and day:
            day["plays"] += 1
        play_completes += int(kind == "play_complete")
        if kind == "page_view" and event["at"][11:13].isdigit() and int(event["at"][11:13]) < 24:
            hours[int(event["at"][11:13])] += 1
            try:
                week_hours[dt.date.fromisoformat(event["at"][:10]).weekday()][int(event["at"][11:13])] += 1
            except ValueError:
                pass
        if kind == "page_view":
            summary["pageViews"] += 1
            if day:
                day["visits"] += 1
            countries[event.get("country") or "Unknown"] += 1
            languages[event.get("language") or "Unspecified"] += 1
            counts["referrers"][event.get("referrer") or "Direct / unknown"] += 1
            counts["pages"][event["path"]] += 1
            coverage["pageViewsWithCountry"] += int(bool(event.get("country")))
            coverage["pageViewsWithReferrer"] += int(bool(event.get("referrer")))
        if kind == "share_intent":
            summary["shareIntents"] += 1
            channels[event.get("channel") or "unknown"] += 1
            if day:
                day["shares"] += 1
        if kind == "share_complete" and status in ("copied", "completed", "success", "sent"):
            summary["shareCompletions"] += 1
        if kind == "shared_visit":
            summary["sharedVisits"] += 1
            coverage["sharedVisitsWithShareId"] += int(bool(event.get("shareId")))
        if kind == "download_complete" and status == "saved":
            summary["downloads"] += 1
        if kind == "transfer_complete" and status == "received":
            summary["transfers"] += 1
        if kind == "resource_open" and event.get("resource"):
            resources[event["resource"]] += 1
    coverage["distinctResources"] = len(resource_ids)
    result = {"summary": summary, "daily": list(daily.values()), "events": events[:MAX_RECENT_EVENTS], "retentionDays": RETENTION_DAYS, "truncated": truncated, "recentEventsTruncated": len(events) > MAX_RECENT_EVENTS, "analyzedEvents": len(events), "analysisLimit": MAX_ANALYSIS_EVENTS, "coverage": coverage, "generatedAt": iso_at(now), "periodDays": days, "reportingTimezone": "UTC"}
    for collection, counter in counts.items():
        result[collection] = [{"name": name, "count": count} for name, count in sorted(counter.items(), key=lambda entry: (-entry[1], entry[0]))[:100]]
    # Denominators include rows omitted by the per-breakdown cap, within the
    # analyzed window. A truncated report still covers only analyzed events.
    result["breakdownTotals"] = {name: sum(counter.values()) for name, counter in counts.items()}
    result["breakdownTruncated"] = {name: len(counter) > 100 for name, counter in counts.items()}
    for date, visitors in day_visitors.items():
        daily[date]["visitors"] = len(visitors)
    for table, rows in tables.items():
        for row in rows.values():
            row["visitors"] = len(row["visitors"])
        ranked = sorted(rows.values(), key=lambda row: (-sum(value for key, value in row.items() if key != "name"), row["name"]))
        result[table] = ranked[:100]
        result["breakdownTruncated"][table] = len(ranked) > 100
    result["engagement"] = dict({name: len(members) for name, members in stages.items()},
                                returningVisitors=sum(1 for sessions in visitor_sessions.values() if len(sessions) > 1),
                                plays=plays, playCompletes=play_completes)
    result["hours"] = hours
    result["weekHours"] = [{"day": name, "hours": row} for name, row in zip(WEEKDAYS, week_hours)]
    for person in people.values():
        person["sessions"] = len(person["sessions"])
    ranked_people = sorted(people.values(), key=lambda person: (person["lastSeen"], person["id"]), reverse=True)
    result["visitorTable"] = ranked_people[:200]
    result["breakdownTruncated"]["visitorTable"] = len(ranked_people) > 200
    result["totals"] = totals(events)
    result["shareChains"] = share_chains(events)
    return result


def validate_visibility(payload, now):
    """Admin switches: only overrides of the app's built-in defaults are kept."""
    if not isinstance(payload, dict) or set(payload) - {"action", "types", "items"} or payload.get("action") != "save":
        raise APIError(400, "Invalid library settings.")
    types, items = payload.get("types", {}), payload.get("items", {})
    if not isinstance(types, dict) or not isinstance(items, dict) or len(types) > 500 or len(items) > MAX_VISIBILITY_ITEMS:
        raise APIError(400, "Invalid library settings.")
    clean_types = {}
    for language, switches in types.items():
        if not isinstance(language, str) or not LANGUAGE_CODE.match(language) or not isinstance(switches, dict):
            raise APIError(400, "Invalid library settings.")
        if any(kind not in CONTENT_TYPES or type(value) is not bool for kind, value in switches.items()):
            raise APIError(400, "Invalid library settings.")
        if switches:
            clean_types[language] = dict(sorted(switches.items()))
    for resource, value in items.items():
        if not isinstance(resource, str) or not 0 < len(resource) <= 200 or any(ord(c) < 32 for c in resource) or type(value) is not bool:
            raise APIError(400, "Invalid library settings.")
    return {"v": 1, "types": dict(sorted(clean_types.items())), "items": dict(sorted(items.items())), "updatedAt": iso_at(now)}


def read_visibility(store):
    body = store.get_setting(VISIBILITY_KEY)
    if not body:
        return None
    try:
        state = json.loads(body)
    except ValueError:
        return None
    return state if isinstance(state, dict) and state.get("v") == 1 else None


def visibility_script(state):
    # A classic script, so file:// and offline pages simply fail to load it and
    # keep the built-in defaults (or the copy they last saw).
    return "window.ET_VISIBILITY_LIVE = " + json.dumps(state, separators=(",", ":")) + ";\n"


def dispatch_visibility(route, method, headers, payload, production, public_root, now, output_headers):
    if method == "GET":
        query = urllib.parse.parse_qs(route.query)
        if query.get("format") == ["json"]:
            state = read_visibility(get_store(production, public_root))
            return 200, {"state": state, "admin": authenticated(headers, now)}, output_headers
        try:
            state = read_visibility(get_store(production, public_root))
        except (APIError, OSError, sqlite3.Error, ValueError, TypeError):
            # Unconfigured or unavailable storage must never break the library.
            state = None
        output_headers = {**output_headers, "Content-Type": "application/javascript; charset=utf-8",
                          "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=60"}
        return 200, visibility_script(state), output_headers
    if not os.environ.get("EASYTRANSFER_ADMIN_PASSWORD"):
        raise APIError(503, "Admin access is not configured. Set EASYTRANSFER_ADMIN_PASSWORD.")
    if not authenticated(headers, now):
        raise APIError(401, "Admin sign-in is required.")
    state = validate_visibility(payload, now)
    get_store(production, public_root).set_setting(VISIBILITY_KEY, json.dumps(state, separators=(",", ":")))
    return 200, {"ok": True, "state": state}, output_headers


def dispatch(path, method, headers, raw=b"", client_ip="", production=False, public_root=None, now=None):
    """Return status, JSON object and response headers without leaking errors."""
    now = time.time() if now is None else now
    headers = {key.lower(): value for key, value in headers.items()}
    output_headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
    try:
        route = urllib.parse.urlsplit(path)
        if route.path not in ("/api/analytics", "/api/admin", "/api/visibility", "/api/qr"):
            raise APIError(404, "API not found.")
        if route.path == "/api/qr":
            if method != "GET":
                raise APIError(405, "Method not allowed.")
            return dispatch_qr(route, headers, client_ip, production, public_root, now)
        if method not in (("POST",) if route.path == "/api/analytics" else ("GET", "POST")):
            raise APIError(405, "Method not allowed.")
        limit = MAX_VISIBILITY_BODY if route.path == "/api/visibility" else MAX_BODY
        payload = None
        if method == "POST":
            require_same_origin(headers, production)
            if headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
                raise APIError(415, "Use application/json.")
            if len(raw) > limit:
                raise APIError(413, "Request body is too large.")
            try:
                payload = json.loads(raw)
            except (ValueError, UnicodeError, RecursionError):
                raise APIError(400, "Invalid JSON.") from None
        if route.path == "/api/visibility":
            return dispatch_visibility(route, method, headers, payload, production, public_root, now, output_headers)
        if route.path == "/api/analytics":
            country = headers.get("x-vercel-ip-country", "") if production else ""
            events = validate_events(payload, now, country)
            store = get_store(production, public_root)
            check_limits(store, EVENT_LIMITS, client_ip, now, "Too many analytics requests. Try again shortly.")
            if not store.rate(rate_key("events-site", "site", now), SITE_EVENTS_PER_DAY, 86400, now, amount=len(events)):
                raise APIError(429, "Analytics is busy. Try again later.", retry_after=3600)
            inserted = store.append(events, now)
            return 200, {"ok": True, "accepted": inserted, "duplicates": len(events) - inserted, "rejected": len(payload["events"]) - len(events)}, output_headers
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
            check_limits(store, LOGIN_LIMITS, client_ip, now, "Too many login attempts. Try again later.")
            if not hmac.compare_digest(payload["password"].encode(), os.environ["EASYTRANSFER_ADMIN_PASSWORD"].encode()):
                raise APIError(401, "Invalid admin credentials.")
            output_headers["Set-Cookie"] = cookie_header(issue_session(now), production)
            return 200, {"ok": True}, output_headers
        if not authenticated(headers, now):
            raise APIError(401, "Admin sign-in is required.")
        query = urllib.parse.parse_qs(route.query, keep_blank_values=True)
        if set(query) - {"days"} - set(FILTERS) or any(len(values) != 1 for values in query.values()) or query.get("days", ["30"])[0] not in ("7", "30", "90"):
            raise APIError(400, "Choose a 7, 30 or 90 day period.")
        days = int(query.get("days", ["30"])[0])
        filters = {name: query[name][0] for name in FILTERS if name in query}
        if any(not FILTERS[name].match(value) for name, value in filters.items()):
            raise APIError(400, "Invalid filter.")
        today = dt.datetime.fromtimestamp(now, dt.timezone.utc).date()
        start = dt.datetime.combine(today - dt.timedelta(days=days - 1), dt.time(), dt.timezone.utc).timestamp()
        # One read covers this period and the one before it. The store returns
        # newest first, so a capped read always keeps the current period whole
        # before it drops anything from the comparison period.
        store = get_store(production, public_root)
        events, truncated = store.read(start - days * 86400, now)
        current = [event for event in events if timestamp(event["at"]) >= start]
        previous = [event for event in events if timestamp(event["at"]) < start]
        current_truncated = truncated and not previous
        comparable = not truncated and start - days * 86400 > now - RETENTION_SECONDS
        current, previous = (apply_filters(group, filters) for group in (current, previous))
        result = aggregate(current, days, now, current_truncated)
        result["filters"] = filters
        result["previous"] = totals(previous) if comparable else None
        result["qrScans"] = qr_report(store, days, filters, now)
        return 200, result, output_headers
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
            limit = MAX_VISIBILITY_BODY if urllib.parse.urlsplit(handler.path).path == "/api/visibility" else MAX_BODY
            if length < 0 or length > limit:
                raise APIError(413, "Request body is too large.")
            raw = handler.rfile.read(length)
        address = handler.headers.get("x-real-ip", "") if production else handler.client_address[0]
        code, payload, headers = dispatch(handler.path, handler.command, dict(handler.headers), raw, address, production, public_root)
    except (ValueError, APIError) as error:
        code, payload = (error.status, {"error": error.message}) if isinstance(error, APIError) else (400, {"error": "Invalid request length."})
        headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
    if isinstance(payload, str):
        body = payload.encode()
    else:
        body = json.dumps(payload, separators=(",", ":")).encode()
        headers = {"Content-Type": "application/json; charset=utf-8", **headers}
    handler.send_response(code)
    handler.send_header("Content-Length", str(len(body)))
    for key, value in headers.items():
        handler.send_header(key, value)
    handler.end_headers()
    handler.wfile.write(body)
