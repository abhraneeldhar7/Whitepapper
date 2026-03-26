import time
from urllib.parse import urlsplit, urlunsplit


def add_cache_buster(url: str) -> str:
    parts = urlsplit(url)
    if parts.query:
        return url
    stamp = int(time.time() * 1000)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, f"time={stamp}", ""))
