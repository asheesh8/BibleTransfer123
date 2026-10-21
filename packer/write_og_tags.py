"""Write the link-preview (Open Graph) tags into every library page.

Facebook, WhatsApp and others read these tags, never the page's script, so each
language page carries its own title, words and picture in its own language.
The words come from art/og/cards.json and the pictures from app/assets/og/,
both made by `node art/og/render.js`. Run after it:

    python3 packer/write_og_tags.py

Bump VERSION when the pictures change, so Facebook fetches them again.
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app")
SITE = "https://www.bibletransfer123.org"
VERSION = "1"
START, END = "<!-- og:start -->", "<!-- og:end -->"
# Pages that aren't one language: they show the whole library's card.
HOME_PAGES = {"index.html": "", "share-libraries/index.html": "share-libraries"}


def tags(url, image, title, description):
    attr = lambda value: html.escape(value, quote=True)
    rows = [
        ('property', 'og:type', 'website'),
        ('property', 'og:site_name', 'The Library'),
        ('property', 'og:url', url),
        ('property', 'og:title', title),
        ('property', 'og:description', description),
        ('property', 'og:image', image),
        ('property', 'og:image:width', '1200'),
        ('property', 'og:image:height', '630'),
        ('property', 'og:image:alt', title),
        ('name', 'twitter:card', 'summary_large_image'),
    ]
    return "\n".join([START] + ['<meta %s="%s" content="%s">' % (kind, key, attr(value)) for kind, key, value in rows] + [END])


def write(path, block):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if START in text:
        text = re.sub(re.escape(START) + ".*?" + re.escape(END), lambda _: block, text, flags=re.S)
    else:
        text = re.sub(r'(<meta name="description"[^>]*>\n)', lambda m: m.group(1) + block + "\n", text, count=1)
        if START not in text:
            raise SystemExit("no description tag to follow in " + path)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def main():
    with open(os.path.join(ROOT, "art/og/cards.json"), encoding="utf-8") as f:
        cards = json.load(f)
    for slug, card in cards.items():
        image = "%s/assets/og/%s.jpg?v=%s" % (SITE, slug, VERSION)
        if slug == "home":
            for page, path in HOME_PAGES.items():
                write(os.path.join(APP, page), tags(SITE + "/" + path, image, card["title"], card["description"]))
            continue
        write(os.path.join(APP, slug, "index.html"), tags(SITE + "/" + slug, image, card["title"], card["description"]))
    print("og tags written for %d pages" % len(cards))


if __name__ == "__main__":
    main()
