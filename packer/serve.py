#!/usr/bin/env python3
"""Serve app/ for review, the way a VillageServer Raspberry Pi would.

    python3 packer/serve.py [port]

Differs from `python3 -m http.server` in two ways that matter: it never lets a
browser cache anything (so an edit shows up on reload instead of an hour later),
and it serves the right content types for .mp4 and .webp, which some Python
builds get wrong and which a video silently fails on.
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


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    ensure_catalog()
    handler = functools.partial(Handler, directory=str(ROOT))
    with Server(("", port), handler) as httpd:
        print(f"  Serving {ROOT} at http://localhost:{port}  (ctrl-c to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  stopped")


if __name__ == "__main__":
    main()
