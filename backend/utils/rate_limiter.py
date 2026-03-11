"""Simple async rate limiter using token bucket for external API calls."""

import asyncio
import time
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """Token-bucket rate limiter for async contexts."""

    def __init__(self, calls_per_second: float, name: str = ""):
        self.min_interval = 1.0 / calls_per_second
        self.name = name
        self._lock = asyncio.Lock()
        self._last_call = 0.0

    async def acquire(self):
        async with self._lock:
            now = time.monotonic()
            wait = self._last_call + self.min_interval - now
            if wait > 0:
                logger.debug(f"Rate limiter [{self.name}] waiting {wait:.2f}s")
                await asyncio.sleep(wait)
            self._last_call = time.monotonic()

    async def __aenter__(self):
        await self.acquire()
        return self

    async def __aexit__(self, *exc):
        pass


# Pre-configured limiters for external services
jina_limiter = RateLimiter(calls_per_second=5, name="jina")
gemini_limiter = RateLimiter(calls_per_second=10, name="gemini")
groq_limiter = RateLimiter(calls_per_second=0.5, name="groq")  # Free tier: ~30 req/min
cerebras_limiter = RateLimiter(calls_per_second=0.5, name="cerebras")  # Free tier: ~30 req/min
sambanova_limiter = RateLimiter(calls_per_second=0.33, name="sambanova")  # Free tier: ~20 req/min
crossref_limiter = RateLimiter(calls_per_second=3, name="crossref")
