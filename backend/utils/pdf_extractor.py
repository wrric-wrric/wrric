import logging
import httpx
import pdfplumber
import asyncio
import os
from io import BytesIO
from pdfminer.pdfparser import PDFSyntaxError
from concurrent.futures import ThreadPoolExecutor
import time
from bs4 import BeautifulSoup

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)
logging.getLogger('pdfplumber').setLevel(logging.INFO)
logging.getLogger('pdfminer').setLevel(logging.INFO)

# Config
PDF_CONFIG = {
    'download_timeout': 25,
    'chunk_size': 2048,
    'max_size_mb': 25,
}

JINA_READER_BASE = "https://r.jina.ai/"
JINA_API_KEY = os.getenv("JINA_API_KEY")


async def is_pdf_url(url: str, session_id: str) -> bool:
    """Check if a URL points to a PDF file."""
    try:
        if url.lower().endswith('.pdf'):
            logger.debug(f"URL {url} identified as PDF by extension for session {session_id}")
            return True

        async with httpx.AsyncClient(timeout=PDF_CONFIG['download_timeout'], follow_redirects=True) as client:
            response = await client.head(url)
        content_type = response.headers.get('Content-Type', '').lower()
        return 'application/pdf' in content_type
    except Exception as e:
        logger.warning(f"Failed to check if URL {url} is PDF for session {session_id}: {str(e)}")
        return False


async def extract_pdf_content(url: str, session_id: str, executor: ThreadPoolExecutor, max_pages: int = 5) -> dict:
    """Download and extract text from a PDF URL using pdfplumber, with Jina fallback if PDF parsing fails."""
    start_time = time.time()
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        async with httpx.AsyncClient(timeout=PDF_CONFIG['download_timeout'], follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
        response.raise_for_status()

        # Validate content type
        content_type = response.headers.get('Content-Type', '').lower()
        if 'application/pdf' not in content_type and not response.content.startswith(b'%PDF'):
            logger.warning(f"{url} does not appear to be a valid PDF (Content-Type: {content_type})")
            return await jina_fallback(url, session_id)

        # Size check
        content_length = response.headers.get('Content-Length')
        if content_length:
            size_mb = int(content_length) / (1024 * 1024)
            if size_mb > PDF_CONFIG['max_size_mb']:
                logger.warning(f"PDF exceeds max size: {size_mb:.2f}MB > {PDF_CONFIG['max_size_mb']}MB")
                return {'raw_content': '', 'error': f'PDF size {size_mb:.2f}MB exceeds limit'}

        pdf_data = BytesIO(response.content)

        # Extract text in executor (pdfplumber is CPU-bound)
        def process_pdf(data):
            with pdfplumber.open(data) as pdf:
                text = ''
                for i, page in enumerate(pdf.pages[:max_pages]):
                    page_text = page.extract_text(layout=False)
                    if page_text:
                        text += page_text + '\n'
                return text.strip()

        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(executor, process_pdf, pdf_data)

        if not text:
            logger.warning(f"No text extracted from PDF; falling back to Jina for {url}")
            return await jina_fallback(url, session_id)

        elapsed = time.time() - start_time
        logger.info(f"Extracted {len(text)} chars from {url} in {elapsed:.2f}s")
        return {'raw_content': text, 'error': None}

    except (httpx.HTTPStatusError, PDFSyntaxError) as e:
        logger.warning(f"PDF parse/download failed for {url}: {str(e)} — using Jina fallback")
        return await jina_fallback(url, session_id)

    except Exception as e:
        logger.error(f"Unexpected PDF extraction error for {url}: {str(e)} — using Jina fallback")
        return await jina_fallback(url, session_id)


async def jina_fallback(url: str, session_id: str) -> dict:
    """Fallback: Use Jina Reader API to extract readable text from a URL."""
    try:
        headers = {"Authorization": f"Bearer {JINA_API_KEY}"}
        logger.info(f"[Jina Fallback] Fetching {url} for session {session_id}")
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(f"{JINA_READER_BASE}{url}", headers=headers)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        text = soup.get_text(separator="\n", strip=True)
        logger.info(f"[Jina Fallback] Extracted {len(text)} chars from {url}")
        return {"raw_content": text, "error": None}
    except Exception as e:
        logger.error(f"[Jina Fallback] Failed for {url}: {e}")
        return {"raw_content": "", "error": f"Jina fallback failed: {e}"}
