"""Draws the app icons and splash screens from app/assets/icon/icon-512.png.

Run from mobile/:  python3 scripts/make_icons.py
The web icon has transparent rounded corners; the stores want a full square
(each platform rounds it itself), so the corners are filled with its purple."""
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent.parent
SRC = HERE.parent / "app/assets/icon/icon-512.png"
RES = HERE / "android/app/src/main/res"
IOS = HERE / "ios/App/App/Assets.xcassets"
CREAM = (255, 251, 242, 255)

icon = Image.open(SRC).convert("RGBA")
purple = icon.getpixel((256, 30))
square = Image.new("RGBA", icon.size, purple)
square.alpha_composite(icon)
big = square.resize((1024, 1024), Image.LANCZOS)

def save(img, path, size):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.resize(size, Image.LANCZOS).convert("RGB" if path.suffix == ".png" and "foreground" not in path.name else "RGBA").save(path)

# Android launcher icons: 48dp, and the 108dp adaptive foreground layer.
for name, scale in {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}.items():
    folder = RES / f"mipmap-{name}"
    save(big, folder / "ic_launcher.png", (round(48 * scale),) * 2)
    save(big, folder / "ic_launcher_round.png", (round(48 * scale),) * 2)
    save(big, folder / "ic_launcher_foreground.png", (round(108 * scale),) * 2)
(RES / "values/ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">#%02X%02X%02X</color>\n</resources>\n' % purple[:3])

# Splash screens: the icon on the app's cream page colour.
def splash(w, h):
    page = Image.new("RGBA", (w, h), CREAM)
    side = min(w, h) // 3
    mark = icon.resize((side, side), Image.LANCZOS)
    page.alpha_composite(mark, ((w - side) // 2, (h - side) // 2))
    return page.convert("RGB")

for path in RES.glob("drawable*/splash.png"):
    with Image.open(path) as old:
        size = old.size
    splash(*size).save(path)
for path in (IOS / "Splash.imageset").glob("*.png"):
    with Image.open(path) as old:
        size = old.size
    splash(*size).save(path)

# iPhone: one 1024 px icon, no transparency allowed.
for path in (IOS / "AppIcon.appiconset").glob("*.png"):
    big.convert("RGB").save(path)
print("icons and splash screens written; corner colour", purple[:3])
