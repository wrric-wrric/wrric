import asyncio
import logging
from typing import Dict, Any, List, Optional
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from dotenv import load_dotenv
import os
from fuzzywuzzy import fuzz

load_dotenv()
logger = logging.getLogger(__name__)

# API credentials (set in .env or environment variables)
OPENCAGE_API_KEY = os.getenv("OPENCAGE_API_KEY", "")
GEONAMES_USERNAME = os.getenv("GEONAMES_USERNAME", "")

def validate_result(university: str, result: Dict[str, Any]) -> bool:
    """Validate if the geocoded result matches the input university name."""
    if not result or not result.get("display_name"):
        return False
    display_name = result["display_name"].lower()
    university_lower = university.lower()
    # Use fuzzy matching with a threshold of 80%
    similarity = fuzz.partial_ratio(university_lower, display_name)
    if similarity < 80:
        logger.debug(f"Result rejected: '{display_name}' does not match '{university}' (similarity: {similarity})")
        return False
    return True

async def geocode_with_api(client: httpx.AsyncClient, api: str, query: str, university: str) -> Optional[Dict[str, Any]]:
    """Attempt geocoding with a specific API and return result if valid."""
    try:
        if api == "photon":
            logger.debug(f"Attempting Photon API for '{query}'")
            photon_url = f"https://photon.komoot.io/api/?q={query}&limit=1&osm_tag=amenity:university"
            response = await client.get(photon_url)
            response.raise_for_status()
            data = response.json()
            if data.get("features"):
                feature = data["features"][0]
                props = feature.get("properties", {})
                coords = feature.get("geometry", {}).get("coordinates", [None, None])
                result = {
                    "city": props.get("city", "") or props.get("name", ""),
                    "county": props.get("county", ""),
                    "state": props.get("state", ""),
                    "postcode": props.get("postcode", ""),
                    "country": props.get("country", ""),
                    "display_name": props.get("name", "") or university,
                    "latitude": coords[1] if coords[1] else None,
                    "longitude": coords[0] if coords[0] else None
                }
                if validate_result(university, result):
                    return result

        elif api == "opencage" and OPENCAGE_API_KEY:
            logger.debug(f"Attempting OpenCage API for '{query}'")
            opencage_url = f"https://api.opencagedata.com/geocode/v1/json?q={query}&key={OPENCAGE_API_KEY}&limit=1"
            response = await client.get(opencage_url)
            response.raise_for_status()
            data = response.json()
            if data.get("results"):
                result = data["results"][0]
                components = result.get("components", {})
                geometry = result.get("geometry", {})
                city = (
                    components.get("city")
                    or components.get("town")
                    or components.get("village")
                    or ""
                ).strip()
                result_dict = {
                    "city": city,
                    "county": components.get("county", ""),
                    "state": components.get("state", ""),
                    "postcode": components.get("postcode", ""),
                    "country": components.get("country", ""),
                    "display_name": result.get("formatted", "") or university,
                    "latitude": geometry.get("lat"),
                    "longitude": geometry.get("lng")
                }
                if validate_result(university, result_dict):
                    return result_dict

        elif api == "geonames" and GEONAMES_USERNAME:
            logger.debug(f"Attempting GeoNames API for '{query}'")
            geonames_url = f"http://api.geonames.org/searchJSON?q={query}&maxRows=1&username={GEONAMES_USERNAME}&featureCode=UNIV"
            response = await client.get(geonames_url)
            response.raise_for_status()
            data = response.json()
            if data.get("geonames"):
                place = data["geonames"][0]
                result = {
                    "city": place.get("name", ""),
                    "county": place.get("adminName2", ""),
                    "state": place.get("adminName1", ""),
                    "postcode": "",
                    "country": place.get("countryName", ""),
                    "display_name": place.get("name", "") or university,
                    "latitude": float(place.get("lat")) if place.get("lat") else None,
                    "longitude": float(place.get("lng")) if place.get("lng") else None
                }
                if validate_result(university, result):
                    return result

        logger.debug(f"No valid result from {api} for '{query}'")
        return None

    except httpx.HTTPStatusError as he:
        logger.error(f"HTTP error in {api} for '{query}': {he}")
        return None
    except httpx.RequestError as re:
        logger.error(f"Network error in {api} for '{query}': {re}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in {api} for '{query}': {e}")
        return None

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def get_location_for_university(university: str, contexts: List[str] = None) -> Dict[str, Any]:
    """Geocode the university name with multiple contexts and prioritize coordinates."""
    contexts = contexts or []
    queries = [f"{university} {ctx}".strip() for ctx in contexts if ctx] + [university]
    best_result = {}
    best_has_coords = False

    async with httpx.AsyncClient(timeout=10) as client:
        for query in queries:
            logger.debug(f"Processing query: '{query}'")
            for api in ["photon", "opencage", "geonames"]:
                result = await geocode_with_api(client, api, query, university)
                if result:
                    has_coords = result.get("latitude") is not None and result.get("longitude") is not None
                    if has_coords:
                        logger.info(f"Geocoded '{query}' with coordinates using {api}: {result}")
                        return result  # Return immediately if coordinates are found
                    elif not best_result or (result.get("country") and not best_result.get("country")):
                        best_result = result  # Store best non-coordinate result
                        logger.debug(f"Stored non-coordinate result from {api} for '{query}': {result}")

        if best_result:
            logger.info(f"No coordinates found, returning best address for '{university}': {best_result}")
            return best_result
        logger.warning(f"No geocoding results for '{university}' with contexts {contexts}")
        return {}