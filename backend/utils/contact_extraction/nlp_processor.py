import re
import logging
from typing import List, Dict, Tuple, Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

class NLPProcessor:
    _nlp_model = None

    def __init__(self):
        # We no longer load the model in __init__
        pass
    
    @classmethod
    def _get_nlp(cls):
        """Lazy load the spaCy model."""
        if cls._nlp_model is None:
            try:
                import spacy
                cls._nlp_model = spacy.load("en_core_web_sm")
                logger.info("spaCy model loaded successfully")
            except (ImportError, OSError):
                logger.warning("spaCy model not found or failed to load, attempting download...")
                try:
                    import subprocess
                    import spacy
                    subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"], check=True)
                    cls._nlp_model = spacy.load("en_core_web_sm")
                    logger.info("spaCy model downloaded and loaded successfully")
                except Exception as e:
                    logger.error(f"Failed to load spaCy model: {str(e)}")
                    cls._nlp_model = None
        return cls._nlp_model
    
    @lru_cache(maxsize=500)
    def process_text(self, text: str):
        """Process text with caching for frequently seen content."""
        if not text:
            return None
        nlp = self._get_nlp()
        if not nlp:
            return None
        return nlp(text[:1000000])  # Limit text length for performance
    
    def extract_person_names(self, text: str, context_window: int = 200) -> List[Dict]:
        """
        Extract person names with context using spaCy NER.
        """
        if not self.nlp:
            return self._fallback_name_extraction(text)
        
        doc = self.process_text(text)
        if not doc:
            return []
        
        persons = []
        for ent in doc.ents:
            if ent.label_ == "PERSON":
                # Get context around the name
                start = max(0, ent.start_char - context_window)
                end = min(len(text), ent.end_char + context_window)
                context = text[start:end]
                
                # Look for titles and email in context
                title = self._extract_title_from_context(context, ent.text)
                email = self._extract_email_from_context(context)
                
                persons.append({
                    'name': ent.text.strip(),
                    'title': title,
                    'email': email,
                    'context': context.strip(),
                    'confidence': 'high'  # spaCy NER is generally reliable
                })
        
        return persons
    
    def extract_contact_sections(self, text: str) -> List[Dict]:
        """
        Identify and extract contact information sections using NLP.
        """
        if not self.nlp:
            return []
        
        doc = self.process_text(text)
        contact_sections = []
        
        # Look for contact-related sentences
        contact_keywords = ['contact', 'email', 'phone', 'faculty', 'staff', 'directory', 'team']
        
        for sent in doc.sents:
            sent_text = sent.text.lower()
            if any(keyword in sent_text for keyword in contact_keywords):
                # Get the paragraph containing this sentence
                section = self._get_context_paragraph(text, sent.start_char, sent.end_char)
                
                # Extract entities from this section
                persons = self.extract_person_names(section)
                emails = self._extract_emails(section)
                phones = self._extract_phones(section)
                
                if persons or emails:
                    contact_sections.append({
                        'section_text': section,
                        'persons': persons,
                        'emails': emails,
                        'phones': phones,
                        'relevance_score': self._calculate_section_relevance(section)
                    })
        
        return sorted(contact_sections, key=lambda x: x['relevance_score'], reverse=True)
    
    def _extract_title_from_context(self, context: str, name: str) -> Optional[str]:
        """Extract professional title from context."""
        title_patterns = [
            r'(Professor|Prof\.|Dr\.|Doctor|Mr\.|Ms\.|Mrs\.)\s+' + re.escape(name),
            r'(Dean|Director|Head|Chair)\s+(?:of\s+)?[^,]+,\s*' + re.escape(name),
        ]
        
        for pattern in title_patterns:
            match = re.search(pattern, context, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_email_from_context(self, context: str) -> Optional[str]:
        """Extract email from context."""
        emails = self._extract_emails(context)
        return emails[0] if emails else None
    
    def _extract_emails(self, text: str) -> List[str]:
        """Extract all email addresses from text."""
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        return re.findall(email_pattern, text)
    
    def _extract_phones(self, text: str) -> List[str]:
        """Extract phone numbers from text."""
        phone_patterns = [
            r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
            r'tel:([+\d\s-]+)',
            r'Phone:\s*([+\d\s-]+)'
        ]
        phones = []
        for pattern in phone_patterns:
            phones.extend(re.findall(pattern, text))
        return phones
    
    def _get_context_paragraph(self, text: str, start: int, end: int, window: int = 500) -> str:
        """Extract a paragraph of text around the given position."""
        paragraph_start = max(0, start - window)
        paragraph_end = min(len(text), end + window)
        return text[paragraph_start:paragraph_end]
    
    def _calculate_section_relevance(self, section: str) -> float:
        """Calculate relevance score for a contact section."""
        score = 0.0
        section_lower = section.lower()
        
        # Score based on contact indicators
        contact_indicators = {
            'email': 2.0, 'contact': 1.5, 'phone': 1.0, 'faculty': 1.0,
            'staff': 1.0, 'directory': 1.5, 'personnel': 1.0
        }
        
        for indicator, points in contact_indicators.items():
            if indicator in section_lower:
                score += points
        
        # Bonus for structured data patterns
        if re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', section):
            score += 3.0
        
        return min(score, 10.0)  # Cap at 10
    
    def _fallback_name_extraction(self, text: str) -> List[Dict]:
        """Fallback name extraction when spaCy is not available."""
        # Simple pattern-based extraction as fallback
        name_pattern = r'\b(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b'
        matches = re.finditer(name_pattern, text)
        
        persons = []
        for match in matches:
            persons.append({
                'name': match.group(1).strip(),
                'title': None,
                'email': None,
                'context': text[max(0, match.start()-100):min(len(text), match.end()+100)],
                'confidence': 'low'
            })
        
        return persons