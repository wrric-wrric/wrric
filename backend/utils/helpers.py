import asyncio
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from sentence_transformers import util
import logging
from utils.config import load_config
from typing import Dict
import tldextract

logger = logging.getLogger(__name__)

# Global placeholders
model = None
lab_embeddings = None

def init_model_and_embeddings():
    """Load the SentenceTransformer model and lab keyword embeddings."""
    global model, lab_embeddings
    if model is not None:
        return
        
    from sentence_transformers import SentenceTransformer 
    try:
        config = load_config()
        LAB_KEYWORDS = config.get('LAB_KEYWORDS', [
            "science lab", "research lab", "laboratory", "experiment", "scientific research",
            "innovation", "biology", "biochemistry", "research centre", "science", "technology",
            "development", "study", "faculty", "department", "chemistry"
        ])
        model = SentenceTransformer('all-MiniLM-L6-v2')
        lab_embeddings = model.encode(LAB_KEYWORDS, convert_to_tensor=True)
        logger.info("✅ Model and lab embeddings loaded.")
    except Exception as e:
        logger.error(f"❌ Error loading embeddings: {str(e)}")
        # We don't raise here, fallback or error will happen at call time


def is_valid_url(url: str) -> bool:
    parsed = urlparse(url)
    path = parsed.path.lower()
    if re.search(r"(login|signup|auth|\.docx?|media|governance|events|student|blog)", path, re.I):
        return False
    pattern = re.compile(
        r'^(https?:\/\/)' 
        r'((([A-Z0-9][A-Z0-9_-]*)(\.[A-Z0-9][A-Z0-9_-]*)+)|'
        r'(localhost))'
        r'(:\d+)?'
        r'(\/.*)?$', re.IGNORECASE
    )
    result = bool(pattern.match(url)) and parsed.scheme in {'http', 'https'} and parsed.netloc
    if not result:
        logger.debug(f"Invalid URL filtered: {url}")
    return result

def is_meaningful_entity(data: dict) -> bool:
    """Check if entity has enough meaningful fields to save/return.

    Requires: non-empty university AND at least one of (research_abstract, scopes, department).
    This filters out low-value entities that only have a URL and empty fields.
    """
    university = data.get('university', '')
    if not university or not university.strip() or university == 'Unknown Institution':
        # Still accept if research_abstract is substantial
        abstract = data.get('research_abstract', '')
        if not (isinstance(abstract, str) and len(abstract.strip()) > 50):
            logger.debug(f"Entity for URL {data.get('url', 'unknown')}: rejected — no university and no substantial abstract")
            return False

    # Require at least one content field
    has_abstract = bool(data.get('research_abstract', '').strip()) if isinstance(data.get('research_abstract'), str) else False
    scopes = data.get('scopes', [])
    has_scopes = isinstance(scopes, list) and len(scopes) > 0
    dept = data.get('department', {})
    has_department = isinstance(dept, dict) and any(dept.values())

    result = has_abstract or has_scopes or has_department
    logger.debug(f"Entity for URL {data.get('url', 'unknown')}: abstract={has_abstract}, scopes={has_scopes}, dept={has_department} → {'accepted' if result else 'rejected'}")
    return result

def get_domain(url: str) -> str:
    extracted = tldextract.extract(url)
    domain = extracted.registered_domain.lower()
    return domain if domain else urlparse(url).netloc.lower()


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.rstrip('/')
    return f"{parsed.scheme}://{parsed.netloc}{path}"


def normalize_anchor_text(text: str, url: str = "") -> str:
    text = text.strip().lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'\s+', ' ', text)
    if not text and url:
        path = urlparse(url).path.strip('/')
        text = path.replace('/', ' ').replace('-', ' ')
    return text or "unknown"


async def extract_links(html_content: str, base_url: str) -> list[tuple[str, str]]:
    if not html_content:
        logger.warning(f"No HTML content provided for {base_url}")
        return []
    try:
        soup = BeautifulSoup(html_content, 'lxml')
        links = []
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            anchor_text = a_tag.get_text(strip=True)
            normalized_anchor = normalize_anchor_text(anchor_text, href)
            absolute_url = urljoin(base_url, href).split('#')[0].rstrip('/')
            if is_valid_url(absolute_url):
                links.append((absolute_url, normalized_anchor))
                logger.debug(f"Extracted link: {absolute_url} | Anchor: {normalized_anchor}")
            else:
                logger.debug(f"Skipped invalid link: {absolute_url} | Anchor: {normalized_anchor}")
        logger.debug(f"Extracted {len(links)} valid links from {base_url}")
        return links
    except Exception as e:
        logger.error(f"Error parsing HTML for {base_url}: {str(e)}")
        return []


async def semantic_categorization(url: str, anchor_text: str) -> tuple[str, float]:
    if model is None or lab_embeddings is None:
        init_model_and_embeddings()
    if model is None:
        return "other", 0.0
    path = urlparse(url).path.lower().replace('/', ' ').replace('-', ' ')
    context = f"{anchor_text} {path}".lower()
    context_embedding = model.encode(context, convert_to_tensor=True)
    similarities = util.cos_sim(context_embedding, lab_embeddings)
    max_similarity = similarities[0].max().item()
    academic_keywords = ["faculty", "department", "science", "research", "lab", "laboratory", "institute"]
    if any(kw in context for kw in academic_keywords):
        max_similarity += 0.2
    category = "research" if max_similarity > 0.5 else "other"
    logger.debug(f"Semantic categorization for {url}: category={category}, score={max_similarity:.2f}")
    return category, max_similarity
