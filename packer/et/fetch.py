"""Sizing and downloading.

Two jobs: find out how big a build would be before committing a card to it, and
then fetch the files in a way that survives the connection a build like this is
usually run on. Downloads resume — a 2.1 GB film that dies at 80% picks up where
it stopped rather than starting over.
"""
import concurrent.futures, json, os, pathlib, threading, time, urllib.error, urllib.request
from .util import UA, human, inside, fetchable

TIMEOUT = 30
CHUNK = 1 << 18          # 256 KB


# ---------------------------------------------------------------- sizing

class SizeCache:
    """URL -> content-length, persisted so re-planning a card is instant."""

    def __init__(self, path):
        self.path = pathlib.Path(path)
        self.lock = threading.Lock()
        try:
            self.data = json.loads(self.path.read_text())
        except Exception:
            self.data = {}

    def get(self, url):
        return self.data.get(url)

    def put(self, url, n):
        with self.lock:
            self.data[url] = n

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=0, sort_keys=True))


def head_size(url):
    """Content-length, or 0 if the server will not say.

    Some DBS paths reject HEAD but answer GET, so fall back to a ranged GET that
    asks for a single byte rather than giving up on the size.
    """
    for method in ("HEAD", "GET"):
        try:
            headers = dict(UA)
            if method == "GET":
                headers["Range"] = "bytes=0-0"
            req = urllib.request.Request(url, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                if method == "GET":
                    cr = resp.headers.get("content-range")     # bytes 0-0/12345
                    if cr and "/" in cr:
                        tail = cr.rsplit("/", 1)[1]
                        if tail.isdigit():
                            return int(tail)
                n = resp.headers.get("content-length")
                if n and n.isdigit() and int(n) > 1:
                    return int(n)
        except Exception:
            continue
    return 0


def probe(assets, cache, workers=8, on_each=None):
    """Fill in .nbytes on every asset. Cached URLs cost nothing."""
    todo = [a for a in assets if cache.get(a.url) is None]
    for a in assets:
        cached = cache.get(a.url)
        if cached is not None:
            a.nbytes = cached

    if todo:
        with concurrent.futures.ThreadPoolExecutor(workers) as pool:
            futs = {pool.submit(head_size, a.url): a for a in todo}
            for i, fut in enumerate(concurrent.futures.as_completed(futs), 1):
                a = futs[fut]
                a.nbytes = fut.result()
                cache.put(a.url, a.nbytes)
                if on_each:
                    on_each(i, len(todo), a)
        cache.save()
    return assets


# ---------------------------------------------------------------- fetching

class Result:
    __slots__ = ("asset", "status", "nbytes", "error")

    def __init__(self, asset, status, nbytes=0, error=""):
        self.asset, self.status, self.nbytes, self.error = asset, status, nbytes, error


def _fetch_one(asset, root, retries=3):
    # A catalogue is untrusted input: neither the URL nor the path it lands in
    # is taken on trust.
    if not fetchable(asset.url):
        return Result(asset, "fail", 0, "refused: not a public http(s) URL")
    try:
        dest = inside(root, asset.rel)
    except ValueError as e:
        return Result(asset, "fail", 0, str(e))
    part = dest.with_suffix(dest.suffix + ".part")

    # A file only ever gets its final name by the rename at the end of a
    # completed, validated download — partial data lives in `.part`. So a file
    # that exists under its real name is finished. Comparing it to the probed
    # size instead would delete good files whenever the probe was wrong, which
    # it sometimes is (see below).
    if dest.exists() and dest.stat().st_size > 0:
        return Result(asset, "have", dest.stat().st_size)

    dest.parent.mkdir(parents=True, exist_ok=True)
    last = ""
    for attempt in range(retries):
        have = part.stat().st_size if part.exists() else 0
        headers = dict(UA)
        if have:
            headers["Range"] = f"bytes={have}-"
        try:
            req = urllib.request.Request(asset.url, headers=headers)
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                # A server that ignores Range answers 200 and restarts the body.
                mode = "ab" if (have and resp.status == 206) else "wb"
                if mode == "wb":
                    have = 0

                # What THIS response promises, which is what the file is judged
                # against. The size probed at plan time is for planning only:
                # meta.dbs.org answers a probe with one length and a download
                # with another for the same cover image, and trusting the probe
                # threw away thirteen complete, valid files.
                expect = 0
                cl = resp.headers.get("content-length")
                if cl and cl.isdigit():
                    expect = have + int(cl)
                with open(part, mode) as fh:
                    while True:
                        buf = resp.read(CHUNK)
                        if not buf:
                            break
                        fh.write(buf)
            size = part.stat().st_size
            if expect and size != expect:
                # The connection closed before the server finished. Keep the
                # part-file: the next attempt resumes from here.
                last = f"short read: got {size} of {expect} bytes"
                continue
            part.replace(dest)
            return Result(asset, "ok", size)
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            if e.code in (403, 404, 410):
                break                       # not coming back; stop retrying
            if e.code == 416:               # already complete
                part.replace(dest)
                return Result(asset, "ok", dest.stat().st_size)
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
        time.sleep(1.5 * (attempt + 1))
    return Result(asset, "fail", 0, last)


def download(assets, root, workers=4, on_done=None):
    """Fetch every asset into `root`. Returns the list of Results."""
    results = []
    with concurrent.futures.ThreadPoolExecutor(workers) as pool:
        futs = [pool.submit(_fetch_one, a, root) for a in assets]
        for i, fut in enumerate(concurrent.futures.as_completed(futs), 1):
            r = fut.result()
            results.append(r)
            if on_done:
                on_done(i, len(assets), r)
    return results
