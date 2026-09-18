#!/usr/bin/env python3
"""Serve the library over HTTP, the way a VillageServer Raspberry Pi does.

    python3 packer/serve.py [port]              the app in app/, for development
    python3 packer/serve.py [port] --root card  a built card, media and all

Differs from `python3 -m http.server` in three ways that matter: it never lets a
browser cache anything (so an edit shows up on reload instead of an hour later),
it serves the right content types for .mp4 and .webp, which some Python builds
get wrong and which a video silently fails on, and it honours Range requests
properly so seeking inside a two-hour film works.

Pointed at a built card, this is the whole offline library on a local network —
no internet, and anyone who joins can watch, read and save.
"""
import email.utils, functools, http.server, json, mimetypes, os, pathlib, re, socketserver, sys, threading, time, urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent / "app"
CATALOG = ROOT / "data" / "catalog.js"

mimetypes.add_type("video/mp4", ".mp4")
mimetypes.add_type("audio/mpeg", ".mp3")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/epub+zip", ".epub")


# ------------------------------------------------------------------ nearby
# Two phones on the same page need to swap a few hundred bytes of connection
# details before WebRTC can join them directly. On the web edition a public
# broker does that; here this server does it, which is what lets Nearby work on
# a village network with no internet at all. Only the handshake passes through
# — the file itself goes phone to phone.
#
#   GET  /signal/ping                 is local signalling available?
#   POST /signal/<room>/<to>          leave a message for <to>
#   GET  /signal/<room>/<me>?wait=25  collect messages, waiting up to 25 s
MAIL = {}
MAIL_LOCK = threading.Condition()
NAME = re.compile(r"^[A-Za-z0-9_-]{1,40}$")

# This server listens on the whole network, and on a village Wi-Fi that network
# is whoever is in range. A pairing mailbox therefore has to survive strangers:
#
#  · caps, so nobody can fill a Raspberry Pi's memory from a phone — 300 rooms
#    of 60 KB arrived in a tenth of a second during testing, unbounded;
#  · a short life, because a handshake is used within seconds;
#  · a per-address rate limit, because six-digit codes can otherwise be
#    enumerated fast enough to sit on somebody else's pairing.
#
# None of this makes the mailbox private — see PAIRING PRIVACY at the bottom.
MAIL_TTL = 120
MAX_ROOMS = 256
MAX_PER_ROOM = 32
RATE_BURST = 60           # requests per address per window
RATE_WINDOW = 10.0

HITS = {}
HITS_LOCK = threading.Lock()


def _allowed(ip):
    now = time.time()
    with HITS_LOCK:
        q = HITS.setdefault(ip, [])
        while q and now - q[0] > RATE_WINDOW:
            q.pop(0)
        if len(q) >= RATE_BURST:
            return False
        q.append(now)
        if len(HITS) > 512:
            for k in [k for k, v in HITS.items() if not v or now - v[-1] > 300]:
                HITS.pop(k, None)
    return True


def _expire():
    now = time.time()
    for k in list(MAIL):
        MAIL[k] = [m for m in MAIL[k] if now - m[0] < MAIL_TTL]
        if not MAIL[k]:
            del MAIL[k]
    # Still too many? Drop the oldest rooms rather than grow without limit.
    if len(MAIL) > MAX_ROOMS:
        for k in sorted(MAIL, key=lambda k: MAIL[k][-1][0])[:len(MAIL) - MAX_ROOMS]:
            del MAIL[k]


class Handler(http.server.SimpleHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _route(self):
        u = urllib.parse.urlparse(self.path)
        parts = u.path.split("/")
        return u, parts

    def do_GET(self):
        u, parts = self._route()
        if u.path.startswith("/signal/") and not _allowed(self.client_address[0]):
            return self._json(429, {"error": "slow down"})
        if u.path == "/signal/ping":
            return self._json(200, {"ok": True, "kind": "local"})
        if len(parts) == 4 and parts[1] == "signal":
            room, me = parts[2], parts[3]
            if not (NAME.match(room) and NAME.match(me)):
                return self._json(400, {"error": "bad name"})
            q = urllib.parse.parse_qs(u.query)
            wait = min(max(float((q.get("wait") or ["25"])[0]), 0), 30)
            key, deadline = f"{room}:{me}", time.time() + wait
            with MAIL_LOCK:
                while not MAIL.get(key) and time.time() < deadline:
                    MAIL_LOCK.wait(max(0.05, deadline - time.time()))
                msgs = MAIL.pop(key, [])
                _expire()
            return self._json(200, [m[1] for m in msgs])
        return super().do_GET()

    def do_POST(self):
        u, parts = self._route()
        if u.path.startswith("/signal/") and not _allowed(self.client_address[0]):
            return self._json(429, {"error": "slow down"})
        if len(parts) == 4 and parts[1] == "signal":
            room, to = parts[2], parts[3]
            if not (NAME.match(room) and NAME.match(to)):
                return self._json(400, {"error": "bad name"})
            n = int(self.headers.get("content-length") or 0)
            if n <= 0 or n > 64 * 1024:
                return self._json(413, {"error": "size"})
            try:
                msg = json.loads(self.rfile.read(n))
            except Exception:
                return self._json(400, {"error": "json"})
            with MAIL_LOCK:
                box = MAIL.setdefault(f"{room}:{to}", [])
                if len(box) >= MAX_PER_ROOM:
                    box.pop(0)                   # a stale handshake, not a queue
                box.append((time.time(), msg))
                _expire()
                MAIL_LOCK.notify_all()
            return self._json(200, {"ok": True})
        self.send_error(405)

    # ---------------------------------------------------------- byte ranges
    # Python's built-in handler ignores Range and always sends the whole file.
    # That is not a nicety: iOS Safari will not play a video from a server that
    # cannot answer a range request, and on every phone seeking into a film
    # re-downloads it from the start. Off a Pi, that is every iPhone in the room
    # unable to watch anything. So ranges are honoured here, properly: 206 with
    # Content-Range, suffix ranges ("the last N bytes"), and 416 past the end.
    RANGE = re.compile(r"^bytes=(\d*)-(\d*)$")

    def send_head(self):
        self._span = None
        header = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not header or not os.path.isfile(path):
            return super().send_head()
        m = self.RANGE.match(header.strip())
        if not m or (m.group(1) == "" and m.group(2) == ""):
            return super().send_head()          # multi-range or malformed: send it all

        size = os.path.getsize(path)
        if m.group(1) == "":                    # bytes=-500  → the last 500 bytes
            start, end = max(0, size - int(m.group(2))), size - 1
        else:
            start = int(m.group(1))
            end = min(int(m.group(2)), size - 1) if m.group(2) else size - 1
        if start >= size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None

        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Last-Modified", email.utils.formatdate(os.path.getmtime(path), usegmt=True))
        self.end_headers()
        self._span = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, "_span", None)
        try:
            if left is None:
                return super().copyfile(source, outputfile)
            while left > 0:
                buf = source.read(min(256 * 1024, left))
                if not buf:
                    break
                outputfile.write(buf)
                left -= len(buf)
        except (BrokenPipeError, ConnectionResetError):
            pass                                # the player seeked away — normal

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            sys.stderr.write("  404  %s\n" % (args[0] if args else ""))


    def list_directory(self, path):
        """No listings. A folder without an index is simply not there.

        The default handler prints every filename in it, which on a card hands
        a stranger on the same Wi-Fi a map of the whole library and its
        manifest for free."""
        self.send_error(404, "No listing")
        return None


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def ensure_catalog():
    """A fresh clone has no catalog.js — it is generated, so it is not in git.
    Build the preview one rather than serving an app that reports itself broken."""
    if CATALOG.exists():
        return
    print("  No catalogue yet — generating the preview one.")
    import subprocess
    subprocess.run([sys.executable, str(HERE / "easytransfer.py"), "preview"],
                   check=True)


def lan_address():
    """The address other devices on this network can reach, not 127.0.0.1.

    A phone joining the Wi-Fi cannot use localhost, and telling someone to
    "open localhost" is the single most common way this demo fails.
    """
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("192.0.2.1", 1))          # TEST-NET-1; no packets are sent
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    args = [a for a in sys.argv[1:]]
    root = ROOT
    if "--root" in args:
        i = args.index("--root")
        root = pathlib.Path(args[i + 1]).resolve()
        del args[i:i + 2]
    port = int(args[0]) if args else 8080

    if root == ROOT:
        ensure_catalog()
    if not (root / "index.html").exists() and not (root / "app").exists():
        sys.exit(f"  Nothing to serve at {root} — no index.html and no app/ folder.")

    handler = functools.partial(Handler, directory=str(root))
    with Server(("", port), handler) as httpd:
        print(f"  Serving {root}")
        print(f"    this computer   http://localhost:{port}")
        print(f"    other devices   http://{lan_address()}:{port}")
        print(f"  (ctrl-c to stop)")
        print()
        print("  PAIRING PRIVACY: anyone on this network can read and write the")
        print("  handshake mailbox if they know the 6-digit code. The file itself")
        print("  never passes through here — it goes phone to phone — but do not")
        print("  treat a code as a secret on a network you do not trust.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  stopped")


if __name__ == "__main__":
    main()
