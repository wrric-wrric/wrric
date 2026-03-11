from typing import Dict, Optional
from .contact_extraction.orchestrator import ContactExtractionOrchestrator

# Global orchestrator instance
_contact_orchestrator = None

def get_contact_orchestrator() -> ContactExtractionOrchestrator:
    """Get or create the global contact orchestrator instance."""
    global _contact_orchestrator
    if _contact_orchestrator is None:
        _contact_orchestrator = ContactExtractionOrchestrator()
    return _contact_orchestrator

async def extract_point_of_contact_enhanced(
    university: str, 
    department: Optional[Dict[str, str]] = None,
    entity_url: Optional[str] = None,
    existing_content: Optional[str] = None,
    db_session = None
) -> Dict[str, str]:
    """
    Enhanced point of contact extraction with NLP and multiple strategies.
    """
    orchestrator = get_contact_orchestrator()
    
    return await orchestrator.extract_contacts(
        university=university,
        department=department,
        url=entity_url,
        content=existing_content,
        db_session=db_session
    )