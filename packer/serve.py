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
MAIL_TTL = 600
NAME = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


def _expire():
    now = time.time()
    for k in list(MAIL):
        MAIL[k] = [m for m in MAIL[k] if now - m[0] < MAIL_TTL]
        if not MAIL[k]:
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
                MAIL.setdefault(f"{room}:{to}", []).append((time.time(), msg))
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
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  stopped")


if __name__ == "__main__":
    main()
