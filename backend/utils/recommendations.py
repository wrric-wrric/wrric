import asyncio
import logging
import os
import numpy as np
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sklearn.metrics.pairwise import cosine_similarity
# from sentence_transformers import SentenceTransformer
class MockSentenceTransformer:
    def __init__(self, *args, **kwargs): pass
    def encode(self, texts, *args, **kwargs):
        import numpy as np
        return np.zeros((len(texts), 384)) # Dummy embeddings of size 384

SentenceTransformer = MockSentenceTransformer
from groq import Groq
from tenacity import retry, stop_after_attempt, wait_exponential
from models.db_models import Entity, SessionEntity
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

from utils.embeddings import get_embedding_model

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _generate_suggestion(client: Groq, entity: Entity, original_query: str) -> str:
    """Generate a single query suggestion using Groq API."""
    prompt = f"""
    Based on university '{entity.university}' with research focus '{', '.join(entity.get_json_field('scopes') or [])}',
    generate a concise, research-focused search query related to '{original_query}'.
    Ensure the query is specific, relevant to academic research, and expands on the original query.
    Return only the query string without comments or explanations.
    Do not include a sentence such as 'Here are three concise, research-focused search queries that expand on the original query' just the sentences
    Example: 'quantum computing innovations in African universities'
    """
    try:
        response = await asyncio.get_event_loop().run_in_executor(
            GLOBAL_EXECUTOR,
            lambda: client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama3-70b-8192",
                temperature=0.7,
                max_tokens=50
            )
        )
        suggestion = response.choices[0].message.content.strip()
        logger.info(f"Generated suggestion for entity {entity.url}: {suggestion}")
        return suggestion
    except Exception as e:
        logger.error(f"Groq API error for entity {entity.url}: {str(e)}")
        raise

async def suggest_related_queries(db: AsyncSession, session_id: str, original_query: str, top_n: int = 4) -> List[str]:
    """Generate related query suggestions based on scraped entities."""
    logger.info(f"Generating suggestions for session {session_id}, query: {original_query}")
    try:
        # Fetch entities linked to the session via SessionEntity
        entities_result = await db.execute(
            select(Entity)
            .join(SessionEntity, SessionEntity.entity_id == Entity.id)
            .where(SessionEntity.session_id == session_id)
        )
        entities = entities_result.scalars().all()
        if not entities:
            logger.warning(f"No entities found for session {session_id}, attempting keyword-based fallback")
            return await _keyword_based_suggestions(original_query, top_n)

        # Collect valid embeddings from PostgreSQL (stored in json_data['embeddings'])
        all_embeddings = []
        valid_entities = []
        for entity in entities:
            embedding = entity.get_json_field('embeddings')
            if embedding:
                all_embeddings.append(np.array(embedding))
                valid_entities.append(entity)

        if not all_embeddings:
            logger.warning(f"No valid embeddings for session {session_id}, attempting keyword-based fallback")
            return await _keyword_based_suggestions(original_query, top_n)

        # Embed original query with normalization
        query_embedding = get_embedding_model().encode([original_query], normalize_embeddings=True, show_progress_bar=False)[0]

        # Compute cosine similarities
        similarities = cosine_similarity([query_embedding], all_embeddings)[0]
        top_indices = np.argsort(similarities)[-top_n:][::-1]

        # Generate suggestions using Groq API
        client = Groq(api_key=GROQ_API_KEY)
        suggestions = []
        seen_entities = set()  # Avoid duplicates if needed, though now one embedding per entity
        for idx in top_indices:
            entity = valid_entities[idx]
            if entity.id in seen_entities:
                continue
            seen_entities.add(entity.id)
            try:
                suggestion = await _generate_suggestion(client, entity, original_query)
                if suggestion and suggestion not in suggestions:
                    suggestions.append(suggestion)
            except Exception as e:
                logger.error(f"Failed to generate suggestion for entity {entity.url}: {str(e)}")
                continue

        # Fallback if not enough suggestions
        if len(suggestions) < top_n:
            logger.info(f"Generated only {len(suggestions)} suggestions, supplementing with keyword-based")
            keyword_suggestions = await _keyword_based_suggestions(original_query, top_n - len(suggestions))
            suggestions.extend(keyword_suggestions)

        logger.info(f"Generated {len(suggestions)} query suggestions for session {session_id}: {suggestions}")
        return suggestions[:top_n]

    except Exception as e:
        logger.error(f"Error generating suggestions for session {session_id}: {str(e)}")
        return await _keyword_based_suggestions(original_query, top_n)

async def _keyword_based_suggestions(original_query: str, top_n: int) -> List[str]:
    """Generate fallback suggestions using keyword expansion and Groq."""
    logger.info(f"Generating keyword-based suggestions for query: {original_query}")
    client = Groq(api_key=GROQ_API_KEY)
    prompt = f"""
    Given the query '{original_query}', generate {top_n} concise, research-focused search queries that expand on the original query.
    Return only a list of query strings, one per line, without comments or explanations.
    Do not include a sentence such as 'Here are three concise, research-focused search queries that expand on the original query' just the sentences
    Example:
    quantum computing innovations in African universities
    quantum algorithms for sustainable energy
    """
    try:
        response = await asyncio.get_event_loop().run_in_executor(
            GLOBAL_EXECUTOR,
            lambda: client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                temperature=0.7,
                max_tokens=200
            )
        )
        suggestions = [line.strip() for line in response.choices[0].message.content.strip().split('\n') if line.strip()]
        logger.info(f"Generated {len(suggestions)} keyword-based suggestions: {suggestions}")
        return suggestions[:top_n]
    except Exception as e:
        logger.error(f"Error generating keyword-based suggestions: {str(e)}")
        return []