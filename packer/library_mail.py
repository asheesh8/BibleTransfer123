"""Send one language library's link by email from the outreach account.

The message is a fixed template: the visitor only chooses a recipient and one of
the published language libraries, so the endpoint cannot relay arbitrary text.
SMTP credentials come from server environment variables and never reach a page.
"""
import email.message
import email.utils
import hashlib
import hmac
import json
import os
import re
import smtplib
import ssl
import sys
import time
import urllib.parse

try:
    from packer.analytics import APIError, IDENTIFIER, get_store, rate_key, require_same_origin, secret_key
except ImportError:                  # direct `python3 packer/serve.py`
    from analytics import APIError, IDENTIFIER, get_store, rate_key, require_same_origin, secret_key

MAX_BODY = 2048
ADDRESS = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?=.{4,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$")
# Sends per visitor address per hour, per recipient per day, and site-wide per day.
LIMITS = (("mail-ip", 8, 3600), ("mail-to", 3, 86400), ("mail-all", 300, 86400))

# One entry per one-language page (app/<slug>/index.html); a test keeps them in step.
LIBRARIES = {
    "akan": ("Akan", "Twi (Akan)"),
    "amharic": ("Amharic", "አማርኛ"),
    "arabic": ("Arabic", "العربية"),
    "cantonese": ("Cantonese", "廣東話"),
    "chichewa": ("Chichewa", "Chichewa"),
    "eastern-punjabi": ("Eastern Punjabi", "ਪੰਜਾਬੀ"),
    "english": ("English", "English"),
    "french": ("French", "Français"),
    "gusii": ("Gusii", "Ekegusii / Kisii"),
    "haitian": ("Haitian Creole", "Kreyòl ayisyen"),
    "hausa": ("Hausa", "Hausa"),
    "hindi": ("Hindi", "हिन्दी"),
    "igbo": ("Igbo", "Asụsụ Igbo"),
    "kikuyu": ("Kikuyu", "Gĩkũyũ"),
    "kinyarwanda": ("Kinyarwanda", "Ikinyarwanda"),
    "kirundi": ("Kirundi", "Ikirundi"),
    "lingala": ("Lingala", "Lingála"),
    "luganda": ("Luganda", "Luganda"),
    "luo": ("Luo", "Dholuo"),
    "maasai": ("Maasai", "ɔl Maa"),
    "malagasy": ("Malagasy", "Malagasy"),
    "mandarin": ("Mandarin", "普通话"),
    "marathi": ("Marathi", "मराठी"),
    "nepali": ("Nepali", "नेपाली"),
    "nigerian-pidgin": ("Nigerian Pidgin", "Naija Pidgin"),
    "oromo": ("Oromo", "Afaan Oromoo"),
    "pashto": ("Pashto", "پښتو"),
    "portuguese": ("Portuguese", "Português"),
    "shona": ("Shona", "chiShona"),
    "sindhi": ("Sindhi", "سنڌي"),
    "swahili": ("Swahili", "Kiswahili"),
    "tigrinya": ("Tigrinya", "ትግርኛ"),
    "urdu": ("Urdu", "اردو"),
    "western-punjabi": ("Western Punjabi", "پنجابی"),
    "xhosa": ("Xhosa", "isiXhosa"),
    "yoruba": ("Yoruba", "Èdè Yorùbá"),
    "zulu": ("Zulu", "isiZulu"),}


def smtp_settings():
    host, user, password = (os.environ.get(name, "") for name in ("OUTREACH_SMTP_HOST", "OUTREACH_SMTP_USER", "OUTREACH_SMTP_PASSWORD"))
    if not (host and user and password):
        raise APIError(503, "Email sending is not configured.")
    try:
        port = int(os.environ.get("OUTREACH_SMTP_PORT") or 587)
    except ValueError:
        raise APIError(503, "Email sending is not configured.") from None
    return {
        "host": host, "port": port, "user": user, "password": password,
        "from": os.environ.get("OUTREACH_FROM_EMAIL") or user,
        "name": os.environ.get("OUTREACH_FROM_NAME") or "VillageServer Outreach",
        "reply_to": os.environ.get("OUTREACH_REPLY_TO", ""),
    }


def library_link(origin, slug, share_id):
    link = origin.rstrip("/") + "/" + slug
    if share_id:
        link += "?" + urllib.parse.urlencode({"et_share": share_id, "et_channel": "email"})
    return link


def compose(settings, recipient, slug, link):
    name, native = LIBRARIES[slug]
    title = name + (" (" + native + ")" if native != name else "") + " Bible Library"
    message = email.message.EmailMessage()
    message["Subject"] = title
    message["From"] = email.utils.formataddr((settings["name"], settings["from"]))
    message["To"] = recipient
    if settings["reply_to"]:
        message["Reply-To"] = settings["reply_to"]
    message["Date"] = email.utils.formatdate(localtime=False)
    message["Message-ID"] = email.utils.make_msgid(domain=settings["from"].rsplit("@", 1)[-1])
    message.set_content(
        f"Hello,\n\nSomeone shared the {title} with you. It has free Bible films, Scripture "
        f"and audio in {name}, ready to watch online or save to your phone:\n\n{link}\n\n"
        f"Sent by {settings['name']} at someone's request. If this was not meant for you, "
        "you can ignore it; we will not email you again unless someone shares a library with you.\n"
    )
    safe = {key: value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
            for key, value in (("title", title), ("name", name), ("link", link), ("sender", settings["name"]))}
    message.add_alternative(
        f"""<!doctype html><html><body style="font-family:Arial,sans-serif;color:#2a1a33;line-height:1.5">
<p>Hello,</p>
<p>Someone shared the <strong>{safe['title']}</strong> with you. It has free Bible films, Scripture and audio in {safe['name']}, ready to watch online or save to your phone.</p>
<p><a href="{safe['link']}" style="display:inline-block;background:#1fa463;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Open the library</a></p>
<p style="font-size:13px;color:#6b5a73">Or copy this link: {safe['link']}</p>
<p style="font-size:13px;color:#6b5a73">Sent by {safe['sender']} at someone's request. If this was not meant for you, you can ignore it.</p>
</body></html>""", subtype="html")
    return message


def deliver(settings, message):
    context = ssl.create_default_context()
    try:
        if settings["port"] == 465:
            server = smtplib.SMTP_SSL(settings["host"], settings["port"], timeout=12, context=context)
        else:
            server = smtplib.SMTP(settings["host"], settings["port"], timeout=12)
        with server:
            if settings["port"] != 465:
                server.starttls(context=context)
            server.login(settings["user"], settings["password"])
            server.send_message(message)
    except smtplib.SMTPRecipientsRefused:
        raise APIError(400, "That email address was refused.") from None
    except smtplib.SMTPAuthenticationError:
        # Says which setting to fix without echoing anything the server returned.
        print("send-library: SMTP login was rejected; check OUTREACH_SMTP_USER and OUTREACH_SMTP_PASSWORD", file=sys.stderr)
        raise APIError(502, "The outreach mailbox rejected its sign-in.") from None
    except (smtplib.SMTPException, OSError) as error:
        print("send-library: SMTP send failed:", type(error).__name__, file=sys.stderr)
        raise APIError(502, "The email could not be sent right now (" + type(error).__name__ + ").") from None


def origin_for(headers, production):
    configured = os.environ.get("EASYTRANSFER_PUBLIC_ORIGIN", "")
    return configured.rstrip("/") if configured else ("https" if production else "http") + "://" + headers.get("host", "")


def dispatch(path, method, headers, raw=b"", client_ip="", production=False, public_root=None, now=None, send=deliver):
    now = time.time() if now is None else now
    headers = {key.lower(): value for key, value in headers.items()}
    output_headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
    try:
        if urllib.parse.urlsplit(path).path != "/api/send-library":
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
        if not isinstance(payload, dict) or set(payload) - {"to", "library", "shareId"} or not isinstance(payload.get("to"), str) or not isinstance(payload.get("library"), str):
            raise APIError(400, "Invalid request.")
        recipient, slug, share_id = payload["to"].strip(), payload["library"], payload.get("shareId") or ""
        if slug not in LIBRARIES:
            raise APIError(400, "Unknown library.")
        if not ADDRESS.match(recipient):
            raise APIError(400, "Enter a valid email address.")
        if not isinstance(share_id, str) or (share_id and not IDENTIFIER.match(share_id)):
            raise APIError(400, "Invalid request.")
        settings = smtp_settings()
        store = get_store(production, public_root)
        hashed_to = hmac.new(secret_key(), recipient.lower().encode(), hashlib.sha256).hexdigest()
        for kind, maximum, window in LIMITS:
            subject = client_ip if kind == "mail-ip" else hashed_to if kind == "mail-to" else "site"
            if not store.rate(rate_key(kind, subject, now), maximum, window, now):
                raise APIError(429, "Too many emails right now. Try again later.", retry_after=window)
        link = library_link(origin_for(headers, production), slug, share_id)
        send(settings, compose(settings, recipient, slug, link))
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
