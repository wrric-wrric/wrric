import asyncio
import json
import os
import logging
from datetime import datetime, timedelta, date
from sqlalchemy import text, insert, select, delete, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from typing import AsyncGenerator, Union
from sqlalchemy.exc import IntegrityError, InterfaceError
from sqlalchemy.orm import selectinload
import tenacity
import uuid
import bcrypt
import pandas as pd
from io import BytesIO
from models.db_models import Base, Query, Session, Entity, User, SharedSession, EntityImage, UserEntityLink, SessionEntity, Profile, Funder, Proposal, MatchRecord, Verification, EntityEmbedding, Publication, Notification, Message, ProfileBacklink, EcosystemEntityLink
import re
from dotenv import load_dotenv
from typing import Any, List, Optional, Dict
from sqlalchemy import func
from utils.embeddings import generate_funder_embeddings
from services.favicon_service import _enrich_with_favicons_parallel


load_dotenv(override=False)

logger = logging.getLogger(__name__)

# Database URL from environment
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required but not set")

# Log the URL being used (masked for security)
import logging
logger = logging.getLogger(__name__)
if 'localhost' in DATABASE_URL or '127.0.0.1' in DATABASE_URL:
    logger.warning(f"WARNING: DATABASE_URL contains localhost/127.0.0.1 - this may not work in Docker! URL: {DATABASE_URL[:20]}...")
else:
    logger.info(f"DATABASE_URL host: {DATABASE_URL.split('@')[1].split(':')[0] if '@' in DATABASE_URL else 'unknown'}")

# Create async engine for PostgreSQL
# Handle both postgresql:// and postgres:// formats
db_url = DATABASE_URL

# Log raw URL for debugging
logger.warning(f"RAW DATABASE_URL: {db_url}")

if db_url.startswith('postgres://'):
    db_url = 'postgresql+asyncpg://' + db_url[9:]
    logger.warning(f"Converted to asyncpg: {db_url[:50]}...")
elif db_url.startswith('postgresql://'):
    db_url = 'postgresql+asyncpg://' + db_url[12:]
elif db_url.startswith('postgresql:'):
    db_url = re.sub(r'^postgresql:', 'postgresql+asyncpg:', db_url)

logger.warning(f"FINAL connection URL host: {db_url.split('@')[1].split(':')[0] if '@' in db_url else 'PARSE ERROR'}")

engine = create_async_engine(
    db_url,
    echo=False,
    pool_size=20,
    pool_recycle=300,
    pool_pre_ping=True,
    max_overflow=10,
    pool_timeout=30
)

# Create async session factory
async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def check_and_reconnect(db: AsyncSession) -> AsyncSession:
    """Check if the database connection is active and reconnect if necessary."""
    try:
        await asyncio.wait_for(db.execute(text("SELECT 1")), timeout=5.0)
        logger.debug("Database connection is active")
    except (InterfaceError, asyncio.TimeoutError) as e:
        logger.warning(f"Database connection issue: {str(e)}, attempting to reconnect...")
        try:
            # Rollback any pending transaction first
            try:
                await db.rollback()
            except Exception:
                pass
            await db.close()
            logger.info("Reconnected to database successfully")
        except Exception as reconnect_e:
            logger.error(f"Failed to reconnect to database: {str(reconnect_e)}", exc_info=True)
            raise
    except Exception as e:
        logger.error(f"Unexpected error checking database connection: {str(e)}", exc_info=True)
        raise
    return db

async def init_db():
    """Initialize the database and create tables."""
    try:
        async with engine.connect() as conn:
            conn = await check_and_reconnect(conn)
            await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
            await conn.commit()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info(f"Database initialized at {DATABASE_URL}")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}", exc_info=True)
        raise

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to provide an async database session."""
    async with AsyncSession(engine, expire_on_commit=False) as session:
        try:
            await check_and_reconnect(session)
            logger.debug("Yielding database session")
            yield session
            logger.debug("Committing database session")
            await asyncio.wait_for(session.commit(), timeout=15.0)
        except Exception as e:
            logger.error(f"Database session error: {str(e)}", exc_info=True)
            try:
                # Always try to rollback on error
                await session.rollback()
            except Exception as rollback_e:
                logger.error(f"Failed to rollback session: {str(rollback_e)}")
            raise
        finally:
            try:
                logger.debug("Closing database session")
                await session.close()
            except Exception as close_e:
                logger.error(f"Error closing session: {str(close_e)}")

# async def get_db() -> AsyncGenerator[AsyncSession, None]:
#     """Provide an async database session per request."""
#     async with AsyncSession(engine, expire_on_commit=False) as session:
#         try:
#             yield session
#         except Exception as e:
#             logger.error(f"DB session error: {e}", exc_info=True)
#             await session.rollback()
#             raise
#         finally:
#             await session.close()

def normalize_json_field(value: Any) -> Any:
    """Normalize JSON-serializable field for JSONB, handling None/empty/invalid values."""
    try:
        logger.debug(f"🔧 NORMALIZE_JSON_FIELD INPUT: type={type(value)}, value={repr(str(value)[:200]) if value is not None else 'None'}")
        
        if value is None or value == "":
            result = {} if not isinstance(value, list) else []
            logger.debug(f"🔧 NORMALIZE - None/empty case: returning {type(result)}")
            return result
        
        if isinstance(value, (dict, list)):
            logger.debug(f"🔧 NORMALIZE - Already dict/list: returning as-is")
            return value
        
        if isinstance(value, str):
            try:
                logger.debug(f"🔧 NORMALIZE - Attempting to parse JSON string")
                parsed = json.loads(value)
                logger.debug(f"🔧 NORMALIZE - JSON parse successful: type={type(parsed)}, value={repr(str(parsed)[:200]) if parsed else parsed}")
                return parsed
            except json.JSONDecodeError as e:
                logger.debug(f"🔧 NORMALIZE - JSON decode failed for string '{value[:100]}...', returning {{}}")
                return {}
        
        # Handle other types (int, float, bool, etc.)
        logger.debug(f"🔧 NORMALIZE - Other type {type(value)}: returning as-is")
        return value
        
    except Exception as e:
        logger.error(f"❌ NORMALIZE_JSON_FIELD ERROR: {str(e)}", exc_info=True)
        logger.error(f"❌ ERROR CONTEXT - value type: {type(value)}, value: {repr(str(value)[:200]) if value is not None else 'None'}")
        return {}

def validate_email(email: str) -> bool:
    """Validate email format."""
    return bool(re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email))

async def create_user(db: AsyncSession, username: str, email: str, password: str, profile_image_url: Optional[str] = None) -> Optional[User]:
    """Create a new user with hashed password, email, optional profile image, and default profile."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Creating user: {username}, email: {email}")
        if not validate_email(email):
            logger.error(f"Invalid email format: {email}")
            return None
        if len(password) < 8:
            logger.error(f"Password too short for user {username}")
            return None
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user = User(
            id=uuid.uuid4(),
            username=username,
            email=email,
            password=hashed_password,
            profile_image_url=profile_image_url
        )
        db.add(user)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(user), timeout=15.0)

        # Create default profile
        default_profile = await create_default_profile(db, user.id, username, email, profile_image_url)
        if not default_profile:
            logger.error(f"Failed to create default profile for user {user.id}")
            # Rollback user creation if profile creation fails
            await db.rollback()
            return None

        logger.info(f"Created user: {username}, email: {email}, with default profile")
        return user
    except IntegrityError as e:
        logger.error(f"Failed to create user {username}: Username or email already exists")
        await db.rollback()
        return None
    except Exception as e:
        logger.error(f"Failed to create user {username}: {str(e)}", exc_info=True)
        await db.rollback()
        return None

async def authenticate_user(db: AsyncSession, username: Optional[str] = None, password: Optional[str] = None, email: Optional[str] = None) -> Optional[User]:
    """Authenticate a user by username or email and password."""
    db = await check_and_reconnect(db)
    try:
        if not password or (not username and not email):
            logger.warning("Authentication failed: username/email and password are required")
            return None
        identifier = email if email else username
        logger.debug(f"Initiating user authentication for identifier: {identifier}")
        query = select(User).where(User.email == email) if email else select(User).where(User.username == username)
        result = await asyncio.wait_for(db.execute(query), timeout=5.0)
        user = result.scalars().first()
        if not user:
            logger.warning(f"Authentication failed: user not found for identifier {identifier}")
            return None
        logger.debug(f"Found user: {user.username}, email: {user.email}, checking password")
        if not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
            logger.warning(f"Authentication failed: incorrect password for user {user.username}")
            return None
        logger.info(f"User {user.username} authenticated successfully")
        return user
    except asyncio.TimeoutError:
        logger.error("Authentication timed out after 5 seconds")
        return None
    except Exception as e:
        logger.error(f"Error during authentication for {email if email else username}: {str(e)}", exc_info=True)
        return None


async def get_user_history(db: AsyncSession, user_id: str) -> List[dict]:
    """Retrieve all user history including sessions, queries, entities, images, and favicons."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving history for user: {user_id}")
        
        result = await asyncio.wait_for(
            db.execute(
                select(Session)
                .where(Session.user_id == user_id)
                .order_by(Session.start_time.desc())
                .options(
                    selectinload(Session.queries),
                    selectinload(Session.session_entities)
                        .selectinload(SessionEntity.entity)
                        .selectinload(Entity.images),
                    selectinload(Session.session_entities)
                        .selectinload(SessionEntity.entity)
                        .selectinload(Entity.user_links)
                )
            ),
            timeout=15.0
        )
        sessions = result.scalars().all()
        logger.debug(f"Total sessions found for user {user_id}: {len(sessions)}")

        history = []
        all_entity_payloads: List[Dict[str, Any]] = []  # For parallel favicon fetching
        session_entity_map: List[tuple[int, int]] = []  # (session_idx, entity_idx in session)

        # First pass: build all entity payloads and collect for favicon batching
        for session_idx, session in enumerate(sessions):
            logger.debug(f"Processing session id: {session.id}, active: {session.is_active}, title: {session.title}")
            effective_title = session.title
            if not effective_title or effective_title.lower() in ["untitled session", "new session"] or effective_title.startswith("Session "):
                first_query = next((q for q in session.queries if q.query_text), None)
                effective_title = (
                    first_query.query_text[:50] + ("..." if first_query and len(first_query.query_text) > 50 else "")
                    if first_query else f"Session {str(session.id)[:8]}"
                )

            session_entities = []
            for entity_idx, se in enumerate(session.session_entities):
                entity = se.entity
                entity_data = {
                    "id": str(entity.id),
                    "url": entity.url,
                    "source": entity.source,
                    "created_by_user_id": str(entity.created_by_user_id) if entity.created_by_user_id else None,
                    "university": entity.university,
                    "location": entity.get_json_field("location"),
                    "website": entity.website or None,  # ← needed for favicon
                    "edurank": entity.get_json_field("edurank"),
                    "department": entity.get_json_field("department"),
                    "publications_meta": entity.get_json_field("publications_meta"),
                    "related": entity.related,
                    "point_of_contact": entity.get_json_field("point_of_contact"),
                    "scopes": entity.get_json_field("scopes"),
                    "research_abstract": entity.research_abstract,
                    "lab_equipment": entity.get_json_field("lab_equipment"),
                    "timestamp": entity.timestamp.isoformat() if isinstance(entity.timestamp, datetime) else entity.timestamp,
                    "last_updated": entity.last_updated.isoformat() if isinstance(entity.last_updated, datetime) else entity.last_updated,
                    "embeddings": entity.get_json_field("embeddings"),
                    "images": [
                        {
                            "id": str(img.id),
                            "url": img.url,
                            "caption": img.caption,
                            "is_primary": img.is_primary,
                            "uploaded_by_user_id": str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                            "created_at": img.created_at.isoformat() if isinstance(img.created_at, datetime) else img.created_at
                        } for img in entity.images
                    ],
                    "user_interactions": [
                        {
                            "interaction_type": link.interaction_type,
                            "notes": link.notes,
                            "metadata_": link.metadata_,
                            "timestamp": link.timestamp.isoformat() if isinstance(link.timestamp, datetime) else link.timestamp
                        } for link in entity.user_links if link.user_id == uuid.UUID(user_id)
                    ]
                }
                session_entities.append(entity_data)
                all_entity_payloads.append(entity_data)
                session_entity_map.append((session_idx, entity_idx))

            # Temporarily store entities (will be replaced after favicon enrichment)
            history.append({
                "id": str(session.id),
                "title": effective_title,
                "original_title": session.title,
                "description": session.description,
                "start_time": session.start_time.isoformat() if isinstance(session.start_time, datetime) else session.start_time,
                "end_time": session.end_time.isoformat() if session.end_time else None,
                "status": session.status,
                "is_active": session.is_active,
                "metadata_": session.metadata_,
                "queries": [
                    {
                        "id": str(query.id),
                        "query_text": query.query_text,
                        "timestamp": query.timestamp.isoformat() if isinstance(query.timestamp, datetime) else query.timestamp
                    } for query in sorted(session.queries, key=lambda q: q.timestamp)
                ],
                "entities": session_entities  # placeholder
            })

        # Parallel favicon enrichment for ALL entities across ALL sessions
        if all_entity_payloads:
            enriched_payloads = await _enrich_with_favicons_parallel(all_entity_payloads)
        else:
            enriched_payloads = []

        # Replace placeholder entities with enriched ones
        for (session_idx, entity_idx), enriched in zip(session_entity_map, enriched_payloads):
            history[session_idx]["entities"][entity_idx] = enriched

        logger.debug(f"Retrieved {len(history)} sessions with queries, entities, and favicons for user {user_id}")
        return history

    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving history for user {user_id}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve history for user {user_id}: {str(e)}", exc_info=True)
        raise




# async def get_user_history(db: AsyncSession, user_id: str) -> List[dict]:
#     """Retrieve all user history including sessions, queries, entities, and images."""
#     db = await check_and_reconnect(db)
#     try:
#         logger.debug(f"Retrieving history for user: {user_id}")

#         # Fetch all sessions regardless of is_active
#         result = await asyncio.wait_for(
#             db.execute(
#                 select(Session)
#                 .where(Session.user_id == user_id)
#                 .order_by(Session.start_time.desc())
#                 .options(
#                     selectinload(Session.queries),
#                     selectinload(Session.session_entities)
#                         .selectinload(SessionEntity.entity)
#                         .selectinload(Entity.images),
#                     selectinload(Session.session_entities)
#                         .selectinload(SessionEntity.entity)
#                         .selectinload(Entity.user_links)
#                 )
#             ),
#             timeout=15.0
#         )

#         sessions = result.scalars().all()
#         logger.debug(f"Total sessions found for user {user_id} ignoring is_active filter: {len(sessions)}")

#         history = []
#         for session in sessions:
#             logger.debug(f"Processing session id: {session.id}, active: {session.is_active}, title: {session.title}")
#             effective_title = session.title
#             if not effective_title or effective_title.lower() in ["untitled session", "new session"] or effective_title.startswith("Session "):
#                 first_query = next((q for q in session.queries if q.query_text), None)
#                 effective_title = first_query.query_text[:50] + ("..." if first_query and len(first_query.query_text) > 50 else "") \
#                     if first_query else f"Session {str(session.id)[:8]}"

#             entities = []
#             for se in session.session_entities:
#                 entity = se.entity
#                 entity_data = {
#                     "id": str(entity.id),
#                     "url": entity.url,
#                     "source": entity.source,
#                     "created_by_user_id": str(entity.created_by_user_id) if entity.created_by_user_id else None,
#                     "university": entity.university,
#                     "location": entity.get_json_field("location"),
#                     "website": entity.website or None,
#                     "edurank": entity.get_json_field("edurank"),
#                     "department": entity.get_json_field("department"),
#                     "publications_meta": entity.get_json_field("publications_meta"),
#                     "related": entity.related,
#                     "point_of_contact": entity.get_json_field("point_of_contact"),
#                     "scopes": entity.get_json_field("scopes"),
#                     "research_abstract": entity.research_abstract,
#                     "lab_equipment": entity.get_json_field("lab_equipment"),
#                     "timestamp": entity.timestamp.isoformat(),
#                     "last_updated": entity.last_updated.isoformat(),
#                     "embeddings": entity.get_json_field("embeddings"),
#                     "images": [
#                         {
#                             "id": img.id,
#                             "url": img.url,
#                             "caption": img.caption,
#                             "is_primary": img.is_primary,
#                             "uploaded_by_user_id": str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
#                             "created_at": img.created_at.isoformat()
#                         } for img in entity.images
#                     ],
#                     "user_interactions": [
#                         {
#                             "interaction_type": link.interaction_type,
#                             "notes": link.notes,
#                             "metadata_": link.metadata_,
#                             "timestamp": link.timestamp.isoformat()
#                         } for link in entity.user_links if link.user_id == uuid.UUID(user_id)
#                     ]
#                 }
#                 entities.append(entity_data)

#             history.append({
#                 "id": str(session.id),
#                 "title": effective_title,
#                 "original_title": session.title,
#                 "description": session.description,
#                 "start_time": session.start_time.isoformat(),
#                 "end_time": session.end_time.isoformat() if session.end_time else None,
#                 "status": session.status,
#                 "is_active": session.is_active, 
#                 "metadata_": session.metadata_,
#                 "queries": [
#                     {
#                         "id": query.id,
#                         "query_text": query.query_text,
#                         "timestamp": query.timestamp.isoformat()
#                     } for query in sorted(session.queries, key=lambda q: q.timestamp)
#                 ],
#                 "entities": entities
#             })

#         logger.debug(f"Retrieved {len(history)} sessions with queries and entities for user {user_id}")
#         return history

#     except asyncio.TimeoutError as e:
#         logger.error(f"Database timeout retrieving history for user {user_id}: {str(e)}", exc_info=True)
#         raise
#     except Exception as e:
#         logger.error(f"Failed to retrieve history for user {user_id}: {str(e)}", exc_info=True)
#         raise



async def update_session_title(db: AsyncSession, session_id: str, new_title: str) -> bool:
    """Update the title of a session."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Updating title for session {session_id} to {new_title}")
        result = await asyncio.wait_for(
            db.execute(
                update(Session)
                .where(Session.id == session_id)
                .values(title=new_title)
            ),
            timeout=15.0
        )
        await asyncio.wait_for(db.commit(), timeout=15.0)
        logger.debug(f"Updated title for session {session_id}")
        return True
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout updating title for session {session_id}: {str(e)}", exc_info=True)
        await db.rollback()
        return False
    except Exception as e:
        logger.error(f"Failed to update title for session {session_id}: {str(e)}", exc_info=True)
        await db.rollback()
        return False
    

async def get_session_by_id(db: AsyncSession, session_id: str, user_id: Optional[str]) -> Optional[Session]:
    """Retrieve a session by ID, optionally filtered by user_id."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving session {session_id} for user {user_id or 'guest'}")
        query = select(Session).where(Session.id == session_id)
        if user_id:
            query = query.where(Session.user_id == user_id)
        query = query.options(
            selectinload(Session.queries),
            selectinload(Session.session_entities).selectinload(SessionEntity.entity).options(
                selectinload(Entity.images),
                selectinload(Entity.user_links)
            )
        )
        result = await asyncio.wait_for(db.execute(query), timeout=15.0)
        session = result.scalars().first()
        logger.debug(f"{'Found' if session else 'No'} session {session_id}")
        return session
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving session {session_id}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve session {session_id}: {str(e)}", exc_info=True)
        raise

async def get_session_by_title(db: AsyncSession, user_id: str, title: str) -> Optional[Session]:
    """Retrieve a session by user_id and title."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving session for user {user_id} with title {title}")
        result = await asyncio.wait_for(
            db.execute(
                select(Session)
                .where(Session.user_id == user_id)
                .where(Session.title == title)
                .where(Session.is_active == True)
                .options(
                    selectinload(Session.queries),
                    selectinload(Session.session_entities).selectinload(SessionEntity.entity).selectinload(Entity.images)
                )
            ),
            timeout=15.0
        )
        session = result.scalars().first()
        logger.debug(f"{'Found' if session else 'No'} session for user {user_id} with title {title}")
        return session
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving session for user {user_id}, title {title}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve session for user {user_id}, title {title}: {str(e)}", exc_info=True)
        raise

async def create_shared_session(db: AsyncSession, session_id: str, user_id: str) -> Optional[str]:
    """Create a shared session with a snapshot of queries and entities."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Creating shared session for session {session_id}, user {user_id}")
        query_result = await db.execute(
            select(Query).where(Query.session_id == session_id)
        )
        queries = [
            {
                'id': q.id,
                'query_text': q.query_text,
                'timestamp': q.timestamp.isoformat()
            } for q in query_result.scalars().all()
        ]
        entity_result = await db.execute(
            select(SessionEntity)
            .where(SessionEntity.session_id == session_id)
            .options(selectinload(SessionEntity.entity).selectinload(Entity.images))
        )
        entities = [
            {
                'id': str(se.entity.id),
                'url': se.entity.url,
                'source': se.entity.source,
                'created_by_user_id': str(se.entity.created_by_user_id) if se.entity.created_by_user_id else None,
                'university': se.entity.university,
                'location': se.entity.get_json_field('location'),
                'website': se.entity.website or None,
                'edurank': se.entity.get_json_field('edurank'),
                'department': se.entity.get_json_field('department'),
                'publications_meta': se.entity.get_json_field('publications_meta'),
                'related': se.entity.related,
                'point_of_contact': se.entity.get_json_field('point_of_contact'),
                'scopes': se.entity.get_json_field('scopes'),
                'research_abstract': se.entity.research_abstract,
                'lab_equipment': se.entity.get_json_field('lab_equipment'),
                'timestamp': se.entity.timestamp.isoformat(),
                'last_updated': se.entity.last_updated.isoformat(),
                'images': [
                    {
                        'id': img.id,
                        'url': img.url,
                        'caption': img.caption,
                        'is_primary': img.is_primary,
                        'uploaded_by_user_id': str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                        'created_at': img.created_at.isoformat()
                    } for img in se.entity.images
                ]
            } for se in entity_result.scalars().all()
        ]
        snapshot = {
            'queries': queries,
            'entities': entities
        }
        share_id = uuid.uuid4()
        shared_session = SharedSession(
            id=share_id,
            original_session_id=session_id,
            user_id=user_id if user_id else None,
            snapshot=snapshot,
            created_at=datetime.utcnow()
        )
        db.add(shared_session)
        await db.commit()
        await db.refresh(shared_session)
        logger.info(f"Created shared session {share_id} for session {session_id}")
        return str(share_id)
    except Exception as e:
        logger.error(f"Failed to create shared session for {session_id}: {str(e)}")
        await db.rollback()
        return None

async def get_shared_session(db: AsyncSession, share_id: str) -> Optional[dict]:
    """Retrieve a shared session by ID."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving shared session {share_id}")
        result = await db.execute(
            select(SharedSession).where(SharedSession.id == share_id)
        )
        shared_session = result.scalars().first()
        if not shared_session:
            logger.warning(f"Shared session {share_id} not found")
            return None
        return {
            'share_id': str(shared_session.id),
            'original_session_id': str(shared_session.original_session_id),
            'snapshot': shared_session.snapshot,
            'created_at': shared_session.created_at.isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to retrieve shared session {share_id}: {str(e)}")
        return None

async def export_session_data(db: AsyncSession, session_id: str) -> Optional[pd.DataFrame]:
    """Export session data as a DataFrame, including queries, entities, and images."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Exporting data for session {session_id}")
        query_result = await db.execute(
            select(Query).where(Query.session_id == session_id).order_by(Query.timestamp)
        )
        queries = [
            {
                'Query ID': q.id,
                'Query Text': q.query_text,
                'Query Timestamp': q.timestamp.isoformat().split('.')[0]
            } for q in query_result.scalars().all()
        ]
        entity_result = await db.execute(
            select(SessionEntity)
            .where(SessionEntity.session_id == session_id)
            .options(selectinload(SessionEntity.entity).selectinload(Entity.images))
            .order_by(SessionEntity.timestamp)
        )
        entities = []
        for se in entity_result.scalars().all():
            e = se.entity
            location = e.get_json_field('location') or {}
            edurank = e.get_json_field('edurank') or {}
            department = e.get_json_field('department') or {}
            publications = e.get_json_field('publications_meta') or {}
            point_of_contact = e.get_json_field('point_of_contact') or {}
            scopes = e.get_json_field('scopes') or []
            lab_equipment = e.get_json_field('lab_equipment') or {}
            entity_data = {
                'Entity ID': str(e.id),
                'URL': e.url or '',
                'Source': e.source,
                'Created By User ID': str(e.created_by_user_id) if e.created_by_user_id else '',
                'University': e.university or '',
                'Location Country': location.get('country', ''),
                'Location City': location.get('city', ''),
                'Location Address': location.get('address', ''),
                'Website': e.website or '',
                'EduRank Score': edurank.get('score', ''),
                'EduRank Rank': edurank.get('rank', ''),
                'Department Name': department.get('name', ''),
                'Department Faculty': ', '.join(department.get('faculty', [])) if department.get('faculty') else '',
                'Publications Count': len(publications.get('items', [])),
                'Publications Titles': '; '.join(pub.get('title', '') for pub in publications.get('items', [])) if publications.get('items') else '',
                'Related Links': e.related or '',
                'Point of Contact Name': point_of_contact.get('name', ''),
                'Point of Contact Email': point_of_contact.get('email', ''),
                'Point of Contact LinkedIn': point_of_contact.get('linkedin', ''),
                'Scopes': '; '.join(scopes) if scopes else '',
                'Research Abstract': e.research_abstract or '',
                'Lab Equipment': '; '.join(lab_equipment.get('items', [])) if lab_equipment.get('items') else '',
                'Entity Timestamp': e.timestamp.isoformat().split('.')[0] if e.timestamp else '',
                'Last Updated': e.last_updated.isoformat().split('.')[0] if e.last_updated else '',
                'Images': '; '.join(img.url for img in e.images) if e.images else ''
            }
            entities.append((se.timestamp, entity_data))

        all_columns = [
            'Query ID', 'Query Text', 'Query Timestamp',
            'Entity ID', 'URL', 'Source', 'Created By User ID', 'University',
            'Location Country', 'Location City', 'Location Address',
            'Website', 'EduRank Score', 'EduRank Rank', 'Department Name', 'Department Faculty',
            'Publications Count', 'Publications Titles', 'Related Links',
            'Point of Contact Name', 'Point of Contact Email', 'Point of Contact LinkedIn',
            'Scopes', 'Research Abstract', 'Lab Equipment', 'Entity Timestamp', 'Last Updated', 'Images'
        ]

        data = []
        for query in queries:
            data.append({
                **query,
                **{col: '' for col in all_columns if col not in query}
            })

        for entity_timestamp, entity in entities:
            matching_query = None
            for query in queries:
                query_timestamp = datetime.fromisoformat(query['Query Timestamp'])
                if query_timestamp <= entity_timestamp:
                    matching_query = query
                else:
                    break
            entity_row = {
                **entity,
                'Query ID': matching_query['Query ID'] if matching_query else '',
                'Query Text': matching_query['Query Text'] if matching_query else '',
                'Query Timestamp': matching_query['Query Timestamp'] if matching_query else ''
            }
            data.append({
                **entity_row,
                **{col: '' for col in all_columns if col not in entity_row}
            })

        df = pd.DataFrame(data, columns=all_columns)
        df['Query Timestamp'] = pd.to_datetime(df['Query Timestamp'], errors='coerce')
        df['Entity Timestamp'] = pd.to_datetime(df['Entity Timestamp'], errors='coerce')
        df = df.sort_values(by=['Query Timestamp', 'Entity Timestamp'], na_position='first')
        df['Query Timestamp'] = df['Query Timestamp'].apply(lambda x: x.isoformat().split('.')[0] if pd.notna(x) else '')
        df['Entity Timestamp'] = df['Entity Timestamp'].apply(lambda x: x.isoformat().split('.')[0] if pd.notna(x) else '')
        df = df.fillna('')
        logger.debug(f"Exported {len(data)} rows for session {session_id}")
        return df
    except Exception as e:
        logger.error(f"Failed to export session {session_id}: {str(e)}")
        return None

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, asyncio.CancelledError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying save_query (attempt {retry_state.attempt_number})")
)
async def save_query(db: AsyncSession, query: str, session_id: str):
    """Save a user query to the database, avoiding duplicates, and update session title if needed."""
    db = await check_and_reconnect(db)
    try:
        session_id_uuid = uuid.UUID(session_id)
        result = await asyncio.wait_for(
            db.execute(
                select(Query).where(Query.session_id == session_id_uuid).where(Query.query_text == query)
            ),
            timeout=15.0
        )
        exists = result.scalars().first() is not None
        if exists:
            logger.debug(f"Query '{query}' already exists for session {session_id}, skipping insert")
            return
        timestamp = datetime.utcnow()
        logger.debug(f"Saving query: {query} for session {session_id}")
        await asyncio.wait_for(
            db.execute(
                insert(Query).values(
                    session_id=session_id_uuid,
                    query_text=query,
                    timestamp=timestamp
                )
            ),
            timeout=15.0
        )
        result = await db.execute(
            select(Session).where(Session.id == session_id_uuid)
        )
        session = result.scalars().first()
        if session and (not session.title or session.title in ["Untitled Session", "New Session"] or session.title.startswith("Session ")):
            new_title = query[:50] + ("..." if len(query) > 50 else "")
            await update_session_title(db, session_id, new_title)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        logger.debug(f"Saved query: {query}")
    except asyncio.CancelledError as e:
        logger.warning(f"Query commit cancelled: {str(e)}")
        await db.rollback()
        raise
    except Exception as e:
        logger.error(f"Query save error for session {session_id}: {str(e)}", exc_info=True)
        await db.rollback()
        raise

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, asyncio.CancelledError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying save_session (attempt {retry_state.attempt_number})")
)
async def save_session(db: AsyncSession, user_id: Optional[str] = None, title: Optional[str] = None, description: Optional[str] = None) -> Session:
    """Create a new session for a user, allowing user_id to be None for guests."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Saving new session for user {user_id or 'guest'} with title {title or 'Untitled Session'}")
        session = Session(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id) if user_id else None,
            title=title or "Untitled Session",
            description=description,
            start_time=datetime.utcnow(),
            end_time=None,
            status="running",
            is_active=True,
            metadata_={}
        )
        db.add(session)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(session), timeout=15.0)
        logger.debug(f"Saved session: {session.id} for user {user_id or 'guest'} with title {session.title}")
        return session
    except asyncio.CancelledError as e:
        logger.warning(f"Session commit cancelled: {str(e)}")
        await db.rollback()
        raise
    except IntegrityError as e:
        logger.error(f"Integrity error saving session: {str(e)}")
        await db.rollback()
        raise
    except Exception as e:
        logger.error(f"Failed to save session: {str(e)}", exc_info=True)
        await db.rollback()
        raise

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, asyncio.CancelledError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying save_entity (attempt {retry_state.attempt_number})")
)
async def save_entity(db: AsyncSession, session_id: str, data: dict, user_id: Optional[str] = None) -> Optional[Entity]:
    """Save or update an entity, handling duplicates, and link to session."""
    db = await check_and_reconnect(db)
    try:
        url = data.get('url')
        source = data.get('source', 'scraped')
        logger.debug(f"=== SAVE_ENTITY START ===")
        logger.debug(f"URL: {url}, source: {source}, session_id: {session_id}, user_id: {user_id}")
        
        # DEBUG: Log all incoming data keys and types
        logger.debug(f"INCOMING DATA - All keys: {list(data.keys())}")
        for key, value in data.items():
            logger.debug(f"INCOMING DATA - {key}: type={type(value)}, value={repr(str(value)[:200]) if value else value}")
        
        json_fields = [
            'location', 'edurank', 'department', 'publications',
            'point_of_contact', 'scopes', 'lab_equipment', 'embeddings',
            'climate_tech_focus', 'climate_impact_metrics'
        ]
        
        # DEBUG: Check JSON fields before normalization
        logger.debug(f"=== CHECKING JSON FIELDS BEFORE NORMALIZATION ===")
        for field in json_fields:
            value = data.get(field)
            logger.debug(f"BEFORE NORMALIZE - {field}: type={type(value)}, value={repr(str(value)[:200]) if value else value}")
        
        session_id_uuid = uuid.UUID(session_id)
        stmt = select(Entity).where(Entity.url == url)
        result = await asyncio.wait_for(db.execute(stmt), timeout=15.0)
        existing_entity = result.scalars().first()
        TIMESTAMP_THRESHOLD_DAYS = 1
        update_needed = False
        
        if existing_entity:
            time_diff = datetime.utcnow() - existing_entity.timestamp
            if time_diff > timedelta(days=TIMESTAMP_THRESHOLD_DAYS):
                logger.debug(f"Entity for URL {url} is older than {TIMESTAMP_THRESHOLD_DAYS} days, updating")
                update_needed = True
            else:
                logger.info(f"Skipping duplicate URL: {url}")
                await db.execute(
                    insert(SessionEntity).values(
                        session_id=session_id_uuid,
                        entity_id=existing_entity.id,
                        timestamp=datetime.utcnow()
                    )
                )
                await db.commit()
                return existing_entity
        
        normalized_data = data.copy()
        
        # DEBUG: Normalization process
        logger.debug(f"=== NORMALIZATION PROCESS ===")
        for field in json_fields:
            original_value = data.get(field)
            logger.debug(f"NORMALIZING - {field}: original_type={type(original_value)}, original_value={repr(str(original_value)[:200]) if original_value else original_value}")
            normalized_data[field] = normalize_json_field(original_value)
            logger.debug(f"NORMALIZED - {field}: new_type={type(normalized_data[field])}, new_value={repr(str(normalized_data[field])[:200]) if normalized_data[field] else normalized_data[field]}")
        
        critical_fields = ['university', 'location', 'website', 'edurank', 'point_of_contact', 'publications']
        non_empty_critical = sum(
            1 for field in critical_fields
            if normalized_data.get(field) and normalized_data[field] not in [{}, [], ""]
        )
        
        logger.debug(f"=== CRITICAL FIELDS CHECK ===")
        for field in critical_fields:
            value = normalized_data.get(field)
            is_empty = value in [{}, [], ""] or not value
            logger.debug(f"CRITICAL FIELD - {field}: empty={is_empty}, value={repr(str(value)[:100]) if value else value}")
        logger.debug(f"Non-empty critical fields: {non_empty_critical}/6")
        
        if non_empty_critical < 2:
            logger.info(f"Skipping entity for URL {url} (only {non_empty_critical}/6 critical fields non-empty)")
            return None
        
        # DEBUG: Entity data construction
        logger.debug(f"=== ENTITY DATA CONSTRUCTION ===")
        entity_data = {
            'url': url,
            'source': source,
            'created_by_user_id': uuid.UUID(user_id) if user_id and source == 'user' else None,
            'university': normalized_data.get('university', ''),
            'location': normalized_data.get('location', {}),
            'website': normalized_data.get('website'),
            'edurank': normalized_data.get('edurank', {}),
            'department': normalized_data.get('department', {}),
            'publications_meta': normalized_data.get('publications', {'count': 0, 'items': []}),
            'related': normalized_data.get('related', ''),
            'point_of_contact': normalized_data.get('point_of_contact', {}),
            'scopes': normalized_data.get('scopes', []),
            'research_abstract': normalized_data.get('research_abstract', ''),
            'lab_equipment': normalized_data.get('lab_equipment', {}),
            'climate_tech_focus': normalized_data.get('climate_tech_focus', []),
            'climate_impact_metrics': normalized_data.get('climate_impact_metrics', {}),
            'timestamp': datetime.utcnow(),
            'last_updated': datetime.utcnow(),
            'embeddings': normalized_data.get('embeddings', {})
        }
        
        # DEBUG: Log final entity_data structure
        logger.debug(f"=== FINAL ENTITY_DATA ===")
        logger.debug(f"Entity_data keys: {list(entity_data.keys())}")
        for key, value in entity_data.items():
            if key in ['timestamp', 'last_updated']:
                logger.debug(f"ENTITY_DATA - {key}: {value}")
            else:
                logger.debug(f"ENTITY_DATA - {key}: type={type(value)}, value={repr(str(value)[:200]) if value else value}")
        
        images = normalized_data.get('images', [])
        logger.debug(f"Images to process: {len(images)}")
        
        # DEBUG: Database operation
        logger.debug(f"=== DATABASE OPERATION ===")
        logger.debug(f"Update needed: {update_needed}")
        
        if update_needed:
            stmt = (
                update(Entity)
                .where(Entity.url == url)
                .values(**entity_data)
                .returning(Entity)
            )
            logger.debug(f"UPDATE SQL: {str(stmt)}")
            result = await asyncio.wait_for(db.execute(stmt), timeout=15.0)
            entity = result.scalars().first()
            logger.info(f"Updated entity for URL: {url}")
        else:
            stmt = insert(Entity).values(**entity_data).returning(Entity)
            logger.debug(f"INSERT SQL: {str(stmt)}")
            result = await asyncio.wait_for(db.execute(stmt), timeout=15.0)
            entity = result.scalars().first()
            logger.info(f"Saved entity for URL: {url}")
        
        logger.debug(f"Entity result: {entity}")
        
        # DEBUG: Related records
        logger.debug(f"=== RELATED RECORDS ===")
        await db.execute(
            insert(SessionEntity).values(
                session_id=session_id_uuid,
                entity_id=entity.id,
                timestamp=datetime.utcnow()
            )
        )
        logger.debug(f"SessionEntity created for entity_id: {entity.id}")
        
        for i, img in enumerate(images):
            logger.debug(f"Processing image {i+1}: {img.get('url', 'no url')}")
            await db.execute(
                insert(EntityImage).values(
                    entity_id=entity.id,
                    url=img.get('url'),
                    caption=img.get('caption'),
                    is_primary=img.get('is_primary', False),
                    uploaded_by_user_id=uuid.UUID(user_id) if user_id else None,
                    created_at=datetime.utcnow()
                )
            )
        
        if user_id:
            await db.execute(
                insert(UserEntityLink).values(
                    user_id=uuid.UUID(user_id),
                    entity_id=entity.id,
                    interaction_type='created' if source == 'user' else 'viewed',
                    timestamp=datetime.utcnow()
                )
            )
            logger.debug(f"UserEntityLink created for user_id: {user_id}")
        
        logger.debug(f"=== COMMITTING TRANSACTION ===")
        await asyncio.wait_for(db.commit(), timeout=15.0)
        logger.debug("Transaction committed successfully")
        
        await asyncio.wait_for(db.refresh(entity), timeout=15.0)
        logger.debug(f"Entity refreshed: {entity.url}, ID: {entity.id}")
        
        logger.debug(f"=== SAVE_ENTITY COMPLETED SUCCESSFULLY ===")
        return entity
        
    except IntegrityError as e:
        logger.error(f"❌ INTEGRITY ERROR for URL {url}: {str(e)}", exc_info=True)
        await db.rollback()
        return None
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON DECODE ERROR for URL {url}: {str(e)}", exc_info=True)
        await db.rollback()
        return None
    except asyncio.TimeoutError as e:
        logger.error(f"❌ TIMEOUT ERROR for URL {url}: {str(e)}", exc_info=True)
        await db.rollback()
        return None
    except asyncio.CancelledError as e:
        logger.warning(f"⚠️ ENTITY COMMIT CANCELLED for URL {url}: {str(e)}")
        await db.rollback()
        raise
    except Exception as e:
        logger.error(f"❌ UNEXPECTED ERROR for URL {url}: {str(e)}", exc_info=True)
        logger.error(f"ERROR TYPE: {type(e).__name__}")
        logger.error(f"ERROR ARGS: {e.args}")
        import traceback
        logger.error(f"FULL TRACEBACK: {traceback.format_exc()}")
        await db.rollback()
        return None

async def get_entities_by_session(db: AsyncSession, session_id: str) -> List[Entity]:
    """Retrieve entities for a specific session."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving entities for session: {session_id}")
        result = await asyncio.wait_for(
            db.execute(
                select(SessionEntity)
                .where(SessionEntity.session_id == session_id)
                .options(selectinload(SessionEntity.entity).selectinload(Entity.images))
                .order_by(SessionEntity.timestamp)
            ),
            timeout=15.0
        )
        entities = [se.entity for se in result.scalars().all()]
        logger.debug(f"Retrieved {len(entities)} entities for session {session_id}")
        return entities
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving entities for session {session_id}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to get entities: {str(e)}", exc_info=True)
        raise

async def delete_entity(db: AsyncSession, entity_id: str) -> bool:
    """Delete an entity by ID."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Deleting entity with ID: {entity_id}")
        result = await asyncio.wait_for(
            db.execute(delete(Entity).where(Entity.id == entity_id)),
            timeout=15.0
        )
        await asyncio.wait_for(db.commit(), timeout=15.0)
        success = result.rowcount > 0
        logger.debug(f"Delete entity {entity_id}: {'success' if success else 'no rows affected'}")
        return success
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout deleting entity {entity_id}: {str(e)}", exc_info=True)
        await db.rollback()
        raise
    except Exception as e:
        logger.error(f"Failed to delete entity: {str(e)}", exc_info=True)
        await db.rollback()
        raise

async def delete_all_entities(db: AsyncSession) -> int:
    """Delete all entities."""
    db = await check_and_reconnect(db)
    try:
        logger.debug("Deleting all entities")
        result = await asyncio.wait_for(
            db.execute(delete(Entity)),
            timeout=15.0
        )
        await asyncio.wait_for(db.commit(), timeout=15.0)
        rowcount = result.rowcount
        logger.debug(f"Deleted {rowcount} entities")
        return rowcount
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout deleting all entities: {str(e)}", exc_info=True)
        await db.rollback()
        raise
    except Exception as e:
        logger.error(f"Failed to delete all entities: {str(e)}", exc_info=True)
        await db.rollback()
        raise

async def get_entity_by_url(db: AsyncSession, url: str) -> Optional[Entity]:
    """Retrieve an entity by URL."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving entity for URL: {url}")
        result = await asyncio.wait_for(
            db.execute(
                select(Entity)
                .where(Entity.url == url)
                .options(selectinload(Entity.images))
            ),
            timeout=15.0
        )
        entity = result.scalars().first()
        logger.debug(f"{'Entity found' if entity else 'Entity not found'} for URL: {url}")
        return entity
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving entity for URL {url}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve entity for URL {url}: {str(e)}", exc_info=True)
        raise


@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying save_entity_image for entity {retry_state.kwargs.get('entity_id')} (attempt {retry_state.attempt_number})")
)
async def save_entity_image(db: AsyncSession, entity_id: str, image_data: dict, user_id: Optional[str] = None) -> Optional[EntityImage]:
    """Save an image for an entity."""
    # Validate image_data
    if not isinstance(image_data, dict) or not image_data.get('url'):
        logger.error(f"Invalid image_data for entity {entity_id}: {image_data}")
        return None

    # Validate UUIDs
    try:
        entity_id_uuid = uuid.UUID(entity_id)
        user_id_uuid = uuid.UUID(user_id) if user_id else None
    except ValueError as e:
        logger.error(f"Invalid UUID for entity_id {entity_id} or user_id {user_id}: {str(e)}")
        return None

    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Saving image for entity {entity_id}")
        image = EntityImage(
            entity_id=entity_id_uuid,
            url=image_data.get('url'),
            caption=image_data.get('caption'),
            is_primary=image_data.get('is_primary', False),
            uploaded_by_user_id=user_id_uuid,
            created_at=datetime.utcnow()
        )
        db.add(image)
        try:
            await asyncio.wait_for(db.commit(), timeout=15.0)
        except asyncio.TimeoutError as e:
            logger.error(f"Timeout during commit for image of entity {entity_id}: {str(e)}")
            await db.rollback()
            raise
        try:
            await asyncio.wait_for(db.refresh(image), timeout=15.0)
        except asyncio.TimeoutError as e:
            logger.error(f"Timeout during refresh for image of entity {entity_id}: {str(e)}")
            await db.rollback()
            raise
        logger.debug(f"Saved image for entity {entity_id}")
        return image
    except IntegrityError as e:
        logger.error(f"Failed to save image for entity {entity_id}: IntegrityError - {str(e)}", exc_info=True)
        await db.rollback()
        return None
    except asyncio.TimeoutError:
        # Raised by the specific timeout blocks above
        return None
    except asyncio.CancelledError as e:
        logger.warning(f"Image commit cancelled for entity {entity_id}: {str(e)}")
        await db.rollback()
        raise
    except Exception as e:
        logger.error(f"Failed to save image for entity {entity_id}: Unexpected error - {str(e)}", exc_info=True)
        await db.rollback()
        return None
    

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, asyncio.CancelledError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying save_user_entity_link (attempt {retry_state.attempt_number})")
)
async def save_user_entity_link(db: AsyncSession, user_id: str, entity_id: str, interaction_type: str, notes: str = "", metadata_: dict = {}) -> Optional[UserEntityLink]:
    """Save a user-entity interaction link."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Saving user-entity link for user {user_id}, entity {entity_id}, type {interaction_type}")
        link = UserEntityLink(
            user_id=uuid.UUID(user_id),
            entity_id=uuid.UUID(entity_id),
            interaction_type=interaction_type,
            notes=notes,
            metadata_=normalize_json_field(metadata_),
            timestamp=datetime.utcnow()
        )
        db.add(link)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(link), timeout=15.0)
        logger.debug(f"Saved user-entity link for user {user_id}, entity {entity_id}")
        return link
    except IntegrityError as e:
        logger.error(f"Failed to save user-entity link: IntegrityError - {str(e)}", exc_info=True)
        await db.rollback()
        return None
    except asyncio.TimeoutError as e:
        logger.error(f"Failed to save user-entity link: TimeoutError - {str(e)}", exc_info=True)
        await db.rollback()
        return None
    except asyncio.CancelledError as e:
        logger.warning(f"User-entity link commit cancelled: {str(e)}")
        await db.rollback()
        raise
    except Exception as e:
        logger.error(f"Failed to save user-entity link: Unexpected error - {str(e)}", exc_info=True)
        await db.rollback()
        return None


@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(
        f"Retrying create_profile (attempt {retry_state.attempt_number})"
    ),
    reraise=True,
)
async def create_profile(
    db: AsyncSession,
    user_id: str,
    profile_type: str,
    display_name: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    date_of_birth: Optional[date] = None,
    gender: Optional[str] = None,
    phone: Optional[str] = None,
    website: Optional[str] = None,
    title: Optional[str] = None,
    organization: Optional[str] = None,
    bio: str = "",
    location: Optional[Dict] = None,
    social_links: Optional[Dict] = None,
    expertise: Optional[List[str]] = None,
    profile_image: Optional[str] = None,  # storage key, not presigned URL
    metadata_: Optional[Dict] = None,
) -> Optional[Profile]:
    """
    Create a new profile for a user with the updated schema.
    profile_image is the storage key (e.g., Backblaze B2 object key).
    """
    db = await check_and_reconnect(db)  # assuming this helper exists in your utils
    try:
        logger.debug(f"Creating profile for user {user_id}, type={profile_type}")

        profile = Profile(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            type=profile_type,
            display_name=display_name,
            first_name=first_name,
            last_name=last_name,
            date_of_birth=date_of_birth,
            gender=gender,
            phone=phone,
            website=website,
            title=title,
            organization=organization,
            bio=bio or "",
            location=normalize_json_field(location or {}),
            social_links=normalize_json_field(social_links or {}),
            expertise=normalize_json_field(expertise or []),
            metadata_=normalize_json_field(metadata_ or {}),
            profile_image=profile_image,
        )

        db.add(profile)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(profile), timeout=15.0)

        logger.info(f"Created profile {profile.id} for user {user_id}")
        return profile

    except IntegrityError as e:
        logger.error(f"Integrity error creating profile for user {user_id}: {str(e)}")
        await db.rollback()
        return None
    except Exception as e:
        logger.error(f"Unexpected error creating profile for user {user_id}: {str(e)}", exc_info=True)
        await db.rollback()
        return None

async def update_profile(db: AsyncSession, profile_id: str, user_id: str, **profile_data) -> Optional[Profile]:
    """Update an existing user profile in the database."""
    try:
        result = await db.execute(
            select(Profile).where(
                (Profile.id == profile_id) & (Profile.user_id == uuid.UUID(user_id))
            )
        )
        profile = result.scalars().first()
        if not profile:
            return None
        for key, value in profile_data.items():
            if hasattr(profile, key):
                setattr(profile, key, value)
        # update timestamp only if model has updated_at
        if hasattr(profile, "updated_at"):
            profile.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(profile)
        return profile
    except Exception as e:
        await db.rollback()
        raise e


async def get_user_profiles(db: AsyncSession, user_id: str) -> List[Profile]:
    """Retrieve all profiles for a user."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving profiles for user {user_id}")
        result = await asyncio.wait_for(
            db.execute(
                select(Profile)
                .where(Profile.user_id == uuid.UUID(user_id))
                .order_by(Profile.created_at.desc())
            ),
            timeout=15.0
        )
        profiles = result.scalars().all()
        logger.debug(f"Retrieved {len(profiles)} profiles for user {user_id}")
        return profiles
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving profiles for user {user_id}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve profiles for user {user_id}: {str(e)}", exc_info=True)
        raise


@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying create_funder (attempt {retry_state.attempt_number})")
)
async def create_funder(db: AsyncSession, name: str, website: str = "", contact: Dict = {}, profile: str = "", org_type: str = "vc", regions: List[str] = [], thematic_focus: List[str] = [], min_ticket: Optional[int] = None, max_ticket: Optional[int] = None, verified: bool = False, metadata_: Dict = {}, profile_id: Optional[str] = None, investment_history: List[Dict] = []) -> Optional[Funder]:
    """Create a new funder, optionally linked to a profile."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Creating funder: {name}")
        
        # Construct funder_data dict for embeddings (only fields used in generate_funder_embeddings)
        funder_data = {
            "name": name,
            "profile": profile,
            "org_type": org_type,
            "regions": regions,
            "thematic_focus": thematic_focus,
            "investment_history": investment_history
        }
        
        # Generate embeddings
        embeddings = await generate_funder_embeddings(funder_data)
        
        funder = Funder(
            id=uuid.uuid4(),
            name=name,
            website=website,
            contact=normalize_json_field(contact),
            profile=profile,
            org_type=org_type,
            regions=normalize_json_field(regions),
            thematic_focus=normalize_json_field(thematic_focus),
            min_ticket=min_ticket,
            max_ticket=max_ticket,
            created_at=datetime.utcnow(),
            last_seen=None,
            verified=verified,
            metadata_=normalize_json_field(metadata_),
            profile_id=uuid.UUID(profile_id) if profile_id else None,
            investment_history=normalize_json_field(investment_history),
            embeddings=embeddings  # Set generated embeddings
        )
        db.add(funder)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(funder), timeout=15.0)
        logger.info(f"Created funder {funder.id}: {name} with embeddings")
        return funder
    except IntegrityError as e:
        logger.error(f"Failed to create funder {name}: {str(e)}")
        await db.rollback()
        return None
    except Exception as e:
        logger.error(f"Failed to create funder {name}: {str(e)}", exc_info=True)
        await db.rollback()
        return None

async def get_funder_by_id(db: AsyncSession, funder_id: str) -> Optional[Funder]:
    """Retrieve a funder by ID."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving funder {funder_id}")
        result = await asyncio.wait_for(
            db.execute(
                select(Funder)
                .where(Funder.id == uuid.UUID(funder_id))
                .options(selectinload(Funder.proposals), selectinload(Funder.matches))
            ),
            timeout=15.0
        )
        funder = result.scalars().first()
        logger.debug(f"{'Funder found' if funder else 'Funder not found'} for ID: {funder_id}")
        return funder
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving funder {funder_id}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve funder {funder_id}: {str(e)}", exc_info=True)
        raise


@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying create_proposal (attempt {retry_state.attempt_number})")
)
async def create_proposal(db: AsyncSession, entity_id: str, title: str, summary: str = "", ask_amount: Optional[int] = None, equity_seek: Optional[float] = None, stage: str = "early", documents: List[str] = [], status: str = "open", funder_id: Optional[str] = None, climate_focus: List[str] = []) -> Optional[Proposal]:
    """Create a new proposal for an entity, optionally linked to a funder."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Creating proposal for entity {entity_id}: {title}")
        proposal = Proposal(
            id=uuid.uuid4(),
            entity_id=uuid.UUID(entity_id),
            funder_id=uuid.UUID(funder_id) if funder_id else None,
            title=title,
            summary=summary,
            ask_amount=ask_amount,
            equity_seek=equity_seek,
            stage=stage,
            documents=normalize_json_field(documents),
            status=status,
            created_at=datetime.utcnow(),
            last_updated=datetime.utcnow(),
            climate_focus=normalize_json_field(climate_focus)
        )
        db.add(proposal)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(proposal), timeout=15.0)
        logger.info(f"Created proposal {proposal.id} for entity {entity_id}")
        return proposal
    except IntegrityError as e:
        logger.error(f"Failed to create proposal for entity {entity_id}: {str(e)}")
        await db.rollback()
        return None
    except Exception as e:
        logger.error(f"Failed to create proposal for entity {entity_id}: {str(e)}", exc_info=True)
        await db.rollback()
        return None

async def get_proposals_for_entity(db: AsyncSession, entity_id: str) -> List[Proposal]:
    """Retrieve all proposals for an entity."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving proposals for entity {entity_id}")
        result = await asyncio.wait_for(
            db.execute(
                select(Proposal)
                .where(Proposal.entity_id == uuid.UUID(entity_id))
                .order_by(Proposal.created_at.desc())
            ),
            timeout=15.0
        )
        proposals = result.scalars().all()
        logger.debug(f"Retrieved {len(proposals)} proposals for entity {entity_id}")
        return proposals
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving proposals for entity {entity_id}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve proposals for entity {entity_id}: {str(e)}", exc_info=True)
        raise

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying create_match_record (attempt {retry_state.attempt_number})")
)
async def create_match_record(db: AsyncSession, funder_id: str, entity_id: str, score: float, reason: Optional[str] = None, status: str = "suggested", metadata_: Dict = {}) -> Optional[MatchRecord]:
    """Create a match record between a funder and an entity."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Creating match record for funder {funder_id} and entity {entity_id}")
        match_record = MatchRecord(
            funder_id=uuid.UUID(funder_id),
            entity_id=uuid.UUID(entity_id),
            score=score,
            reason=reason,
            status=status,
            created_at=datetime.utcnow(),
            metadata_=normalize_json_field(metadata_)
        )
        db.add(match_record)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(match_record), timeout=15.0)
        logger.info(f"Created match record {match_record.id}")
        return match_record
    except IntegrityError as e:
        logger.error(f"Failed to create match record: {str(e)}")
        await db.rollback()
        return None
    except Exception as e:
        logger.error(f"Failed to create match record: {str(e)}", exc_info=True)
        await db.rollback()
        return None

async def get_match_records_for_entity(db: AsyncSession, entity_id: str) -> List[MatchRecord]:
    """Retrieve match records for an entity."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving match records for entity {entity_id}")
        result = await asyncio.wait_for(
            db.execute(
                select(MatchRecord)
                .where(MatchRecord.entity_id == uuid.UUID(entity_id))
                .order_by(MatchRecord.created_at.desc())
            ),
            timeout=15.0
        )
        match_records = result.scalars().all()
        logger.debug(f"Retrieved {len(match_records)} match records for entity {entity_id}")
        return match_records
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving match records for entity {entity_id}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve match records for entity {entity_id}: {str(e)}", exc_info=True)
        raise

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying add_verification (attempt {retry_state.attempt_number})")
)
async def add_verification(db: AsyncSession, entity_id: str, verifier: Optional[str] = None, level: str = "basic", notes: str = "", documents: List[str] = []) -> Optional[Verification]:
    """Add a verification to an entity."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Adding verification to entity {entity_id}")
        verification = Verification(
            entity_id=uuid.UUID(entity_id),
            verifier=verifier,
            verified_at=datetime.utcnow(),
            level=level,
            notes=notes,
            documents=normalize_json_field(documents)
        )
        db.add(verification)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(verification), timeout=15.0)
        logger.info(f"Added verification {verification.id} to entity {entity_id}")
        return verification
    except IntegrityError as e:
        logger.error(f"Failed to add verification to entity {entity_id}: {str(e)}")
        await db.rollback()
        return None
    except Exception as e:
        logger.error(f"Failed to add verification to entity {entity_id}: {str(e)}", exc_info=True)
        await db.rollback()
        return None

async def get_verifications_for_entity(db: AsyncSession, entity_id: str) -> List[Verification]:
    """Retrieve verifications for an entity."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving verifications for entity {entity_id}")
        result = await asyncio.wait_for(
            db.execute(
                select(Verification)
                .where(Verification.entity_id == uuid.UUID(entity_id))
                .order_by(Verification.verified_at.desc())
            ),
            timeout=15.0
        )
        verifications = result.scalars().all()
        logger.debug(f"Retrieved {len(verifications)} verifications for entity {entity_id}")
        return verifications
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving verifications for entity {entity_id}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve verifications for entity {entity_id}: {str(e)}", exc_info=True)
        raise

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying add_entity_embedding (attempt {retry_state.attempt_number})")
)
async def add_entity_embedding(db: AsyncSession, entity_id: str, model: str, vector: List[float]) -> Optional[EntityEmbedding]:
    """Add an embedding to an entity."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Adding embedding to entity {entity_id} with model {model}")
        embedding = EntityEmbedding(
            entity_id=uuid.UUID(entity_id),
            model=model,
            vector=vector,
            created_at=datetime.utcnow()
        )
        db.add(embedding)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(embedding), timeout=15.0)
        logger.info(f"Added embedding {embedding.id} to entity {entity_id}")
        return embedding
    except IntegrityError as e:
        logger.error(f"Failed to add embedding to entity {entity_id}: {str(e)}")
        await db.rollback()
        return None
    except Exception as e:
        logger.error(f"Failed to add embedding to entity {entity_id}: {str(e)}", exc_info=True)
        await db.rollback()
        return None

async def get_entity_embeddings(db: AsyncSession, entity_id: str) -> List[EntityEmbedding]:
    """Retrieve embeddings for an entity."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving embeddings for entity {entity_id}")
        result = await asyncio.wait_for(
            db.execute(
                select(EntityEmbedding)
                .where(EntityEmbedding.entity_id == uuid.UUID(entity_id))
                .order_by(EntityEmbedding.created_at.desc())
            ),
            timeout=15.0
        )
        embeddings = result.scalars().all()
        logger.debug(f"Retrieved {len(embeddings)} embeddings for entity {entity_id}")
        return embeddings
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving embeddings for entity {entity_id}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve embeddings for entity {entity_id}: {str(e)}", exc_info=True)
        raise

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying create_publication (attempt {retry_state.attempt_number})")
)
async def create_publication(db: AsyncSession, title: str, entity_id: Optional[str] = None, abstract: str = "", authors: List[str] = [], doi: Optional[str] = None, publication_date: Optional[datetime] = None, journal: Optional[str] = None, keywords: List[str] = [], pdf_url: Optional[str] = None, citation_count: int = 0) -> Optional[Publication]:
    """Create a new publication, optionally linked to an entity."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Creating publication: {title}")
        publication = Publication(
            id=uuid.uuid4(),
            entity_id = entity_id if isinstance(entity_id, uuid.UUID) else uuid.UUID(str(entity_id)) if entity_id else None,
            title=title,
            abstract=abstract,
            authors=normalize_json_field(authors),
            doi=doi,
            publication_date=publication_date,
            journal=journal,
            keywords=normalize_json_field(keywords),
            pdf_url=str(pdf_url) if pdf_url else None,
            citation_count=citation_count,
            created_at=datetime.utcnow()
        )
        db.add(publication)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(publication), timeout=15.0)
        logger.info(f"Created publication {publication.id}")
        return publication
    except IntegrityError as e:
        logger.error(f"Failed to create publication {title}: {str(e)}")
        await db.rollback()
        return None
    except Exception as e:
        logger.error(f"Failed to create publication {title}: {str(e)}", exc_info=True)
        await db.rollback()
        return None

async def get_publications_for_entity(db: AsyncSession, entity_id: str) -> List[Publication]:
    """Retrieve publications for an entity."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving publications for entity {entity_id}")
        result = await asyncio.wait_for(
            db.execute(
                select(Publication)
                .where(Publication.entity_id == uuid.UUID(entity_id))
                .order_by(Publication.created_at.desc())
            ),
            timeout=15.0
        )
        publications = result.scalars().all()
        logger.debug(f"Retrieved {len(publications)} publications for entity {entity_id}")
        return publications
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving publications for entity {entity_id}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve publications for entity {entity_id}: {str(e)}", exc_info=True)
        raise


@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
)
async def create_notification(
    db,
    user_id: str,
    type: str,
    content: str,
    related_id: Optional[Union[int, str]] = None
):
    """Create a new notification for a user."""
    db = await check_and_reconnect(db)
    try:
        # determine whether related_id is int or UUID
        safe_related_id = None
        if isinstance(related_id, int):
            safe_related_id = related_id  
        elif isinstance(related_id, str):
            try:
                safe_related_id = uuid.UUID(related_id)  
            except ValueError:
                logger.warning(f"Ignoring invalid related_id: {related_id}")
                safe_related_id = None

        notification = Notification(
            id=uuid.uuid4(),
            user_id=uuid.UUID(str(user_id)),
            type=type,
            content=content,
            related_id=safe_related_id,
            is_read=False,
            created_at=datetime.utcnow()
        )

        db.add(notification)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(notification), timeout=15.0)
        logger.info(f"Created notification {notification.id} for user {user_id}")
        return notification

    except IntegrityError as e:
        logger.error(f"IntegrityError creating notification: {str(e)}")
        await db.rollback()
        return None
    except Exception as e:
        logger.error(f"Failed to create notification: {str(e)}", exc_info=True)
        await db.rollback()
        return None

async def get_notifications_for_user(db: AsyncSession, user_id: str, unread_only: bool = False) -> List[Notification]:
    """Retrieve notifications for a user, optionally only unread ones."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Retrieving notifications for user {user_id}{' (unread only)' if unread_only else ''}")
        query = select(Notification).where(Notification.user_id == uuid.UUID(user_id))
        if unread_only:
            query = query.where(Notification.is_read == False)
        query = query.order_by(Notification.created_at.desc())
        result = await asyncio.wait_for(db.execute(query), timeout=15.0)
        notifications = result.scalars().all()
        logger.debug(f"Retrieved {len(notifications)} notifications for user {user_id}")
        return notifications
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout retrieving notifications for user {user_id}: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve notifications for user {user_id}: {str(e)}", exc_info=True)
        raise

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying create_message (attempt {retry_state.attempt_number})")
)
async def create_message(db: AsyncSession, **kwargs) -> Message:
    """Create a new message"""
    try:
        message = Message(**kwargs)
        db.add(message)
        await db.commit()
        await db.refresh(message)
        return message
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to create message: {e}")
        return None

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying create_message (attempt {retry_state.attempt_number})")
)
async def get_messages_for_profile(db: AsyncSession, profile_id: str, sent: bool = False, unread_only: bool = False) -> List[Message]:
    """Get messages for a profile"""
    try:
        query = select(Message).options(selectinload(Message.attachments))
        
        if sent:
            query = query.where(Message.sender_profile_id == profile_id)
        else:
            query = query.where(Message.receiver_profile_id == profile_id)
            
        if unread_only:
            query = query.where(Message.is_read == False)
            
        query = query.order_by(Message.created_at.desc())
        
        result = await db.execute(query)
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Failed to get messages for profile {profile_id}: {e}")
        return []
        raise

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying create_profile_backlink (attempt {retry_state.attempt_number})")
)
async def create_profile_backlink(db: AsyncSession, source_profile_id: str, target_profile_id: str, link_type: str = "collaboration", context: str = "", weight: int = 1, metadata_: Dict = {}) -> Optional[ProfileBacklink]:
    """Create a backlink between profiles."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Creating backlink from {source_profile_id} to {target_profile_id}")
        backlink = ProfileBacklink(
            id=uuid.uuid4(),
            source_profile_id=uuid.UUID(source_profile_id),
            target_profile_id=uuid.UUID(target_profile_id),
            link_type=link_type,
            context=context,
            weight=weight,
            metadata_=normalize_json_field(metadata_),
            created_at=datetime.utcnow()
        )
        db.add(backlink)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(backlink), timeout=15.0)
        logger.info(f"Created backlink {backlink.id}")
        return backlink
    except IntegrityError as e:
        logger.error(f"Failed to create backlink: {str(e)}")
        await db.rollback()
        return None
    except Exception as e:
        logger.error(f"Failed to create backlink: {str(e)}", exc_info=True)
        await db.rollback()
        return None

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=5),
    retry=tenacity.retry_if_exception_type((asyncio.TimeoutError, IntegrityError)),
    before_sleep=lambda retry_state: logger.debug(f"Retrying create_ecosystem_entity_link (attempt {retry_state.attempt_number})")
)
async def create_ecosystem_entity_link(db: AsyncSession, profile_id: str, entity_id: str, role: str = "collaborator", context: str = "", metadata_: Dict = {}) -> Optional[EcosystemEntityLink]:
    """Create a link between a profile and an entity in the ecosystem."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Creating ecosystem link for profile {profile_id} and entity {entity_id}")
        link = EcosystemEntityLink(
            id=uuid.uuid4(),
            profile_id=uuid.UUID(profile_id),
            entity_id=uuid.UUID(entity_id),
            role=role,
            context=context,
            metadata_=normalize_json_field(metadata_),
            created_at=datetime.utcnow()
        )
        db.add(link)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(link), timeout=15.0)
        logger.info(f"Created ecosystem link {link.id}")
        return link
    except IntegrityError as e:
        logger.error(f"Failed to create ecosystem link: {str(e)}")
        await db.rollback()
        return None
    except Exception as e:
        logger.error(f"Failed to create ecosystem link: {str(e)}", exc_info=True)
        await db.rollback()
        return None

async def search_entities_full_text(db: AsyncSession, query_text: str) -> List[Entity]:
    """Perform full-text search on entities using tsv_document."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Full-text searching entities with query: {query_text}")
        ts_query = func.to_tsquery('english', query_text.replace(' ', ' & '))
        stmt = select(Entity).where(Entity.tsv_document.op('@@')(ts_query)).order_by(func.ts_rank(Entity.tsv_document, ts_query).desc())
        result = await asyncio.wait_for(db.execute(stmt), timeout=15.0)
        entities = result.scalars().all()
        logger.debug(f"Found {len(entities)} entities matching full-text query")
        return entities
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout during full-text search: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed full-text search: {str(e)}", exc_info=True)
        raise

async def search_proposals_full_text(db: AsyncSession, query_text: str) -> List[Proposal]:
    """Perform full-text search on proposals using tsv_document."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Full-text searching proposals with query: {query_text}")
        ts_query = func.to_tsquery('english', query_text.replace(' ', ' & '))
        stmt = select(Proposal).where(Proposal.tsv_document.op('@@')(ts_query)).order_by(func.ts_rank(Proposal.tsv_document, ts_query).desc())
        result = await asyncio.wait_for(db.execute(stmt), timeout=15.0)
        proposals = result.scalars().all()
        logger.debug(f"Found {len(proposals)} proposals matching full-text query")
        return proposals
    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout during full-text search for proposals: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"Failed full-text search for proposals: {str(e)}", exc_info=True)
        raise


async def search_publications_full_text(db: AsyncSession, query_text: str) -> List[Publication]:
    """Perform full-text search on publications using tsv_document."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Full-text searching publications with query: {query_text}")
        
        # Convert the query string to a PostgreSQL ts_query
        ts_query = func.to_tsquery('english', query_text.replace(' ', ' & '))
        
        # Define search statement with rank ordering
        stmt = (
            select(Publication)
            .where(Publication.tsv_document.op('@@')(ts_query))
            .order_by(func.ts_rank(Publication.tsv_document, ts_query).desc())
        )

        # Execute asynchronously with timeout protection
        result = await asyncio.wait_for(db.execute(stmt), timeout=15.0)
        publications = result.scalars().all()

        logger.debug(f"Found {len(publications)} publications matching full-text query")
        return publications

    except asyncio.TimeoutError as e:
        logger.error(f"Database timeout during full-text search for publications: {str(e)}", exc_info=True)
        raise RuntimeError("Database operation timed out during publication search.") from e


async def get_default_profile(db: AsyncSession, user_id: str) -> Optional[Profile]:
    """Get the default profile for a user."""
    db = await check_and_reconnect(db)
    try:
        result = await db.execute(
            select(Profile)
            .where(Profile.user_id == uuid.UUID(user_id), Profile.is_default == True)
        )
        default_profile = result.scalar_one_or_none()
        logger.debug(f"Default profile for user {user_id}: {default_profile.id if default_profile else None}")
        return default_profile
    except Exception as e:
        logger.error(f"Failed to get default profile for user {user_id}: {str(e)}", exc_info=True)
        raise


async def can_create_profile(db: AsyncSession, user_id: str) -> tuple[bool, str]:
    """Check if user can create additional profile (max 2 profiles allowed)."""
    db = await check_and_reconnect(db)
    try:
        result = await db.execute(
            select(func.count(Profile.id))
            .where(Profile.user_id == uuid.UUID(user_id))
        )
        profile_count = result.scalar() or 0
        if profile_count >= 2:
            return False, f"Maximum of 2 profiles allowed (currently have {profile_count})"
        return True, "OK"
    except Exception as e:
        logger.error(f"Failed to check profile count for user {user_id}: {str(e)}", exc_info=True)
        raise


async def create_default_profile(db: AsyncSession, user_id: uuid.UUID, username: str, email: Optional[str] = None, profile_image_url: Optional[str] = None) -> Optional[Profile]:
    """Create a default profile for a new user from User table data."""
    db = await check_and_reconnect(db)
    try:
        logger.debug(f"Creating default profile for user {user_id}")
        default_profile = Profile(
            id=uuid.uuid4(),
            user_id=user_id,
            is_default=True,
            display_name=username,
            type="attendee",
            bio="",
            profile_image=profile_image_url
        )
        db.add(default_profile)
        await asyncio.wait_for(db.commit(), timeout=15.0)
        await asyncio.wait_for(db.refresh(default_profile), timeout=15.0)
        logger.info(f"Created default profile {default_profile.id} for user {user_id}")
        return default_profile
    except Exception as e:
        logger.error(f"Failed to create default profile for user {user_id}: {str(e)}", exc_info=True)
        await db.rollback()
        return None


    except Exception as e:
        logger.error(f"Error performing full-text search for publications: {str(e)}", exc_info=True)
        await db.rollback()
        raise RuntimeError("An unexpected error occurred during publication search.") from e

    finally:
        # Optional: ensure session stays healthy
        try:
            await db.commit()
        except Exception as e:
            logger.warning(f"Commit skipped after search due to: {e}")
