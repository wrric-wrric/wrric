import logging
from sentence_transformers import SentenceTransformer

import numpy as np

logger = logging.getLogger(__name__)
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


# ========================
# Initialize embedding model
# ========================
model = SentenceTransformer('all-MiniLM-L6-v2')  # Lightweight model for semantic embeddings



# ========================
# Function: Generate embeddings for an entity
# ========================
async def generate_embeddings(entity_data: dict) -> dict:
    texts = [
        entity_data.get('research_abstract', ''),
        ' '.join(entity_data.get('scopes', [])),
        ' '.join([pub.get('title', '') for pub in entity_data.get('publications', {}).get('key_items', [])]),
        entity_data.get('department', {}).get('name', '') + ' ' + ' '.join(entity_data.get('department', {}).get('focus_areas', []))
    ]
    # Filter non-empty texts
    texts = [t for t in texts if t.strip()]
    if not texts:
        return {}

    embeddings = model.encode(texts, convert_to_tensor=False).tolist()  # List of vectors

    # Average embeddings for a single entity vector (or store per-field for finer control)
    avg_embedding = (
        [sum(col) / len(col) for col in zip(*embeddings)]
        if len(embeddings) > 1 else embeddings[0]
    )
    return {'entity_vector': avg_embedding}








import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy import select
from models.db_models import Entity
# from utils.embeddings import generate_embeddings

async def update_existing_entities():
    engine = create_async_engine(
        "postgresql+asyncpg://neondb_owner:npg_pHMwkJ1oEmt9@ep-summer-hall-abj7fo9g-pooler.eu-west-2.aws.neon.tech/neondb?ssl=require"
    )
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as db:
        result = await db.execute(select(Entity))
        for entity in result.scalars().all():
            entity_data = {
                'url': entity.url,
                'university': entity.university,
                'research_abstract': entity.research_abstract,
                'scopes': entity.get_json_field('scopes'),
                'publications': entity.get_json_field('publications'),
                'department': entity.get_json_field('department')
            }
            entity.set_json_field('embeddings', await generate_embeddings(entity_data))
            await db.commit()

if __name__ == "__main__":
    asyncio.run(update_existing_entities())