import logging
import re
import httpx
import json
import asyncio
import os
from httpx import RequestError
from bs4 import BeautifulSoup
from urllib.parse import quote
from typing import Dict, List, Optional, Any
from tenacity import retry, stop_after_attempt, wait_exponential
from difflib import SequenceMatcher
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
from utils.google_search import search_with_meta
import requests
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from publications.simple_publications_crossref import semantic_crossref_fallback


CHROME_PATH = os.getenv("CHROME_PATH")

USER_DATA_DIR = os.path.join(os.getcwd(), "chrome_user_data")

logger = logging.getLogger(__name__)

# Headers for HTTP request
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
}

def normalize_university_name(university: str) -> str:
    """Normalize university name for search (e.g., 'of' to 'for', remove extra spaces)."""
    name = re.sub(r'\s+', ' ', university.strip())
    name = name.replace(" of ", " for ")
    return name

def similarity(a: str, b: str) -> float:
    """Calculate similarity ratio between two strings using SequenceMatcher."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

async def search_duckduckgo(query: str, max_results: int = 2) -> List[Dict[str, str]]:
    """Custom DDGS search using httpx to avoid timeouts."""
    try:
        encoded_query = quote(query)
        url = f"https://lite.duckduckgo.com/lite/?q={encoded_query}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, headers=HEADERS)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            results = []
            for link in soup.find_all("a", class_="result-link")[:max_results]:
                href = link.get("href")
                title = link.get_text(strip=True)
                if href:
                    results.append({"url": href, "title": title, "description": ""})
            logger.debug(f"[Custom DDGS] Retrieved {len(results)} results for query '{query}': {results}")
            return results
    except Exception as e:
        logger.error(f"Custom DDGS failed for '{query}': {str(e)}")
        return []
    

# In-memory caches
_EDURANK_NEGATIVE_CACHE: Dict[str, datetime] = {}             # {university: timestamp}
_EDURANK_POSITIVE_CACHE: Dict[str, Dict[str, Any]] = {}       # {university: {"data": {...}, "timestamp": datetime}}

# Cache expiry
_NEGATIVE_CACHE_TTL = timedelta(hours=6)
_POSITIVE_CACHE_TTL = timedelta(hours=12)

# Tunable timeouts
_SEARCH_TIMEOUT = 2.5        # seconds for Google/DDGS search
_DDGS_TIMEOUT = 2.5
_HTTP_TIMEOUT = 4.5          # seconds for fetching EduRank page
_MAX_RESULTS = 2


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=0.5, min=0.5, max=4), reraise=True)
async def get_edurank_data(university: str) -> Dict[str, Any]:
    """Fast, cached EduRank lookup with separate positive/negative caches."""
    try:
        if not university:
            return {"score": None, "url": None}

        now = datetime.utcnow()

        # Positive cache check
        cached_pos = _EDURANK_POSITIVE_CACHE.get(university)
        if cached_pos and now - cached_pos["timestamp"] < _POSITIVE_CACHE_TTL:
            logger.debug("EduRank positive cache hit for '%s'", university)
            return cached_pos["data"]

        # Negative cache check
        cached_neg = _EDURANK_NEGATIVE_CACHE.get(university)
        if cached_neg and now - cached_neg < _NEGATIVE_CACHE_TTL:
            logger.debug("EduRank negative cache hit for '%s'", university)
            return {"score": None, "url": None}

        norm_university = normalize_university_name(university)
        queries = [
            f"edurank {norm_university}",
            f"site:edurank.org {norm_university}",
            f"edurank {university}"
        ]

        edurank_url = None
        loop = asyncio.get_running_loop()

        # Search for EduRank URL
        for query in queries:
            logger.debug("Searching for EduRank with query: %s", query)
            results = []

            try:
                results = await asyncio.wait_for(
                    search_with_meta(query, max_results=_MAX_RESULTS),
                    timeout=_SEARCH_TIMEOUT
                )

                logger.debug("Google Search returned %d results", len(results))
            except asyncio.TimeoutError:
                logger.debug("Google search timed out for: %s", query)
            except Exception as e:
                logger.debug("Google search error for '%s': %s", query, str(e))

            # Fallback: DDGS
            if not results:
                try:
                    results = await asyncio.wait_for(
                        search_duckduckgo(query, max_results=_MAX_RESULTS),
                        timeout=_DDGS_TIMEOUT
                    )
                    logger.debug("DDGS returned %d results", len(results))
                except asyncio.TimeoutError:
                    logger.debug("DDGS timed out for query: %s", query)
                except Exception as ddgs_e:
                    logger.debug("DDGS failed for '%s': %s", query, str(ddgs_e))

            # Inspect results
            for result in results:
                url = result.get("url") or result.get("href") or ""
                if "edurank.org" in url.lower() and ("/uni/" in url or "/university/" in url):
                    edurank_url = url
                    break

            if edurank_url:
                logger.debug("Found EduRank URL: %s", edurank_url)
                break

        # No result — cache negative
        if not edurank_url:
            logger.debug("No EduRank page found for '%s' — caching negative", university)
            _EDURANK_NEGATIVE_CACHE[university] = now
            return {"score": None, "url": None}

        # Fetch EduRank page
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            try:
                response = await client.get(edurank_url, headers=HEADERS)
                response.raise_for_status()
            except (httpx.HTTPError, asyncio.TimeoutError) as e:
                logger.warning("HTTP error fetching EduRank for '%s' at %s: %s", university, edurank_url, e)
                return {"score": None, "url": None}

        # Parse page quickly
        soup = BeautifulSoup(response.text, "html.parser")
        title_tag = soup.find("h1") or soup.find("title")
        title_text = title_tag.get_text(strip=True) if title_tag else ""
        similarity_score = similarity(university, title_text) if title_text else 0.0

        if similarity_score < 0.7:
            logger.debug("Title mismatch for '%s' (sim=%.2f) — ignoring", university, similarity_score)
            return {"score": None, "url": None}

        # Extract world rank
        score = None
        rank_table = soup.find("table", class_="ranks")
        if rank_table:
            for row in rank_table.find_all("tr", limit=10):
                th = row.find("th", scope="row")
                if th and "In the World" in th.get_text(strip=True):
                    td = row.find("td", class_="ranks__rank")
                    if td:
                        place_span = td.find("span", class_="ranks__place")
                        if place_span:
                            txt = place_span.get_text(strip=True).replace(",", "")
                            try:
                                val = int(txt)
                                if 1 <= val <= 20000:
                                    score = val
                            except ValueError:
                                pass
                            break

        data = {"score": score, "url": edurank_url}
        logger.debug("EduRank result: %s score=%s url=%s", university, score, edurank_url)

        # Cache positive result
        _EDURANK_POSITIVE_CACHE[university] = {"data": data, "timestamp": now}

        return data

    except Exception as e:
        logger.exception("Unexpected error in get_edurank_data for '%s': %s", university, e)
        return {"score": None, "url": None}




@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def get_location_for_university(university: str) -> Dict[str, Any]:
    """Geocode the university name and return a structured address."""
    try:
        geo = Nominatim(user_agent="university-scraper")
        loop = asyncio.get_running_loop()
        # Run synchronous geocode in executor to avoid blocking
        place = await loop.run_in_executor(None, lambda: geo.geocode(university, exactly_one=True, timeout=10))
        if not place:
            logger.warning(f"Geocoder found no match for '{university}'")
            return {}

        logger.debug(f"Raw place.raw for '{university}': {place.raw}")
        logger.debug(f"Full display_name: '{place.address}'")

        addr = place.raw.get("address", {})
        county = addr.get("county", "").strip()
        city = (
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("municipality")
            or ""
        ).strip()
        state = addr.get("state", "").strip()
        postcode = addr.get("postcode", "").strip()
        country = addr.get("country", "").strip()
        display_name = place.address or ""

        if not city and display_name:
            parts = [p.strip() for p in display_name.split(",") if p.strip()]
            parts = [p for p in parts if not re.fullmatch(r'[\d\- ]+', p)]
            if len(parts) >= 2:
                city = parts[-2]

        result = {
            "county": county,
            "city": city,
            "state": state,
            "postcode": postcode,
            "country": country,
            "display_name": display_name
        }

        logger.info(f"Geocoded '{university}': {result}")
        return result

    except (GeocoderTimedOut, GeocoderUnavailable) as ge:
        logger.error(f"Geocoding service unavailable for '{university}': {ge}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error geocoding '{university}': {e}")
        return {}



async def semantic_scholar_fallback(university: str, topic: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Fallback function to fetch publications from Semantic Scholar.

    Args:
        university (str): University name.
        topic (str): Research topic.
        limit (int): Number of results to fetch.

    Returns:
        List[Dict[str, Any]]: List of publications with metadata.
    """
    base_url = "https://api.semanticscholar.org/graph/v1/paper/search"
    query = f"{university} {topic}"
    
    params = {
        "query": query,
        "limit": limit,
        "fields": "title,authors,year,url,abstract,citationCount,referenceCount,fieldsOfStudy,publicationTypes,publicationDate,openAccessPdf"
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()

        publications = []
        for paper in data.get("data", []):
            doi_link = None
            oapdf = paper.get("openAccessPdf", {})

            # Check if openAccessPdf.url contains DOI
            if oapdf.get("url", "").startswith("https://doi.org/"):
                doi_link = oapdf["url"]

            # Try to get from disclaimer if available
            elif "disclaimer" in oapdf and oapdf["disclaimer"]:
                match = re.search(r"https://doi\.org/[^\s,]+", oapdf["disclaimer"])
                if match:
                    doi_link = match.group(0)

            publications.append({
                "title": paper.get("title", ""),
                "doi": doi_link or "N/A",
                "url": paper.get("url", ""),  # Semantic Scholar page
                "year": paper.get("year", ""),
                "citations": paper.get("citationCount", 0),
                "references": paper.get("referenceCount", 0),
                "fields_of_study": paper.get("fieldsOfStudy", []),
                "publication_types": paper.get("publicationTypes", []),
                "publication_date": paper.get("publicationDate", ""),
                "abstract": paper.get("abstract", "") or ""
            })

        return publications


async def get_publications(university: str, topic: str, department: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    # Step 1: Try crossref with a looser query
    pubs = await semantic_crossref_fallback(university, topic)

    # Step 3: If still empty, fallback to Semantic Scholar
    if not pubs:
        pubs = await semantic_scholar_fallback(university, topic)

    return {"count": len(pubs), "list": pubs}


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def extract_point_of_contact(university: str, department: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Search for point of contact using jina Search as primary, custom DDGS as fallback."""
    try:
        dept_name = department.get("name", "") if department else ""
        norm_university = normalize_university_name(university)
        query = f"point of contact {norm_university} {dept_name}".strip()
        logger.debug(f"Searching jina for contact with query: {query}")
        try:
            results = await search_with_meta(query, max_results=2)
            logger.debug(f"Jina Search returned {len(results)} results")
        except Exception as e:
            logger.error(f"Jina Search failed for '{query}': {str(e)}, falling back to DDGS")
            try:
                results = await search_duckduckgo(query, max_results=5)
                logger.debug(f"Custom DDGS returned {len(results)} results")
            except Exception as ddgs_e:
                logger.error(f"Custom DDGS failed for '{query}': {str(ddgs_e)}")
                return {}

        if not results:
            logger.warning(f"No results for contact query: {query}")
            return {}

        url = results[0].get("url", results[0].get("href", ""))
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=HEADERS)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")
            html_content = response.text

        json_ld_scripts = soup.find_all("script", type="application/ld+json")
        for script in json_ld_scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict) and data.get("@type") in ["Person", "Organization"]:
                    contact = {}
                    if data.get("name"):
                        contact["name"] = str(data["name"]).strip()
                    if data.get("email"):
                        contact["email"] = str(data["email"]).strip()
                    if data.get("sameAs") and "linkedin.com" in str(data["sameAs"]).lower():
                        contact["linkedin"] = str(data["sameAs"]).strip()
                    if contact:
                        logger.debug(f"Found JSON-LD contact: {contact}")
                        return contact
            except json.JSONDecodeError:
                continue

        faculty_sections = soup.select("div.staff, div.faculty, section.team, ul.staff-list")
        for section in faculty_sections:
            person = section.find(["li", "div"], class_=["person", "staff-member"])
            if person:
                name = person.find(["h3", "h4", "span"], class_=["name", "staff-name"])
                email = person.find("a", href=re.compile(r"mailto:"))
                linkedin = person.find("a", href=re.compile(r"linkedin\.com"))
                contact = {}
                if name:
                    contact["name"] = name.get_text(strip=True)
                if email:
                    contact["email"] = email["href"].replace("mailto:", "")
                if linkedin:
                    contact["linkedin"] = linkedin["href"]
                if contact:
                    logger.debug(f"Found faculty contact: {contact}")
                    return contact

        email_pattern = r"[\w\.-]+@[\w\.-]+\.\w+"
        name_pattern = r"(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.) [\w\s-]+?(?=(,|\s{2,}|$))"
        emails = re.findall(email_pattern, html_content)
        names = re.findall(name_pattern, html_content)
        if emails:
            contact = {"email": emails[0]}
            if names:
                contact["name"] = names[0].strip()
            logger.debug(f"Found regex contact: {contact}")
            return contact

        logger.debug(f"No point of contact found for {query}")
        return {}

    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to fetch point of contact for {university} {dept_name}: {e}")
        return {}
    except Exception as e:
        logger.error(f"Failed to fetch point of contact for {university} {dept_name}: {e}")
        return {}