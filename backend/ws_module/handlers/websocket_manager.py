import asyncio
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect
from ws_module.manager import manager, ScraperState
from .query_processor import handle_new_query
from .cancel_handler import handle_cancel
from .error_sanitizer import sanitize_error
from utils.database import get_db, get_session_by_id, save_session, save_query, save_entity, save_user_entity_link, async_session
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError, jwt
from models.db_models import Entity, Session
from dotenv import load_dotenv
import os
from sqlalchemy.sql import text
from datetime import datetime
import uuid
from utils.recaptcha import verify_recaptcha
from sqlalchemy import update
from sqlalchemy.orm import selectinload
from sqlalchemy.future import select

load_dotenv()
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
JWT_ALGORITHM = "HS256"

logger = logging.getLogger(__name__)

async def get_current_user(token: str, db: AsyncSession = None):
    """Validate JWT token and return user_id, or None for guest."""
    if not token:
        logger.debug("No token provided, treating as guest")
        return None
    try:
        if token.startswith("Bearer "):
            token = token[len("Bearer "):]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            logger.warning("Invalid token: No user_id")
            raise ValueError("Invalid token: No user_id")
        # Use provided db or create a fresh session
        if db:
            result = await db.execute(
                text("SELECT id FROM users WHERE id = :user_id"),
                {"user_id": user_id}
            )
            user = result.scalars().first()
        else:
            async with async_session() as session:
                result = await session.execute(
                    text("SELECT id FROM users WHERE id = :user_id"),
                    {"user_id": user_id}
                )
                user = result.scalars().first()
        if user is None:
            logger.warning(f"User not found: {user_id}")
            raise ValueError("User not found")
        logger.debug(f"Authenticated user: {user_id}")
        return user_id
    except JWTError as e:
        logger.error(f"Invalid token: {str(e)}")
        raise ValueError(f"Invalid token: {str(e)}")

async def websocket_endpoint(websocket: WebSocket):
    """Handle WebSocket connections and messages with session synchronization."""
    logger.info("Received WebSocket connection attempt")
    session_id = None
    user_id = None
    state = None
    query_processor = None
    try:
        await websocket.accept()
        state = ScraperState()
        state.query_queue = asyncio.Queue()

        async def process_query_queue():
            """Process queued queries for the session."""
            while True:
                query_data = await state.query_queue.get()
                if query_data is None:
                    break
                try:
                    query = query_data.get('query')
                    query_type = query_data.get('type', 'general')
                    recaptcha_response = query_data.get('recaptchaResponse')
                    session_id = query_data.get('sessionId')
                    if not query:
                        logger.warning(f"No query provided in queue for session {session_id}")
                        await manager.send_message(session_id, {
                            'status': 'error',
                            'url': None,
                            'reason': 'No query provided'
                        })
                        continue
                    if not user_id and not recaptcha_response:
                        logger.warning(f"reCAPTCHA required for guest query in session {session_id}")
                        await manager.send_message(session_id, {
                            'status': 'error',
                            'url': None,
                            'reason': 'reCAPTCHA required'
                        })
                        continue
                    if not user_id and not await verify_recaptcha(recaptcha_response):
                        logger.warning(f"Invalid reCAPTCHA for guest query in session {session_id}")
                        await manager.send_message(session_id, {
                            'status': 'error',
                            'url': None,
                            'reason': 'Invalid reCAPTCHA'
                        })
                        continue
                    valid_types = ['publications', 'websites', 'general']
                    if query_type not in valid_types:
                        logger.warning(f"Invalid search type '{query_type}' for session {session_id}, defaulting to 'general'")
                        query_type = 'general'
                    logger.info(f"Processing query for {session_id}: user_id='{user_id or 'guest'}', query='{query}', type='{query_type}'")
                    async with async_session() as db:
                        await save_query(db, query, session_id)
                    async for entity_data in handle_new_query(session_id, state, query, query_type):
                        async with async_session() as db:
                            entity = await save_entity(db, session_id, entity_data, user_id)
                            if entity:
                                # Explicitly load images in async context
                                result = await db.execute(
                                    select(Entity)
                                    .options(selectinload(Entity.images))
                                    .where(Entity.id == entity.id)
                                )
                                entity = result.scalars().first()
                                entity_response = {
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
                                    'timestamp': entity.timestamp.isoformat(),
                                    'last_updated': entity.last_updated.isoformat(),
                                    'embeddings': entity.get_json_field('embeddings'),
                                    'images': [
                                        {
                                            'id': img.id,
                                            'url': img.url,
                                            'caption': img.caption,
                                            'is_primary': img.is_primary,
                                            'uploaded_by_user_id': str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                                            'created_at': img.created_at.isoformat()
                                        } for img in entity.images
                                    ]
                                }
                                if user_id:
                                    await save_user_entity_link(db, user_id, str(entity.id), 'viewed')
                                await manager.send_message(session_id, {
                                    'status': 'entity',
                                    'data': entity_response,
                                    'message': f'Entity saved for query: {query}'
                                })
                                logger.info(f"Sent entity message for {entity.url} in session {session_id}")
                except Exception as e:
                    logger.error(f"Error processing queued query for {session_id}: {str(e)}", exc_info=True)
                    await manager.send_message(session_id, {
                        'status': 'error',
                        'url': None,
                        'reason': sanitize_error(e, f"query processing for {session_id}")
                    })
                finally:
                    state.query_queue.task_done()

        query_processor = asyncio.create_task(process_query_queue())

        while True:
            data = await websocket.receive_text()
            logger.info(f"Received message: {data}")
            try:
                message = json.loads(data)
                token = message.get('token')
                session_id = message.get('sessionId')
                title = message.get('title')
                description = message.get('description')
                query = message.get('query')
                action = message.get('action')

                # Authenticate user
                if token and not user_id:
                    user_id = await get_current_user(token)
                    state.user_id = user_id
                    logger.debug(f"Authenticated user {user_id}")

                # Handle session
                async with async_session() as db:
                    if session_id:
                        session = await get_session_by_id(db, session_id, user_id)
                        if session:
                            state.session_id = session_id
                            state.title = session.title or title or query or "Untitled Session"
                            updates = {}
                            if title and (not session.title or session.title != title):
                                updates['title'] = title
                            if description and session.description != description:
                                updates['description'] = description
                            if updates:
                                await db.execute(
                                    update(Session).where(Session.id == session_id).values(**updates)
                                )
                                await db.commit()
                                logger.info(f"Updated session {session_id} with {updates}")
                            if session_id not in manager.active_connections:
                                manager.active_connections[session_id] = websocket
                                manager.scraper_states[session_id] = state
                            await manager.send_message(session_id, {
                                'status': 'connected',
                                'sessionId': str(session.id),
                                'title': session.title,
                                'description': session.description,
                                'is_active': session.is_active,
                                'metadata_': session.metadata_,
                                'message': f'Continuing session: {session_id}'
                            })
                        else:
                            logger.warning(f"Session {session_id} not found or not authorized, creating new session")
                            effective_title = title or query or "Untitled Session"
                            session = await save_session(db, user_id, title=effective_title, description=description)
                            session_id = str(session.id)
                            state.session_id = session_id
                            state.title = session.title
                            manager.active_connections[session_id] = websocket
                            manager.scraper_states[session_id] = state
                            await manager.send_message(session_id, {
                                'status': 'connected',
                                'sessionId': str(session.id),
                                'title': session.title,
                                'description': session.description,
                                'is_active': session.is_active,
                                'metadata_': session.metadata_,
                                'message': 'New session created due to invalid or missing session'
                            })
                    else:
                        effective_title = title or query or "Untitled Session"
                        session = await save_session(db, user_id, title=effective_title, description=description)
                        session_id = str(session.id)
                        state.session_id = session_id
                        state.title = session.title
                        manager.active_connections[session_id] = websocket
                        manager.scraper_states[session_id] = state
                        await manager.send_message(session_id, {
                            'status': 'connected',
                            'sessionId': str(session.id),
                            'title': session.title,
                            'description': session.description,
                            'is_active': session.is_active,
                            'metadata_': session.metadata_,
                            'message': 'New session created'
                        })

                # Handle messages
                if query or action == 'new_query':
                    query_type = message.get('type', 'general')
                    recaptcha_response = message.get('recaptchaResponse')
                    if not state.session_id:
                        async with async_session() as db:
                            effective_title = title or query or "Untitled Session"
                            session = await save_session(db, user_id, title=effective_title, description=description)
                            session_id = str(session.id)
                            state.session_id = session_id
                            state.title = effective_title
                            manager.active_connections[session_id] = websocket
                            manager.scraper_states[session_id] = state
                            await manager.send_message(session_id, {
                                'status': 'connected',
                                'sessionId': str(session.id),
                                'title': session.title,
                                'description': session.description,
                                'is_active': session.is_active,
                                'metadata_': session.metadata_,
                                'message': 'New session created for query'
                            })
                    logger.debug(f"Queuing query for session {session_id}: user_id='{user_id or 'guest'}', query='{query}', type='{query_type}'")
                    await state.query_queue.put({
                        'query': query,
                        'type': query_type,
                        'recaptchaResponse': recaptcha_response,
                        'sessionId': session_id,
                        'title': state.title
                    })
                    await manager.send_message(session_id, {
                        'status': 'queued',
                        'message': f'Query "{query}" (type: {query_type}) queued for processing',
                        'sessionId': session_id,
                        'title': state.title,
                        'description': description
                    })
                elif action == 'cancel':
                    logger.debug(f"Processing cancel action for session {session_id}")
                    await handle_cancel(session_id, state)
                else:
                    logger.debug(f"Session ID confirmation for {session_id}")
                    await manager.send_message(session_id, {
                        'status': 'connected',
                        'sessionId': session_id,
                        'title': state.title,
                        'description': description,
                        'is_active': True,
                        'metadata_': {},
                        'message': 'Session ID confirmed'
                    })

            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON received for {session_id}: {str(e)}")
                await manager.send_message(session_id, {
                    'status': 'error',
                    'url': None,
                    'reason': 'Invalid message format. Please try again.'
                })
            except Exception as e:
                logger.error(f"Error processing message for {session_id}: {str(e)}", exc_info=True)
                await manager.send_message(session_id, {
                    'status': 'error',
                    'url': None,
                    'reason': sanitize_error(e, f"message processing for {session_id}")
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for {session_id}")
        if session_id:
            await state.query_queue.put(None)
            await manager.disconnect(session_id)
            if user_id:
                try:
                    async with async_session() as db:
                        await db.execute(
                            text("UPDATE sessions SET end_time = :end_time, status = :status, is_active = :is_active WHERE id = :session_id"),
                            {
                                "session_id": session_id,
                                "end_time": datetime.utcnow(),
                                "status": "disconnected",
                                "is_active": False
                            }
                        )
                        await db.commit()
                except Exception as e:
                    logger.error(f"Failed to update session on disconnect: {e}")
    except Exception as e:
        logger.error(f"WebSocket error for {session_id}: {str(e)}", exc_info=True)
        if session_id:
            try:
                await manager.send_message(session_id, {
                    'status': 'error',
                    'url': None,
                    'reason': sanitize_error(e, f"websocket for {session_id}")
                })
            except Exception as send_err:
                logger.error(f"Failed to send error message for {session_id}: {send_err}")
            finally:
                await state.query_queue.put(None)
                await manager.disconnect(session_id)
                if user_id:
                    try:
                        async with async_session() as db:
                            await db.execute(
                                text("UPDATE sessions SET end_time = :end_time, status = :status, is_active = :is_active WHERE id = :session_id"),
                                {
                                    "session_id": session_id,
                                    "end_time": datetime.utcnow(),
                                    "status": "error",
                                    "is_active": False
                                }
                            )
                            await db.commit()
                    except Exception as e:
                        logger.error(f"Failed to update session on error: {e}")
    finally:
        if session_id and state:
            await state.query_queue.put(None)
            if query_processor:
                query_processor.cancel()