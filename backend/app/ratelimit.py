"""
Minimal in-memory rate limiter for auth endpoints. Good enough to blunt
credential stuffing on a single-process deployment; swap for Redis-backed
slowapi if this ever runs behind multiple workers.
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

_hits: dict[str, deque] = defaultdict(deque)


def check_rate(request: Request, key: str, limit: int = 8, window_s: int = 60) -> None:
    ip = request.client.host if request.client else "unknown"
    bucket = f"{key}:{ip}"
    now = time.time()
    q = _hits[bucket]
    while q and now - q[0] > window_s:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Try again in a minute.")
    q.append(now)