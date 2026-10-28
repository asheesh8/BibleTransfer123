"""Write every per-language file from registry/languages.json.

The registry is the one list of language libraries. From it this writes:

  app/<slug>/index.html          the one-language library page
  app/<stub>/index.html          a redirect page for an old folder name
  app/sw.js                      the language block of SHELL, and VERSION
  vercel.json                    the language rewrites and the QR redirect
  app/assets/js/share-libraries.js   the routes list
  packer/analytics.py            QR_LIBRARIES
  packer/library_mail.py         LIBRARIES

Run it after editing the registry (or any shell file, since VERSION follows
the shell's contents), then commit what it wrote:

    npm run generate                       # python3 packer/et/generate.py
    python3 packer/et/generate.py --check   # list stale files, change nothing

tests/test_generate.py fails while any generated file is out of date.
Standard library only, like the rest of packer/.
"""
import hashlib
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from packer import write_og_tags  # noqa: E402

APP = ROOT / "app"
REGISTRY = ROOT / "registry" / "languages.json"
# app/ folders that hold a page but are not language libraries.
OTHER_PAGES = {"admin", "share-libraries"}
TEXT = {".html", ".js", ".css", ".json", ".webmanifest", ".svg"}
SW_START = "  // generated:languages:start"
SW_END = "  // generated:languages:end"

REQUIRED = ("slug", "lang", "ui", "name", "native", "htmlLang", "aliases",
            "title", "description", "badge", "lead")
OPTIONAL = ("shareName", "dir", "catalog", "stubs", "heading", "pageText", "reloadGuard")
PAGE_TEXT = ("email", "copy", "search", "kind", "none", "noneSub", "clear")
SLUG = re.compile(r"^[a-z][a-z0-9-]*$")


def load(path=REGISTRY):
    with open(path, encoding="utf-8") as f:
        registry = json.load(f)
    validate(registry)
    return registry


def validate(registry):
    """Refuse a registry that would write a broken or ambiguous page."""
    problems = []
    texts = registry["pageText"]
    for key, strings in texts.items():
        if set(strings) != set(PAGE_TEXT):
            problems.append("pageText %s needs exactly %s" % (key, ", ".join(PAGE_TEXT)))
    seen = {}
    for entry in registry["languages"]:
        slug = entry.get("slug", "?")
        missing = [k for k in REQUIRED if k not in entry]
        unknown = [k for k in entry if k not in REQUIRED + OPTIONAL]
        if missing:
            problems.append("%s: missing %s" % (slug, ", ".join(missing)))
        if unknown:
            problems.append("%s: unknown field %s" % (slug, ", ".join(unknown)))
        if entry.get("dir", "ltr") not in ("ltr", "rtl"):
            problems.append("%s: dir must be ltr or rtl" % slug)
        if entry.get("reloadGuard") not in (None, "lang", "i18n"):
            problems.append("%s: reloadGuard must be lang or i18n" % slug)
        if entry.get("pageText", entry.get("ui")) not in texts:
            problems.append("%s: no pageText %r; add it or set pageText" % (slug, entry.get("pageText", entry.get("ui"))))
        if not (APP / "data" / ("catalog-%s.js" % catalog(entry))).is_file():
            problems.append("%s: app/data/catalog-%s.js does not exist" % (slug, catalog(entry)))
        for path in [slug] + entry.get("aliases", []) + entry.get("stubs", []):
            if not SLUG.match(path):
                problems.append("%s: %r is not a lowercase URL path" % (slug, path))
            if path in OTHER_PAGES or path in seen:
                problems.append("%s: /%s is already used by %s" % (slug, path, seen.get(path, "the app")))
            seen[path] = slug
    if problems:
        raise SystemExit("registry/languages.json:\n  " + "\n  ".join(problems))


def catalog(entry):
    return entry.get("catalog", entry["lang"])


def share_name(entry):
    return entry.get("shareName", entry["name"])


def text(value):
    return html.escape(value, quote=False)


def attr(value):
    return html.escape(value, quote=False).replace('"', "&quot;")


# --- language pages -----------------------------------------------------------

RELOAD_GUARD = {
    None: "",
    "lang": (
        "// Older installed shells may not know this newly added interface. Refresh\n"
        "// only after the current worker has installed and can serve the new strings.\n"
        "if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', function () {\n"
        "  if (document.documentElement.lang !== window.ET_SHARED_LIBRARY.ui) location.reload();\n"
        "});\n"
    ),
    "i18n": (
        "// Older installed shells may not know this newly added interface. Refresh\n"
        "// only after the current worker has installed and can serve the new strings.\n"
        "if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', function () {\n"
        "  var ui = window.ET_SHARED_LIBRARY.ui;\n"
        "  if (document.documentElement.lang !== ui || !window.ET || !window.ET.i18n || window.ET.i18n.meta(ui).code !== ui) location.reload();\n"
        "});\n"
    ),
}

PAGE = """<!doctype html>
<html lang="{htmlLang}" dir="{dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<base href="../">
<title>{title}</title>
<meta name="description" content="{description}">
{og}
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="assets/icon/apple-touch-icon.png">
<link rel="icon" href="assets/icon/favicon-32.png" sizes="32x32">
<meta name="theme-color" content="#6A35C2">
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/components/button.css">
<link rel="stylesheet" href="assets/css/components/card.css">
<link rel="stylesheet" href="assets/css/components/chip.css">
<link rel="stylesheet" href="assets/css/app.css">
<link rel="stylesheet" href="assets/css/components/sheet.css">
<link rel="stylesheet" href="assets/css/components/toast.css">
<link rel="stylesheet" href="assets/css/consent.css">
<link rel="stylesheet" href="assets/css/pages/screens.css">
<link rel="stylesheet" href="assets/css/pages/partners.css">
<script>
window.ET_SHARED_LIBRARY = {shared};
{guard}try {{
  var theme = localStorage.getItem("et.theme");
  if (theme) document.documentElement.setAttribute("data-theme", theme);
}} catch (e) {{}}
</script>
</head>
<body class="screen-library">
<main class="wrap" id="main">
  <section class="shared-hero">
    <p class="eyebrow" id="shared-badge">{badge}</p>
    <h1 id="shared-title" dir="auto">{heading}</h1>
    <p class="muted" id="shared-lead">{lead}</p>
    <div class="btn-row shared-actions">
      <a class="btn green" id="email-library" href="#">{email}</a>
      <a class="btn fb" data-shared-channel="facebook" href="#" target="_blank" rel="noopener noreferrer">Facebook</a>
      <button class="btn ghost" id="copy-library" type="button">{copy}</button>
      <a class="btn ghost" data-shared-channel="whatsapp" href="#" target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a class="btn ghost" data-shared-channel="telegram" href="#" target="_blank" rel="noopener noreferrer">Telegram</a>
    </div>
    <p class="sr" id="copy-status" aria-live="polite"></p>
  </section>

  <div class="search" style="margin-bottom:.9rem">
    <span id="search-ico"></span>
    <input type="search" id="q" data-i18n-placeholder="lib.search" placeholder="{search}" autocomplete="off" enterkeyhint="search">
  </div>
  <p class="flabel" data-i18n="lib.kind">{kind}</p>
  <div class="filters" id="type-filters" role="group" data-i18n-aria="lib.kind" aria-label="{kindAttr}"></div>
  <div id="bulk-controls"></div>
  <p class="muted" id="count" style="margin:1rem 0 .6rem"></p>
  <div class="row-list" id="results"></div>
  <div id="empty" hidden class="card center" style="padding:2rem 1.2rem">
    <div id="empty-art"></div>
    <h3 data-i18n="lib.none">{none}</h3>
    <p class="muted" data-i18n="lib.none.sub">{noneSub}</p>
    <button class="btn ghost" id="reset" data-i18n="lib.clear">{clear}</button>
  </div>
  <div class="foot-nav"></div>
</main>
<div id="bulk-dock" class="bulk-dock" hidden></div>
<script defer src="data/catalog-{catalog}-shelf.js"></script>
<script defer src="api/visibility"></script>
<script defer src="assets/js/visibility.js"></script>
<script defer src="assets/js/core.js"></script>
<script defer src="assets/js/ui/icons.js"></script>
<script defer src="assets/js/ui/sheet.js"></script>
<script defer src="assets/js/ui/toast.js"></script>
<script defer src="assets/js/ui/shell.js"></script>
<script defer src="assets/js/ui/covers.js"></script>
<script defer src="assets/js/art.js"></script>
<script src="assets/js/i18n-load.js"></script>
<script defer src="assets/js/i18n.js"></script>
<script defer src="assets/js/analytics.js"></script>
<script defer src="assets/js/save.js"></script>
<script defer src="assets/js/shared-library.js"></script>
<script defer src="assets/js/library.js"></script>
</body>
</html>
"""

STUB = ('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
        '<title>Opening library…</title><script>location.replace("../{slug}/" + location.search + location.hash);</script>'
        '</head><body><p><a href="../{slug}/">Open the {name} library</a></p></body></html>\n')


def og_block(slug, cards):
    if slug not in cards:
        raise SystemExit("art/og/cards.json has no card for %s; add one and run node art/og/render.js" % slug)
    card = cards[slug]
    site = write_og_tags.SITE
    image = "%s/assets/og/%s.jpg?v=%s" % (site, slug, write_og_tags.VERSION)
    return write_og_tags.tags(site + "/" + slug, image, card["title"], card["description"])


def page(entry, strings, cards):
    shared = json.dumps({key: entry[key] for key in ("lang", "ui", "slug", "name", "native")},
                        ensure_ascii=False, separators=(",", ":"))
    return PAGE.format(
        htmlLang=attr(entry["htmlLang"]), dir=entry.get("dir", "ltr"),
        title=text(entry["title"]), description=attr(entry["description"]),
        og=og_block(entry["slug"], cards), shared=shared.replace("</", "<\\/"),
        guard=RELOAD_GUARD[entry.get("reloadGuard")],
        badge=text(entry["badge"]), heading=text(entry.get("heading", entry["title"])),
        lead=text(entry["lead"]), catalog=catalog(entry),
        email=text(strings["email"]), copy=text(strings["copy"]), search=attr(strings["search"]),
        kind=text(strings["kind"]), kindAttr=attr(strings["kind"]), none=text(strings["none"]),
        noneSub=text(strings["noneSub"]), clear=text(strings["clear"]))


def pages(registry, cards):
    out = {}
    for entry in registry["languages"]:
        strings = registry["pageText"][entry.get("pageText", entry["ui"])]
        out["app/%s/index.html" % entry["slug"]] = page(entry, strings, cards)
        for stub in entry.get("stubs", []):
            out["app/%s/index.html" % stub] = STUB.format(slug=entry["slug"], name=text(entry["name"]))
    return out


# --- app/sw.js ----------------------------------------------------------------

def sw_block(registry):
    lines, catalogues = [], set()
    for entry in registry["languages"]:
        files = ["%s/index.html" % entry["slug"]] + ["%s/index.html" % s for s in entry.get("stubs", [])]
        if catalog(entry) not in catalogues:
            catalogues.add(catalog(entry))
            files.append("data/catalog-%s.js" % catalog(entry))
            files.append("data/catalog-%s-shelf.js" % catalog(entry))
        lines.append("  " + ", ".join("'%s'" % f for f in files) + ",")
    return "\n".join(lines)


def shell_files(sw):
    body = re.search(r"var SHELL = \[(.*?)\];", sw, re.S).group(1)
    return re.findall(r"'([^']+)'", body)


def read_shell_file(path, generated):
    key = "app/" + path
    if key in generated:
        data = generated[key].encode("utf-8")
    else:
        file = APP / path
        if not file.is_file():
            raise SystemExit("app/sw.js caches %s, which does not exist" % path)
        data = file.read_bytes()
    if pathlib.PurePosixPath(path).suffix in TEXT:
        data = data.replace(b"\r\n", b"\n")  # same hash on a Windows checkout
    return data


def service_worker(registry, generated):
    """SHELL's language block from the registry, and VERSION from a hash of
    every file the shell caches, so any shell change renames the cache."""
    sw = (APP / "sw.js").read_text(encoding="utf-8")
    if "\n<<<<<<< " in sw or "\n>>>>>>> " in sw:
        raise SystemExit("app/sw.js has merge conflict markers; keep either side, then run npm run generate")
    pattern = re.compile(re.escape(SW_START) + r"\n(?:.*?\n)?" + re.escape(SW_END), re.S)
    if not pattern.search(sw):
        raise SystemExit("app/sw.js has lost its %s / %s markers" % (SW_START.strip(), SW_END.strip()))
    sw = pattern.sub(lambda _: SW_START + "\n" + sw_block(registry) + "\n" + SW_END, sw, count=1)
    unversioned = re.sub(r"var VERSION = '[^']*';", "var VERSION = '';", sw, count=1)
    digest = hashlib.sha256(unversioned.encode("utf-8"))
    for path in shell_files(sw):
        digest.update(b"\0" + path.encode("utf-8") + b"\0")
        digest.update(read_shell_file(path, generated))
    return re.sub(r"var VERSION = '[^']*';", "var VERSION = 'shell-%s';" % digest.hexdigest()[:12], sw, count=1)


# --- vercel.json --------------------------------------------------------------

REWRITE = re.compile(r'\{ "source": "([^"]+)", "destination": "([^"]+)" \}')


def vercel(registry):
    """Language rewrites come from the registry; any other rewrite (/admin,
    /privacy...) is kept as written, ahead of them."""
    config = (ROOT / "vercel.json").read_text(encoding="utf-8")
    block = re.search(r'(  "rewrites": \[\n)(.*?)(\n  \])', config, re.S)
    language_pages = {"/%s/index.html" % e["slug"] for e in registry["languages"]}
    kept = [line for line in block.group(2).split(",\n")
            if REWRITE.search(line) and REWRITE.search(line).group(2) not in language_pages]
    rows = []
    for entry in registry["languages"]:
        for path in [entry["slug"]] + entry["aliases"] + entry.get("stubs", []):
            rows.append('    { "source": "/%s", "destination": "/%s/index.html" }' % (path, entry["slug"]))
    config = config[:block.start(2)] + ",\n".join(kept + rows) + config[block.end(2):]
    slugs = "|".join(e["slug"] for e in registry["languages"])
    config, count = re.subn(r'"source": "/:slug\([^)]*\)"', lambda _: '"source": "/:slug(%s)"' % slugs, config)
    if count != 1:
        raise SystemExit("vercel.json: expected one /:slug(...) QR redirect, found %d" % count)
    return config


# --- share-libraries.js, analytics.py, library_mail.py ------------------------

def js_string(value):
    if "'" not in value:
        return "'%s'" % value
    if '"' in value or "\\" in value:
        raise SystemExit("cannot quote %r for share-libraries.js" % value)
    return '"%s"' % value


def share_libraries(registry):
    path = APP / "assets/js/share-libraries.js"
    source = path.read_text(encoding="utf-8")
    rows = ",\n".join("    [%s]" % ", ".join(js_string(v) for v in (e["slug"], e["lang"], share_name(e), e["native"]))
                      for e in registry["languages"])
    return replace_once(source, r"(  var routes = \[\n)(.*?)(\n  \]\.sort\()", rows, path)


def py_string(value):
    return json.dumps(value, ensure_ascii=False)


def analytics(registry):
    path = ROOT / "packer/analytics.py"
    rows = ",\n".join("    %s: %s" % (py_string(e["slug"]), py_string(e["lang"])) for e in registry["languages"])
    return replace_once(path.read_text(encoding="utf-8"), r"(QR_LIBRARIES = \{\n)(.*?)(\n\}\n)", rows, path)


def library_mail(registry):
    path = ROOT / "packer/library_mail.py"
    entries = sorted(registry["languages"], key=lambda e: e["slug"])
    rows = ",\n".join("    %s: (%s, %s)" % (py_string(e["slug"]), py_string(e["name"]), py_string(e["native"]))
                      for e in entries)
    return replace_once(path.read_text(encoding="utf-8"), r"(\nLIBRARIES = \{\n)(.*?)(\n\}\n)", rows, path)


def replace_once(source, pattern, body, path):
    match = re.search(pattern, source, re.S)
    if not match:
        raise SystemExit("%s: cannot find the generated list" % path.relative_to(ROOT))
    return source[:match.start(2)] + body + source[match.end(2):]


# --- everything ---------------------------------------------------------------

def outputs(registry=None):
    """Every generated file as {repo-relative path: text}."""
    registry = registry or load()
    with open(ROOT / "art/og/cards.json", encoding="utf-8") as f:
        cards = json.load(f)
    out = pages(registry, cards)
    out["app/sw.js"] = service_worker(registry, out)
    out["vercel.json"] = vercel(registry)
    out["app/assets/js/share-libraries.js"] = share_libraries(registry)
    out["packer/analytics.py"] = analytics(registry)
    out["packer/library_mail.py"] = library_mail(registry)
    return out


def stale(out=None):
    """Paths whose file on disk differs from what the registry generates."""
    out = out or outputs()
    changed = []
    for path, content in out.items():
        file = ROOT / path
        if not file.is_file() or file.read_text(encoding="utf-8") != content:
            changed.append(path)
    return changed


def main(argv):
    out = outputs()
    changed = stale(out)
    if "--check" in argv:
        for path in changed:
            print("stale: " + path)
        return 1 if changed else 0
    for path in changed:
        file = ROOT / path
        file.parent.mkdir(parents=True, exist_ok=True)
        with open(file, "w", encoding="utf-8", newline="\n") as f:
            f.write(out[path])
        print("wrote " + path)
    print("%d files generated, %d changed" % (len(out), len(changed)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
