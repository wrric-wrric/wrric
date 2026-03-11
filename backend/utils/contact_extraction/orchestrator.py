import asyncio
from typing import Dict, Optional, List
from sqlalchemy import select

from .base import ContactExtractionStrategy, ExtractionResult
from .strategies import ContentBasedExtraction, DomainPatternExtraction, ExternalSearchExtraction
from .cache import ContactCache, DomainContactCache
from .nlp_processor import NLPProcessor

class ContactExtractionOrchestrator:
    def __init__(self):
        self.nlp_processor = NLPProcessor()
        self.cache = ContactCache()
        self.domain_cache = DomainContactCache()
        
        # Initialize strategies
        self.strategies = [
            ContentBasedExtraction(self.nlp_processor),
            DomainPatternExtraction(self.nlp_processor),
            ExternalSearchExtraction(self.nlp_processor)
        ]
    
    async def extract_contacts(self, university: str, department: Optional[Dict] = None,
                             url: Optional[str] = None, content: Optional[str] = None,
                             db_session = None) -> Dict:
        """
        Main entry point for contact extraction with multiple fallback strategies.
        """
        # Generate cache key
        cache_key = self.cache.generate_key(university, 
                                          department.get('name') if department else None, 
                                          url)
        
        # Check cache first
        cached_result = self.cache.get(cache_key)
        if cached_result:
            logger.debug(f"Cache hit for contact: {cache_key}")
            return cached_result
        
        # Strategy 1: Database lookup
        db_contact = await self._get_from_database(db_session, university, department)
        if db_contact:
            self.cache.set(cache_key, db_contact)
            return db_contact
        
        # Strategy 2: Content-based extraction (fastest)
        if content:
            content_extractor = ContentBasedExtraction(self.nlp_processor)
            content_contact = await content_extractor.extract_from_content(content, url)
            if content_contact:
                self.cache.set(cache_key, content_contact)
                return content_contact
        
        # Strategy 3: Domain pattern extraction
        if url:
            domain_contact = await self._extract_from_domain(url)
            if domain_contact:
                self.cache.set(cache_key, domain_contact)
                return domain_contact
        
        # Strategy 4: External search (most expensive, last resort)
        external_contact = await self._extract_from_external_search(university, department)
        if external_contact:
            self.cache.set(cache_key, external_contact)
            return external_contact
        
        # Cache negative result to avoid repeated lookups
        self.cache.set(cache_key, {})
        return {}
    
    async def _get_from_database(self, db_session, university: str, department: Optional[Dict]) -> Optional[Dict]:
        """Look for contacts from previously saved entities."""
        if not db_session:
            return None
        
        try:
            dept_name = department.get('name') if department else None
            query = select(Entity).where(Entity.university == university)
            
            if dept_name:
                query = query.where(Entity.department['name'].astext == dept_name)
            
            query = query.limit(10)
            result = await db_session.execute(query)
            entities = result.scalars().all()
            
            # Find the best contact from similar entities
            best_contact = None
            best_score = 0
            
            for entity in entities:
                contact = entity.get_json_field('point_of_contact')
                if contact:
                    score = self._score_contact_completeness(contact)
                    if score > best_score:
                        best_score = score
                        best_contact = contact
            
            return best_contact if best_score > 1 else None
            
        except Exception as e:
            logger.debug(f"Database contact lookup failed: {str(e)}")
            return None
    
    async def _extract_from_domain(self, url: str) -> Optional[Dict]:
        """Extract contacts from domain patterns."""
        domain_extractor = DomainPatternExtraction(self.nlp_processor)
        return await domain_extractor.extract_from_domain(url)
    
    async def _extract_from_external_search(self, university: str, department: Optional[Dict]) -> Optional[Dict]:
        """Extract contacts from external search."""
        search_extractor = ExternalSearchExtraction(self.nlp_processor)
        return await search_extractor.extract_from_external_search(university, department)
    
    def _score_contact_completeness(self, contact: Dict) -> int:
        """Score contact based on completeness."""
        score = 0
        if contact.get('name'): score += 3
        if contact.get('email'): score += 2
        if contact.get('linkedin'): score += 1
        if contact.get('phone'): score += 1
        return score