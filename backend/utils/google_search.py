


import logging
import asyncio
import httpx
from duckduckgo_search import DDGS
from bs4 import BeautifulSoup
import os
import re
import json
from dotenv import load_dotenv
from utils.rate_limiter import jina_limiter

logger = logging.getLogger(__name__)

async def fetch_title_and_snippet(
    client: httpx.AsyncClient,
    url: str,
    timeout: float = 7.0,
    max_bytes: int = 10_000
):
    """
    Fetch page title + first paragraph snippet from a URL asynchronously via httpx.
    Streams up to `max_bytes` characters.
    """
    try:
        resp = await client.get(
            url,
            timeout=httpx.Timeout(5.0, read=timeout),
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        )
        resp.raise_for_status()

        text = ""
        async for chunk in resp.aiter_text():
            text += chunk
            if len(text) >= max_bytes:
                break

        if not text:
            raw = await resp.aread()
            text = raw.decode(resp.encoding or "utf-8", errors="ignore")[:max_bytes]

        soup = BeautifulSoup(text, "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else ""
        p = soup.find("p")
        snippet = p.get_text().strip() if p else ""
        return title, snippet

    except Exception as e:
        logger.warning(f"Failed to fetch metadata for {url}: {e}")
        return "", ""

async def search_with_meta_async(query: str, max_results: int, fetch_metadata: bool = True, timeout: int = 2):
    """Perform Google search and optionally enrich URLs with title and snippet."""
    logger.info(f"Searching Google for: {query} (max_results={max_results})")
    try:
        ddgs = DDGS()
        urls = [r['href'] for r in ddgs.text(query, max_results=max_results)]
    except Exception as e:
        logger.error(f"Google search failed: {e}")
        return []
    
    if not fetch_metadata:
        return [{"title": "", "url": url, "description": ""} for url in urls]
    
    results = []
    async with httpx.AsyncClient() as client:
        tasks = [fetch_title_and_snippet(client, url, timeout) for url in urls]
        metadata = await asyncio.gather(*tasks, return_exceptions=True)
        for url, (title, snippet) in zip(urls, metadata):
            results.append({"title": title or "", "url": url, "description": snippet or ""})
    return results

async def search_with_meta(query: str, max_results: int = 5, fetch_metadata: bool = True):
    """Synchronous wrapper for Jina Reader API search with optional Google metadata enrichment."""
    load_dotenv()
    JINA_API_KEY = os.getenv("JINA_API_KEY")
    
    encoded_query = query.replace(' ', '+').replace('|', '%7C')
    jina_url = f"https://s.jina.ai/?q={encoded_query}"
    
    headers = {
        "Authorization": f"Bearer {JINA_API_KEY}",
        "X-Respond-With": "no-content"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            await jina_limiter.acquire()
            response = await client.get(jina_url, headers=headers, timeout=10.0)
            response.raise_for_status()
            text_content = response.text
            
            raw_results = []
            pattern = r'\[(\d+)\]\s*Title:\s*(.*?)\n\[(\d+)\]\s*URL Source:\s*(.*?)\n\[(\d+)\]\s*Description:\s*(.*?)(?=\[\d+\]|$)'
            matches = re.findall(pattern, text_content, re.DOTALL)
            
            for match in matches[:max_results]:
                num1, title, num2, url, num3, desc = match
                title = title.strip()
                url = url.strip()
                desc = desc.strip()
                raw_results.append({
                    'title': title,
                    'url': url,
                    'description': desc
                })
    
    except Exception as e:
        logger.warning(f"Jina Reader search failed: {e}, falling back to Google search")
        google_results = await search_with_meta_async(query, max_results, fetch_metadata=False)
        raw_results = [{"title": r['title'], "url": r['url'], "description": r['description']} for r in google_results]
    
    # Return Jina results directly — title/description from Jina are sufficient.
    # Google metadata enrichment removed (Phase 2.3) to avoid 2-5s extra latency per search.
    unique_raw = []
    seen_urls = set()
    for res in raw_results[:max_results]:
        if res['url'] not in seen_urls:
            unique_raw.append(res)
            seen_urls.add(res['url'])
    return unique_raw

def jina_search(query, output_format="description_url"):
    """
    Standalone Jina-based search for structured outputs (non-async).
    
    Args:
        query (str): The search query.
        output_format (str): "urls", "description_url", or "paragraph".
    
    Returns:
        dict: Structured output.
    """
    load_dotenv()
    JINA_API_KEY = os.getenv("JINA_API_KEY")
    
    encoded_query = query.replace(' ', '+').replace('|', '%7C')
    jina_url = f"https://s.jina.ai/?q={encoded_query}"
    
    headers = {
        "Authorization": f"Bearer {JINA_API_KEY}",
        "X-Respond-With": "no-content"
    }
    
    try:
        response = httpx.get(jina_url, headers=headers, timeout=10.0)
        response.raise_for_status()
        text_content = response.text
        
        raw_results = []
        pattern = r'\[(\d+)\]\s*Title:\s*(.*?)\n\[(\d+)\]\s*URL Source:\s*(.*?)\n\[(\d+)\]\s*Description:\s*(.*?)(?=\[\d+\]|$)'
        matches = re.findall(pattern, text_content, re.DOTALL)
        
        for match in matches:
            num1, title, num2, url, num3, desc = match
            title = title.strip()
            url = url.strip()
            desc = desc.strip()
            raw_results.append({
                'title': title,
                'url': url,
                'description': desc
            })
        
        if output_format == "urls":
            return {'all_urls': [res['url'] for res in raw_results[:15]]}
        elif output_format == "description_url":
            unique_raw = []
            seen_urls = set()
            for res in raw_results[:15]:
                if res['url'] not in seen_urls:
                    unique_raw.append(res)
                    seen_urls.add(res['url'])
            return {'results': unique_raw}
        elif output_format == "paragraph":
            if raw_results:
                summary_parts = [f"{res['title']}: {res['description'][:200]}..." for res in raw_results[:5]]
                paragraph = "Key insights from research on the topic: " + ". ".join(summary_parts) + "."
            else:
                paragraph = f"Based on the search for '{query}', relevant resources include studies on biology labs and facilities, highlighting opportunities for research and collaboration."
            return {'summary_paragraph': paragraph}
        else:
            raise ValueError("Invalid output_format. Choose 'urls', 'description_url', or 'paragraph'.")
    
    except Exception as e:
        logger.warning(f"Jina Reader search failed: {e}, falling back to DuckDuckGo search")
        try:
            ddgs = DDGS()
            urls = [r['href'] for r in ddgs.text(query, max_results=15)]
            return {'all_urls': urls} if output_format == "urls" else {'results': [{'title': '', 'description': '', 'url': url} for url in urls[:15]]}
        except Exception as fallback_e:
            logger.error(f"DuckDuckGo fallback failed: {fallback_e}")
            return {'results': []}
















# import logging
# import asyncio
# import httpx
# from googlesearch import search
# from bs4 import BeautifulSoup
# from utils.config import load_config

# # Logging Setup
# logging.basicConfig(
#     level=logging.INFO,
#     format="%(asctime)s - %(levelname)s - %(message)s"
# )
# logger = logging.getLogger(__name__)

# async def fetch_title_and_snippet(
#     client: httpx.AsyncClient,
#     url: str,
#     timeout: float = 2.0,
#     max_bytes: int = 10_000
# ):
#     """
#     Fetch page title + first paragraph snippet from a URL asynchronously via httpx.
#     Streams up to `max_bytes` characters.
#     """
#     try:
#         # Use a read timeout separate from connect timeout
#         resp = await client.get(
#             url,
#             timeout=httpx.Timeout(5.0, read=timeout),
#             headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
#         )
#         resp.raise_for_status()

#         # Stream text chunks until we have enough
#         text = ""
#         async for chunk in resp.aiter_text():
#             text += chunk
#             if len(text) >= max_bytes:
#                 break

#         # If the site served bytes in a weird charset, fallback:
#         if not text:
#             raw = await resp.aread()
#             text = raw.decode(resp.encoding or "utf-8", errors="ignore")[:max_bytes]

#         soup = BeautifulSoup(text, "html.parser")
#         title = soup.title.string.strip() if soup.title and soup.title.string else ""
#         p = soup.find("p")
#         snippet = p.get_text().strip() if p else ""
#         return title, snippet

#     except Exception as e:
#         logger.warning(f"Failed to fetch metadata for {url}: {e}")
#         return "", ""


# async def search_with_meta_async(query: str, max_results: int, fetch_metadata: bool = True, timeout: int = 2):
#     """Perform Google search and optionally enrich URLs with title and snippet."""
#     logger.info(f"Searching Google for: {query} (max_results={max_results})")
#     try:
#         urls = list(search(query, num_results=max_results, lang="en"))
#     except Exception as e:
#         logger.error(f"Google search failed: {e}")
#         return []
    
#     if not fetch_metadata:
#         return [{"title": "", "url": url, "description": ""} for url in urls]
    
#     results = []
#     async with httpx.AsyncClient() as client:
#         tasks = [fetch_title_and_snippet(client, url, timeout) for url in urls]
#         metadata = await asyncio.gather(*tasks, return_exceptions=True)
#         for url, (title, snippet) in zip(urls, metadata):
#             results.append({"title": title or "", "url": url, "description": snippet or ""})
#     return results

# def search_with_meta(query: str, max_results: int = 5, fetch_metadata: bool = True):
#     """Synchronous wrapper for search_with_meta_async."""
#     return asyncio.run(search_with_meta_async(query, max_results, fetch_metadata))