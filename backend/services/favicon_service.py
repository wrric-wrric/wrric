
import asyncio
import logging
from utils.favicon_extraction.favicon_fetch import fetch_favicons
from typing import Dict, List, Any

logger = logging.getLogger(__name__)



# --------------------------------------------------------------
# Helper – parallel favicon enrichment
# --------------------------------------------------------------
async def _enrich_with_favicons_parallel(
    payloads: List[Dict[str, Any]],
    institution_key: str = "university",
    source_key: str = "website",
) -> List[Dict[str, Any]]:
    """
    Takes a list of entity payloads and enriches each one with
    university_favicon / source_favicon in parallel.
    """
    # 1. Build the list of coroutine objects
    tasks = [
        fetch_favicons(payload.get(institution_key), payload.get(source_key))
        for payload in payloads
    ]

    # 2. Execute all of them concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 3. Merge results back (exceptions → None/None)
    for payload, raw in zip(payloads, results):
        if isinstance(raw, Exception):
            logger.warning(
                f"Failed to fetch favicons for {payload.get(institution_key) or payload.get(source_key)}: {raw}"
            )
            payload["university_favicon"] = None
            payload["source_favicon"] = None
        else:
            payload["university_favicon"] = raw.get("university_favicon")
            payload["source_favicon"] = raw.get("source_favicon")

    return payloads