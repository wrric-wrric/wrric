import aiohttp
import re
from typing import Dict, Optional, List
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
import json

class ContentBasedExtraction:
    def __init__(self, nlp_processor):
        self.nlp = nlp_processor
    
    async def extract_from_content(self, content: str, url: Optional[str] = None) -> Optional[Dict]:
        """Extract contacts from existing HTML/content using NLP."""
        if not content:
            return None
        
        # Use NLP to find contact sections and persons
        contact_sections = self.nlp.extract_contact_sections(content)
        
        if not contact_sections:
            return None
        
        # Get the most relevant section
        best_section = contact_sections[0]
        
        # Build contact from best available data
        contact = {}
        
        # Prefer persons with emails from NLP
        for person in best_section['persons']:
            if person.get('email'):
                contact['name'] = person['name']
                contact['email'] = person['email']
                if person.get('title'):
                    contact['title'] = person['title']
                break
        
        # If no person with email, use first email found
        if not contact.get('email') and best_section.get('emails'):
            contact['email'] = best_section['emails'][0]
            # Try to find a name near this email
            if not contact.get('name'):
                name = self._find_name_near_email(content, contact['email'])
                if name:
                    contact['name'] = name
        
        # Extract LinkedIn from content
        linkedin_urls = self._extract_linkedin_urls(content)
        if linkedin_urls:
            contact['linkedin'] = linkedin_urls[0]
        
        # Extract phone numbers
        if best_section.get('phones'):
            contact['phone'] = best_section['phones'][0]
        
        return contact if contact else None
    
    def _find_name_near_email(self, content: str, email: str) -> Optional[str]:
        """Find a name near an email address in content."""
        # Look for name in proximity to email (before or after)
        email_pos = content.find(email)
        if email_pos == -1:
            return None
        
        # Search before email
        before_context = content[max(0, email_pos-200):email_pos]
        names = self.nlp.extract_person_names(before_context)
        if names:
            return names[0]['name']
        
        # Search after email
        after_context = content[email_pos:min(len(content), email_pos+200)]
        names = self.nlp.extract_person_names(after_context)
        if names:
            return names[0]['name']
        
        return None
    
    def _extract_linkedin_urls(self, content: str) -> List[str]:
        """Extract LinkedIn URLs from content."""
        patterns = [
            r'https?://(?:www\.)?linkedin\.com/in/[\w-]+',
            r'linkedin\.com/in/[\w-]+'
        ]
        urls = []
        for pattern in patterns:
            urls.extend(re.findall(pattern, content, re.IGNORECASE))
        return urls

class DomainPatternExtraction:
    def __init__(self, nlp_processor):
        self.nlp = nlp_processor
    
    async def extract_from_domain(self, url: str) -> Optional[Dict]:
        """Extract contacts from domain-level patterns."""
        if not url:
            return None
        
        parsed = urlparse(url)
        domain = f"{parsed.scheme}://{parsed.netloc}"
        
        # Common contact page patterns
        contact_paths = [
            '/contact', '/people', '/faculty', '/staff', '/team',
            '/department/contact', '/about/people', '/academics/faculty',
            '/directory', '/personnel'
        ]
        
        for path in contact_paths:
            contact_url = urljoin(domain, path)
            try:
                content = await self._fetch_url_content(contact_url)
                if content:
                    extractor = ContentBasedExtraction(self.nlp)
                    contact = await extractor.extract_from_content(content, contact_url)
                    if contact:
                        return contact
            except Exception as e:
                continue
        
        return None
    
    async def _fetch_url_content(self, url: str, timeout: int = 5) -> Optional[str]:
        """Fetch URL content with timeout."""
        try:
            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=timeout)
            ) as session:
                async with session.get(url, headers=HEADERS) as response:
                    if response.status == 200:
                        return await response.text()
        except Exception:
            return None
        return None

class ExternalSearchExtraction:
    def __init__(self, nlp_processor):
        self.nlp = nlp_processor
    
    async def extract_from_external_search(self, university: str, department: Optional[Dict]) -> Optional[Dict]:
        """Extract contacts from external search with optimized queries."""
        dept_name = department.get("name", "") if department else ""
        
        # More specific search queries
        search_queries = [
            f"\"{university}\" \"{dept_name}\" email contact",
            f"{university} {dept_name} faculty directory",
            f"{university} {dept_name} staff list",
            f"site:edu \"{university}\" \"{dept_name}\" contact",
        ]
        
        for query in search_queries:
            try:
                results = await search_with_meta(query, max_results=2)
                for result in results:
                    content = await self._fetch_url_content(result.get('url'))
                    if content:
                        extractor = ContentBasedExtraction(self.nlp)
                        contact = await extractor.extract_from_content(content, result.get('url'))
                        if contact:
                            return contact
            except Exception as e:
                logger.debug(f"Search query failed {query}: {str(e)}")
                continue
        
        return None
    
    async def _fetch_url_content(self, url: str, timeout: int = 8) -> Optional[str]:
        """Fetch URL content with timeout."""
        try:
            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=timeout)
            ) as session:
                async with session.get(url, headers=HEADERS) as response:
                    if response.status == 200:
                        return await response.text()
        except Exception:
            return None
        return None