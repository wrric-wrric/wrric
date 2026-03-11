from abc import ABC, abstractmethod
from typing import Dict, Optional, List

class ContactExtractionStrategy(ABC):
    """Base class for contact extraction strategies."""
    
    @abstractmethod
    async def extract(self, university: str, department: Optional[Dict] = None, 
                     url: Optional[str] = None, content: Optional[str] = None) -> Optional[Dict]:
        pass
    
    @abstractmethod
    def get_priority(self) -> int:
        """Return strategy priority (higher = tried first)."""
        pass

class ExtractionResult:
    """Container for extraction results."""
    
    def __init__(self, contact: Dict = None, strategy: str = None, confidence: float = 0.0):
        self.contact = contact or {}
        self.strategy = strategy
        self.confidence = confidence
    
    def is_valid(self) -> bool:
        """Check if result contains meaningful contact data."""
        return bool(self.contact and any(
            self.contact.get(k) for k in ['name', 'email', 'linkedin']
        ))
    
    def merge(self, other: 'ExtractionResult') -> 'ExtractionResult':
        """Merge with another result."""
        merged_contact = {**self.contact, **other.contact}
        return ExtractionResult(
            contact=merged_contact,
            strategy=f"{self.strategy}+{other.strategy}",
            confidence=max(self.confidence, other.confidence)
        )