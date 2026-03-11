import os
import asyncio
import logging
import re
import numpy as np
from typing import List, Tuple, Dict, Set, Optional
from sqlalchemy import or_, select, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import JSONB
from models.db_models import Entity, UserEntityLink, SessionEntity
from utils.database import save_query, save_user_entity_link, async_session
from utils.helpers import is_meaningful_entity
from utils.embeddings import generate_embeddings

from ws_module.manager import manager
from datetime import datetime
from uuid import UUID
import json

logger = logging.getLogger(__name__)
from utils.embeddings import get_embedding_model
# model = SentenceTransformer('all-MiniLM-L6-v2') 

# Climate tech focus areas for boosting
CLIMATE_TECH_KEYWORDS = {
    'solar', 'wind', 'hydro', 'geothermal', 'biomass', 'bioenergy',
    'renewable', 'energy', 'power', 'electric', 'climate', 'carbon',
    'emissions', 'green', 'sustainable', 'clean', 'decarbonization',
    'net-zero', 'netzero', 'carbon-neutral', 'climate-change', 'adaptation',
    'mitigation', 'environmental', 'ecology', 'conservation', 'biodiversity',
    'water', 'waste', 'recycling', 'circular', 'agriculture', 'food',
    'transportation', 'mobility', 'electric-vehicles', 'ev', 'battery',
    'storage', 'smart-grid', 'grid', 'hydrogen', 'fuel', 'thermal',
    'building', 'construction', 'industry', 'manufacturing', 'materials'
}

# African countries and regions for location matching
AFRICAN_COUNTRIES = {
    'algeria', 'angola', 'benin', 'botswana', 'burkina faso', 'burundi', 'cabo verde',
    'cameroon', 'central african republic', 'chad', 'comoros', 'congo', "cote d'ivoire",
    'ivory coast', 'djibouti', 'egypt', 'equatorial guinea', 'eritrea', 'eswatini',
    'swaziland', 'ethiopia', 'gabon', 'gambia', 'ghana', 'guinea', 'guinea-bissau',
    'kenya', 'lesotho', 'liberia', 'libya', 'madagascar', 'malawi', 'mali', 'mauritania',
    'mauritius', 'morocco', 'mozambique', 'namibia', 'niger', 'nigeria', 'rwanda',
    'sao tome and principe', 'senegal', 'seychelles', 'sierra leone', 'somalia',
    'south africa', 'south sudan', 'sudan', 'tanzania', 'togo', 'tunisia', 'uganda',
    'zambia', 'zimbabwe'
}

# Alternative names and spellings for countries
COUNTRY_ALTERNATIVES = {
    'ivory coast': ["cote d'ivoire", "cote divoire", 'ivorycoast'],
    'tanzania': ['tanzanie'],
    ' DRC': ['congo', 'democratic republic', 'dr congo', 'drc'],
    ' republic of congo': ['congo brazzaville', 'republic of congo'],
    'cabo verde': ['cape verde', 'verde cape'],
    'eswatini': ['swaziland'],
    'macedonia': ['north macedonia'],
}

def extract_search_terms(query: str) -> Tuple[List[str], str, Optional[str]]:
    """
    Extract meaningful search terms from query.
    Returns (keywords, cleaned_query, detected_country)
    """
    query = query.lower().strip()
    query = re.sub(r'[^\w\s\-\']', ' ', query)
    query = re.sub(r'\s+', ' ', query).strip()
    words = query.split()
    
    extracted_terms = []
    detected_country = None
    
    # Check for country names in the query
    query_for_country = query.lower()
    for country in AFRICAN_COUNTRIES:
        if country in query_for_country:
            detected_country = country
            # Add country and alternatives to extracted terms
            extracted_terms.append(country)
            if country in COUNTRY_ALTERNATIVES:
                extracted_terms.extend(COUNTRY_ALTERNATIVES[country])
            break
    
    # If no full country match, check for partial matches
    if not detected_country:
        for country in AFRICAN_COUNTRIES:
            if any(word in query_for_country for word in country.split()):
                detected_country = country
                extracted_terms.append(country)
                break
    
    # Extract other keywords
    for word in words:
        word_lower = word.lower()
        if word_lower in CLIMATE_TECH_KEYWORDS:
            if word_lower not in extracted_terms:
                extracted_terms.append(word_lower)
        elif len(word) > 3 and word_lower not in AFRICAN_COUNTRIES:
            if word_lower not in extracted_terms:
                extracted_terms.append(word_lower)
    
    return extracted_terms, query, detected_country

def calculate_location_score(entity: Entity, detected_country: Optional[str]) -> Tuple[float, bool]:
    """
    Calculate match score based on location/country detection.
    Returns (score, is_location_match)
    """
    if not detected_country:
        return 0.0, False
    
    location = entity.get_json_field('location')
    if not location:
        return 0.0, False
    
    location_str = str(location).lower()
    country_variations = {detected_country.lower()}
    
    # Add alternatives
    if detected_country.lower() in COUNTRY_ALTERNATIVES:
        country_variations.update([alt.lower() for alt in COUNTRY_ALTERNATIVES[detected_country.lower()]])
    
    # Also check university field for country mentions
    if entity.university:
        university_lower = entity.university.lower()
        for variation in country_variations:
            if variation in university_lower:
                return 15.0, True  # Highest location score - country in university name
    
    # Check location dict for country
    location_country = ''
    if isinstance(location, dict):
        location_country = location.get('country', '').lower() if location.get('country') else ''
        if not location_country:
            location_country = location.get('country_name', '').lower() if location.get('country_name') else ''
    
    if location_country:
        for variation in country_variations:
            if variation in location_country:
                return 12.0, True
    
    # Check if any variation is in the location string
    for variation in country_variations:
        if variation in location_str:
            return 8.0, True
    
    return 0.0, False

def calculate_field_match_score(entity: Entity, keywords: List[str], detected_country: Optional[str] = None) -> Tuple[float, Dict[str, int]]:
    """
    Calculate a match score based on keyword presence in key fields.
    Returns (score, match_details)
    """
    score = 0.0
    match_details = {
        'university': 0,
        'research_abstract': 0,
        'scopes': 0,
        'department': 0,
        'lab_equipment': 0,
        'climate_tech_focus': 0
    }
    
    if not keywords:
        return score, match_details
    
    for keyword in keywords:
        keyword_lower = keyword.lower()
        keyword_variations = {keyword_lower}
        if '-' in keyword_lower:
            keyword_variations.add(keyword_lower.replace('-', ''))
            keyword_variations.add(keyword_lower.replace('-', ' '))
        
        # University name - highest weight (10 points)
        if entity.university:
            for variation in keyword_variations:
                if variation in entity.university.lower():
                    match_details['university'] += 1
                    score += 10.0
                    break
        
        # Research abstract - high weight (5 points)
        if entity.research_abstract:
            abstract_lower = entity.research_abstract.lower()
            for variation in keyword_variations:
                if variation in abstract_lower:
                    match_details['research_abstract'] += 1
                    score += 5.0
                    break
        
        # Scopes - medium weight (3 points)
        scopes = entity.get_json_field('scopes')
        if scopes and isinstance(scopes, list):
            for scope in scopes:
                if scope and isinstance(scope, str):
                    scope_lower = scope.lower()
                    for variation in keyword_variations:
                        if variation in scope_lower:
                            match_details['scopes'] += 1
                            score += 3.0
                            break
        
        # Climate tech focus - medium weight (3 points)
        climate_focus = entity.get_json_field('climate_tech_focus')
        if climate_focus and isinstance(climate_focus, list):
            for focus in climate_focus:
                if focus and isinstance(focus, str):
                    focus_lower = focus.lower()
                    for variation in keyword_variations:
                        if variation in focus_lower:
                            match_details['climate_tech_focus'] += 1
                            score += 3.0
                            break
        
        # Department - low weight (2 points)
        department = entity.get_json_field('department')
        if department and isinstance(department, dict):
            dept_name = department.get('name', '').lower()
            for variation in keyword_variations:
                if variation in dept_name:
                    match_details['department'] += 1
                    score += 2.0
                    break
        
        # Lab equipment - low weight (1 point)
        lab_equipment = entity.get_json_field('lab_equipment')
        if lab_equipment and isinstance(lab_equipment, dict):
            equip_str = str(lab_equipment).lower()
            for variation in keyword_variations:
                if variation in equip_str:
                    match_details['lab_equipment'] += 1
                    score += 1.0
                    break
    
    return score, match_details

def serialize_entity(entity: Entity) -> dict:
    """Serialize an Entity object into a dictionary for sending via WebSocket."""
    return {
        'id': str(entity.id),
        'url': entity.url,
        'source': entity.source,
        'created_by_user_id': str(entity.created_by_user_id) if entity.created_by_user_id else None,
        'university': entity.university,
        'location': entity.get_json_field('location'),
        'website': entity.website or None,
        'edurank': entity.get_json_field('edurank'),
        'department': entity.get_json_field('department'),
        'publications_meta': entity.get_json_field('publications_meta'),
        'related': entity.related,
        'point_of_contact': entity.get_json_field('point_of_contact'),
        'scopes': entity.get_json_field('scopes'),
        'research_abstract': entity.research_abstract,
        'lab_equipment': entity.get_json_field('lab_equipment'),
        'climate_tech_focus': entity.get_json_field('climate_tech_focus'),
        'timestamp': entity.timestamp.isoformat() if isinstance(entity.timestamp, datetime) else entity.timestamp,
        'last_updated': entity.last_updated.isoformat() if isinstance(entity.last_updated, datetime) else entity.last_updated,
        'embeddings': entity.get_json_field('embeddings'),
        'images': [
            {
                'id': img.id,
                'url': img.url,
                'caption': img.caption,
                'is_primary': img.is_primary,
                'uploaded_by_user_id': str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                'created_at': img.created_at.isoformat() if isinstance(img.created_at, datetime) else img.created_at
            } for img in entity.images
        ]
    }

async def retrieve_relevant_user_entities(
    query_text: str,
    user_id: UUID | None,
    session_id: UUID,
    db: AsyncSession
) -> List[Entity]:
    """
    Retrieve relevant entities from the database with source='user' based on the query text.
    Uses multi-level matching: exact phrase, field boosting, and semantic similarity.
    
    Args:
        query_text (str): The user's query string (e.g., "biotech labs in Ghana").
        user_id (UUID | None): The user's ID, or None for guest users.
        session_id (UUID): The session ID to associate the query with.
        db (AsyncSession): The database session for querying entities.
    
    Returns:
        List[Entity]: A list of relevant Entity objects matching the query.
    """
    try:
        keywords, cleaned_query, detected_country = extract_search_terms(query_text)
        logger.debug(f"Extracted keywords: {keywords}, detected_country: {detected_country}")
        
        if not keywords:
            logger.info(f"No valid keywords extracted from query: {query_text}")
            return []
        
        # Build optimized database query with multiple conditions
        conditions = []
        
        # Exact phrase matching in university name (highest priority)
        conditions.append(Entity.university.ilike(f"%{cleaned_query}%"))
        
        # Location-based conditions (if country detected)
        if detected_country:
            location_variations = [detected_country.lower()]
            if detected_country.lower() in COUNTRY_ALTERNATIVES:
                location_variations.extend([alt.lower() for alt in COUNTRY_ALTERNATIVES[detected_country.lower()]])
            
            for variation in location_variations:
                # Search in location JSON field
                conditions.append(Entity.location.op('@>')(f'{{"country": "{variation}"}}').cast(JSONB))
                conditions.append(Entity.location.op('@>')(f'{{"country_name": "{variation}"}}').cast(JSONB))
                conditions.append(Entity.university.ilike(f"%{variation}%"))
                conditions.append(Entity.research_abstract.ilike(f"%{variation}%"))
        
        # Keyword-based conditions
        for keyword in keywords:
            # Skip country keywords for field matching (handled above)
            if detected_country and keyword.lower() == detected_country.lower():
                continue
                
            keyword_lower = keyword.lower()
            keyword_variations = [keyword_lower]
            if '-' in keyword_lower:
                keyword_variations.append(keyword_lower.replace('-', ' '))
                keyword_variations.append(keyword_lower.replace('-', ''))
            
            for variation in keyword_variations:
                conditions.append(Entity.university.ilike(f"%{variation}%"))
                conditions.append(Entity.research_abstract.ilike(f"%{variation}%"))
                conditions.append(Entity.related.ilike(f"%{variation}%"))
        
        # Climate tech boost condition
        for tech_term in CLIMATE_TECH_KEYWORDS:
            if tech_term in query_text.lower():
                conditions.append(
                    or_(
                        Entity.university.ilike(f"%{tech_term}%"),
                        Entity.research_abstract.ilike(f"%{tech_term}%"),
                        Entity.scopes.op('@>')(cast([tech_term], JSONB)),
                        Entity.climate_tech_focus.op('@>')(cast([tech_term], JSONB))
                    )
                )
        
        candidates = []
        candidate_map = {}  # entity_id -> entity
        
        try:
            async with asyncio.timeout(8.0):  # 8-second timeout
                base_query = (
                    select(Entity)
                    .options(selectinload(Entity.images))
                    .where(Entity.source == "user")
                )
                
                # Query 1: Session-based entities (highest priority)
                if user_id:
                    session_query = (
                        base_query
                        .join(SessionEntity, SessionEntity.entity_id == Entity.id, isouter=True)
                        .where(
                            or_(
                                SessionEntity.session_id == session_id,
                                *conditions[:15]  # Limit conditions for performance
                            )
                        )
                        .distinct()
                        .limit(100)
                    )
                    session_result = await db.execute(session_query)
                    session_entities = session_result.scalars().all()
                    for entity in session_entities:
                        if entity.id not in candidate_map:
                            candidate_map[entity.id] = entity
                    logger.debug(f"Retrieved {len(session_entities)} session-based entities")
                
                # Query 2: User-linked entities
                if user_id:
                    user_query = (
                        base_query
                        .join(UserEntityLink, UserEntityLink.entity_id == Entity.id, isouter=True)
                        .where(
                            or_(
                                UserEntityLink.user_id == user_id,
                                *conditions[:15]
                            )
                        )
                        .distinct()
                        .limit(100)
                    )
                    user_result = await db.execute(user_query)
                    user_entities = user_result.scalars().all()
                    for entity in user_entities:
                        if entity.id not in candidate_map:
                            candidate_map[entity.id] = entity
                    logger.debug(f"Retrieved {len(user_entities)} user-linked entities")
                
                # Query 3: General keyword search for guest or additional results
                if not candidates or len(candidates) < 10:
                    general_query = (
                        base_query
                        .where(or_(*conditions[:20]))
                        .limit(100)
                    )
                    general_result = await db.execute(general_query)
                    general_entities = general_result.scalars().all()
                    for entity in general_entities:
                        if entity.id not in candidate_map:
                            candidate_map[entity.id] = entity
                    logger.debug(f"Retrieved {len(general_entities)} general keyword entities")
                
                candidates = list(candidate_map.values())
                logger.debug(f"Total unique candidates after all queries: {len(candidates)}")
                
        except asyncio.TimeoutError:
            logger.warning(f"Database query timed out for session {session_id}")
            await manager.send_message(str(session_id), {
                'status': 'error',
                'message': 'Database query timed out'
            })
            return []
        
        if not candidates:
            logger.info(f"No candidates found for query: {query_text}")
            await manager.send_message(str(session_id), {
                'status': 'no_results',
                'message': 'No relevant entities found for the query'
            })
            return []
        
        # Generate query embedding for semantic similarity
        query_embedding = get_embedding_model().encode([query_text], normalize_embeddings=True, show_progress_bar=False)[0]
        
        # Process candidates with field matching and semantic similarity
        scored_entities = []
        loop = asyncio.get_event_loop()
        
        for entity in candidates:
            try:
                # Step 1: Calculate field match score
                field_score, match_details = calculate_field_match_score(entity, keywords)
                
                # Step 2: Calculate location match score (critical for country-based queries)
                location_score, is_location_match = calculate_location_score(entity, detected_country)
                
                # Add location score to field score (location is high priority)
                if is_location_match:
                    field_score += location_score
                    match_details['location'] = 1
                    logger.debug(f"Entity {entity.id} matched location: {detected_country}, score: {location_score}")
                
                # Step 3: Handle embeddings
                needs_generation = (
                    entity.embeddings is None or 
                    isinstance(entity.embeddings, dict) and not entity.embeddings or
                    not isinstance(entity.embeddings, list) or len(entity.embeddings) == 0
                )
                
                entity_embedding = None
                if not needs_generation and isinstance(entity.embeddings, list) and len(entity.embeddings) > 0:
                    try:
                        entity_embedding = np.array(entity.embeddings)
                    except Exception:
                        needs_generation = True
                
                if needs_generation and entity.research_abstract:
                    entity_data = serialize_entity(entity)
                    try:
                        embeddings_dict = await loop.run_in_executor(
                            None,
                            lambda: generate_embeddings(entity_data)
                        )
                        if embeddings_dict and 'embedding' in embeddings_dict:
                            entity.embeddings = embeddings_dict['embedding']
                            try:
                                async with async_session() as new_db:
                                    await new_db.commit()
                            except Exception:
                                pass
                            entity_embedding = np.array(entity.embeddings)
                    except Exception as gen_e:
                        logger.warning(f"Error generating embedding for entity {entity.id}: {str(gen_e)}")
                
                # Step 3: Calculate semantic similarity
                semantic_score = 0.0
                if entity_embedding is not None and len(entity_embedding) > 0:
                    try:
                        semantic_score = float(np.dot(query_embedding, entity_embedding))
                    except Exception:
                        semantic_score = 0.0
                
            except Exception as e:
                logger.warning(f"Error processing entity {entity.id}: {str(e)}")
                continue
            
            # Step 4: Calculate combined score
            # Field score is weighted higher since it's exact match
            combined_score = (field_score * 0.6) + (semantic_score * 0.4)
            
            # Apply boosts
            boost = 0.0
            
            # Boost for session entities
            if user_id:
                try:
                    session_check = await db.execute(
                        select(SessionEntity).where(
                            and_(
                                SessionEntity.entity_id == entity.id,
                                SessionEntity.session_id == session_id
                            )
                        )
                    )
                    if session_check.scalar_one_or_none():
                        boost += 5.0
                except Exception:
                    pass
            
            # Boost for user-owned entities
            if user_id and entity.created_by_user_id == user_id:
                boost += 3.0
            
            # Boost for exact university name match
            university_lower = (entity.university or '').lower()
            query_lower = query_text.lower()
            if query_lower in university_lower or university_lower in query_lower:
                boost += 10.0
            
            # Boost for climate tech relevance
            climate_focus = entity.get_json_field('climate_tech_focus') or []
            if isinstance(climate_focus, list):
                climate_lower = [str(f).lower() for f in climate_focus]
                for keyword in keywords:
                    if keyword.lower() in climate_lower:
                        boost += 2.0
                        break
            
            # CRITICAL: Boost for location match when country is in query
            # This is crucial for queries like "solar labs in Ghana"
            if detected_country and is_location_match:
                # Major boost for location match - country in query is high priority
                boost += 20.0
                logger.debug(f"Entity {entity.id} received location boost (+20) for matching {detected_country}")
            
            final_score = combined_score + boost
            
            # Only include entities with meaningful score
            # If a country was specified, entities MUST have location match or high score
            min_threshold = 0.5
            min_field_threshold = 5.0
            
            # Higher bar when country is specified - location match is critical
            if detected_country:
                min_threshold = 5.0
                min_field_threshold = 10.0
            
            if final_score > min_threshold or field_score > min_field_threshold:
                scored_entities.append((entity, final_score, field_score, semantic_score, match_details))
        
        # Sort by combined score descending
        scored_entities.sort(key=lambda x: x[1], reverse=True)
        
        # Get top relevant entities
        relevant_entities = [entity for entity, score, field, semantic, details in scored_entities]
        
        # Filter meaningful entities
        meaningful_entities = []
        for entity in relevant_entities:
            entity_data = serialize_entity(entity)
            if is_meaningful_entity(entity_data):
                meaningful_entities.append(entity)
            
            # Limit to top 20 for performance
            if len(meaningful_entities) >= 20:
                break
        
        logger.debug(f"Filtered {len(meaningful_entities)} meaningful entities from {len(relevant_entities)} candidates")
        
        # Save query
        try:
            await save_query(db, query_text, str(session_id))
            logger.info(f"Query saved for session_id: {session_id}, user_id: {user_id or 'guest'}")
        except Exception as e:
            logger.warning(f"Failed to save query: {str(e)}")
        
        # Send entities via WebSocket
        if meaningful_entities:
            for entity in meaningful_entities:
                entity_data = serialize_entity(entity)
                if user_id:
                    try:
                        async with async_session() as new_db:
                            await save_user_entity_link(new_db, str(user_id), str(entity.id), 'viewed')
                            await new_db.commit()
                    except Exception as link_e:
                        logger.warning(f"Failed to save user entity link for entity ID: {entity.id}: {str(link_e)}")
                
                await manager.send_message(str(session_id), {
                    'status': 'entity',
                    'data': entity_data
                })
                logger.debug(f"Sent entity message for {entity.url} in session {session_id}")
            
            await manager.send_message(str(session_id), {
                'status': 'search_complete',
                'message': 'Entity search completed'
            })
        else:
            await manager.send_message(str(session_id), {
                'status': 'no_results',
                'message': 'No relevant entities found for the query'
            })
        
        try:
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to commit database changes: {str(e)}")
            await db.rollback()
        
        return meaningful_entities
        
    except Exception as e:
        logger.error(f"Error in retrieve_relevant_user_entities: {str(e)}")
        await manager.send_message(str(session_id), {
            'status': 'error',
            'message': 'An error occurred while searching existing labs. Continuing with web search.'
        })
        try:
            await db.rollback()
        except Exception as rollback_e:
            logger.error(f"Failed to rollback database: {str(rollback_e)}")
        return []
