import logging
import os
import numpy as np

from models.db_models import Entity
from ws_module.handlers.config import (
    config,
    GLOBAL_EXECUTOR,
    EDUCATIONAL_DOMAINS,
    ACADEMIC_REPOSITORIES,
    PAPER_KEYWORDS,
    DDGS_SEMAPHORE,
    LAST_DDGS_REQUEST_TIME,
    DDGS_MIN_DELAY,
    DATA_DIR,
    GROQ_API_KEY
)

logger = logging.getLogger(__name__)

# Embedding model (loaded lazily)
_model = None

def get_embedding_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("SentenceTransformer model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load SentenceTransformer: {e}")
            # Fallback to a mock if it fails
            class MockModel:
                def encode(self, texts, **kwargs):
                    return np.zeros((len(texts), 384))
            _model = MockModel()
    return _model

async def generate_embeddings(entity_data: dict) -> dict:
    """Generate and prepare embeddings for storage in PostgreSQL."""
    logger.debug(f"Generating embeddings for entity")
    texts = [
        entity_data.get('research_abstract', ''),
        ' '.join(entity_data.get('scopes', [])),
        ' '.join([pub.get('title', '') for pub in entity_data.get('publications', {}).get('key_items', [])]),
        entity_data.get('department', {}).get('name', '') + ' ' + ' '.join(entity_data.get('department', {}).get('focus_areas', [])),
        entity_data.get('university', ''), 
        ' '.join([entity_data.get('location', {}).get(key, '') for key in ['country', 'city', 'address']])  # Include location fields
    ]
    
    # Filter non-empty texts and log empty cases
    texts = [t.strip() for t in texts if t.strip()]
    if not texts:
        logger.warning(f"No valid texts for entity, returning empty embeddings")
        return {}

    try:
        # Concatenate texts for a single, comprehensive embedding per entity
        combined_text = ' '.join(texts)
        # Generate embedding with normalization for better cosine similarity
        embedding = get_embedding_model().encode([combined_text], normalize_embeddings=True, show_progress_bar=False)[0].tolist()
        
        logger.info(f"Generated embedding for entity, vector length: {len(embedding)}")
        return {'embedding': embedding}
    except Exception as e:
        logger.error(f"Error generating embeddings for entity: {str(e)}")
        return {}


async def generate_funder_embeddings(funder_data: dict) -> dict:
    """Generate embeddings for a funder."""
    logger.debug("Generating embeddings for funder")
    texts = [
        funder_data.get('profile', ''),
        ' '.join(funder_data.get('thematic_focus', [])),
        ' '.join(funder_data.get('regions', [])),
        ' '.join([inv.get('description', '') for inv in funder_data.get('investment_history', []) if inv]),
        funder_data.get('name', '') + ' ' + funder_data.get('org_type', '')
    ]
    
    texts = [t.strip() for t in texts if t.strip()]
    if not texts:
        logger.warning("No valid texts for funder, returning empty embeddings")
        return {}

    try:
        combined_text = ' '.join(texts)
        embedding = get_embedding_model().encode([combined_text], normalize_embeddings=True, show_progress_bar=False)[0].tolist()
        logger.info(f"Generated embedding for funder, vector length: {len(embedding)}")
        return {'embedding': embedding}
    except Exception as e:
        logger.error(f"Error generating embeddings for funder: {str(e)}")
        return {}