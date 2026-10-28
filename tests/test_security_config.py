"""Deployment security settings that are easy to break by accident."""
import base64
import hashlib
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent


def admin_headers():
    config = json.loads((ROOT / "vercel.json").read_text())
    rule = next(rule for rule in config["headers"] if rule["source"] == "/admin(.*)")
    return {header["key"]: header["value"] for header in rule["headers"]}


class AdminPolicyTest(unittest.TestCase):
    def test_admin_pages_cannot_be_framed_or_run_injected_script(self):
        policy = admin_headers()["Content-Security-Policy"]
        self.assertIn("frame-ancestors 'none'", policy)
        self.assertIn("object-src 'none'", policy)
        script = re.search(r"script-src ([^;]+)", policy).group(1).split()
        self.assertNotIn("'unsafe-inline'", script)
        self.assertNotIn("'unsafe-eval'", script)
        self.assertEqual(admin_headers()["X-Frame-Options"], "DENY")

    def test_every_inline_admin_script_is_allowed_by_its_hash(self):
        # Editing an inline <script> on an admin page changes its hash; without
        # the new hash in vercel.json the browser silently refuses to run it.
        policy = admin_headers()["Content-Security-Policy"]
        allowed = set(re.findall(r"'sha256-([^']+)'", policy))
        needed = set()
        for page in sorted((ROOT / "app" / "admin").glob("*.html")):
            for body in re.findall(r"<script>(.*?)</script>", page.read_text(), re.S):
                needed.add(base64.b64encode(hashlib.sha256(body.encode()).digest()).decode())
        self.assertEqual(needed - allowed, set(), "add these 'sha256-…' sources to the /admin CSP in vercel.json")
        self.assertEqual(allowed - needed, set(), "remove unused script hashes from the /admin CSP")

    def test_admin_pages_load_nothing_from_other_sites(self):
        for page in sorted((ROOT / "app" / "admin").glob("*.html")):
            self.assertNotRegex(page.read_text(), r"""(?:src|href)=["']?(?:https?:)?//""", page.name)


class WorkflowTest(unittest.TestCase):
    def test_test_workflow_token_is_read_only(self):
        workflow = (ROOT / ".github" / "workflows" / "tests.yml").read_text()
        self.assertRegex(workflow, r"(?m)^permissions:\n  contents: read$")


if __name__ == "__main__":
    unittest.main()
