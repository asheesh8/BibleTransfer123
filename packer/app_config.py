"""/api/app-config: what the iPhone and Android apps ask the site when they open.

The apps carry the whole library, so this is the one thing they check online:
is this version still fine (update "none"), is a newer one in the store
("available"), or is it too old to keep using ("required", for a broken or
unsafe release only). It also hands them the store, privacy, data-deletion
and support links and switches for the online features, so a store review
problem or an outage can be handled without shipping a new app.

The answer is public and the same for everyone, so it is cacheable and any
origin may read it. Edit registry/app-config.json to change it.
"""
import json
import pathlib
import re
import urllib.parse

try:
    from packer.analytics import APIError
except ImportError:                  # direct `python3 packer/serve.py`
    from analytics import APIError

CONFIG = pathlib.Path(__file__).resolve().parent.parent / "registry" / "app-config.json"
PUBLIC_ORIGIN = "https://www.bibletransfer123.org"
PLATFORMS = ("ios", "android")
VERSION = re.compile(r"^\d{1,4}(?:\.\d{1,4}){0,2}$")
FEATURES = ("analytics", "emailShare", "nearbyOnline", "dataDeletion")
LINKS = {
    "privacy": PUBLIC_ORIGIN + "/privacy",
    "deleteData": PUBLIC_ORIGIN + "/delete-data",
    "support": PUBLIC_ORIGIN + "/support",
    "website": PUBLIC_ORIGIN + "/",
}
SUPPORT_EMAIL = "villageserverinitiative@gmail.com"
NOTICE_ID = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


def parse_version(value):
    return tuple(int(part) for part in value.split(".")) + (0,) * (3 - value.count(".") - 1)


def load(path=CONFIG):
    """Read and check the config; a bad edit fails the tests, not the apps."""
    config = json.loads(path.read_text(encoding="utf-8"))
    for platform in PLATFORMS:
        entry = config["platforms"][platform]
        if not VERSION.fullmatch(entry["latest"]) or not VERSION.fullmatch(entry["minimum"]):
            raise ValueError("app-config: %s versions must look like 1.2.3" % platform)
        if parse_version(entry["minimum"]) > parse_version(entry["latest"]):
            raise ValueError("app-config: %s minimum is above latest" % platform)
        if entry["store"] and not entry["store"].startswith("https://"):
            raise ValueError("app-config: %s store link must be https" % platform)
    notice = config.get("notice")
    if notice is not None and (set(notice) != {"id", "text"} or not NOTICE_ID.fullmatch(notice["id"])
                               or not isinstance(notice["text"], str) or not 0 < len(notice["text"]) <= 280):
        raise ValueError("app-config: notice needs an id and up to 280 characters of text")
    if set(config["features"]) != set(FEATURES) or any(type(v) is not bool for v in config["features"].values()):
        raise ValueError("app-config: features must be exactly %s, each true or false" % ", ".join(FEATURES))
    return config


def answer(query, config):
    params = urllib.parse.parse_qs(query, keep_blank_values=True)
    if set(params) - {"platform", "version"} or any(len(values) != 1 for values in params.values()):
        raise APIError(400, "Use ?platform=ios|android&version=1.2.3.")
    platform = params.get("platform", [""])[0]
    if platform not in PLATFORMS:
        raise APIError(400, "Use ?platform=ios|android&version=1.2.3.")
    version = params.get("version", [""])[0]
    if version and not VERSION.fullmatch(version):
        raise APIError(400, "Use ?platform=ios|android&version=1.2.3.")
    entry = config["platforms"][platform]
    if not version:
        update = "unknown"
    elif parse_version(version) < parse_version(entry["minimum"]):
        update = "required"
    elif parse_version(version) < parse_version(entry["latest"]):
        update = "available"
    else:
        update = "none"
    return {
        "ok": True, "platform": platform, "version": version or None, "update": update,
        "latestVersion": entry["latest"], "minimumVersion": entry["minimum"], "storeUrl": entry["store"] or None,
        "links": LINKS, "supportEmail": SUPPORT_EMAIL, "notice": config.get("notice"), "features": config["features"],
    }


def dispatch(path, method, headers=None, config_path=CONFIG):
    output_headers = {"X-Content-Type-Options": "nosniff", "Access-Control-Allow-Origin": "*",
                      "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400"}
    try:
        route = urllib.parse.urlsplit(path)
        if route.path != "/api/app-config":
            raise APIError(404, "API not found.")
        if method == "OPTIONS":
            return 204, "", {"Cache-Control": "no-store", **output_headers}
        if method not in ("GET", "HEAD"):
            raise APIError(405, "Method not allowed.")
        body = answer(route.query, load(config_path))
        # Short enough that raising `minimum` reaches every phone within minutes.
        return 200, body, {"Cache-Control": "public, max-age=300, s-maxage=300", **output_headers}
    except APIError as error:
        return error.status, {"error": error.message}, {"Cache-Control": "no-store", **output_headers}
    except (OSError, ValueError, KeyError, TypeError):
        return 503, {"error": "App settings are temporarily unavailable."}, {"Cache-Control": "no-store", **output_headers}


def handle_http(handler, production=False, public_root=None):
    code, payload, headers = dispatch(handler.path, handler.command, dict(handler.headers))
    body = payload.encode() if isinstance(payload, str) else json.dumps(payload, separators=(",", ":")).encode()
    if not isinstance(payload, str):
        headers = {"Content-Type": "application/json; charset=utf-8", **headers}
    handler.send_response(code)
    handler.send_header("Content-Length", str(len(body)))
    for key, value in headers.items():
        handler.send_header(key, value)
    handler.end_headers()
    if handler.command != "HEAD":
        handler.wfile.write(body)
