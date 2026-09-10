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
import functools, http.server, mimetypes, pathlib, socketserver, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent / "app"
CATALOG = ROOT / "data" / "catalog.js"

mimetypes.add_type("video/mp4", ".mp4")
mimetypes.add_type("audio/mpeg", ".mp3")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/epub+zip", ".epub")


class Handler(http.server.SimpleHTTPRequestHandler):
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
