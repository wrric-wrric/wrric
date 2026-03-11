#!/usr/bin/env python3
import logging
import time
from googlesearch import search
import requests
from bs4 import BeautifulSoup

# ─── Configuration ──────────────────────────────────────────────────────────────
MAX_RESULTS = 5
REQUEST_DELAY = 1  # seconds between page fetches to be polite

# ─── Logging Setup ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# ─── Helper Functions ────────────────────────────────────────────────────────────
def fetch_title_and_snippet(url):
    """Fetch the page title and first paragraph snippet from a URL."""
    try:
        resp = requests.get(url, timeout=5, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        })
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        title = soup.title.string.strip() if soup.title else ""
        p = soup.find("p")
        snippet = p.get_text().strip() if p else ""
        return title, snippet
    except Exception as e:
        logger.warning(f"Failed to fetch metadata for {url}: {e}")
        return "", ""

def search_with_meta(query, max_results=MAX_RESULTS):
    """Perform Googlesearch, then enrich each URL with title & snippet."""
    logger.info(f"Searching Google for: {query}")
    try:
        urls = list(search(query, num_results=max_results, lang="en"))
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return []
    results = []
    for idx, url in enumerate(urls, start=1):
        logger.info(f"[{idx}/{len(urls)}] Fetching metadata for: {url}")
        title, snippet = fetch_title_and_snippet(url)
        results.append({"title": title, "url": url, "description": snippet})
        time.sleep(REQUEST_DELAY)
    return results

# ─── Main Entry Point ────────────────────────────────────────────────────────────
def main():
    query = input("Enter your search query: ").strip()
    if not query:
        print("No query entered, exiting.")
        return

    results = search_with_meta(query)
    if not results:
        print("No results found or an error occurred.")
        return

    print(f"\nTop {len(results)} results for “{query}”:\n")
    for i, item in enumerate(results, start=1):
        print(f"Result {i}:")
        print(f"  Title      : {item['title']}")
        print(f"  URL        : {item['url']}")
        print(f"  Description: {item['description'][:200]}{'...' if len(item['description'])>200 else ''}")
        print()

if __name__ == "__main__":
    main()
