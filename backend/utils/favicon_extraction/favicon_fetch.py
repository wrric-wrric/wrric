import re
import base64
import aiohttp
import asyncio
import logging
from urllib.parse import urlparse, unquote, parse_qs
from bs4 import BeautifulSoup
from utils.logger import get_logger
from typing import Optional

logger = get_logger("favicon")

# Enhanced in-memory cache
_domain_to_favicon_cache: dict[str, str] = {}        # domain → base64 favicon
_name_to_domain_cache: dict[str, str] = {}           # university name → resolved domain
_failed_name_cache: set[str] = set()                 # names that failed to resolve
_failed_domain_cache: set[str] = set()               # domains that failed to fetch favicon


async def resolve_domain_from_name(name: str) -> Optional[str]:
    """
    Resolve domain from university name using DuckDuckGo.
    Caches successful and failed resolutions.
    """
    if not name:
        return None

    name = name.strip().lower()
    if name in _name_to_domain_cache:
        logger.debug(f"Domain cache hit for name: {name}")
        return _name_to_domain_cache[name]

    if name in _failed_name_cache:
        logger.debug(f"Skipping known failed name: {name}")
        return None

    query = f"{name} official site"
    search_url = "https://duckduckgo.com/html"
    params = {"q": query}

    logger.info(f"Resolving domain via DuckDuckGo: '{name}'")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                search_url,
                params=params,
                timeout=8,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            ) as response:
                if response.status == 202:
                    logger.warning(f"DuckDuckGo rate-limited (202) for '{name}'")
                    _failed_name_cache.add(name)
                    return None
                if response.status != 200:
                    logger.warning(f"DuckDuckGo status {response.status} for '{name}'")
                    _failed_name_cache.add(name)
                    return None

                html = await response.text()
                soup = BeautifulSoup(html, "html.parser")
                links = soup.select("a.result__a, a.result__url")

                for link in links:
                    href = link.get("href")
                    if not href:
                        continue

                    # Decode DDG redirect
                    if "duckduckgo.com/l/?" in href:
                        parsed = urlparse(href)
                        qs = parse_qs(parsed.query)
                        real_url = qs.get("uddg", [None])[0]
                        if real_url:
                            href = unquote(real_url)

                    parsed = urlparse(href)
                    domain = parsed.netloc
                    if not domain:
                        continue

                    # Filter junk
                    junk = ["duckduckgo", "wikipedia", "facebook", "linkedin", "youtube", "twitter"]
                    if any(j in domain for j in junk):
                        continue

                    logger.debug(f"Resolved '{name}' → {domain}")
                    _name_to_domain_cache[name] = domain
                    return domain

                logger.warning(f"No valid domain found for '{name}'")
                _failed_name_cache.add(name)
                return None

    except asyncio.TimeoutError:
        logger.error(f"Timeout resolving domain for '{name}'")
        _failed_name_cache.add(name)
        return None
    except Exception as e:
        logger.error(f"Error resolving domain for '{name}': {e}")
        _failed_name_cache.add(name)
        return None


async def get_favicon_data(domain_or_name: str, size: int = 64) -> Optional[str]:
    """
    Fetch favicon from domain. Accepts domain or name.
    Uses domain-level cache.
    """
    if not domain_or_name:
        return None

    # Normalize input
    if re.match(r"^https?://", domain_or_name, re.I):
        domain = urlparse(domain_or_name).netloc
    else:
        domain = domain_or_name

    domain = domain.lower().strip()
    if not domain:
        return None

    # Cache hit
    if domain in _domain_to_favicon_cache:
        logger.debug(f"Favicon cache hit for domain: {domain}")
        return _domain_to_favicon_cache[domain]

    if domain in _failed_domain_cache:
        logger.debug(f"Skipping known failed domain: {domain}")
        return None

    # Resolve name → domain if needed
    if not re.match(r"^[a-z0-9.-]+\.[a-z]{2,}$", domain):
        resolved = await resolve_domain_from_name(domain_or_name)
        if not resolved:
            # Heuristic fallback (only once)
            heuristic = re.sub(r'[^a-z0-9]', '', domain_or_name.lower()) + ".edu"
            if heuristic not in _failed_domain_cache:
                domain = heuristic
            else:
                return None
        else:
            domain = resolved

    favicon_url = f"https://www.google.com/s2/favicons?sz={size}&domain={domain}"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(favicon_url, timeout=5) as response:
                if response.status == 200:
                    data = await response.read()
                    if data:
                        encoded = base64.b64encode(data).decode("utf-8")
                        favicon_b64 = f"data:image/png;base64,{encoded}"
                        _domain_to_favicon_cache[domain] = favicon_b64
                        logger.debug(f"Favicon cached for domain: {domain}")
                        return favicon_b64
    except Exception as e:
        logger.error(f"Failed to fetch favicon for {domain}: {e}")
        _failed_domain_cache.add(domain)
        return None

    logger.warning(f"No favicon for domain: {domain}")
    _failed_domain_cache.add(domain)
    return None


async def fetch_favicons(
    university_name: Optional[str] = None,
    source_url: Optional[str] = None
) -> dict:
    """
    Fetch favicons for university and source URL.
    Fully cached at domain level.
    """
    result = {
        "university": university_name,
        "source_url": source_url,
        "university_favicon": None,
        "source_favicon": None
    }

    tasks = []
    if university_name:
        tasks.append(get_favicon_data(university_name))
    else:
        tasks.append(asyncio.create_task(asyncio.sleep(0)))

    if source_url:
        tasks.append(get_favicon_data(source_url))
    else:
        tasks.append(asyncio.create_task(asyncio.sleep(0)))

    try:
        uni_fav, src_fav = await asyncio.gather(*tasks)
        result["university_favicon"] = uni_fav
        result["source_favicon"] = src_fav
    except Exception as e:
        logger.exception(f"Error in fetch_favicons: {e}")

    return result