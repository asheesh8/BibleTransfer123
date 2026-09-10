#!/usr/bin/env python3
"""EasyTransfer — pack a media library onto a card that opens itself.

    python3 packer/easytransfer.py plan  --profile standard
    python3 packer/easytransfer.py build --profile standard --out /Volumes/LIBRARY
    python3 packer/easytransfer.py verify --out /Volumes/LIBRARY

`plan` never writes anything and never downloads a file — it asks each server how
big its file is and tells you what would fit. Always plan before you build; the
full catalogue is several hundred gigabytes and a 32 GB card holds a deliberate
slice of it.
"""
import argparse, collections, dataclasses, datetime, pathlib, shutil, sys, textwrap

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from et import build as B, catalog as C, fetch as F, profiles as P
from et.util import human

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_CATALOG = ROOT / "catalog" / "resources.json"
APP_SRC = ROOT / "app"
CACHE = ROOT / ".cache" / "sizes.json"

BAR = 34
TTY = sys.stderr.isatty()


_last_log = [0]


def _draw(line, i=None, n=None, every=25):
    """Redraw in place on a terminal.

    Piped to a file — a long `nohup` build is the usual case — carriage returns
    would produce one unreadable line, so instead a plain progress line is
    written every `every` items. Silence for half an hour looks like a hang.
    """
    if TTY:
        print("\r" + line, end="", file=sys.stderr)
    elif i is not None and (i - _last_log[0] >= every or i == n):
        _last_log[0] = i
        print(line.strip(), file=sys.stderr, flush=True)


def _bar(done, total):
    n = int(BAR * done / total) if total else BAR
    return "█" * n + "·" * (BAR - n)


def _profile(args):
    """The chosen profile, narrowed by --types if one was given."""
    prof = P.PROFILES[args.profile]
    if getattr(args, "types", None):
        want = tuple(x.strip() for x in args.types.split(",") if x.strip())
        unknown = [x for x in want if x not in P.PRIORITY]
        if unknown:
            sys.exit(f"  Unknown type(s): {', '.join(unknown)}\n"
                     f"  Choose from: {', '.join(P.PRIORITY)}\n")
        prof = dataclasses.replace(prof, types=tuple(x for x in prof.types if x in want))
    return prof


def _load(args):
    cat = C.load(args.catalog)
    assets = C.all_assets(cat)
    return cat, assets


def _sized(cat, assets, args, needed_ids=None):
    """Probe every asset we might pack, with a progress line."""
    flat = [a for rid, lst in assets.items() for a in lst
            if needed_ids is None or rid in needed_ids]
    cache = F.SizeCache(CACHE)
    pending = sum(1 for a in flat if cache.get(a.url) is None)
    if pending:
        print(f"  sizing {pending} files not seen before "
              f"({len(flat) - pending} cached)…", file=sys.stderr)

        def tick(i, n, a):
            _draw(f"  {_bar(i, n)} {i}/{n}", i, n)

        F.probe(flat, cache, workers=args.workers, on_each=tick)
        if TTY:
            print(file=sys.stderr)
    else:
        F.probe(flat, cache, workers=args.workers)
    return cache


# ------------------------------------------------------------------ commands

def cmd_plan(args):
    cat, assets = _load(args)
    prof = _profile(args)
    langs = args.lang.split(",") if args.lang else None

    print(f"\n  EasyTransfer — plan for the '{prof.name}' profile")
    print(f"  {prof.blurb}\n")
    _sized(cat, assets, args)

    chosen, skipped, used = P.select(cat, assets, prof, langs)
    by_type = collections.Counter(r["type"] for r, _ in chosen)

    print(f"\n  {'TYPE':<19}{'ITEMS':>7}{'SIZE':>12}")
    print("  " + "-" * 38)
    for t in P.PRIORITY:
        rs = [(r, a) for r, a in chosen if r["type"] == t]
        if not rs:
            continue
        size = sum(a.nbytes for _, al in rs for a in al)
        label = cat["types"].get(t, {}).get("label", t)
        print(f"  {label:<19}{by_type[t]:>7}{human(size):>12}")
    print("  " + "-" * 38)
    print(f"  {'TOTAL':<19}{len(chosen):>7}{human(used):>12}")

    if prof.budget:
        pct = 100 * used / prof.budget
        print(f"\n  {_bar(min(used, prof.budget), prof.budget)}  "
              f"{pct:.0f}% of {human(prof.budget)} usable")

    unknown = sum(1 for _, al in chosen for a in al if not a.nbytes)
    if unknown:
        print(f"\n  {unknown} file{'s' if unknown > 1 else ''} would not report a "
              f"size — the real total will be larger.")

    picked = {r["id"] for r, _ in chosen}
    noff = [r for r in cat["resources"]
            if r["id"] not in picked and not assets.get(r["id"])]
    if noff:
        kinds = collections.Counter(r["typeLabel"] for r in noff)
        detail = ", ".join(
            f"{n} {k.lower() if n > 1 else k.lower().rstrip('s')}"
            for k, n in kinds.most_common())
        print(f"\n  {len(noff)} resources have no downloadable file ({detail}).")
        print(f"  They stay in the app marked \"needs internet\" rather than being "
              f"hidden —\n  a Raspberry Pi with an uplink can still reach them.")

    toobig = [(r, why) for r, why in skipped if "not fit" in why]
    if toobig:
        print(f"\n  {len(toobig)} left off for space:")
        for r, why in toobig[:8]:
            print(f"    · {r['title'][:44]:<44} {why}")
        if len(toobig) > 8:
            print(f"    … and {len(toobig) - 8} more")

    print(f"\n  Ready:  python3 packer/easytransfer.py build "
          f"--profile {prof.name} --out /Volumes/YOURCARD\n")


def cmd_build(args):
    cat, assets = _load(args)
    prof = _profile(args)
    langs = args.lang.split(",") if args.lang else None
    out = pathlib.Path(args.out).expanduser()

    print(f"\n  EasyTransfer — building '{prof.name}' into {out}\n")
    _sized(cat, assets, args)
    chosen, skipped, used = P.select(cat, assets, prof, langs)

    free = shutil.disk_usage(out.parent if not out.exists() else out).free
    print(f"  {len(chosen)} resources · {human(used)} · "
          f"{human(free)} free at the destination")
    if used > free:
        sys.exit(f"\n  Not enough room. Need {human(used)}, have {human(free)}.\n"
                 f"  Try --profile pocket, or --lang snd to pack one language.\n")
    if not args.yes:
        if input("\n  Write it? [y/N] ").strip().lower() not in ("y", "yes"):
            sys.exit("  Nothing written.")

    out.mkdir(parents=True, exist_ok=True)
    media = out / B.MEDIA_DIRNAME
    flat = [a for _, al in chosen for a in al]

    print(f"\n  Fetching {len(flat)} files…")
    failures = []

    def tick(i, n, res):
        if res.status == "fail":
            failures.append(res)
        _draw(f"  {_bar(i, n)} {i}/{n}  {res.asset.rel[:38]:<38}", i, n, every=10)

    results = F.download(flat, media, workers=args.workers, on_done=tick)
    print("\n")

    got = collections.Counter(r.status for r in results)
    print(f"  downloaded {got['ok']} · already had {got['have']} · "
          f"failed {got['fail']}")

    if failures:
        print(f"\n  {len(failures)} files could not be fetched:")
        for r in failures[:10]:
            print(f"    · {r.asset.rel[:50]:<50} {r.error}")
        if len(failures) > 10:
            print(f"    … and {len(failures) - 10} more")
        dead = [r for r in failures if r.error.startswith(("HTTP 403", "HTTP 404", "HTTP 410"))]
        if dead:
            print(f"\n  {len(dead)} of those are gone at the source (403/404) — re-running "
                  f"will not bring them back.\n  Their resources stay on the card with "
                  f"whatever else did download.")
        if len(dead) < len(failures):
            print("  For the rest, re-run the same command — finished files are skipped "
                  "and part-files resume.")

    # Record the size each file actually has, not the size probed at plan time.
    # They differ for some CDN images, and the manifest is what `verify` checks
    # against — a probed size there would fail a card that is perfectly fine.
    cache = F.SizeCache(CACHE)
    for r in results:
        if r.status in ("ok", "have") and r.nbytes:
            r.asset.nbytes = r.nbytes
            cache.put(r.asset.url, r.nbytes)
    cache.save()

    # Only advertise what actually landed.
    on_disk = {r.asset.rel for r in results if r.status in ("ok", "have")}
    landed = [(r, [a for a in al if a.rel in on_disk]) for r, al in chosen]
    landed = [(r, al) for r, al in landed if al]

    app_dir = B.write_app(out, APP_SRC,
                          stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
    library = B.card_catalog(cat, landed, prof, C.index(cat))
    B.write_catalog(app_dir, library)
    B.write_manifest(out, landed, library)
    _write_readme(out, library, prof)

    print(f"\n  Card written.")
    print(f"    {library['counts']['offline']} resources work with no internet")
    print(f"    {library['counts']['total']} resources listed in total")
    print(f"\n  Open {out / 'START-HERE.html'} to check it, then eject.\n")


def cmd_verify(args):
    import json
    out = pathlib.Path(args.out).expanduser()
    mf = out / "manifest.json"
    if not mf.exists():
        sys.exit(f"  No manifest at {mf} — is that a card EasyTransfer built?")
    m = json.loads(mf.read_text())
    print(f"\n  Card built {m['built']} · profile '{m['profile']}' · "
          f"{m['files']} files\n")

    missing, wrong, ok = [], [], 0
    for e in m["entries"]:
        p = out / B.MEDIA_DIRNAME / e["rel"]
        if not p.exists():
            missing.append(e)
        elif e["bytes"] and p.stat().st_size != e["bytes"]:
            wrong.append((e, p.stat().st_size))
        else:
            ok += 1

    print(f"  {ok} good · {len(missing)} missing · {len(wrong)} wrong size")
    for e in missing[:10]:
        print(f"    missing  {e['rel']}")
    for e, got in wrong[:10]:
        print(f"    size     {e['rel']}  {human(got)} ≠ {human(e['bytes'])}")
    if missing or wrong:
        print("\n  Re-run the build to repair. Good files are left alone.\n")
        sys.exit(1)
    print("\n  Card is complete.\n")


def cmd_preview(args):
    """Write app/data/catalog.js with nothing packed, so the app is browsable
    from the repo without committing a card to a 20 GB download first. Every
    resource comes out marked "needs internet", which is exactly what an
    unpacked card is."""
    cat, assets = _load(args)
    prof = P.PROFILES["standard"]
    library = B.card_catalog(cat, [], prof, C.index(cat))
    library["profile"] = "preview"
    n = B.write_catalog(APP_SRC, library)
    print(f"\n  Wrote {APP_SRC / 'data' / 'catalog.js'} — {human(n)} of catalogue, "
          f"{library['counts']['total']} resources, none packed.")
    print("  Serve it with:  npm run dev      (or: python3 packer/serve.py 8080)\n")


def cmd_list(args):
    cat, assets = _load(args)
    for r in sorted(cat["resources"], key=lambda r: (P.rank(r), r["id"])):
        n = len(assets.get(r["id"], []))
        flag = "  " if n else "· "     # · = online-only
        rid = r["id"] if len(r["id"]) <= 37 else r["id"][:36] + "…"
        print(f"  {flag}{rid:<38}{r['langName']:<8}{r['typeLabel']:<18}"
              f"{n:>4} files  {r['title'][:40]}")
    print(f"\n  {len(cat['resources'])} resources. "
          f"'·' marks the ones with nothing to download.\n")


def _write_readme(out, library, prof):
    (out / "README.txt").write_text(textwrap.dedent(f"""\
        THE LIBRARY
        ===========

        Built {library['built']} with EasyTransfer, profile '{prof.name}'.
        {library['counts']['offline']} of {library['counts']['total']} resources
        work with no internet at all.

        TO OPEN IT
          Phone or tablet ..... tap START-HERE.html
          Computer ............ double-click START-HERE.html
          VillageServer Pi .... serve this folder; it is already the web root

        You do not need to install anything, and you do not need a signal.

        TO SHARE WHAT IS ON IT
          Open the app and tap Share on any item. It asks what you are sharing
          from and to, and walks through that one route step by step.

        WHAT NOT TO DO
          Do not rename or move the 'app' or 'media' folders. The app finds
          everything by its path, so a moved folder is a library that opens to
          empty shelves.

        The material comes from the Digital Bible Society and its publishing
        partners, who give it away free of charge. Free to receive and to pass
        on is not the same as free to sell — never charge for this card.
        """), encoding="utf-8")


# ------------------------------------------------------------------ entry

def main():
    ap = argparse.ArgumentParser(
        prog="easytransfer",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--catalog", default=str(DEFAULT_CATALOG),
                    help="source catalogue (default: catalog/resources.json)")
    ap.add_argument("--workers", type=int, default=6)
    sub = ap.add_subparsers(dest="cmd", required=True)

    for name, fn, needs_out in (("plan", cmd_plan, False),
                                ("build", cmd_build, True),
                                ("verify", cmd_verify, True),
                                ("preview", cmd_preview, False),
                                ("list", cmd_list, False)):
        p = sub.add_parser(name, help=fn.__doc__)
        p.set_defaults(fn=fn)
        if name in ("plan", "build"):
            p.add_argument("--profile", choices=list(P.PROFILES), default="standard")
            p.add_argument("--lang", help="snd, urd, or snd,urd (default: both)")
            p.add_argument("--types", help="narrow the profile, e.g. film,historic")
        if needs_out:
            p.add_argument("--out", required=True, help="card or folder to write")
        if name == "build":
            p.add_argument("--yes", action="store_true", help="skip the prompt")

    args = ap.parse_args()
    try:
        args.fn(args)
    except KeyboardInterrupt:
        sys.exit("\n  Stopped. Re-run the same command to resume.\n")


if __name__ == "__main__":
    main()
