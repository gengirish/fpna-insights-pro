"""In-memory TTL cache for expensive queries."""

import time
from typing import Any
from functools import wraps
import hashlib
import json


class TTLCache:
    def __init__(self, default_ttl: int = 300):
        self._store: dict[str, tuple[Any, float]] = {}
        self._default_ttl = default_ttl

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        expires_at = time.time() + (ttl or self._default_ttl)
        self._store[key] = (value, expires_at)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    def clear(self) -> None:
        self._store.clear()

    @property
    def size(self) -> int:
        self._cleanup()
        return len(self._store)

    def _cleanup(self) -> None:
        now = time.time()
        expired = [k for k, (_, exp) in self._store.items() if now > exp]
        for k in expired:
            del self._store[k]


cache = TTLCache(default_ttl=300)


def make_cache_key(*args: Any) -> str:
    raw = json.dumps(args, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def cached(ttl: int = 300):
    """Decorator to cache async function results."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{func.__module__}.{func.__name__}:{make_cache_key(args[1:], kwargs)}"
            result = cache.get(key)
            if result is not None:
                return result
            result = await func(*args, **kwargs)
            cache.set(key, result, ttl)
            return result
        return wrapper
    return decorator
