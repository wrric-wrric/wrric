import asyncio
import logging
import re
import os
import json
from typing import Optional, Dict, Any, Union, List
from urllib.parse import urljoin

import aiohttp
from bs4 import BeautifulSoup, Tag
from dateutil.parser import parse
from datetime import datetime, timezone
import dateparser
from dotenv import load_dotenv
from pydantic import HttpUrl
from api.schemas import EntityImageCreate
from utils.helpers import semantic_categorization

load_dotenv()
logger = logging.getLogger(__name__)

USER_DATA_DIR = os.path.join(os.getcwd(), "chrome_user_data")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
}

async def validate_image_urls(urls: List[str], session: aiohttp.ClientSession) -> List[str]:
    """Validate multiple image URLs in a batch."""
    valid_urls = []
    tasks = []
    for url in urls:
        tasks.append(asyncio.create_task(session.head(url, timeout=5)))
    
    responses = await asyncio.gather(*tasks, return_exceptions=True)
    for url, response in zip(urls, responses):
        try:
            if isinstance(response, Exception):
                logger.debug(f"Invalid image URL {url}: {response}")
                continue
            content_type = response.headers.get("Content-Type", "")
            if response.status == 200 and content_type.startswith("image/"):
                valid_urls.append(url)
            else:
                logger.debug(f"Invalid image URL {url}: status={response.status}, content_type={content_type}")
        except Exception as e:
            logger.debug(f"Error validating {url}: {e}")
    
    return valid_urls

def extract_last_updated(
    soup: BeautifulSoup,
    url: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None,
    html_content: Optional[str] = None
) -> str:
    """
    Extract the last-updated date for a page.
    Returns an ISO 8601 UTC timestamp or "" if none found.
    """
    def to_iso(dt: datetime) -> str:
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    def parse_date(text: str) -> Optional[datetime]:
        if not text or len(text) < 4:
            return None
        dp = dateparser.parse(
            text,
            settings={
                "RETURN_AS_TIMEZONE_AWARE": True,
                "TO_TIMEZONE": "UTC",
                "PREFER_DATES_FROM": "past",
                "STRICT_PARSING": True
            }
        )
        if dp and datetime(1970, 1, 1, tzinfo=dp.tzinfo) <= dp <= datetime.now(dp.tzinfo):
            return dp
        return None

    candidates: Dict[str, datetime] = {}

    if headers and url:
        lm = headers.get("Last-Modified") or headers.get("last-modified")
        if lm:
            dt = parse_date(lm)
            if dt:
                logger.debug(f"HTTP Last-Modified: {lm} -> {dt}")
                candidates["http_last_modified"] = dt

    body = html_content or soup.get_text(" ", strip=True)

    meta_attrs = [
        ("name", "last-modified"), ("name", "modified"),
        ("name", "article:modified_time"), ("property", "article:modified_time"),
        ("property", "og:updated_time"), ("name", "date"),
        ("itemprop", "dateModified"), ("itemprop", "datePublished"),
        ("name", "publishdate"), ("name", "pubdate"),
        ("name", "timestamp"), ("name", "dc.date.issued"),
        ("name", "dc.date.modified")
    ]
    for attr, val in meta_attrs:
        tag = soup.find("meta", attrs={attr: val})
        if tag and tag.get("content"):
            dt = parse_date(tag["content"])
            if dt:
                key = f"meta_{attr}_{val}"
                logger.debug(f"Meta[{attr}={val}]: {tag['content']} -> {dt}")
                candidates[key] = dt

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "{}")
            def extract_from_obj(obj: Any):
                if isinstance(obj, dict):
                    for k in ("dateModified", "datePublished", "uploadDate", "dateCreated"):
                        if k in obj:
                            dt = parse_date(obj[k])
                            if dt:
                                candidates[f"jsonld_{k}"] = dt
                    for v in obj.values():
                        extract_from_obj(v)
                elif isinstance(obj, list):
                    for item in obj:
                        extract_from_obj(item)
            extract_from_obj(data)
        except json.JSONDecodeError:
            continue

    for time_tag in soup.find_all("time"):
        dt_str = time_tag.get("datetime") or time_tag.get_text(" ", strip=True)
        dt = parse_date(dt_str)
        if dt:
            key = f"time_tag"
            logger.debug(f"<time> tag: {dt_str} -> {dt}")
            candidates[key] = dt

    date_patterns = [
        r"\b(?:last\s+updated|updated|modified)\s*[:\-]?\s*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})",
        r"\b(?:last\s+updated|updated|modified)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})",
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b",
    ]
    for pat in date_patterns:
        for match in re.finditer(pat, body, flags=re.IGNORECASE):
            dt = parse_date(match.group(1))
            if dt:
                key = f"body_pattern_{pat}"
                logger.debug(f"Body pattern: {match.group(1)} -> {dt}")
                candidates[key] = dt

    if not candidates:
        logger.debug("No date candidates found")
        return ""

    best_key = max(candidates, key=lambda k: candidates[k])
    best_date = candidates[best_key]
    iso = to_iso(best_date)
    logger.info(f"Selected '{best_key}' -> {iso}")
    return iso



def _is_static_html(html: str, url: str, server_header: str = '') -> bool:
    """Determine if fetched HTML is from a static site using heuristics (no extra HTTP requests)."""
    # URL heuristic
    lower_url = url.lower()
    if any(keyword in lower_url for keyword in ['pdf', 'article', 'articles']) and not lower_url.endswith('.pdf'):
        logger.debug(f"URL considered dynamic due to keyword in path: {url}")
        return False

    # Server header check
    static_servers = {'Netlify', 'Vercel', 'GitHub-Pages', 'S3'}
    if any(server in server_header for server in static_servers):
        logger.debug(f"Detected static site for {url}: Server={server_header}")
        return True

    soup = BeautifulSoup(html, 'lxml')

    meta_generator = soup.find('meta', {'name': 'generator'})
    if meta_generator and any(ssg in meta_generator.get('content', '')
                              for ssg in ['Jekyll', 'Hugo', 'Gatsby', 'Next.js']):
        logger.debug(f"Detected static site for {url}: Generator={meta_generator.get('content')}")
        return True

    script_sources = [script.get('src', '') for script in soup.find_all('script')]
    if any('react' in src or 'vue' in src for src in script_sources):
        logger.debug(f"Detected dynamic site for {url}: Found React/Vue scripts")
        return False

    html_size = len(html)
    has_root = bool(soup.find(id='root'))
    is_static_site = html_size < 100000 and not has_root
    logger.debug(f"Static check for {url}: size={html_size}, has_root={has_root}, is_static={is_static_site}")
    return is_static_site


async def is_static(url: str, session: aiohttp.ClientSession) -> bool:
    """Determine if a website is static using heuristic checks. (Legacy wrapper — prefer scrape_static_url)"""
    try:
        async with session.get(url, headers=HEADERS, timeout=10) as response:
            html = await response.text()
            server_header = response.headers.get('Server', '')
            return _is_static_html(html, url, server_header)
    except Exception as e:
        logger.error(f"Error checking if {url} is static: {e}")
        return False


async def scrape_static_url(url: str, session: aiohttp.ClientSession) -> Dict[str, Any]:
    """Fetch a URL once and extract content. Returns scraped data dict.
    Combines the old is_static + scrape_with_bs into a single GET request."""
    logger.info(f"Scraping URL (single-fetch): {url}")
    try:
        async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=15)) as response:
            html = await response.text(encoding='utf-8')
            resp_headers = dict(response.headers)
            server_header = resp_headers.get('Server', '')

        is_static_site = _is_static_html(html, url, server_header)

        if not is_static_site:
            # Dynamic site — caller should fall back to Jina
            return {'is_static': False, 'raw_content': '', 'html_content': html[:100000], 'images': []}

        soup = BeautifulSoup(html, 'lxml')
        last_updated = extract_last_updated(soup, url, resp_headers, html)
        raw_content, images = extract_raw_content(soup)

        # Validate images using the same session
        image_urls = [img.url for img in images]
        valid_urls = await validate_image_urls(image_urls, session) if image_urls else []
        valid_images = [img for img in images if img.url in valid_urls]

        data = {
            'is_static': True,
            'url': url,
            'raw_content': raw_content,
            'html_content': html[:100000],
            'last_updated': last_updated,
            'images': [img.dict() for img in valid_images]
        }
        logger.info(f"Successfully scraped {url} (content: {len(raw_content)} chars, images: {len(valid_images)})")
        return data
    except Exception as e:
        logger.error(f"Error scraping {url}: {e}")
        return {'is_static': True, 'raw_content': '', 'html_content': '', 'error': str(e), 'images': []}


def extract_raw_content(
    soup: BeautifulSoup,
    *,
    content_selectors: List[str] = None,
    non_content_selectors: List[str] = None,
    text_elements: List[str] = None,
    keep_link_html: bool = True,
    min_text_length: int = 0,
    max_containers: int = 5,
) -> tuple[str, List[EntityImageCreate]]:
    """
    Extract structured raw content and images from the soup object.
    Returns a tuple of (Markdown content, list of EntityImageCreate objects).
    """
    content_selectors = content_selectors or [
        'main', 'article', 'section',
        'div.content', 'div.main-content', 'div.container',
        'div.post-content', 'div.entry-content',
        '[role="main"]', 'article.post', 'div#content'
    ]
    non_content_selectors = non_content_selectors or [
        'nav', 'header', 'footer', 'aside',
        '.sidebar', '.ad-container', '.navbar',
        '.menu', '.comments', '.social-links'
    ]
    text_elements = text_elements or [
        'h1','h2','h3','h4','h5','h6',
        'p','li','blockquote','pre','figcaption',
        'dt','dd','td','th','code','q','cite'
    ]

    for sel in non_content_selectors:
        for el in soup.select(sel):
            el.decompose()

    containers = []
    for sel in content_selectors:
        containers.extend(soup.select(sel))
    if not containers and soup.body:
        containers = [soup.body]

    scored = sorted(
        ((c, len(c.get_text(strip=True))) for c in containers),
        key=lambda x: x[1],
        reverse=True
    )
    top = [c for c, _ in scored[:max_containers]]

    lines = []
    seen = set()
    heading_path: List[str] = []
    images: List[EntityImageCreate] = []

    _LAB_IMAGE_KEYWORDS = {
        'lab', 'laboratory', 'research', 'microscope', 'equipment', 'experiment',
        'scientist', 'facility', 'campus', 'building', 'department', 'faculty',
        'professor', 'team', 'group', 'institute', 'center', 'centre',
    }

    def is_lab_related_sync(elem: Tag, src: str) -> bool:
        """Check if an image is likely related to a lab using keyword heuristics."""
        alt = (elem.get('alt') or '').lower()
        parent = elem.find_parent()
        parent_text = (parent.get_text(" ", strip=True)[:150] if parent else '').lower()
        src_lower = src.lower()
        context = f"{alt} {parent_text} {src_lower}"
        # Skip tiny tracking pixels and icons
        width = elem.get('width', '')
        height = elem.get('height', '')
        try:
            if (width and int(width) < 50) or (height and int(height) < 50):
                return False
        except (ValueError, TypeError):
            pass
        if any(kw in context for kw in _LAB_IMAGE_KEYWORDS):
            return True
        # Accept images with meaningful alt text (likely content images, not decorative)
        if alt and len(alt) > 10:
            return True
        return False

    def render_node(node: Union[Tag, str], base_url: str) -> str:
        if isinstance(node, str):
            text = node.strip()
            return text if len(text) >= min_text_length else ''
        if node.name == 'a' and node.get('href'):
            anchor = node.get_text(strip=True) or node['href']
            href = urljoin(base_url, node['href'])
            return f"[{anchor}]({href})"
        if node.name == 'img' and node.get('src'):
            src = urljoin(base_url, node['src'])
            alt = node.get('alt', '')
            if is_lab_related_sync(node, src):
                images.append(EntityImageCreate(url=src, caption=alt, is_primary=len(images) == 0))
            return f"![{alt}]({src})"
        if node.name == 'table':
            rows = []
            for tr in node.find_all('tr', recursive=False):  # Limit recursion
                cols = [td.get_text(" ", strip=True) for td in tr.find_all(['td','th'], recursive=False)]
                rows.append("| " + " | ".join(cols) + " |")
            if rows:
                sep = "| " + " | ".join("---" for _ in rows[0].split("|") if _.strip()) + " |"
                return "\n".join([rows[0], sep] + rows[1:])
        return node.get_text(" ", strip=True)

    for container in top:
        for elem in container.find_all(text_elements + ['img'], recursive=False):  # Limit recursion
            parent = elem
            while parent and parent.name not in ['h1','h2','h3','h4','h5','h6']:
                parent = parent.parent
            if parent and parent.name in ['h1','h2','h3','h4','h5','h6']:
                level = int(parent.name[1])
                heading = parent.get_text(" ", strip=True)
                path = heading_path[:level-1] + [heading]
                heading_path[:] = path
                md_heading = f"\n{'#'*level} {heading}"
                if md_heading not in seen:
                    lines.append(md_heading)
                    seen.add(md_heading)
            md = ''.join(
                filter(None, [render_node(child, container.get('data-url', '')) for child in elem.children])
                or [render_node(elem, container.get('data-url', ''))]
            ).strip()
            if not md or md in seen:
                continue
            lines.append(md)
            seen.add(md)

    return "\n\n".join(lines), images

async def scrape_with_bs(url: str) -> Dict[str, Any]:
    """Scrape a static website using aiohttp and BeautifulSoup."""
    logger.info(f"Scraping static website: {url}")
    timeout = 10  # seconds
    try:
        async with aiohttp.ClientSession(headers=HEADERS) as session:
            async with session.head(url, timeout=timeout) as head_response:
                headers = dict(head_response.headers)

            async with session.get(url, timeout=timeout) as response:
                html = await response.text(encoding='utf-8')
                soup = BeautifulSoup(html, 'lxml')
                last_updated = extract_last_updated(soup, url, headers, html)
                raw_content, images = extract_raw_content(soup)
                image_urls = [img.url for img in images]
                valid_urls = await validate_image_urls(image_urls, session)
                valid_images = [img for img in images if img.url in valid_urls]

                data = {
                    'url': url,
                    'raw_content': raw_content,
                    'html_content': html[:100000],
                    'last_updated': last_updated,
                    'images': [img.dict() for img in valid_images]
                }
                logger.info(f"Successfully scraped {url} (Raw content length: {len(data['raw_content'])}, HTML content length: {len(data['html_content'])}, Last updated: {last_updated}, Images: {len(data['images'])})")
                logger.debug(f"Found {len(soup.find_all('a', href=True))} <a> tags and {len(valid_images)} valid images in HTML for {url}")
                return data
    except Exception as e:
        logger.error(f"Error scraping {url} with BeautifulSoup: {e}")
        return {'raw_content': '', 'html_content': '', 'error': str(e), 'images': []}
    

from urllib.parse import urlparse

JINA_READER_BASE = "https://r.jina.ai/"
JINA_API_KEY = os.getenv("JINA_API_KEY")

DATE_PATTERNS = [
    r"(Last\s+updated[:\s]+[A-Za-z0-9,\s-]+)",
    r"(Published\s+online[:\s]+[A-Za-z0-9,\s-]+)",
    r"(Accepted[:\s]+[A-Za-z0-9,\s-]+)",
    r"(Received[:\s]+[A-Za-z0-9,\s-]+)",
    r"(©\s*\d{4}\s+[A-Za-z\s]+)",
    r"(\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b)"
]

def extract_last_updated_from_text(text: str) -> str | None:
    """Extract publication or last updated date from raw text."""
    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def extract_date_from_meta(soup: BeautifulSoup) -> str | None:
    """Try extracting date from <meta> tags."""
    for tag in soup.find_all("meta"):
        for attr in ["name", "property"]:
            if tag.get(attr) and any(k in tag.get(attr).lower() for k in ["date", "updated", "published"]):
                return tag.get("content")
    return None


def is_valid_url(url: str) -> bool:
    """Check if a given URL is valid."""
    try:
        result = urlparse(url)
        return all([result.scheme in ["http", "https"], result.netloc])
    except Exception:
        return False


async def scrape_with_jina_async(url: str, session: aiohttp.ClientSession = None) -> Optional[Dict[str, Any]]:
    """Scrape text content from a URL via Jina Reader asynchronously."""
    if not is_valid_url(url):
        logger.error(f"[Jina Reader] Invalid URL: {url}")
        return None

    headers = {"Authorization": f"Bearer {JINA_API_KEY}"}
    jina_url = f"{JINA_READER_BASE}{url}"
    logger.info(f"[Jina Reader] Fetching: {url}")

    owns_session = session is None
    if owns_session:
        session = aiohttp.ClientSession()

    try:
        async with session.get(jina_url, headers=headers, timeout=aiohttp.ClientTimeout(total=40)) as response:
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "").lower()
            content = await response.text()

        if "markdown" in content_type or content.strip().startswith("#"):
            raw_content = content
        else:
            soup = BeautifulSoup(content, "html.parser")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            raw_content = soup.get_text(separator="\n", strip=True)

        soup = BeautifulSoup(content, "html.parser")
        last_updated = (
            extract_last_updated_from_text(raw_content)
            or extract_date_from_meta(soup)
        )

        result = {
            "url": url,
            "raw_content": raw_content,
            "html_content": content,
            "last_updated": last_updated,
            "length": len(raw_content),
        }
        logger.info(f"[Jina Reader] Success: {url} | chars={len(raw_content)} | date={last_updated}")
        return result

    except Exception as e:
        logger.error(f"[Jina Reader] Error for {url}: {e}")
        return None
    finally:
        if owns_session:
            await session.close()


def scrape_with_jina(url: str):
    """Sync wrapper for backward compatibility. Prefer scrape_with_jina_async."""
    if not is_valid_url(url):
        logger.error(f"[Jina Reader] Invalid URL: {url}")
        return None

    import requests as sync_requests
    headers = {"Authorization": f"Bearer {JINA_API_KEY}"}
    jina_url = f"{JINA_READER_BASE}{url}"
    logger.info(f"[Jina Reader] Fetching (sync): {url}")

    try:
        response = sync_requests.get(jina_url, headers=headers, timeout=40)
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "").lower()
        content = response.text

        if "markdown" in content_type or content.strip().startswith("#"):
            raw_content = content
        else:
            soup = BeautifulSoup(content, "html.parser")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            raw_content = soup.get_text(separator="\n", strip=True)

        soup = BeautifulSoup(content, "html.parser")
        last_updated = (
            extract_last_updated_from_text(raw_content)
            or extract_date_from_meta(soup)
        )

        return {
            "url": url,
            "raw_content": raw_content,
            "html_content": content,
            "last_updated": last_updated,
            "length": len(raw_content),
        }
    except Exception as e:
        logger.error(f"[Jina Reader] Error for {url}: {e}")
        return None

