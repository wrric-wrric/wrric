import time
from typing import Dict, List


class RateLimiter:
    """Simple in-memory rate limiter using sliding window."""

    def __init__(self):
        self._store: Dict[str, List[float]] = {}

    async def check(self, key: str, max_requests: int, window_seconds: int) -> bool:
        """Returns True if allowed, False if rate-limited."""
        now = time.time()
        cutoff = now - window_seconds

        if key not in self._store:
            self._store[key] = []

        # Remove expired entries
        self._store[key] = [t for t in self._store[key] if t > cutoff]

        if len(self._store[key]) >= max_requests:
            return False

        self._store[key].append(now)
        return True

    def cleanup(self, max_age_seconds: int = 7200):
        """Remove stale keys older than max_age_seconds."""
        now = time.time()
        cutoff = now - max_age_seconds
        keys_to_delete = []
        for key, timestamps in self._store.items():
            if not timestamps or timestamps[-1] < cutoff:
                keys_to_delete.append(key)
        for key in keys_to_delete:
            del self._store[key]


# Singleton instance
rate_limiter = RateLimiter()
