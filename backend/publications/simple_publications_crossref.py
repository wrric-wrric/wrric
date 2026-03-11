import httpx
import asyncio
import os
import json
import time
import hashlib
import logging
import re
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

CROSSREF_BASE = "https://api.crossref.org/works"

# Update with your contact email per Crossref etiquette:
USER_AGENT = "unlokinno/1.0 (mailto:agudeydaniel8@gmail.com)"

# Simple on-disk cache
CACHE_DIR = "crossref_cache"
os.makedirs(CACHE_DIR, exist_ok=True)
CACHE_TTL_SECONDS = 60 * 60 * 24  # 24 hours

MAX_RETRIES = 3
BACKOFF_BASE = 1.0


def _cache_path_for(query_key: str) -> str:
    h = hashlib.sha256(query_key.encode("utf-8")).hexdigest()
    return os.path.join(CACHE_DIR, f"crossref_{h}.json")


def _parse_crossref_date(item: Dict[str, Any]) -> Optional[str]:
    # Try published-print -> published-online -> issued -> created
    for k in ("published-print", "published-online", "issued", "created"):
        d = item.get(k)
        if not d:
            continue
        # If Crossref supplied date-time
        if isinstance(d, dict):
            dt = d.get("date-time")
            if dt:
                return dt
            parts = d.get("date-parts")
            if parts and isinstance(parts, list) and parts and isinstance(parts[0], (list, tuple)):
                p = parts[0]
                try:
                    if len(p) >= 3:
                        return f"{int(p[0]):04d}-{int(p[1]):02d}-{int(p[2]):02d}"
                    elif len(p) == 2:
                        return f"{int(p[0]):04d}-{int(p[1]):02d}-01"
                    elif len(p) == 1:
                        return f"{int(p[0]):04d}-01-01"
                except Exception:
                    continue
    return None


def _extract_year_from_date(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    # Try ISO-like first
    m = re.match(r"(\d{4})", date_str)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            return None
    return None


async def semantic_crossref_fallback(university: str, topic: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Crossref fallback that returns the same shape as semantic_scholar_fallback.

    Args:
        university (str): University name.
        topic (str): Research topic.
        limit (int): Number of results to fetch.

    Returns:
        List[Dict[str, Any]]: List of publications with keys:
            title, doi, url, year, citations, references, fields_of_study,
            publication_types, publication_date, abstract
    """
    query = f"{university} {topic}".strip()
    rows = max(1, int(limit))

    cache_key = f"crossref|{query}|{rows}"
    cache_path = _cache_path_for(cache_key)

    # Serve from cache if fresh
    if os.path.exists(cache_path):
        try:
            stat = os.stat(cache_path)
            age = time.time() - stat.st_mtime
            if age < CACHE_TTL_SECONDS:
                logger.info(f"Using cached Crossref results for '{query}' (age {age:.0f}s)")
                with open(cache_path, "r", encoding="utf-8") as fh:
                    return json.load(fh)
        except Exception:
            logger.debug("Cache read error; will re-fetch")

    params = {"query": query, "rows": rows}

    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

    backoff = BACKOFF_BASE
    attempt = 0
    resp_json = None
    async with httpx.AsyncClient(timeout=20.0) as client:
        while attempt < MAX_RETRIES:
            attempt += 1
            try:
                r = await client.get(CROSSREF_BASE, params=params, headers=headers)
                if r.status_code == 429:
                    # polite backoff using Retry-After if present
                    ra = r.headers.get("Retry-After")
                    wait = int(ra) if ra and ra.isdigit() else backoff
                    logger.warning(f"Crossref 429 rate limit. Waiting {wait}s (attempt {attempt}/{MAX_RETRIES})")
                    await asyncio.sleep(wait)
                    backoff *= 2
                    continue
                if 500 <= r.status_code < 600:
                    logger.warning(f"Crossref server error {r.status_code}. Backing off {backoff}s")
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue
                r.raise_for_status()
                resp_json = r.json()
                break
            except httpx.HTTPError as e:
                logger.warning(f"HTTP error on Crossref request: {e}; backing off {backoff}s")
                await asyncio.sleep(backoff)
                backoff *= 2
            except Exception as e:
                logger.exception(f"Unexpected error querying Crossref: {e}")
                await asyncio.sleep(backoff)
                backoff *= 2

    if not resp_json:
        logger.error("Failed to get response from Crossref")
        return []

    items = resp_json.get("message", {}).get("items", []) or []
    results: List[Dict[str, Any]] = []

    # Map each item to required shape. Only use data present in the Crossref item.
    for it in items:
        title_list = it.get("title") or []
        title = title_list[0] if title_list else ""
        doi = it.get("DOI") or None
        url = it.get("URL") or None

        pub_date = _parse_crossref_date(it)
        year = _extract_year_from_date(pub_date)

        citations = it.get("is-referenced-by-count") or 0
        references = it.get("reference-count") or 0

        fields_of_study = it.get("subject") or []
        # Crossref 'type' can be e.g. 'journal-article' - present it as list for compatibility
        publication_types = [it.get("type")] if it.get("type") else []

        abstract = it.get("abstract") or ""

        result = {
            "title": title,
            "doi": doi or "N/A",
            "url": url or "",
            "year": year or "",
            "citations": int(citations) if isinstance(citations, (int, float)) else 0,
            "references": int(references) if isinstance(references, (int, float)) else 0,
            "fields_of_study": fields_of_study,
            "publication_types": publication_types,
            "publication_date": pub_date or "",
            "abstract": abstract
        }
        results.append(result)

    # Save to cache (best-effort)
    try:
        with open(cache_path, "w", encoding="utf-8") as fh:
            json.dump(results, fh, indent=2, ensure_ascii=False)
    except Exception:
        logger.debug("Failed to write Crossref query cache")

    return results
