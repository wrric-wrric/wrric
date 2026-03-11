import asyncio
import logging
import random
from typing import List, Tuple, AsyncGenerator
from duckduckgo_search import DDGS
from models.db_models import Entity
# from utils.embeddings import generate_embeddings
from ws_module.manager import ScraperState, manager
from utils.scrapers import is_static, scrape_with_bs, scrape_with_jina, scrape_static_url, scrape_with_jina_async
from utils.helpers import extract_links, is_valid_url, is_meaningful_entity, get_domain, normalize_url, semantic_categorization
from utils.extractors import extract_structured_data
from utils.database import get_session_by_id, save_entity, save_session, save_query, async_session, get_entity_by_url, save_user_entity_link
from utils.config import load_config
from utils.location import get_location_for_university
from utils.external_extractors import get_edurank_data, get_publications #, extract_point_of_contact
from utils.contact_service import extract_point_of_contact_enhanced
from utils.pdf_extractor import is_pdf_url, extract_pdf_content
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from utils.google_search import search_with_meta
from utils.user_entity_search import retrieve_relevant_user_entities
from ws_module.handlers.error_sanitizer import sanitize_error
from utils.quality_scorer import compute_quality_score
from utils.log_context import set_session_id
from utils.pipeline_metrics import PipelineMetrics
import aiohttp

logger = logging.getLogger(__name__)

# Async cache for semantic_categorization
_semantic_cache = {}

async def cached_semantic_categorization(url: str, anchor_text: str) -> Tuple[str, float]:
    """Async wrapper for semantic_categorization with caching."""
    cache_key = (url, anchor_text)
    if cache_key in _semantic_cache:
        return _semantic_cache[cache_key]
    result = await semantic_categorization(url, anchor_text)
    _semantic_cache[cache_key] = result
    if len(_semantic_cache) > 1000:
        _semantic_cache.pop(next(iter(_semantic_cache)))
    return result

async def _collect_process_url(process_url_fn, *args):
    """Wrap async generator into a list so asyncio.wait_for can apply a timeout."""
    results = []
    async for item in process_url_fn(*args):
        results.append(item)
    return results


async def run_scraper_workflow(
    session_id: str,
    user_id: str | None,
    universities_list: List[dict],
    query: str,
    base_domain: str,
    state: ScraperState,
    executor: ThreadPoolExecutor,
    max_links_per_page: int = 5
) -> AsyncGenerator[dict, None]:
    """Run the Google Search-based URL discovery and scraping pipeline with DDGS fallback, yielding entity data."""
    from utils.embeddings import generate_embeddings
    config = load_config()
    max_urls = config['MAX_URLS']
    max_depth = config['MAX_DEPTH']
    timeout_seconds = config['TIMEOUT_SECONDS']
    max_workers = config.get('MAX_WORKERS', 1)
    search_max_results = config.get('SEARCH_MAX_RESULTS', 10)
    
    # Reset state for new session
    set_session_id(session_id)
    state.processed_urls.clear()
    state.current_urls.clear()
    yielded_urls = set()  # Phase 3.5: track yielded entity URLs to prevent duplicates
    metrics = PipelineMetrics(session_id)
    logger.debug(f"Reset processed_urls and current_urls for session {session_id}")

    try:
        logger.debug(f"Starting workflow for session {session_id} with user_id: {user_id or 'guest'}, MAX_WORKERS: {max_workers}, MAX_LINKS_PER_PAGE: {max_links_per_page}, universities: {universities_list}")

        async with aiohttp.ClientSession() as http_session, async_session() as db:
            # Use existing session if valid, otherwise create a new one
            if session_id:
                session = await get_session_by_id(db, session_id, user_id)
                if session:
                    logger.debug(f"Using existing session {session_id} for user_id: {user_id or 'guest'}")
                    state.session_id = session_id
                    state.title = session.title or query or "Untitled Session"
                else:
                    logger.warning(f"Session {session_id} not found or not authorized, creating new session")
                    session = await save_session(db, user_id, title=query or "Untitled Session")
                    session_id = str(session.id)
                    state.session_id = session_id
                    state.title = session.title
                    await manager.send_message(session_id, {
                        'status': 'connected',
                        'sessionId': session_id,
                        'title': state.title,
                        'description': session.description,
                        'is_active': session.is_active,
                        'metadata_': session.metadata_,
                        'message': 'New session created due to invalid or missing session'
                    })
            else:
                logger.debug(f"No session_id provided, creating new session")
                session = await save_session(db, user_id, title=query or "Untitled Session")
                session_id = str(session.id)
                state.session_id = session_id
                state.title = session.title
                await manager.send_message(session_id, {
                    'status': 'connected',
                    'sessionId': session_id,
                    'title': state.title,
                    'description': session.description,
                    'is_active': session.is_active,
                    'metadata_': session.metadata_,
                    'message': 'New session created'
                })
            
            # Step 1: Search user_entities table
            logger.info(f"Searching user_entities for query: {query}")
            try:
                entities = await retrieve_relevant_user_entities(query, user_id, session_id, db)
                logger.info(f"Retrieved {len(entities)} user entities for query: {query}")
                for entity in entities:
                    entity_data = {
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
                        'timestamp': entity.timestamp.isoformat() if isinstance(entity.timestamp, datetime) else entity.timestamp,
                        'last_updated': entity.last_updated.isoformat() if isinstance(entity.last_updated, datetime) else entity.last_updated,
                        'embeddings': entity.get_json_field('embeddings'),
                        'images': [
                            {
                                'id': img.id,
                                'entity_id': str(img.entity_id),
                                'url': img.url,
                                'caption': img.caption,
                                'is_primary': img.is_primary,
                                'uploaded_by_user_id': str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                                'created_at': img.created_at.isoformat() if isinstance(img.created_at, datetime) else img.created_at
                            } for img in entity.images
                        ]
                    }
                    if is_meaningful_entity(entity_data) and entity.url not in yielded_urls:
                        if user_id:
                            await save_user_entity_link(db, user_id, str(entity.id), 'viewed')
                        yielded_urls.add(entity.url)
                        yield entity_data
                        logger.info(f"Yielded user entity data for {session_id}: {entity.url}")
            except Exception as e:
                logger.error(f"Error retrieving user entities: {str(e)}")
                await manager.send_message(session_id, {
                    'status': 'error',
                    'message': sanitize_error(e, "user entity search")
                })
            
            # Step 2: Save query and proceed with scraping
            try:
                logger.debug(f"Saving query for session_id: {session_id}, query: {query}")
                await save_query(db, query, session_id)
                logger.debug(f"Query saved for session_id: {session_id}")
            except Exception as e:
                logger.warning(f"Failed to save query for session {session_id}: {str(e)}, continuing workflow")
            
            state.urls_queue = asyncio.PriorityQueue()
            
            search_query = f"{query} site:{base_domain}"
            logger.debug(f"Searching Google with query: {search_query}")
            try:
                results = await search_with_meta(search_query, max_results=search_max_results)
                logger.debug(f"Retrieved {len(results)} URLs from Google Search")
            except Exception as e:
                logger.error(f"Google Search failed: {str(e)}, falling back to DDGS")
                try:
                    ddgs = DDGS()
                    results = await asyncio.to_thread(ddgs.text, keywords=search_query, max_results=search_max_results)
                    logger.debug(f"Retrieved {len(results)} URLs from DDGS fallback")
                except Exception as ddgs_e:
                    logger.error(f"DDGS fallback failed: {str(ddgs_e)}")
                    results = []
            
            for result in results:
                url = result.get('url')
                title = result.get('title', '')
                if not url or not is_valid_url(url):
                    logger.debug(f"Skipping invalid URL: {url or 'None'}")
                    continue
                if not get_domain(url).endswith(base_domain):
                    logger.debug(f"Skipping URL outside base domain: {url}")
                    continue
                category, relevance = await cached_semantic_categorization(url, title)
                if category == "research" and relevance > 0.5:
                    logger.debug(f"Queueing Google Search URL: {url} (relevance: {relevance}, priority: 1)")
                    await state.urls_queue.put((1, (url, title, relevance, 0, None)))
                else:
                    logger.debug(f"Skipping URL with low relevance: {url} (category: {category}, relevance: {relevance})")
            
            for item in universities_list:
                url = item.get('url')
                university = item.get('university') or "Unknown Institution"
                if not url:
                    logger.debug(f"Skipping university entry with no URL: {item}")
                    continue
                if not is_valid_url(url):
                    logger.debug(f"Skipping invalid university URL: {url}")
                    continue
                logger.debug(f"Queueing university URL: {url} for {university} (priority: 0)")
                await state.urls_queue.put((0, (url, f"{university} Page", 1.0, 0, university)))
            
            async def categorize_links(links: List[Tuple[str, str]], base_domain: str, depth: int) -> List[Tuple[str, str, float, int]]:
                if not links:
                    return []
                sampled_links = random.sample(links, min(len(links), max_links_per_page))
                logger.debug(f"Limited extracted links to {len(sampled_links)} from {len(links)}")
                
                async def categorize_single(link: str, link_anchor: str) -> Tuple[str, str, float, int] | None:
                    if not state.cancelled and is_valid_url(link):
                        link_domain = get_domain(link)
                        if link_domain.endswith(base_domain):
                            try:
                                category, relevance = await cached_semantic_categorization(link, link_anchor)
                                if category == "research" and relevance > 0.5:
                                    return (link, link_anchor, relevance, depth + 1)
                            except Exception as e:
                                logger.error(f"Error categorizing link {link}: {str(e)}")
                    return None
                
                results = await asyncio.gather(*[categorize_single(link, anchor) for link, anchor in sampled_links], return_exceptions=True)
                categorized = [r for r in results if r is not None and not isinstance(r, Exception)]
                logger.debug(f"Categorized {len(categorized)} links for queueing")
                return categorized

            async def extract_links_only(html: str, base_url: str) -> List[Tuple[str, str]]:
                try:
                    links = await extract_links(html, base_url)
                    return links
                except Exception as e:
                    logger.error(f"Error extracting links for {base_url}: {str(e)}")
                    return []

            async def process_url(url: str, anchor_text: str, parent_relevance: float, depth: int, university: str | None, executor: ThreadPoolExecutor) -> AsyncGenerator[dict, None]:
                if state.cancelled or len(state.processed_urls) >= max_urls or depth > max_depth:
                    logger.debug(f"Skipping URL {url}: cancelled={state.cancelled}, processed={len(state.processed_urls)}, depth={depth}")
                    return
                
                normalized_url = normalize_url(url)
                async with async_session() as db:
                    existing_entity = await get_entity_by_url(db, normalized_url)
                    if existing_entity:
                        logger.debug(f"Retrieved existing entity for {normalized_url}")
                        entity_data = {
                            'id': str(existing_entity.id),
                            'url': existing_entity.url,
                            'source': existing_entity.source,
                            'created_by_user_id': str(existing_entity.created_by_user_id) if existing_entity.created_by_user_id else None,
                            'university': existing_entity.university,
                            'location': existing_entity.get_json_field('location'),
                            'website': existing_entity.website or None,
                            'edurank': existing_entity.get_json_field('edurank'),
                            'department': existing_entity.get_json_field('department'),
                            'publications_meta': existing_entity.get_json_field('publications_meta'),
                            'related': existing_entity.related,
                            'point_of_contact': existing_entity.get_json_field('point_of_contact'),
                            'scopes': existing_entity.get_json_field('scopes'),
                            'research_abstract': existing_entity.research_abstract,
                            'lab_equipment': existing_entity.get_json_field('lab_equipment'),
                            'timestamp': existing_entity.timestamp.isoformat() if isinstance(existing_entity.timestamp, datetime) else existing_entity.timestamp,
                            # 'last_updated': entity.last_updated.isoformat() if isinstance(existing_entity.last_updated, datetime) else existing_entity.last_updated,
                            'last_updated': existing_entity.last_updated.isoformat() if isinstance(existing_entity.last_updated, datetime) else existing_entity.last_updated,
                            'embeddings': existing_entity.get_json_field('embeddings'),
                            'images': [
                                {
                                    'id': img.id,
                                    'url': img.url,
                                    'caption': img.caption,
                                    'is_primary': img.is_primary,
                                    'uploaded_by_user_id': str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                                    'created_at': img.created_at.isoformat() if isinstance(img.created_at, datetime) else img.created_at
                                } for img in existing_entity.images
                            ]
                        }
                        if is_meaningful_entity(entity_data) and normalized_url not in yielded_urls:
                            if user_id:
                                await save_user_entity_link(db, user_id, str(existing_entity.id), 'viewed')
                            await db.commit()
                            yielded_urls.add(normalized_url)
                            yield entity_data
                            logger.info(f"Yielded existing entity data for {session_id}: {normalized_url}")
                            state.processed_urls.add(normalized_url)
                            return
                
                    state.current_urls.add(normalized_url)
                    logger.info(f"Processing URL: {url} (depth: {depth}, university: {university or 'Unknown'})")
                
                    try:
                        await manager.send_message(session_id, {
                            'status': 'processing',
                            'url': url,
                            'depth': depth
                        })
                        
                        selected_university = university
                        if selected_university is None:
                            for item in universities_list:
                                if normalize_url(item.get('url')) == normalized_url:
                                    selected_university = item.get('university') or "Unknown Institution"
                                    logger.debug(f"Matched URL {url} to universities_list, using university: {selected_university}")
                                    break
                        selected_university = selected_university or "Unknown Institution"
                        
                        is_pdf = await is_pdf_url(url, session_id)
                        data = None
                        if is_pdf:
                            logger.debug(f"Processing PDF URL: {url}")
                            data = await extract_pdf_content(url, session_id, executor)
                        else:
                            # Single-fetch: get HTML once, decide static/dynamic from response
                            data = await scrape_static_url(url, http_session)
                            if data and not data.get('is_static', True):
                                # Dynamic site — use async Jina reader
                                logger.debug(f"URL {url} is dynamic, falling back to Jina")
                                data = await scrape_with_jina_async(url, http_session)

                        
                        if not data or (not data.get('raw_content') and data.get('error')):
                            error_reason = data.get('error') if data else 'No content retrieved'
                            logger.warning(f"Failed to retrieve content for URL: {url} - {error_reason}")
                            await manager.send_message(session_id, {
                                'status': 'error',
                                'url': url,
                                'reason': error_reason
                            })
                            return
                        raw_content = data.get('raw_content', '')
                        if not raw_content:
                            logger.debug(f"Empty raw_content for {url}, HTML length: {len(data.get('html_content', ''))}")
                        
                        logger.debug(f"Extracting structured data for URL: {url}")
                        structured_data = await extract_structured_data(raw_content, selected_university)
                        structured_data['images'] = []
                        structured_data['url'] = url
                        structured_data['source'] = 'scraped'
                        if selected_university != "Unknown Institution":
                            structured_data['university'] = selected_university
                        structured_data['last_updated'] = data.get('last_updated', datetime.utcnow().isoformat())
                        # Run enrichments concurrently (Phase 2.4)
                        needs_location = not structured_data.get('location') or not (
                            structured_data.get('location', {}).get('latitude') and
                            structured_data.get('location', {}).get('longitude')
                        )
                        needs_contact = not structured_data.get('point_of_contact') or not any(
                            structured_data.get('point_of_contact', {}).get(k) for k in ['email', 'linkedin']
                            if isinstance(structured_data.get('point_of_contact'), dict)
                        )

                        async def _get_edurank():
                            try:
                                return await get_edurank_data(structured_data.get('university'))
                            except Exception as e:
                                logger.warning(f"EduRank enrichment failed for {url}: {e}")
                                return {}

                        async def _get_pubs():
                            try:
                                return await get_publications(structured_data['university'], query, structured_data.get('department'))
                            except Exception as e:
                                logger.warning(f"Publications enrichment failed for {url}: {e}")
                                return []

                        async def _get_location():
                            if not needs_location:
                                return structured_data.get('location', {})
                            try:
                                contexts = [
                                    structured_data.get('department', {}).get('name'),
                                    structured_data.get('query', ''),
                                    "lab",
                                    structured_data.get('country', '')
                                ]
                                return await get_location_for_university(
                                    structured_data.get('university'),
                                    contexts=[ctx for ctx in contexts if ctx]
                                )
                            except Exception as e:
                                logger.warning(f"Location enrichment failed for {url}: {e}")
                                return structured_data.get('location', {})

                        async def _get_contact():
                            if not needs_contact:
                                return structured_data.get('point_of_contact', {})
                            try:
                                return await extract_point_of_contact_enhanced(
                                    university=structured_data.get('university'),
                                    department=structured_data.get('department'),
                                    entity_url=structured_data.get('url'),
                                    existing_content=raw_content,
                                    db_session=db
                                )
                            except Exception as e:
                                logger.warning(f"Contact enrichment failed for {url}: {e}")
                                return structured_data.get('point_of_contact', {})

                        edurank_res, pubs_res, loc_res, contact_res = await asyncio.gather(
                            _get_edurank(), _get_pubs(), _get_location(), _get_contact()
                        )
                        structured_data['edurank'] = edurank_res
                        structured_data['publications_meta'] = pubs_res
                        structured_data['location'] = loc_res
                        structured_data['point_of_contact'] = contact_res

                        structured_data['embeddings'] = {}  # Deferred to background
                        structured_data['quality_score'] = compute_quality_score(structured_data)
                        structured_data['images'].extend(data.get('images', []))
                        
                        logger.debug(f"Structured data for URL {url}: {structured_data}")
                        if not is_meaningful_entity(structured_data):
                            metrics.record_skip()
                            logger.info(f"Skipping generic entity for URL: {url} (insufficient critical fields)")
                            await manager.send_message(session_id, {
                                'status': 'skipped',
                                'url': url,
                                'reason': 'Generic entity with insufficient critical fields'
                            })
                            return
                        
                        logger.debug(f"Saving entity for URL: {url}")
                        entity = await save_entity(db, session_id, structured_data, user_id)
                        if not entity:
                            metrics.record_failure()
                            logger.error(f"Failed to save entity for URL: {url} - save_entity returned None")
                            await manager.send_message(session_id, {
                                'status': 'error',
                                'url': url,
                                'reason': 'Failed to save entity - returned None'
                            })
                            return
                        
                        # Reload entity with images to avoid lazy loading
                        entity = await db.execute(
                            select(Entity)
                            .where(Entity.id == entity.id)
                            .options(selectinload(Entity.images))
                        )
                        entity = entity.scalars().first()
                        if not entity:
                            logger.error(f"Failed to reload entity for URL: {url}")
                            await manager.send_message(session_id, {
                                'status': 'error',
                                'url': url,
                                'reason': 'Failed to reload entity after save'
                            })
                            return
                        
                        entity_data = {
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
                        if user_id:
                            await save_user_entity_link(db, user_id, str(entity.id), 'viewed')
                        await db.commit()
                        yielded_urls.add(normalized_url)
                        yield entity_data
                        metrics.record_success()
                        logger.info(f"Yielded new entity data for {session_id}: {url}")

                        # Background: generate embeddings and update DB
                        async def _update_embeddings(eid, sdata):
                            try:
                                from utils.embeddings import generate_embeddings
                                emb = await generate_embeddings(sdata)
                                if emb:
                                    async with async_session() as edb:
                                        ent = await edb.execute(select(Entity).where(Entity.id == eid))
                                        ent = ent.scalars().first()
                                        if ent:
                                            ent.set_json_field('embeddings', emb)
                                            await edb.commit()
                                            logger.debug(f"Background embeddings updated for entity {eid}")
                            except Exception as emb_err:
                                logger.warning(f"Background embedding failed for {eid}: {emb_err}")

                        asyncio.create_task(_update_embeddings(entity.id, structured_data))
                        
                        if not is_pdf:
                            logger.debug(f"Submitting link extraction for URL: {url}")
                            links = await extract_links_only(data['html_content'], url)
                            if state.cancelled:
                                logger.debug(f"Skipping link categorization for {url} due to cancellation")
                                return
                            queued_links = await categorize_links(links, base_domain, depth)
                            for link, link_anchor, relevance, next_depth in queued_links:
                                await state.urls_queue.put((2, (link, link_anchor, relevance, next_depth, selected_university)))
                    except asyncio.TimeoutError as e:
                        logger.error(f"Timeout processing URL: {url}: {str(e)}")
                        await manager.send_message(session_id, {
                            'status': 'error',
                            'url': url,
                            'reason': 'Processing timed out for this URL. Skipping.'
                        })
                    except asyncio.CancelledError:
                        logger.debug(f"Cancelled processing URL: {url}")
                        raise
                    except Exception as e:
                        logger.error(f"Error processing URL: {url}: {str(e)}")
                        await manager.send_message(session_id, {
                            'status': 'error',
                            'url': url,
                            'reason': sanitize_error(e, f"processing URL {url}")
                        })
                    finally:
                        state.processed_urls.add(normalized_url)
                        state.current_urls.discard(normalized_url)
                        logger.debug(f"Finished processing URL: {url}")
            
            async def worker(executor: ThreadPoolExecutor):
                while not state.cancelled and len(state.processed_urls) < max_urls:
                    try:
                        priority, item = await asyncio.wait_for(state.urls_queue.get(), timeout=1.0)
                        url, anchor_text, parent_relevance, depth, university = item
                        if state.cancelled:
                            logger.debug("Worker stopped due to cancellation")
                            state.urls_queue.task_done()
                            break
                        try:
                            collected = await asyncio.wait_for(
                                _collect_process_url(process_url, url, anchor_text, parent_relevance, depth, university, executor),
                                timeout=60.0
                            )
                            for entity_data in collected:
                                await manager.send_message(session_id, {
                                    'status': 'entity',
                                    'data': entity_data
                                })
                        except asyncio.TimeoutError:
                            metrics.record_timeout()
                            logger.warning(f"Per-URL timeout (60s) for {url}")
                            await manager.send_message(session_id, {
                                'status': 'error',
                                'url': url,
                                'reason': 'Processing timed out for this URL. Skipping.'
                            })
                        state.urls_queue.task_done()
                    except asyncio.TimeoutError:
                        if state.urls_queue.empty() and not state.current_urls:
                            logger.debug("Queue empty and no URLs in progress, exiting worker")
                            break
                        continue
                    except asyncio.CancelledError:
                        logger.debug("Worker cancelled")
                        break
                    except Exception as e:
                        logger.error(f"Worker error: {str(e)}")
                        await manager.send_message(session_id, {
                            'status': 'error',
                            'url': None,
                            'reason': sanitize_error(e, "scraper worker")
                        })
            
            logger.debug(f"Starting {max_workers} workers for session {session_id}")
            workers = [
                asyncio.create_task(worker(executor))
                for _ in range(max_workers)
            ]
                
            try:
                await asyncio.wait_for(
                    asyncio.gather(*workers, return_exceptions=True),
                    timeout=timeout_seconds
                )
            except asyncio.TimeoutError:
                logger.info(f"Scraper timeout after {timeout_seconds} seconds")
                state.cancelled = True
                for worker in workers:
                    worker.cancel()
            except asyncio.CancelledError:
                logger.info(f"Scraper workflow cancelled for session {session_id}")
                state.cancelled = True
                for worker in workers:
                    worker.cancel()
            finally:
                state.cancelled = True
                for worker in workers:
                    if not worker.done():
                        worker.cancel()
                # Await cancelled workers to suppress "exception was never retrieved" warnings
                try:
                    await asyncio.gather(*workers, return_exceptions=True)
                except Exception:
                    pass
                metrics.log_summary()
                logger.info(f"Scraper workflow completed for session {session_id}")
                # Complete message is sent by query_processor.py to avoid duplicates
    
    except asyncio.CancelledError:
        logger.info(f"Scraper workflow cancelled for session {session_id}")
        await manager.send_message(session_id, {
            'status': 'stopped',
            'message': 'Scraper stopped'
        })
    except Exception as e:
        logger.error(f"Workflow error for session {session_id}: {str(e)}")
        await manager.send_message(session_id, {
            'status': 'error',
            'url': None,
            'reason': sanitize_error(e, f"workflow for {session_id}")
        })