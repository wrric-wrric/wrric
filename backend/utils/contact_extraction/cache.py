import asyncio
from typing import Dict, Optional
from datetime import datetime, timedelta
import json

class ContactCache:
    def __init__(self, max_size: int = 1000, ttl_hours: int = 24):
        self.max_size = max_size
        self.ttl = timedelta(hours=ttl_hours)
        self._cache = {}
        self._access_times = {}
    
    def get(self, key: str) -> Optional[Dict]:
        """Get cached contact data."""
        if key in self._cache:
            data, timestamp = self._cache[key]
            if datetime.now() - timestamp < self.ttl:
                self._access_times[key] = datetime.now()
                return data.copy() if data else None
            else:
                # Expired, remove from cache
                del self._cache[key]
                del self._access_times[key]
        return None
    
    def set(self, key: str, data: Dict) -> None:
        """Cache contact data."""
        if len(self._cache) >= self.max_size:
            self._evict_oldest()
        
        self._cache[key] = (data.copy() if data else None, datetime.now())
        self._access_times[key] = datetime.now()
    
    def _evict_oldest(self) -> None:
        """Evict the least recently used item."""
        if not self._access_times:
            return
        
        oldest_key = min(self._access_times.items(), key=lambda x: x[1])[0]
        del self._cache[oldest_key]
        del self._access_times[oldest_key]
    
    def generate_key(self, university: str, department: Optional[str] = None, url: Optional[str] = None) -> str:
        """Generate cache key from parameters."""
        components = [university.lower().strip()]
        if department:
            components.append(department.lower().strip())
        if url:
            components.append(url.lower().strip())
        return "|".join(components)

class DomainContactCache:
    """Specialized cache for domain-level contacts."""
    def __init__(self):
        self._domain_cache = {}
        self._domain_ttl = timedelta(hours=48)  # Longer TTL for domain contacts
    
    def get_domain_contacts(self, domain: str) -> Optional[Dict]:
        """Get cached contacts for a domain."""
        if domain in self._domain_cache:
            data, timestamp = self._domain_cache[domain]
            if datetime.now() - timestamp < self._domain_ttl:
                return data.copy() if data else None
            else:
                del self._domain_cache[domain]
        return None
    
    def set_domain_contacts(self, domain: str, contacts: Dict) -> None:
        """Cache domain contacts."""
        self._domain_cache[domain] = (contacts.copy() if contacts else None, datetime.now())