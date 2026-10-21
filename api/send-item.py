"""Vercel /api/send-item: email one library item to a friend, with who sent it."""
from http.server import BaseHTTPRequestHandler
from packer.item_mail import handle_http


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        handle_http(self, production=True)

    do_GET = do_PUT = do_DELETE = do_PATCH = do_OPTIONS = do_POST

    def log_message(self, *_args):
        pass
