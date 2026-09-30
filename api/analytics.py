"""Vercel /api/analytics; shared implementation also runs on the offline server."""
from http.server import BaseHTTPRequestHandler
from packer.analytics import handle_http


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        handle_http(self, production=True)

    def do_GET(self):
        handle_http(self, production=True)

    do_PUT = do_DELETE = do_PATCH = do_OPTIONS = do_GET

    def log_message(self, *_args):
        pass
