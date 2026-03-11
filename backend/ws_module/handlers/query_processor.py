import asyncio
import json
import logging
import time
import os
import re
from urllib.parse import urlparse
from utils.recommendations import suggest_related_queries
from .config import (
    config, GLOBAL_EXECUTOR, EDUCATIONAL_DOMAINS, ACADEMIC_REPOSITORIES,
    PAPER_KEYWORDS, DATA_DIR
)
from utils.workflow import run_scraper_workflow
from utils.google_search import search_with_meta
from utils.query_refiner import refine_query
from utils.database import save_query, async_session, check_and_reconnect, save_entity, save_user_entity_link, get_session_by_id, save_session
from ws_module.manager import manager, ScraperState
from typing import AsyncGenerator
from datetime import datetime
from fastapi import WebSocket
from jose import jwt
from utils.recaptcha import verify_recaptcha
from .error_sanitizer import sanitize_error
from dotenv import load_dotenv

load_dotenv()
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
JWT_ALGORITHM = "HS256"

logger = logging.getLogger(__name__)

async def handle_new_query(session_id: str, state: ScraperState, query: str, type: str = "general") -> AsyncGenerator[dict, None]:
    """Process a new query, perform search based on type (publications, websites, or general), and yield entity data."""
    if not query:
        logger.error(f"No query provided for session {session_id}")
        await manager.send_message(session_id, {
            'status': 'error',
            'url': None,
            'reason': 'No query provided'
        })
        return

    # Validate search type
    valid_types = ['publications', 'websites', 'general']
    if type not in valid_types:
        logger.warning(f"Invalid search type '{type}' for session {session_id}, defaulting to 'general'")
        type = 'general'
    logger.info(f"Starting new query for {session_id}: query='{query}', type='{type}'")

    state.is_running = True
    state.cancelled = False

    try:
        # Retrieve user_id from state, default to None for guests
        user_id = getattr(state, 'user_id', None)
        logger.debug(f"User ID for session {session_id}: {user_id or 'guest'}")

        # Validate or create session
        async with async_session() as db:
            session = await get_session_by_id(db, session_id, user_id)
            if not session:
                logger.warning(f"Session {session_id} not found or not authorized, creating new session")
                effective_title = query or "Untitled Session"
                session = await save_session(db, user_id, title=effective_title)
                session_id = session.id
                state.session_id = session_id
                state.title = session.title
                manager.active_connections[session_id] = None  # No WebSocket in this context
                manager.scraper_states[session_id] = state
                await manager.send_message(session_id, {
                    'status': 'connected',
                    'sessionId': session_id,
                    'title': state.title,
                    'message': 'New session created due to invalid or missing session'
                })

        # Refine query to focus on universities and research
        refined_query = await refine_query(query)
        domain_filter = "site:*.*edu | site:*.org | site:*.gov"
        
        # Define queries based on type
        if type == 'publications':
            search_query = f"{refined_query} filetype:pdf paper journal {domain_filter}"
            max_results = config.get('DDGS_MAX_RESULTS', 15)
        elif type == 'websites':
            search_query = f"{refined_query} research lab innovation -filetype:pdf {domain_filter}"
            max_results = config.get('DDGS_MAX_RESULTS', 15)
        else:  # general
            pdf_query = f"{refined_query} filetype:pdf paper journal {domain_filter}"
            web_query = f"{refined_query} research lab innovation -filetype:pdf {domain_filter}"
            max_results = config.get('DDGS_MAX_RESULTS', 15)
            pdf_max = max_results - 3
            web_max = 3

        logger.info(f"Search query for {session_id}: {search_query if type in ['publications', 'websites'] else pdf_query + ' | ' + web_query}")

        # Step 1: Perform search
        results = []
        if type == 'general':
            try:
                pdf_results = await search_with_meta(pdf_query, max_results=pdf_max)
                results.extend(pdf_results or [])
                logger.debug(f"Jina PDF search results for {session_id}: {len(pdf_results)} URLs")
            except Exception as e:
                logger.warning(f"Jina PDF search failed for {session_id}: {e}")
            try:
                web_results = await search_with_meta(web_query, max_results=web_max)
                results.extend(web_results or [])
                logger.debug(f"Jina web search results for {session_id}: {len(web_results)} URLs")
            except Exception as e:
                logger.warning(f"Jina web search failed for {session_id}: {e}")
        else:
            try:
                results = await search_with_meta(search_query, max_results=max_results)
                logger.debug(f"Jina {type.capitalize()} search results for {session_id}: {len(results)} URLs")
            except Exception as e:
                logger.warning(f"Jina {type.capitalize()} search failed for {session_id}: {e}")

        if not results:
            logger.error(f"No search results available for {session_id}")
            await manager.send_message(session_id, {
                'status': 'error',
                'url': None,
                'reason': 'No search results available'
            })
            return
        university_urls = [r['url'] for r in results if r.get('url')]

        # Step 2: Fast domain + keyword URL filtering (Phase 3.1)
        # Lightweight filter: accepts educational domains, academic repos, PDFs, and keyword matches.
        # Falls back to accepting all URLs if nothing passes the filter.
        _RELEVANCE_KEYWORDS = {
            'university', 'institute', 'college', 'research', 'lab', 'laboratory',
            'innovation', 'center', 'centre', 'faculty', 'department', 'science',
            'technology', 'engineering', 'academic', 'scholar',
        }
        university_urls_filtered = []
        for result in results:
            url = result.get('url')
            if not url:
                continue
            domain = urlparse(url).netloc.lower().replace('www.', '')
            title = result.get('title', '').lower()
            url_lower = url.lower()

            is_educational = any(domain.endswith(ed) for ed in EDUCATIONAL_DOMAINS)
            is_academic_repo = domain in ACADEMIC_REPOSITORIES
            is_pdf = url_lower.endswith('.pdf')
            is_keyword_match = any(kw in domain or kw in title or kw in url_lower for kw in _RELEVANCE_KEYWORDS)
            is_paper_related = any(kw in title or kw in url_lower for kw in PAPER_KEYWORDS)

            if is_educational or is_academic_repo or is_pdf or is_keyword_match or is_paper_related:
                university_urls_filtered.append(url)
                if len(university_urls_filtered) >= max_results:
                    break

        # Fallback: if filter rejected everything, accept all (Jina already does topic-level filtering)
        if not university_urls_filtered:
            logger.warning(f"No URLs passed filter for {session_id}, accepting all {len(university_urls)} URLs")
            university_urls_filtered = university_urls[:max_results]
        else:
            logger.info(f"Filtered URLs for {session_id}: {len(university_urls_filtered)}/{len(university_urls)} accepted")

        if not university_urls_filtered:
            logger.error(f"No relevant university or research URL found for {session_id}")
            await manager.send_message(session_id, {
                'status': 'error',
                'url': None,
                'reason': 'No relevant university or research URL found for the query'
            })
            return

        # Log result breakdown
        pdf_count = sum(1 for url in university_urls_filtered if url.lower().endswith('.pdf'))
        logger.info(f"Filtered URLs for {session_id}: {pdf_count} PDFs, {len(university_urls_filtered) - pdf_count} webpages")

        # Step 3: Extract university names from URLs
        universities_list = []
        def extract_university(domain: str, title: str, url: str) -> str:
            for keyword in ['university', 'institute', 'college']:
                if keyword in domain:
                    parts = domain.split('.')
                    idx = parts.index(keyword) if keyword in parts else -1
                    if idx >= 0:
                        return ' '.join(parts[:idx+1]).replace('-', ' ').title()
            return 'Unknown Institution'

        for result in results:
            url = result.get('url')
            if not url or url not in university_urls_filtered:
                continue
            domain = urlparse(url).netloc.lower().replace('www.', '')
            title = result.get('title', '').lower()
            university = extract_university(domain, title, url)
            universities_list.append({
                'university': university,
                'url': url,
                'title': result.get('title', ''),
                'description': result.get('description', '')
            })

        # Step 4: Sort and filter universities_list
        universities_list = sorted(
            universities_list,
            key=lambda x: x['university'] != 'Unknown Institution',
            reverse=True
        )
        logger.debug(f"Parsed universities for {session_id}: {universities_list}")

        # Step 5: Proceed even if universities are Unknown Institution
        if not universities_list:
            logger.warning(f"No URLs in universities_list for {session_id}, using filtered URLs")
            universities_list = [{'university': 'Unknown Institution', 'url': url, 'title': '', 'description': ''} 
                                for url in university_urls_filtered]

        logger.info(f"Final universities list for {session_id}: {universities_list}")

        # Step 6: Log domains (file I/O removed — data is in DB)
        domains = set()
        for item in universities_list:
            domain = urlparse(item['url']).netloc.lower().replace('www.', '')
            domains.add(domain)
        logger.info(f"Domains for {session_id}: {domains}")

        # Query already saved by websocket_manager before queuing

        # Step 8: Start scraper workflow and yield entity data
        try:
            first_url = universities_list[0]['url']
            domain = urlparse(first_url).netloc.lower().replace('www.', '')
            domain_parts = domain.split('.')
            base_domain = '.'.join(domain_parts[-2:]) if len(domain_parts) >= 2 else domain

            async for scraped_data in run_scraper_workflow(
                session_id,
                user_id,
                universities_list,
                query,
                base_domain,
                state,
                GLOBAL_EXECUTOR,
                max_links_per_page=config.get('MAX_LINKS_PER_PAGE', 5)
            ):
                if state.cancelled:
                    logger.info(f"Scraper cancelled for {session_id}")
                    break
                # Ensure scraped_data includes all required fields
                entity_data = {
                    'url': scraped_data.get('url'),
                    'source': 'scraped',
                    'university': scraped_data.get('university', 'Unknown Institution'),
                    'location': scraped_data.get('location', {}),
                    'website': scraped_data.get('website'),
                    'edurank': scraped_data.get('edurank', {}),
                    'department': scraped_data.get('department', {}),
                    'publications': scraped_data.get('publications', {'count': 0, 'items': []}),
                    'related': scraped_data.get('related', ''),
                    'point_of_contact': scraped_data.get('point_of_contact', {}),
                    'scopes': scraped_data.get('scopes', []),
                    'research_abstract': scraped_data.get('research_abstract', ''),
                    'lab_equipment': scraped_data.get('lab_equipment', {}),
                    'embeddings': scraped_data.get('embeddings', {}),
                    'images': scraped_data.get('images', []),
                    'last_updated': scraped_data.get('last_updated', datetime.utcnow().isoformat())
                }
                # Save entity to database
                async with async_session() as db:
                    db = await check_and_reconnect(db)
                    entity = await save_entity(db, session_id, entity_data, user_id)
                    if entity and user_id:
                        await save_user_entity_link(db, user_id, str(entity.id), 'viewed')
                yield entity_data
                logger.debug(f"Yielded entity data for {session_id}: {entity_data['url']}")

        except (asyncio.TimeoutError, asyncio.CancelledError, Exception) as e:
            logger.error(f"Scraper workflow failed for {session_id}: {str(e)}")
            if isinstance(e, asyncio.TimeoutError):
                state.task.cancel()
                try:
                    await state.task
                except Exception:
                    pass
                await manager.send_message(session_id, {
                    'status': 'error',
                    'url': first_url,
                    'reason': 'Scraper workflow timed out'
                })
            elif isinstance(e, asyncio.CancelledError):
                logger.info(f"Scraper task cancelled for {session_id}")
            else:
                await manager.send_message(session_id, {
                    'status': 'error',
                    'url': first_url,
                    'reason': sanitize_error(e, f"scraper workflow for {session_id}")
                })
            return

        # Step 9: Generate and send query suggestions
        try:
            async with async_session() as db:
                db = await check_and_reconnect(db)
                suggestions = await suggest_related_queries(db, session_id, query, top_n=3)
                logger.info(f"Generated suggestions for {session_id}: {suggestions}")
                if suggestions and not state.cancelled:
                    await manager.send_message(session_id, {
                        'status': 'recommendations',
                        'suggestions': suggestions,
                        'message': 'Related query suggestions based on scraped results'
                    })
                    logger.info(f"Sent {len(suggestions)} query suggestions for session {session_id}")
                else:
                    logger.warning(f"No suggestions generated or cancelled for session {session_id}")
                    await manager.send_message(session_id, {
                        'status': 'recommendations',
                        'suggestions': [],
                        'message': 'No related query suggestions available'
                    })
        except Exception as e:
            logger.error(f"Failed to generate suggestions for {session_id}: {str(e)}")
            await manager.send_message(session_id, {
                'status': 'recommendations',
                'suggestions': [],
                'message': 'Failed to generate query suggestions'
            })

    except Exception as e:
        logger.error(f"Unexpected error in handle_new_query for {session_id}: {str(e)}")
        await manager.send_message(session_id, {
            'status': 'error',
            'url': None,
            'reason': sanitize_error(e, f"handle_new_query for {session_id}")
        })
    finally:
        state.is_running = False
        state.task = None
        while not state.urls_queue.empty():
            try:
                await state.urls_queue.get()
                state.urls_queue.task_done()
            except Exception:
                pass
        if not state.cancelled:
            try:
                await manager.send_message(session_id, {
                    'status': 'complete',
                    'message': 'Scraping completed'
                })
                logger.info(f"Sent complete message for {session_id}")
            except Exception as e:
                logger.error(f"Failed to send complete message for {session_id}: {e}")