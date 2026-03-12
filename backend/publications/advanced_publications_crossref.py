import aiohttp
import asyncio
import os
import json
import time
import logging
import hashlib
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

CROSSREF_BASE = "https://api.crossref.org/works"
# Replace with your contact email per Crossref etiquette:
USER_AGENT = "wrric/1.0 (mailto:YOUR_EMAIL@example.com)"

# Cache config
CACHE_DIR = "crossref_cache"
QUERY_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days
os.makedirs(CACHE_DIR, exist_ok=True)

# Limits
MAX_PDF_DISCOVERY = 3        # max number of items to attempt PDF discovery per query
PDF_DISCOVERY_CONCURRENCY = 2
MAX_RETRIES = 4
BACKOFF_BASE = 1.0

def _safe_name(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_\-\.]", "_", s)[:240]

def _query_cache_path(query: str, rows: int) -> str:
    h = hashlib.sha256(f"{query}|{rows}".encode("utf-8")).hexdigest()
    return os.path.join(CACHE_DIR, f"query_{h}.json")

def _doi_cache_path(doi: str) -> str:
    return os.path.join(CACHE_DIR, f"doi_{_safe_name(doi)}.json")

def _parse_date(item: Dict[str, Any]) -> Optional[str]:
    # Crossref may include created / issued / published-print / published-online
    for k in ("published-print", "published-online", "issued", "created"):
        d = item.get(k)
        if not d:
            continue
        dt = d.get("date-time") if isinstance(d, dict) else None
        if dt:
            return dt
        parts = d.get("date-parts") if isinstance(d, dict) else None
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

def _map_authors(item: Dict[str, Any]) -> List[str]:
    out = []
    for a in item.get("author", []) if item.get("author") else []:
        given = a.get("given") or ""
        family = a.get("family") or ""
        name = (given + " " + family).strip()
        if not name:
            # sometimes author name is embedded elsewhere
            if a.get("name"):
                name = a.get("name")
        out.append(name if name else None)
    return [x for x in out if x]

def _map_item_to_publication(item: Dict[str, Any]) -> Dict[str, Any]:
    doi = item.get("DOI")
    titles = item.get("title") or []
    title = titles[0] if titles else None
    journal = (item.get("container-title") or [None])[0]
    authors = _map_authors(item)
    abstract = item.get("abstract")  # HTML or text; some publishers omit
    keywords = item.get("subject") or []
    pub_date = _parse_date(item)
    pdf_candidates = []
    for l in item.get("link", []) or []:
        url = l.get("URL") or l.get("url")
        ct = l.get("content-type") or l.get("content_type") or ""
        if url:
            pdf_candidates.append({"url": url, "content_type": ct, "content_version": l.get("content-version")})
    return {
        "title": title or "",
        "abstract": abstract or "",
        "authors": authors,
        "doi": doi,
        "publication_date": pub_date,
        "journal": journal,
        "keywords": keywords,
        "pdf_candidates": pdf_candidates,    # helpful for later PDF discovery
        "pdf_url": None,
        "citation_count": item.get("is-referenced-by-count") or 0,
        "url": item.get("URL"),
        "_crossref_raw": item
    }

async def _get_json_with_retry(session: aiohttp.ClientSession, url: str, params: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    params = params or {}
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with session.get(url, headers=headers, params=params, timeout=30) as resp:
                if resp.status == 429:
                    ra = resp.headers.get("Retry-After")
                    wait = int(ra) if ra and ra.isdigit() else BACKOFF_BASE * (2 ** (attempt - 1))
                    logger.warning(f"Crossref 429: backing off {wait}s (attempt {attempt})")
                    await asyncio.sleep(wait)
                    continue
                if 500 <= resp.status < 600:
                    wait = BACKOFF_BASE * (2 ** (attempt - 1))
                    logger.warning(f"Crossref server error {resp.status}; backoff {wait}s")
                    await asyncio.sleep(wait)
                    continue
                data = await resp.json()
                return data
        except asyncio.TimeoutError:
            wait = BACKOFF_BASE * (2 ** (attempt - 1))
            logger.warning(f"Timeout fetching {url}; retry in {wait}s")
            await asyncio.sleep(wait)
        except Exception as e:
            wait = BACKOFF_BASE * (2 ** (attempt - 1))
            logger.warning(f"Request error {e}; retry in {wait}s")
            await asyncio.sleep(wait)
    logger.error(f"Failed to fetch {url} after {MAX_RETRIES} attempts")
    return None

async def _discover_pdf_url(session: aiohttp.ClientSession, doi: Optional[str], pdf_candidates: List[Dict[str, Any]]) -> Optional[str]:
    """
    1) Prefer Crossref 'link' candidates already present.
    2) If none, try DOI content negotiation (Accept: application/pdf) via https://doi.org/{doi}.
    This is limited and cached; function is conservative.
    """
    # 1) check explicit candidates first
    for c in pdf_candidates:
        url = c.get("url")
        ct = (c.get("content_type") or c.get("content-type") or "").lower()
        if not url:
            continue
        # If content type suggests pdf OR extension ends with .pdf -> accept
        if "pdf" in ct or url.lower().split("?")[0].endswith(".pdf"):
            return url

    # 2) DOI content-negotiation: do a gentle GET (no body download) and inspect headers
    if not doi:
        return None

    doi_key = doi.lower()
    doi_cache_file = _doi_cache_path(doi_key)
    # cached result?
    if os.path.exists(doi_cache_file):
        try:
            with open(doi_cache_file, "r", encoding="utf-8") as fh:
                j = json.load(fh)
                # expire not enforced for DOI cache (we can), but keep simple
                return j.get("pdf_url")
        except Exception:
            pass

    headers = {"User-Agent": USER_AGENT, "Accept": "application/pdf"}
    doi_url = f"https://doi.org/{doi}"
    try:
        # Make a streaming GET but only read headers and small amount; don't download large bodies
        async with session.get(doi_url, headers=headers, allow_redirects=True, timeout=30) as resp:
            # If final content-type is pdf -> return final url
            ct = resp.headers.get("Content-Type", "").lower()
            final_url = str(resp.url)
            if resp.status == 200 and "pdf" in ct:
                # cache and return
                with open(doi_cache_file, "w", encoding="utf-8") as fh:
                    json.dump({"pdf_url": final_url, "checked_at": time.time()}, fh)
                return final_url
            # Some publishers redirect to a landing page even when Accept: application/pdf; fallback none
    except Exception as e:
        logger.debug(f"PDF discovery via DOI failed for {doi}: {e}")

    # cache a negative result to avoid retrying repeatedly
    with open(doi_cache_file, "w", encoding="utf-8") as fh:
        json.dump({"pdf_url": None, "checked_at": time.time()}, fh)
    return None

async def fetch_publications_from_crossref(query: str, rows: int = 5) -> List[Dict[str, Any]]:
    """
    Async replacement for scrape_scholar(query). Returns a list of dicts similar to:
    [
      {
        "title": ...,
        "doi": ...,
        "url": ...,
        "abstract": ...,
        "authors": [...],
        "publication_date": ...,
        "journal": ...,
        "keywords": [...],
        "pdf_url": ...,
        "citation_count": ...,
        "_crossref_raw": {...}
      }, ...
    ]
    Behavior:
      - Uses one Crossref /works call per query.
      - Caches query results on disk for TTL (7 days by default).
      - Attempts limited PDF discovery for up to MAX_PDF_DISCOVERY items per query,
        using Crossref link candidates first and then DOI content negotiation.
    """
    query_cache = _query_cache_path(query, rows)
    # Return cached if fresh
    if os.path.exists(query_cache):
        try:
            stat = os.stat(query_cache)
            age = time.time() - stat.st_mtime
            if age < QUERY_CACHE_TTL_SECONDS:
                logger.info(f"Using cached Crossref results for query (age={age:.0f}s): {query}")
                with open(query_cache, "r", encoding="utf-8") as fh:
                    return json.load(fh)
        except Exception:
            pass

    params = {"query": query, "rows": rows}
    async with aiohttp.ClientSession() as session:
        data = await _get_json_with_retry(session, CROSSREF_BASE, params=params)
        if not data:
            return []

        items = data.get("message", {}).get("items", [])
        mapped = [_map_item_to_publication(it) for it in items]

        # Try limited PDF discovery only for items missing abstracts or pdf_url
        to_discover = [m for m in mapped if (not m.get("abstract")) and not m.get("pdf_url")]
        # limit to MAX_PDF_DISCOVERY
        to_discover = to_discover[:MAX_PDF_DISCOVERY]
        if to_discover:
            sem = asyncio.Semaphore(PDF_DISCOVERY_CONCURRENCY)
            async def _discover_wrap(m):
                async with sem:
                    try:
                        pdf = await _discover_pdf_url(session, m.get("doi"), m.get("pdf_candidates") or [])
                        if pdf:
                            m["pdf_url"] = pdf
                            logger.info(f"Discovered PDF for DOI={m.get('doi')}: {pdf}")
                    except Exception as e:
                        logger.debug(f"Error discovering PDF for {m.get('doi')}: {e}")
            await asyncio.gather(*[_discover_wrap(m) for m in to_discover])

        # Clean up mapped entries (remove internal pdf_candidates) and prepare return
        for m in mapped:
            if "pdf_candidates" in m:
                del m["pdf_candidates"]

        # Save to query cache
        try:
            with open(query_cache, "w", encoding="utf-8") as fh:
                json.dump(mapped, fh, indent=2, ensure_ascii=False)
            logger.info(f"Saved Crossref query results to cache: {query_cache}")
        except Exception as e:
            logger.debug(f"Failed to save query cache: {e}")

        return mapped

# Example usage:
# async def main():
#     res = await fetch_publications_from_crossref("Dr.Isaac Aboagye university of Ghana school of engineering", rows=10)
#     print(f"Found {len(res)} items")
#     for r in res:
#         print(r["title"], r["doi"], r["pdf_url"])
#
# asyncio.run(main())
