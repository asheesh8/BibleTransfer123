"""Email one library item to a friend from the outreach account, with who sent it.

Like library_mail, the message is a fixed, translated template. The visitor
supplies only a recipient address, the item's ID, their own first name and,
optionally, the recipient's name. Names are restricted to letters, spaces,
hyphens and apostrophes so they cannot carry links. The item's title comes
from the published catalogue, never from the request.

Each link carries the sender's name and its place in the sharing chain
(et_from, et_hop) so the person who opens it sees who it came from and is
invited to pass it on. The recipient's address is used to send this one
message and, hashed, for the per-recipient rate limit; it is not stored.
"""
import email.message
import email.utils
import hashlib
import hmac
import json
import pathlib
import threading
import time
import unicodedata
import urllib.parse

try:
    from packer.analytics import APIError, IDENTIFIER, get_store, rate_key, require_same_origin, secret_key
    from packer.library_mail import ADDRESS, LIBRARIES, LIMITS, deliver, origin_for, smtp_settings
    from packer.item_mail_copy import COPY
except ImportError:                  # direct `python3 packer/serve.py`
    from analytics import APIError, IDENTIFIER, get_store, rate_key, require_same_origin, secret_key
    from library_mail import ADDRESS, LIBRARIES, LIMITS, deliver, origin_for, smtp_settings
    from item_mail_copy import COPY

MAX_BODY = 2048
MAX_NAME = 40
MAX_HOP = 999
APP = pathlib.Path(__file__).resolve().parent.parent / "app"
_catalogs, _lock = {}, threading.Lock()


def clean_name(value, required):
    """A first name: letters (any script), marks, spaces, hyphens, apostrophes."""
    if value is None and not required:
        return ""
    if not isinstance(value, str):
        raise APIError(400, "Invalid request.")
    name = " ".join(value.split())
    if not name:
        if required:
            raise APIError(400, "Enter your name.")
        return ""
    if len(name) > MAX_NAME or not all(
            unicodedata.category(c)[0] in "LM" or c in " '’-" for c in name) or not any(c.isalpha() for c in name):
        raise APIError(400, "Use letters only for names.")
    return name


def catalog(public_root=None):
    """Item ID -> (title, language) from the catalogue the pages themselves load."""
    path = pathlib.Path(public_root or APP) / "data" / "catalog.js"
    key = str(path)
    with _lock:
        if key not in _catalogs:
            text = path.read_text(encoding="utf-8")
            start = text.index("{", text.index("window.LIBRARY"))
            library = json.loads(text[start:].rstrip().rstrip(";"))
            _catalogs[key] = {r["id"]: (r.get("title") or r["id"], r.get("lang") or "")
                              for r in library.get("resources", []) if isinstance(r, dict) and r.get("id")}
        return _catalogs[key]


def item_link(origin, item, lang, ui, library, sender, hop, share_id):
    params = [("id", item)]
    if library:
        # Keep the recipient inside the one-language library it was sent from.
        params += [("only", lang), ("ui", ui), ("share", library), ("name", LIBRARIES[library][0])]
    params += [("et_from", sender), ("et_hop", str(hop))]
    if share_id:
        params += [("et_share", share_id), ("et_channel", "email")]
    return origin.rstrip("/") + "/item.html?" + urllib.parse.urlencode(params)


def fill(text, **values):
    for key, value in values.items():
        text = text.replace("{" + key + "}", value)
    return text


def escape(value):
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def compose(settings, recipient, to_name, sender, title, link, lang):
    copy = dict(COPY["en"], **COPY.get(lang, {}))
    values = {"from": sender, "to": to_name, "title": title}
    hello = fill(copy["hello"] if to_name else copy["hello.anon"], **values)
    line = fill(copy["line"], **values)
    fromto = fill(copy["fromto"] if to_name else copy["from"], **values)
    footer = fill(copy["footer"], **values)
    message = email.message.EmailMessage()
    message["Subject"] = fill(copy["subject"], **values)
    message["From"] = email.utils.formataddr((sender + " via " + settings["name"], settings["from"]))
    message["To"] = email.utils.formataddr((to_name, recipient)) if to_name else recipient
    if settings["reply_to"]:
        message["Reply-To"] = settings["reply_to"]
    message["Date"] = email.utils.formatdate(localtime=False)
    message["Message-ID"] = email.utils.make_msgid(domain=settings["from"].rsplit("@", 1)[-1])
    message.set_content(f"{hello}\n\n{line}\n{fromto}\n\n{link}\n\n{copy['pass']}\n\n{footer}\n")
    direction = "rtl" if lang in ("ar", "ur", "snd", "ps", "pnb") else "ltr"
    message.add_alternative(
        f"""<!doctype html><html lang="{escape(lang)}" dir="{direction}"><body style="font-family:Arial,sans-serif;color:#2a1a33;line-height:1.5">
<p>{escape(hello)}</p>
<p>{escape(line)}</p>
<p style="display:inline-block;background:#f4eef7;border-radius:10px;padding:8px 14px;font-weight:bold">{escape(fromto)}</p>
<p><a href="{escape(link)}" style="display:inline-block;background:#1fa463;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">{escape(copy['open'])}</a></p>
<p>{escape(copy['pass'])}</p>
<p style="font-size:13px;color:#6b5a73">{escape(link)}</p>
<p style="font-size:13px;color:#6b5a73">{escape(footer)}</p>
</body></html>""", subtype="html")
    return message


def dispatch(path, method, headers, raw=b"", client_ip="", production=False, public_root=None, now=None, send=deliver):
    now = time.time() if now is None else now
    headers = {key.lower(): value for key, value in headers.items()}
    output_headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
    try:
        if urllib.parse.urlsplit(path).path != "/api/send-item":
            raise APIError(404, "API not found.")
        if method != "POST":
            raise APIError(405, "Method not allowed.")
        require_same_origin(headers, production)
        if headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
            raise APIError(415, "Use application/json.")
        if len(raw) > MAX_BODY:
            raise APIError(413, "Request body is too large.")
        try:
            payload = json.loads(raw)
        except (ValueError, UnicodeError, RecursionError):
            raise APIError(400, "Invalid JSON.") from None
        if not isinstance(payload, dict) or set(payload) - {"to", "item", "from", "toName", "lang", "library", "hop", "shareId"} \
                or not isinstance(payload.get("to"), str) or not isinstance(payload.get("item"), str):
            raise APIError(400, "Invalid request.")
        found = catalog(public_root).get(payload["item"])
        if not found:
            raise APIError(400, "Unknown item.")
        title, item_lang = found
        recipient = payload["to"].strip()
        if not ADDRESS.match(recipient):
            raise APIError(400, "Enter a valid email address.")
        sender = clean_name(payload.get("from"), True)
        to_name = clean_name(payload.get("toName"), False)
        lang = payload.get("lang") or "en"
        library = payload.get("library") or ""
        hop = payload.get("hop", 1)
        share_id = payload.get("shareId") or ""
        if not isinstance(lang, str) or lang not in COPY or not isinstance(library, str) or (library and library not in LIBRARIES):
            raise APIError(400, "Invalid request.")
        if type(hop) is not int or not 1 <= hop <= MAX_HOP:
            raise APIError(400, "Invalid request.")
        if not isinstance(share_id, str) or (share_id and not IDENTIFIER.match(share_id)):
            raise APIError(400, "Invalid request.")
        settings = smtp_settings()
        store = get_store(production, public_root)
        hashed_to = hmac.new(secret_key(), recipient.lower().encode(), hashlib.sha256).hexdigest()
        # The same budget as library emails: one outreach mailbox, one set of limits.
        for kind, maximum, window in LIMITS:
            subject = client_ip if kind.startswith("mail-ip") else hashed_to if kind.startswith("mail-to") else "site"
            if not store.rate(rate_key(kind, subject, now), maximum, window, now):
                raise APIError(429, "Too many emails right now. Try again later.", retry_after=window)
        link = item_link(origin_for(headers, production), payload["item"], item_lang, lang, library, sender, hop, share_id)
        send(settings, compose(settings, recipient, to_name, sender, title, link, lang))
        return 200, {"ok": True}, output_headers
    except APIError as error:
        if error.status == 429:
            output_headers["Retry-After"] = str(error.retry_after)
        return error.status, {"error": error.message}, output_headers
    except (OSError, ValueError, TypeError):
        return 503, {"error": "Email sending is temporarily unavailable."}, output_headers


def handle_http(handler, production=False, public_root=None):
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
