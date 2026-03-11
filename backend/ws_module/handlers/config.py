import asyncio
import os
import logging
from dotenv import load_dotenv
from utils.config import load_config
from concurrent.futures import ThreadPoolExecutor

# Load environment variable
load_dotenv()

logger = logging.getLogger(__name__)
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')

# Load config
config = load_config()
GLOBAL_EXECUTOR = ThreadPoolExecutor(max_workers=config.get('GLOBAL_MAX_WORKERS', 16))
EDUCATIONAL_DOMAINS = config.get('EDUCATIONAL_DOMAINS', [
    '.edu', '.ac.uk', '.edu.gh', '.ac.bw', '.ac.za', '.edu.au', '.ac.nz',
    '.edu.ng', '.ac.ke', '.edu.et', '.ac.ug', '.edu.in', '.ac.in',
    '.edu.br', '.ac.jp', '.edu.cn', '.ac.kr', '.edu.my', '.ac.th',
    '.edu.sg', '.ac.id', '.edu.ph', '.ac.zw', '.edu.zm', '.ac.mw',
    '.edu.pk', '.ac.lk', '.edu.bd', '.ac.rw', '.edu.sd', '.ac.tz',
    '.edu.vn', '.ac.ir', '.edu.tr', '.ac.eg', '.edu.sa', '.ac.ma'
])

# Academic repositories for research papers
ACADEMIC_REPOSITORIES = config.get('ACADEMIC_REPOSITORIES', [
    'arxiv.org', 'researchgate.net', 'sciencedirect.com', 'ieee.org',
    'springer.com', 'elsevier.com', 'wiley.com', 'nature.com',
    'pubmed.ncbi.nlm.nih.gov', 'scholar.google.com', 'doaj.org',
    'jstor.org', 'rsif-paset.org', 'dialnet.unirioja.es'
])

# Keywords for identifying research papers
PAPER_KEYWORDS = config.get('PAPER_KEYWORDS', [
    'paper', 'article', 'journal', 'publication', 'research paper',
    'conference paper', 'thesis', 'dissertation', 'abstract', 'preprint'
])

# PDF extraction configuration
PDF_CONFIG = config.get('PDF_CONFIG', {
    'download_timeout': 30,  # Seconds to wait for PDF download
    'max_size_mb': 10,      # Maximum PDF size in MB
    'chunk_size': 8192      # Bytes to read per chunk during download
})

DDGS_SEMAPHORE = asyncio.Semaphore(1)
LAST_DDGS_REQUEST_TIME = 0
DDGS_MIN_DELAY = 15  # seconds