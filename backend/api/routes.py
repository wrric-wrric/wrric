import json
import os
import logging
import asyncio
import re
from datetime import datetime, timedelta
from io import BytesIO
from typing import List, Dict, Optional, Any
import uuid

from fastapi import APIRouter, HTTPException, Depends, status, Form, File, UploadFile, Request
from fastapi import Query as FastAPIQuery
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import selectinload
from dotenv import load_dotenv
import pandas as pd

from utils.config import load_config, save_config
from api.schemas import (
    Config,
    FeedbackRequest,
    PublicationCreate,
    SignupCredentials,
    EntityResponse,
    QueryResponse,
    SessionResponse,
    UserCredentials,
    Token,
    DeleteSessionResponse,
    InquiryRequest,
    ProfileResponse,
    FunderResponse,
    ProposalResponse,
    MatchRecordResponse,
    VerificationResponse,
    EntityEmbeddingResponse,
    PublicationResponse,
    NotificationResponse,
    ProfileResponse,
    MessageResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    PasswordResetResponse,
    CompleteRegistrationRequest,
    CompleteRegistrationResponse
)
from models.db_models import (
    Entity,
    EntityImage,
    Query,
    Session,
    SessionEntity,
    SharedSession,
    User,
    UserEntityLink,
    Profile,
    Funder,
    Proposal,
    MatchRecord,
    Verification,
    EntityEmbedding,
    Publication,
    Notification,
    Message,
    ProfileBacklink,
    EcosystemEntityLink,
    Partner,
    PartnerEntity
)
from utils.database import (
    check_and_reconnect,
    get_db,
    create_user,
    authenticate_user,
    get_user_history,
    get_entities_by_session,
    get_session_by_id,
    create_shared_session,
    get_shared_session,
    export_session_data,
    update_session_title,
    save_user_entity_link,
    create_profile,
    get_user_profiles,
    get_default_profile,
    update_profile,
    create_funder,
    get_funder_by_id,
    create_proposal,
    get_proposals_for_entity,
    create_match_record,
    get_match_records_for_entity,
    add_verification,
    get_verifications_for_entity,
    add_entity_embedding,
    get_entity_embeddings,
    create_publication,
    get_publications_for_entity,
    create_notification,
    get_notifications_for_user,
    create_message,
    get_messages_for_profile,
    create_profile_backlink,
    create_ecosystem_entity_link
)

from utils.password_reset import (
    create_password_reset_token,
    verify_password_reset_token,
    invalidate_all_password_resets,
    generate_password_reset_link,
    reset_password as reset_password_util
)
from utils.registration_password_setup import (
    complete_registration_password_setup,
    verify_registration_setup_token,
    verify_bulk_import_token,
    verify_rejection_token,
    reject_registration,
    reject_bulk_import_invitation,
    generate_registration_setup_link,
    generate_rejection_link
)

from api.manager_email_service import (
    send_password_reset_email,
    send_password_reset_confirmation_email,
    send_registration_rejection_confirmation_email
    
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, case, func
from sqlalchemy.orm import selectinload
from jose import JWTError, jwt

from utils.recaptcha import verify_recaptcha
from api.dependencies import (
    get_current_user,
    create_access_token,
    sanitize_filename,
    validate_entities,
    _get_presigned_url,
    verify_admin,
)

from services.favicon_service import _enrich_with_favicons_parallel

from api.manager_email_service import send_feedback_email, send_inquiry_email
from .profiles import router as profiles_router
from .user_entity_api import router as entity_router
from .messages import router as messages_router
from .proposals import router as proposals_router
from .notifications import router as notifications_router
from .match_records import router as match_records_router
from .funders import router as funders_router
from .auth import router as auth_router
from media.storage import CustomB2Storage


from .events import router as events_router
from .user_events import router as user_events_router
from .admin.events import router as admin_events_router
from .admin.categories import router as admin_categories_router

from .admin.analytics import router as admin_analytics_router
from .admin.entities import router as admin_entities_router
from .admin.matches import router as admin_matches_router
from .admin.upload import router as admin_upload_router
from .admin.users import router as admin_users_router
from .partners import router as partners_router
from .admin.partners import router as admin_partners_router
from .admin.hackathons import router as admin_hackathons_router
from .judge import router as judge_router
from .labs_social import router as labs_social_router
from .comments import router as comments_router
from .admin.comments import router as admin_comments_router
from .follows import router as follows_router
from .feed import router as feed_router
from .bookmarks import router as bookmarks_router
from .search import router as search_router
from .user_profile import router as user_profile_router
from .blocks import router as blocks_router
from .lab_analytics import router as lab_analytics_router


logger = logging.getLogger(__name__)

load_dotenv()

router = APIRouter()
router.include_router(profiles_router, prefix="/profiles")
router.include_router(entity_router, prefix="/user_entities")
router.include_router(messages_router, prefix="/messages")
router.include_router(proposals_router, prefix="/proposals")
router.include_router(notifications_router, prefix="/notifications")
router.include_router(match_records_router, prefix="/match_records")
router.include_router(funders_router, prefix="/funders")
router.include_router(auth_router, prefix="/auth")
router.include_router(events_router, prefix="/events", tags=["events"])
router.include_router(user_events_router, prefix="/user-events", tags=["user-events"])

# admin endpoints
router.include_router(admin_events_router, prefix="/admin/events", tags=["admin-events"])
router.include_router(admin_categories_router, prefix="/admin/categories", tags=["admin-categories"])
router.include_router(admin_analytics_router, prefix="/admin/analytics", tags=["admin-analytics"])
router.include_router(admin_entities_router, prefix="/admin/entities", tags=["admin-entities"])
router.include_router(admin_categories_router, prefix="/admin/matches", tags=["admin-matches"])
router.include_router(admin_upload_router, prefix="/admin/upload", tags=["admin-upload"])
router.include_router(admin_users_router, prefix="/admin/users", tags=["admin-users"])
router.include_router(partners_router, prefix="/partners", tags=["partners"])
router.include_router(admin_partners_router, prefix="/admin/partners", tags=["admin-partners"])
router.include_router(admin_hackathons_router, prefix="/admin/hackathons", tags=["admin-hackathons"])
router.include_router(judge_router, prefix="/judge", tags=["judge"])
router.include_router(labs_social_router, prefix="/labs", tags=["labs-social"])
router.include_router(comments_router, prefix="/comments", tags=["comments"])
router.include_router(admin_comments_router, prefix="/admin/comments", tags=["admin-comments"])
router.include_router(follows_router, prefix="/follow", tags=["follows"])
router.include_router(feed_router, prefix="/feed", tags=["feed"])
router.include_router(bookmarks_router, prefix="/bookmarks", tags=["bookmarks"])
router.include_router(search_router, prefix="/search", tags=["search"])
router.include_router(user_profile_router, prefix="/users", tags=["user-profile"])
router.include_router(blocks_router, prefix="/blocks", tags=["blocks"])
router.include_router(lab_analytics_router, tags=["lab-analytics"])


# Admin check-access endpoint
@router.get("/admin/check-access", tags=["admin"])
async def check_admin_access(admin_user: str = Depends(verify_admin)):
    """Check if the current user has admin access. Returns 200 if admin, 403 if not."""
    return {"is_admin": True, "user_id": admin_user}





storage = CustomB2Storage()


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/jwt/login")

@router.get("/config", response_model=Config)
async def get_config():
    try:
        config = load_config()
        logger.debug("Loaded config: %s", config)
        config_model = Config(**config)
        logger.debug("Config model: %s", config_model.dict())
        return config_model
    except Exception as e:
        logger.exception("Failed to load config")
        raise HTTPException(status_code=500, detail=f"Failed to load config: {str(e)}")

@router.post("/config", response_model=Config)
async def update_config(config: Config):
    try:
        save_config(config.dict())
        return config
    except Exception as e:
        logger.exception("Failed to save config")
        raise HTTPException(status_code=500, detail=f"Failed to save config: {str(e)}")

@router.get("/logs")
async def get_logs():
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            logs = f.readlines()
    except UnicodeDecodeError:
        with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
            logs = f.readlines()
            logger.warning("app.log contained non-UTF-8 characters; replaced with placeholders")
    except FileNotFoundError:
        logs = ["No logs available yet."]
    return JSONResponse(content={"logs": logs})

@router.get("/queries", response_model=list[QueryResponse])
async def get_queries(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(Query))
        queries = result.scalars().all()
        return [
            QueryResponse(
                id=str(query.id),
                session_id=str(query.session_id),
                query_text=query.query_text,
                timestamp=query.timestamp.isoformat() if isinstance(query.timestamp, datetime) else query.timestamp
            ) for query in queries
        ]
    except Exception as e:
        logger.error(f"Failed to retrieve queries: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve queries: {str(e)}")


@router.get("/sessions", response_model=list[SessionResponse])
async def get_sessions(current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(Session).where(Session.user_id == current_user))
        sessions = result.scalars().all()
        return [
            SessionResponse(
                id=str(session.id),
                user_id=str(session.user_id),
                start_time=session.start_time.isoformat() if isinstance(session.start_time, datetime) else session.start_time,
                end_time=session.end_time.isoformat() if isinstance(session.end_time, datetime) else session.end_time,
                status=session.status,
                title=session.title,
                description=session.description,
                is_active=session.is_active,
                metadata_=session.metadata_
            ) for session in sessions
        ]
    except Exception as e:
        logger.error(f"Failed to retrieve sessions for user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve sessions: {str(e)}")



# -------------------------
# Presign helpers (conditional)
# -------------------------
async def _presign_url_conditional(key_or_url: Optional[str], entity_source: Optional[str]) -> Optional[str]:
    """
    Conditionally return the final URL to send to clients:
      - If key_or_url is falsy -> None
      - If it's already absolute (http/https) -> return as-is
      - If entity_source != "scraped" -> assume it's an object key and generate presigned URL
      - If entity_source == "scraped" and key_or_url is NOT absolute:
          -> log a warning and attempt to presign as a fallback (prevents Pydantic HttpUrl errors)
    All presign generation runs within asyncio.to_thread to avoid blocking.
    """
    if not key_or_url:
        return None

    if isinstance(key_or_url, str) and key_or_url.startswith(("http://", "https://")):
        return key_or_url

    # At this point key_or_url is not absolute (looks like an object key).
    if entity_source and entity_source != "scraped":
        # User-created / non-scraped: presign the object key
        try:
            return await asyncio.to_thread(storage.url, key_or_url)
        except Exception:
            logger.exception("Failed to presign user image key %s", key_or_url)
            return None

    # entity_source == "scraped" but the URL is not absolute. This is unexpected:
    logger.warning("Scraped entity has non-absolute image URL/key '%s' — attempting to presign as fallback", key_or_url)
    try:
        return await asyncio.to_thread(storage.url, key_or_url)
    except Exception:
        logger.exception("Fallback presign failed for scraped image key %s", key_or_url)
        return None


async def _presign_images_list_conditional(images: List[Dict[str, Any]], entity_source: Optional[str]) -> List[Dict[str, Any]]:
    """
    For each image dict (must contain 'url'), return copy with 'url' replaced by:
      - absolute url if already absolute
      - presigned url if entity_source != 'scraped' (or fallback for scraped keys)
      - None if unable to resolve
    """
    if not images:
        return []

    tasks = [ _presign_url_conditional(img.get("url"), entity_source) for img in images ]
    presigned_urls = await asyncio.gather(*tasks, return_exceptions=False)

    out: List[Dict[str, Any]] = []
    for img, pres in zip(images, presigned_urls):
        new = dict(img)
        new["url"] = pres
        out.append(new)
    return out


# -------------------------
# GET /user_labs  (entities for current user)
# -------------------------
@router.get("/user_labs", response_model=List[EntityResponse])
async def get_entities(current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(Entity)
            .join(UserEntityLink, UserEntityLink.entity_id == Entity.id)
            .where(UserEntityLink.user_id == current_user)
            .options(selectinload(Entity.images))
        )
        entities = result.scalars().unique().all()

        def build_entity_payload(entity: Entity) -> Dict[str, Any]:
            images_raw = [
                {
                    "id": str(img.id),
                    "url": img.url,
                    "caption": img.caption,
                    "is_primary": img.is_primary,
                    "uploaded_by_user_id": str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                    "created_at": img.created_at if isinstance(img.created_at, datetime) else img.created_at
                }
                for img in getattr(entity, "images", []) or []
            ]
            return {
                "id": entity.id,
                "profile_id": str(getattr(entity, "profile_id", None)) if getattr(entity, "profile_id", None) else None,
                "source": getattr(entity, "source", "scraped"),
                "created_by_user_id": getattr(entity, "created_by_user_id", None),
                "url": getattr(entity, "url", None),
                "university": getattr(entity, "university", ""),
                "location": entity.get_json_field('location') if hasattr(entity, "get_json_field") else getattr(entity, "location", {}) or {},
                "website": getattr(entity, "website", None) or None,
                "edurank": entity.get_json_field('edurank') if hasattr(entity, "get_json_field") else getattr(entity, "edurank", {}) or {},
                "department": entity.get_json_field('department') if hasattr(entity, "get_json_field") else getattr(entity, "department", {}) or {},
                "publications_meta": entity.get_json_field('publications_meta') if hasattr(entity, "get_json_field") else getattr(entity, "publications_meta", {}) or {},
                "related": getattr(entity, "related", "") or "",
                "point_of_contact": entity.get_json_field('point_of_contact') if hasattr(entity, "get_json_field") else getattr(entity, "point_of_contact", {}) or {},
                "scopes": entity.get_json_field('scopes') if hasattr(entity, "get_json_field") else getattr(entity, "scopes", []) or [],
                "research_abstract": getattr(entity, "research_abstract", "") or "",
                "lab_equipment": entity.get_json_field('lab_equipment') if hasattr(entity, "get_json_field") else getattr(entity, "lab_equipment", {}) or {},
                "climate_tech_focus": entity.get_json_field('climate_tech_focus') if hasattr(entity, "get_json_field") else getattr(entity, "climate_tech_focus", None),
                "climate_impact_metrics": entity.get_json_field('climate_impact_metrics') if hasattr(entity, "get_json_field") else getattr(entity, "climate_impact_metrics", {}) or {},
                "timestamp": entity.timestamp if isinstance(entity.timestamp, datetime) else datetime.utcnow(),
                "last_updated": entity.last_updated if isinstance(entity.last_updated, datetime) else (entity.last_updated or datetime.utcnow()),
                "embeddings": entity.get_json_field('embeddings') if hasattr(entity, "get_json_field") else getattr(entity, "embeddings", None),
                "images_raw": images_raw,
            }

        entity_payloads = [build_entity_payload(e) for e in entities]

        # Parallel favicon fetch
        entity_payloads = await _enrich_with_favicons_parallel(entity_payloads)

        out_entities = []
        for payload in entity_payloads:
            source = payload.get("source", "scraped")
            images_presigned = await _presign_images_list_conditional(payload.pop("images_raw", []), source)
            payload["images"] = images_presigned
            out_entities.append(EntityResponse(**payload))

        logger.info(f"Retrieved {len(out_entities)} entities for user {current_user}")
        return out_entities

    except Exception as e:
        logger.exception("Failed to retrieve entities for user %s: %s", current_user, e)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve entities: {str(e)}")


# -------------------------
# GET /labs  (all labs with pagination)
# -------------------------
@router.get("/labs")
async def get_all_labs(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    try:
        result = await db.execute(
            select(Entity)
            .options(selectinload(Entity.images))
            .order_by(
                case((Entity.source == "user", 0), (Entity.source == "scraped", 1)),
                Entity.timestamp.desc()
            )
            .offset(skip)
            .limit(limit)
        )
        entities = result.scalars().unique().all()

        payloads = []
        for entity in entities:
            images_raw = [
                {
                    "id": str(img.id),
                    "entity_id": str(img.entity_id) if getattr(img, "entity_id", None) else str(entity.id),
                    "url": img.url,
                    "caption": img.caption,
                    "is_primary": img.is_primary,
                    "uploaded_by_user_id": str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                    "created_at": img.created_at if isinstance(img.created_at, datetime) else img.created_at
                }
                for img in getattr(entity, "images", []) or []
            ]
            payload = {
                "id": entity.id,
                "profile_id": str(getattr(entity, "profile_id", None)) if getattr(entity, "profile_id", None) else None,
                "source": getattr(entity, "source", "scraped"),
                "created_by_user_id": getattr(entity, "created_by_user_id", None),
                "url": getattr(entity, "url", None),
                "university": getattr(entity, "university", ""),
                "location": entity.get_json_field('location') if hasattr(entity, "get_json_field") else getattr(entity, "location", {}) or {},
                "website": getattr(entity, "website", None) or None,
                "edurank": entity.get_json_field('edurank') if hasattr(entity, "get_json_field") else getattr(entity, "edurank", {}) or {},
                "department": entity.get_json_field('department') if hasattr(entity, "get_json_field") else getattr(entity, "department", {}) or {},
                "publications_meta": entity.get_json_field('publications_meta') if hasattr(entity, "get_json_field") else getattr(entity, "publications_meta", {}) or {},
                "related": getattr(entity, "related", "") or "",
                "point_of_contact": entity.get_json_field('point_of_contact') if hasattr(entity, "get_json_field") else getattr(entity, "point_of_contact", {}) or {},
                "scopes": entity.get_json_field('scopes') if hasattr(entity, "get_json_field") else getattr(entity, "scopes", []) or [],
                "research_abstract": getattr(entity, "research_abstract", "") or "",
                "lab_equipment": entity.get_json_field('lab_equipment') if hasattr(entity, "get_json_field") else getattr(entity, "lab_equipment", {}) or {},
                "climate_tech_focus": entity.get_json_field('climate_tech_focus') if hasattr(entity, "get_json_field") else getattr(entity, "climate_tech_focus", None),
                "climate_impact_metrics": entity.get_json_field('climate_impact_metrics') if hasattr(entity, "get_json_field") else getattr(entity, "climate_impact_metrics", {}) or {},
                "timestamp": entity.timestamp if isinstance(entity.timestamp, datetime) else datetime.utcnow(),
                "last_updated": entity.last_updated if isinstance(entity.last_updated, datetime) else (entity.last_updated or datetime.utcnow()),
                "embeddings": entity.get_json_field('embeddings') if hasattr(entity, "get_json_field") else getattr(entity, "embeddings", None),
                "images_raw": images_raw,
                "like_count": entity.like_count or 0,
                "comment_count": entity.comment_count or 0,
                "share_count": entity.share_count or 0,
                "view_count": entity.view_count or 0,
            }
            payloads.append(payload)

        # Parallel favicon fetch
        payloads = await _enrich_with_favicons_parallel(payloads)

        out_entities = []
        for payload in payloads:
            imgs_presigned = await _presign_images_list_conditional(
                payload.pop("images_raw", []), payload.get("source")
            )
            payload["images"] = imgs_presigned
            out_entities.append(payload)

        return out_entities

    except Exception as e:
        logger.exception("Failed to retrieve all labs: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve all labs: {e}")




# -------------------------
# GET /user_labs/{id} (single entity for authenticated user)
# -------------------------
@router.get("/user_labs/{id}", response_model=EntityResponse)
async def get_entity(id: str, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(Entity)
            .options(selectinload(Entity.images))
            .where(Entity.id == id)
        )
        entity = result.scalars().first()
        if not entity:
            logger.warning(f"Entity {id} not found")
            raise HTTPException(status_code=404, detail="Entity not found")

        images_raw = [
            {
                "id": str(img.id),
                "url": img.url,
                "caption": img.caption,
                "is_primary": img.is_primary,
                "uploaded_by_user_id": str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                "created_at": img.created_at if isinstance(img.created_at, datetime) else img.created_at
            }
            for img in getattr(entity, "images", []) or []
        ]

        images_presigned = await _presign_images_list_conditional(images_raw, getattr(entity, "source", "scraped"))

        await save_user_entity_link(db, current_user, str(entity.id), "viewed")
        await db.commit()

        payload = {
            "id": entity.id,
            "source": getattr(entity, "source", "scraped"),
            "created_by_user_id": getattr(entity, "created_by_user_id", None),
            "url": getattr(entity, "url", None),
            "university": getattr(entity, "university", ""),
            "location": entity.get_json_field('location') if hasattr(entity, "get_json_field") else getattr(entity, "location", {}) or {},
            "website": getattr(entity, "website", None) or None,
            "edurank": entity.get_json_field('edurank') if hasattr(entity, "get_json_field") else getattr(entity, "edurank", {}) or {},
            "department": entity.get_json_field('department') if hasattr(entity, "get_json_field") else getattr(entity, "department", {}) or {},
            "publications_meta": entity.get_json_field('publications_meta') if hasattr(entity, "get_json_field") else getattr(entity, "publications_meta", {}) or {},
            "related": getattr(entity, "related", "") or "",
            "point_of_contact": entity.get_json_field('point_of_contact') if hasattr(entity, "get_json_field") else getattr(entity, "point_of_contact", {}) or {},
            "scopes": entity.get_json_field('scopes') if hasattr(entity, "get_json_field") else getattr(entity, "scopes", []) or [],
            "research_abstract": getattr(entity, "research_abstract", "") or "",
            "lab_equipment": entity.get_json_field('lab_equipment') if hasattr(entity, "get_json_field") else getattr(entity, "lab_equipment", {}) or {},
            "climate_tech_focus": entity.get_json_field('climate_tech_focus') if hasattr(entity, "get_json_field") else getattr(entity, "climate_tech_focus", None),
            "climate_impact_metrics": entity.get_json_field('climate_impact_metrics') if hasattr(entity, "get_json_field") else getattr(entity, "climate_impact_metrics", {}) or {},
            "timestamp": entity.timestamp if isinstance(entity.timestamp, datetime) else datetime.utcnow(),
            "last_updated": entity.last_updated if isinstance(entity.last_updated, datetime) else (entity.last_updated or datetime.utcnow()),
            "embeddings": entity.get_json_field('embeddings') if hasattr(entity, "get_json_field") else getattr(entity, "embeddings", None),
            "images": images_presigned
        }

        # Parallel favicon fetch (single item)
        payload = (await _enrich_with_favicons_parallel([payload]))[0]

        return EntityResponse(**payload)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to retrieve entity %s: %s", id, e)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve entity: {str(e)}")

# -------------------------
# GET /labs/map (public) - returns all labs with location data for map view
# -------------------------
@router.get("/labs/map")
async def get_labs_map(db: AsyncSession = Depends(get_db)):
    """Get all labs with location data for map display."""
    try:
        result = await db.execute(
            select(
                Entity.id,
                Entity.university,
                Entity.location,
                Entity.department,
                Entity.like_count,
                Entity.view_count
            )
            .where(Entity.location.isnot(None))
            .order_by(Entity.timestamp.desc())
            .limit(1000)
        )
        rows = result.all()
        
        labs = []
        for row in rows:
            location = row.location if isinstance(row.location, dict) else {}
            if location and (location.get("lat") or location.get("latitude") or location.get("coordinates")):
                labs.append({
                    "id": str(row.id),
                    "university": row.university or "",
                    "location": location,
                    "department": row.department if isinstance(row.department, dict) else {},
                    "like_count": row.like_count or 0,
                    "view_count": row.view_count or 0,
                })
        
        return {"items": labs, "count": len(labs)}
    except Exception as e:
        logger.exception("Failed to retrieve labs for map: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve labs for map: {str(e)}")


# -------------------------
# GET /labs/{id} (public)
# -------------------------
@router.get("/labs/{id}")
async def get_lab(id: str, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(Entity)
            .options(selectinload(Entity.images))
            .where(Entity.id == id)
        )
        entity = result.scalars().first()
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")

        # Record unique view (deduplicated per user per day)
        # Done in a separate try/except so failures don't break the GET response
        try:
            from services.view_service import record_view
            view_user_id = None
            try:
                auth_header = request.headers.get("authorization", "")
                if auth_header.startswith("Bearer "):
                    from jose import jwt as jwt_lib
                    token_str = auth_header[7:]
                    jwt_payload = jwt_lib.decode(token_str, os.getenv("JWT_SECRET", "your-secret-key"), algorithms=["HS256"])
                    view_user_id = jwt_payload.get("sub")
            except Exception:
                pass
            view_recorded = await record_view(db, entity.id, user_id=view_user_id)
            if view_recorded:
                await db.commit()
        except Exception as view_err:
            logger.warning("View recording failed for %s: %s", id, view_err)
            try:
                await db.rollback()
            except Exception:
                pass

        # Re-fetch entity after potential rollback to ensure clean state
        result = await db.execute(
            select(Entity)
            .options(selectinload(Entity.images))
            .where(Entity.id == id)
        )
        entity = result.scalars().first()
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")

        images_raw = [
            {
                "id": str(img.id),
                "entity_id": str(img.entity_id) if getattr(img, "entity_id", None) else str(entity.id),
                "url": img.url,
                "caption": img.caption,
                "is_primary": img.is_primary,
                "uploaded_by_user_id": str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                "created_at": img.created_at if isinstance(img.created_at, datetime) else img.created_at
            }
            for img in getattr(entity, "images", []) or []
        ]

        images_presigned = await _presign_images_list_conditional(images_raw, getattr(entity, "source", "scraped"))

        payload = {
            "id": entity.id,
            "profile_id": str(getattr(entity, "profile_id", None)) if getattr(entity, "profile_id", None) else None,
            "source": getattr(entity, "source", "scraped"),
            "created_by_user_id": getattr(entity, "created_by_user_id", None),
            "url": getattr(entity, "url", None),
            "university": getattr(entity, "university", ""),
            "location": entity.get_json_field('location') if hasattr(entity, "get_json_field") else getattr(entity, "location", {}) or {},
            "website": getattr(entity, "website", None) or None,
            "edurank": entity.get_json_field('edurank') if hasattr(entity, "get_json_field") else getattr(entity, "edurank", {}) or {},
            "department": entity.get_json_field('department') if hasattr(entity, "get_json_field") else getattr(entity, "department", {}) or {},
            "publications_meta": entity.get_json_field('publications_meta') if hasattr(entity, "get_json_field") else getattr(entity, "publications_meta", {}) or {},
            "related": getattr(entity, "related", "") or "",
            "point_of_contact": entity.get_json_field('point_of_contact') if hasattr(entity, "get_json_field") else getattr(entity, "point_of_contact", {}) or {},
            "scopes": entity.get_json_field('scopes') if hasattr(entity, "get_json_field") else getattr(entity, "scopes", []) or [],
            "research_abstract": getattr(entity, "research_abstract", "") or "",
            "lab_equipment": entity.get_json_field('lab_equipment') if hasattr(entity, "get_json_field") else getattr(entity, "lab_equipment", {}) or {},
            "climate_tech_focus": entity.get_json_field('climate_tech_focus') if hasattr(entity, "get_json_field") else getattr(entity, "climate_tech_focus", None),
            "climate_impact_metrics": entity.get_json_field('climate_impact_metrics') if hasattr(entity, "get_json_field") else getattr(entity, "climate_impact_metrics", {}) or {},
            "timestamp": entity.timestamp if isinstance(entity.timestamp, datetime) else datetime.utcnow(),
            "last_updated": entity.last_updated if isinstance(entity.last_updated, datetime) else (entity.last_updated or datetime.utcnow()),
            "embeddings": entity.get_json_field('embeddings') if hasattr(entity, "get_json_field") else getattr(entity, "embeddings", None),
            "images": images_presigned,
            "like_count": entity.like_count or 0,
            "comment_count": entity.comment_count or 0,
            "share_count": entity.share_count or 0,
            "view_count": entity.view_count or 0,
        }

        # Fetch partner info if this lab belongs to a partner
        try:
            partner_result = await db.execute(
                select(Partner.id, Partner.name, Partner.slug, Partner.logo_url, Partner.is_verified)
                .join(PartnerEntity, PartnerEntity.partner_id == Partner.id)
                .where(PartnerEntity.entity_id == id, Partner.status == "approved")
            )
            partner_row = partner_result.first()
            if partner_row:
                payload["partner"] = {
                    "id": str(partner_row.id),
                    "name": partner_row.name,
                    "slug": partner_row.slug,
                    "logo_url": partner_row.logo_url,
                    "is_verified": partner_row.is_verified,
                }
            else:
                payload["partner"] = None
        except Exception:
            payload["partner"] = None

        # Parallel favicon fetch (single item)
        payload = (await _enrich_with_favicons_parallel([payload]))[0]

        return payload

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to retrieve entity %s: %s", id, e)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve entity: {str(e)}")


@router.get("/labs/{id}/related")
async def get_related_labs(id: str, limit: int = FastAPIQuery(6, ge=1, le=20), db: AsyncSession = Depends(get_db)):
    """Get related labs based on embedding cosine similarity."""
    try:
        # Get the source entity's embedding
        source_result = await db.execute(
            select(EntityEmbedding.vector).where(EntityEmbedding.entity_id == id)
        )
        source_embedding = source_result.scalar()

        if source_embedding is None:
            # Fallback: return random labs
            result = await db.execute(
                select(Entity.id, Entity.university, Entity.location, Entity.department, Entity.like_count, Entity.comment_count, Entity.share_count, Entity.view_count)
                .where(Entity.id != id)
                .order_by(func.random())
                .limit(limit)
            )
            labs = []
            for row in result.all():
                labs.append({
                    "id": str(row.id),
                    "university": row.university or "",
                    "location": row.location or {},
                    "department": row.department or {},
                    "like_count": row.like_count or 0,
                    "comment_count": row.comment_count or 0,
                    "share_count": row.share_count or 0,
                    "view_count": row.view_count or 0,
                })
            return {"items": labs}

        # Calculate cosine similarity with other entities' embeddings
        import numpy as np
        source_vec = np.array(source_embedding, dtype=np.float32)
        source_norm = np.linalg.norm(source_vec)
        if source_norm == 0:
            return {"items": []}

        all_result = await db.execute(
            select(EntityEmbedding.entity_id, EntityEmbedding.vector)
            .where(EntityEmbedding.entity_id != id)
        )
        scored = []
        for row in all_result.all():
            if row.vector:
                other_vec = np.array(row.vector, dtype=np.float32)
                other_norm = np.linalg.norm(other_vec)
                if other_norm > 0:
                    similarity = float(np.dot(source_vec, other_vec) / (source_norm * other_norm))
                    scored.append((str(row.entity_id), similarity))

        scored.sort(key=lambda x: x[1], reverse=True)
        top_ids = [s[0] for s in scored[:limit]]

        if not top_ids:
            return {"items": []}

        entities_result = await db.execute(
            select(Entity.id, Entity.university, Entity.location, Entity.department, Entity.like_count, Entity.comment_count, Entity.share_count, Entity.view_count)
            .where(Entity.id.in_(top_ids))
        )
        entity_map = {}
        for row in entities_result.all():
            entity_map[str(row.id)] = {
                "id": str(row.id),
                "university": row.university or "",
                "location": row.location or {},
                "department": row.department or {},
                "like_count": row.like_count or 0,
                "comment_count": row.comment_count or 0,
                "share_count": row.share_count or 0,
                "view_count": row.view_count or 0,
            }

        # Preserve similarity order
        labs = [entity_map[eid] for eid in top_ids if eid in entity_map]
        return {"items": labs}

    except Exception as e:
        logger.exception("Failed to get related labs for %s: %s", id, e)
        raise HTTPException(status_code=500, detail="Failed to get related labs")


@router.delete("/database/{id}")
async def delete_entity(id: str, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(Entity)
            .join(UserEntityLink, UserEntityLink.entity_id == Entity.id)
            .where(Entity.id == id, UserEntityLink.user_id == current_user)
        )
        entity = result.scalars().first()
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found or not authorized")
        await db.execute(delete(EntityImage).where(EntityImage.entity_id == entity.id))
        await db.execute(delete(UserEntityLink).where(UserEntityLink.entity_id == entity.id))
        await db.delete(entity)
        await db.commit()
        return JSONResponse(content={"message": f"Deleted entity {id}"})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete entity {id} for user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete entity: {str(e)}")

@router.delete("/database")
async def delete_all_entities(current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(Entity)
            .join(UserEntityLink, UserEntityLink.entity_id == Entity.id)
            .where(UserEntityLink.user_id == current_user)
        )
        entities = result.scalars().all()
        for entity in entities:
            await db.execute(delete(EntityImage).where(EntityImage.entity_id == entity.id))
            await db.execute(delete(UserEntityLink).where(UserEntityLink.entity_id == entity.id))
            await db.delete(entity)
        await db.commit()
        return JSONResponse(content={"message": f"Deleted {len(entities)} entities for user {current_user}"})
    except Exception as e:
        logger.error(f"Failed to delete all entities for user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete all entities: {str(e)}")

@router.post("/login", response_model=Token)
async def login(credentials: UserCredentials, db: AsyncSession = Depends(get_db)):
    # reCAPTCHA bypassed for local Next.js frontend testing
    if not credentials.username and not credentials.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email is required")
    user = await authenticate_user(db, credentials.username, credentials.password, credentials.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username/email or password")

    # Get user's profiles
    profiles = await get_user_profiles(db, str(user.id))

    # Get default profile
    default_profile = await get_default_profile(db, str(user.id))

    # Build profile responses with presigned image URLs
    async def _presign_profile_image(key):
        if not key:
            return None
        try:
            return await asyncio.to_thread(storage.url, key)
        except Exception:
            return None

    profile_responses = []
    for p in profiles:
        presigned_img = await _presign_profile_image(p.profile_image)
        profile_responses.append(ProfileResponse(
            id=p.id,
            user_id=p.user_id,
            is_default=p.is_default,
            type=p.type,
            display_name=p.display_name,
            first_name=p.first_name,
            last_name=p.last_name,
            date_of_birth=p.date_of_birth,
            gender=p.gender,
            phone=p.phone,
            website=p.website,
            title=p.title,
            organization=p.organization,
            bio=p.bio,
            location=p.location,
            social_links=p.social_links,
            expertise=p.expertise,
            profile_image=presigned_img,
            metadata_=p.metadata_,
            created_at=p.created_at
        ))

    access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=timedelta(days=1))
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "profile_image_url": user.profile_image_url,
        "profiles": profile_responses,
        "default_profile_id": default_profile.id if default_profile else None
    }

@router.post("/signup", response_model=Token)
async def signup(credentials: SignupCredentials, db: AsyncSession = Depends(get_db)):
    try:
        logger.debug(f"Signup attempt with payload: {credentials.dict()}")
        # if not credentials.recaptcha_response:
        #     logger.warning("reCAPTCHA response missing")
        #     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reCAPTCHA required")
        # if not await verify_recaptcha(credentials.recaptcha_response):
        #     logger.warning("Invalid reCAPTCHA response")
        #     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reCAPTCHA")

        user = await create_user(db, credentials.username, credentials.email, credentials.password)
        if not user:
            logger.warning(f"Signup failed: Username {credentials.username} or email {credentials.email} already exists")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email already exists")

        # Get user's profiles (default profile is automatically created)
        profiles = await get_user_profiles(db, str(user.id))

        # Get default profile
        default_profile = await get_default_profile(db, str(user.id))

        # Build profile responses with presigned image URLs
        async def _presign_img(key):
            if not key:
                return None
            try:
                return await asyncio.to_thread(storage.url, key)
            except Exception:
                return None

        profile_responses = []
        for p in profiles:
            presigned_img = await _presign_img(p.profile_image)
            profile_responses.append(ProfileResponse(
                id=p.id,
                user_id=p.user_id,
                is_default=p.is_default,
                type=p.type,
                display_name=p.display_name,
                first_name=p.first_name,
                last_name=p.last_name,
                date_of_birth=p.date_of_birth,
                gender=p.gender,
                phone=p.phone,
                website=p.website,
                title=p.title,
                organization=p.organization,
                bio=p.bio,
                location=p.location,
                social_links=p.social_links,
                expertise=p.expertise,
                profile_image=presigned_img,
                metadata_=p.metadata_,
                created_at=p.created_at
            ))

        access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=timedelta(days=1))
        logger.info(f"Successful signup for user ID: {user.id}")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": str(user.id),
            "username": user.username,
            "email": user.email,
            "profile_image_url": user.profile_image_url,
            "profiles": profile_responses,
            "default_profile_id": default_profile.id if default_profile else None
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Unexpected error during signup: {tb}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Traceback: {tb}")

@router.get("/verify-token")
async def verify_token(user_id: str = Depends(get_current_user)):
    return {"user_id": user_id}

# @router.get("/history/{user_id}")
# async def get_history(user_id: str, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
#     if user_id != current_user:
#         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this user's history")
#     history = await get_user_history(db, user_id)
#     return history

@router.get("/history/{user_id}")
async def get_history(
    user_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Authorization check
    if user_id != current_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this user's history"
        )

    try:
        logger.debug(f"Fetching history for user {user_id}")
        history = await get_user_history(db, user_id)

        async def json_stream():
            yield '['
            for i, record in enumerate(history):
                if i > 0:
                    yield ','
                yield json.dumps(record)
                # optional: allow small async pauses for large responses
                await asyncio.sleep(0)
            yield ']'

        logger.info(f"Streaming {len(history)} history sessions for user {user_id}")
        return StreamingResponse(json_stream(), media_type="application/json")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving user history for {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user history."
        )

@router.get("/history/{user_id}/{session_id}")
async def get_session_history(user_id: str, session_id: str, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Retrieve history for a specific session, including queries and associated entities."""
    if user_id != current_user:
        logger.warning(f"User {current_user} attempted to access history for user {user_id}, session {session_id}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to access this user's session history")
    try:
        session = await get_session_by_id(db, session_id, user_id)
        if not session:
            logger.warning(f"Session {session_id} not found or not owned by user {user_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or not authorized")

        effective_title = session.title
        if not effective_title or effective_title in ["Untitled Session", "New Session"] or effective_title.startswith("Session "):
            first_query = next((q for q in session.queries if q.query_text), None)
            effective_title = first_query.query_text[:50] + ("..." if len(first_query.query_text) > 50 else "") if first_query else f"Session {str(session.id)[:8]}"

        entities = []
        json_fields = ['location', 'edurank', 'department', 'publications', 'point_of_contact', 'scopes', 'lab_equipment', 'climate_tech_focus', 'climate_impact_metrics', 'embeddings']
        for se in session.session_entities:
            entity = se.entity
            entity_data = {
                "id": str(entity.id),
                "url": entity.url,
                "source": entity.source,
                "created_by_user_id": str(entity.created_by_user_id) if entity.created_by_user_id else None,
                "university": entity.university,
                "location": entity.get_json_field("location"),
                "website": entity.website or None,
                "edurank": entity.get_json_field("edurank"),
                "department": entity.get_json_field("department"),
                "publications_meta": entity.get_json_field("publications_meta"),
                "related": entity.related,
                "point_of_contact": entity.get_json_field("point_of_contact"),
                "scopes": entity.get_json_field("scopes"),
                "research_abstract": entity.research_abstract,
                "lab_equipment": entity.get_json_field("lab_equipment"),
                "climate_tech_focus": entity.get_json_field("climate_tech_focus"),
                "climate_impact_metrics": entity.get_json_field("climate_impact_metrics"),
                "timestamp": entity.timestamp.isoformat() if isinstance(entity.timestamp, datetime) else entity.timestamp,
                "last_updated": entity.last_updated.isoformat() if isinstance(entity.last_updated, datetime) else entity.last_updated,
                "embeddings": entity.get_json_field("embeddings"),
                "images": [
                    {
                        "id": str(img.id),
                        "entity_id": str(img.entity_id),
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

            # ---- NEW: parallel favicon fetch for *all* entities in the session ----
            entities = await _enrich_with_favicons_parallel(
                entities,
                website_key="website",
                source_key="source",
            )

            entities.append(entity_data)

        history = {
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
                    "timestamp": query.timestamp.isoformat() if isinstance(query.timestamp, datetime) else query.timestamp,
                    "entities": [
                        entity for entity_idx, entity in enumerate(entities)
                        if entity["timestamp"] >= query.timestamp.isoformat()
                        and (query_idx == 0 or entity["timestamp"] < session.queries[query_idx].timestamp.isoformat() if query_idx < len(session.queries) else True)
                    ]
                } for query_idx, query in enumerate(sorted(session.queries, key=lambda q: q.timestamp))
            ]
        }

        logger.info(f"Retrieved history for session {session_id} with {len(session.queries)} queries and {len(entities)} entities for user {user_id}")
        return history
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve history for session {session_id}, user {user_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to retrieve session history: {str(e)}")

@router.delete("/history/{user_id}/{session_id}", response_model=DeleteSessionResponse)
async def delete_session(
    user_id: str,
    session_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    logger.debug(f"Attempting to delete session {session_id} for user {user_id}")
    if user_id != current_user:
        logger.warning(f"User {current_user} attempted to delete session {session_id} for user {user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this user's session"
        )
    try:
        result = await db.execute(
            select(Session).where(Session.id == session_id, Session.user_id == user_id)
        )
        session = result.scalars().first()
        if not session:
            logger.warning(f"Session {session_id} not found or not owned by user {user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found or not authorized"
            )
        await db.execute(delete(SessionEntity).where(SessionEntity.session_id == session_id))
        await db.delete(session)
        await db.commit()
        logger.info(f"Deleted session {session_id} for user {user_id}")
        return DeleteSessionResponse(message="Session deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete session {session_id} for user {user_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete session: {str(e)}"
        )

@router.put("/history/{user_id}/{session_id}/title")
async def update_session_title_endpoint(
    user_id: str,
    session_id: str,
    new_title: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if user_id != current_user:
        logger.warning(f"User {current_user} attempted to update title of session {session_id} for user {user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user's session"
        )
    try:
        result = await db.execute(
            select(Session).where(Session.id == session_id, Session.user_id == user_id)
        )
        session = result.scalars().first()
        if not session:
            logger.warning(f"Session {session_id} not found or not owned by user {user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found or not authorized"
            )
        if not new_title or new_title.strip() == "":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New title cannot be empty")
        success = await update_session_title(db, session_id, new_title.strip()[:50])
        if not success:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update session title")
        logger.info(f"Updated title for session {session_id} to {new_title}")
        return {"message": "Session title updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update title for session {session_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update session title: {str(e)}"
        )

@router.post("/share/{session_id}")
async def share_session(session_id: str, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(Session).where(Session.id == session_id, Session.user_id == current_user)
        )
        session = result.scalars().first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or not authorized")
        share_id = await create_shared_session(db, session_id, current_user)
        if not share_id:
            raise HTTPException(status_code=500, detail="Failed to create shared session")
        share_url = f"/api/shared/{share_id}"
        return {"share_url": share_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to share session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to share session: {str(e)}")

@router.get("/shared/{share_id}")
async def get_shared_session_data(share_id: str, db: AsyncSession = Depends(get_db)):
    try:
        shared_session = await get_shared_session(db, share_id)
        if not shared_session:
            raise HTTPException(status_code=404, detail="Shared session not found")
        return shared_session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve shared session {share_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve shared session: {str(e)}")

@router.get("/export/{session_id}/{format}")
async def export_session(session_id: str, format: str, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(Session).where(Session.id == session_id, Session.user_id == current_user)
        )
        session = result.scalars().first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or not authorized")

        df = await export_session_data(db, session_id)
        if df is None or df.empty:
            raise HTTPException(status_code=500, detail="No data available for export")

        filename_base = sanitize_filename(session.title)
        buffer = BytesIO()
        if format.lower() == 'csv':
            df.to_csv(buffer, index=False, encoding='utf-8')
            content_type = "text/csv"
            filename = f"{filename_base}.csv"
        elif format.lower() == 'excel':
            df.to_excel(buffer, index=False, engine='openpyxl', sheet_name='Session Data')
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"{filename_base}.xlsx"
        else:
            raise HTTPException(status_code=400, detail="Invalid format. Use 'csv' or 'excel'")

        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type=content_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export session: {str(e)}")

@router.post("/inquiry")
async def submit_inquiry(request: InquiryRequest, db: AsyncSession = Depends(get_db)):
    try:
        logger.debug(f"Received inquiry for user_id {request.user_id} about entity IDs {request.entity_ids or 'N/A'}, URLs {request.entity_urls or 'N/A'}")

        request.entity_urls = str(request.entity_urls) if request.entity_urls else None
        if not request.entity_ids and not request.entity_urls:
            logger.warning("Neither entity_ids nor entity_urls provided")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one entity_id or entity_url must be provided")

        if (request.entity_ids and len(request.entity_ids) > 1) or (request.entity_urls and len(request.entity_urls) > 1) or (len(request.entity_ids or []) + len(request.entity_urls or []) > 1):
            logger.warning("Multiple entities provided for single-entity endpoint")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Single-entity endpoint accepts only one entity_id or entity_url")

        entity_id = request.entity_ids[0] if request.entity_ids else None
        entity_url = request.entity_urls[0] if request.entity_urls else None

        await check_and_reconnect(db)
        result = await db.execute(select(User).where(User.id == request.user_id))
        user = result.scalars().first()
        if not user:
            logger.warning(f"User not found: {request.user_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        success = await send_inquiry_email(
            client_name=user.username,
            client_email=user.email,
            entity_id=entity_id,
            entity_url=entity_url,
            inquiry=request.inquiry,
            db=db
        )
        if not success:
            logger.error(f"Failed to send inquiry email for user {request.user_id}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send inquiry")

        logger.info(f"Inquiry submitted successfully for user {request.user_id}")
        return {"message": "Inquiry submitted successfully. We will contact you soon."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process inquiry for user {request.user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to process inquiry: {str(e)}")

@router.post("/inquiry/broadcast")
async def submit_inquiry_broadcast(request: InquiryRequest, db: AsyncSession = Depends(get_db)):
    try:
        logger.debug(f"Received broadcast inquiry for user_id {request.user_id} with {len(request.entity_ids or [])} entity IDs and {len(request.entity_urls or [])} entity URLs")

        if not request.entity_ids and not request.entity_urls:
            logger.warning("Neither entity_ids nor entity_urls provided")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one entity_id or entity_url must be provided")

        await check_and_reconnect(db)
        result = await db.execute(select(User).where(User.id == request.user_id))
        user = result.scalars().first()
        if not user:
            logger.warning(f"User not found: {request.user_id}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        valid_entities = await validate_entities(db, request.entity_ids or [], request.entity_urls or [])
        if not valid_entities:
            logger.warning(f"No valid entities found for user {request.user_id}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid entities found")

        results = []
        tasks = []
        for entity in valid_entities:
            tasks.append(
                send_inquiry_email(
                    client_name=user.username,
                    client_email=user.email,
                    entity_id=entity["id"],
                    entity_url=entity["url"],
                    inquiry=request.inquiry,
                    db=db
                )
            )

        email_results = await asyncio.gather(*tasks, return_exceptions=True)
        for entity, email_result in zip(valid_entities, email_results):
            if isinstance(email_result, Exception):
                logger.error(f"Failed to send inquiry email for entity {entity['url']}: {str(email_result)}")
                results.append({
                    "entity_id": str(entity["id"]),
                    "entity_url": entity["url"],
                    "university": entity["university"],
                    "status": "failed",
                    "reason": str(email_result)
                })
            else:
                if email_result:
                    logger.info(f"Inquiry email sent for entity {entity['url']} (user {request.user_id})")
                    results.append({
                        "entity_id": str(entity["id"]),
                        "entity_url": entity["url"],
                        "university": entity["university"],
                        "status": "success"
                    })
                else:
                    logger.error(f"Inquiry email failed for entity {entity['url']} without exception")
                    results.append({
                        "entity_id": str(entity["id"]),
                        "entity_url": entity["url"],
                        "university": entity["university"],
                        "status": "failed",
                        "reason": "Email sending failed without specific error"
                    })

        successful = [r for r in results if r["status"] == "success"]
        failed = [r for r in results if r["status"] == "failed"]

        if not successful:
            logger.error(f"No inquiries sent successfully for user {request.user_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "message": "Failed to send inquiries for all entities",
                    "results": results
                }
            )

        logger.info(f"Broadcast inquiry processed for user {request.user_id}: {len(successful)} successful, {len(failed)} failed")
        return {
            "message": f"Inquiry broadcast completed: {len(successful)} successful, {len(failed)} failed",
            "results": results
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process broadcast inquiry for user {request.user_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to process broadcast inquiry: {str(e)}")

@router.post("/feedback")
async def submit_feedback(request: FeedbackRequest, db: AsyncSession = Depends(get_db)):
    try:
        logger.debug(f"Received feedback from {request.email or 'anonymous'} (user_id: {request.user_id or 'N/A'})")

        if request.user_id:
            await check_and_reconnect(db)
            result = await db.execute(select(User).where(User.id == request.user_id))
            user = result.scalars().first()
            if not user:
                logger.warning(f"User not found: {request.user_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            if request.email and user.email != request.email:
                logger.warning(f"Email {request.email} does not match user {request.user_id} email")
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provided email does not match user record")

        success = await send_feedback_email(
            name=request.name,
            email=request.email,
            feedback=request.feedback,
            user_id=str(request.user_id) if request.user_id else None
        )
        if not success:
            logger.error(f"Failed to send feedback email from {request.email or 'anonymous'}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send feedback")

        logger.info(f"Feedback submitted successfully from {request.email or 'anonymous'}")
        return {"message": "Feedback submitted successfully. Thank you for your input!"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process feedback from {request.email or 'anonymous'}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to process feedback: {str(e)}")


@router.post("/entities/{entity_id}/verifications", response_model=VerificationResponse)
async def add_entity_verification(entity_id: str, verification_data: dict, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Add a verification record for an entity."""
    try:
        verification = await add_verification(db, entity_id, **verification_data)
        if not verification:
            raise HTTPException(status_code=500, detail="Failed to add verification")
        logger.info(f"Verification added for entity {entity_id} by user {current_user}")
        return VerificationResponse.from_orm(verification)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add verification for entity {entity_id} by user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add verification: {str(e)}")

@router.get("/entities/{entity_id}/verifications", response_model=List[VerificationResponse])
async def get_entity_verifications(entity_id: str, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Retrieve verification records for a specific entity."""
    try:
        verifications = await get_verifications_for_entity(db, entity_id)
        logger.info(f"Retrieved {len(verifications)} verifications for entity {entity_id} by user {current_user}")
        return [VerificationResponse.from_orm(v) for v in verifications]
    except Exception as e:
        logger.error(f"Failed to retrieve verifications for entity {entity_id} by user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve verifications: {str(e)}")

@router.post("/entities/{entity_id}/embeddings", response_model=EntityEmbeddingResponse)
async def add_embedding(entity_id: str, embedding_data: dict, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Add an embedding for an entity."""
    try:
        embedding = await add_entity_embedding(db, entity_id, **embedding_data)
        if not embedding:
            raise HTTPException(status_code=500, detail="Failed to add embedding")
        logger.info(f"Embedding added for entity {entity_id} by user {current_user}")
        return EntityEmbeddingResponse.from_orm(embedding)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add embedding for entity {entity_id} by user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add embedding: {str(e)}")

@router.get("/entities/{entity_id}/embeddings", response_model=List[EntityEmbeddingResponse])
async def get_embeddings(entity_id: str, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Retrieve embeddings for a specific entity."""
    try:
        embeddings = await get_entity_embeddings(db, entity_id)
        logger.info(f"Retrieved {len(embeddings)} embeddings for entity {entity_id} by user {current_user}")
        return [EntityEmbeddingResponse.from_orm(e) for e in embeddings]
    except Exception as e:
        logger.error(f"Failed to retrieve embeddings for entity {entity_id} by user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve embeddings: {str(e)}")


@router.post("/publications", response_model=PublicationResponse)
async def create_new_publication(
    publication_data: PublicationCreate,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new publication."""
    try:
        publication = await create_publication(db, **publication_data.dict())
        if not publication:
            raise HTTPException(status_code=500, detail="Failed to create publication")
        logger.info(f"Publication created by user {current_user}")
        return PublicationResponse.from_orm(publication)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create publication for user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create publication: {str(e)}")


@router.get("/entities/{entity_id}/publications", response_model=List[PublicationResponse])
async def get_entity_publications(entity_id: str, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Retrieve publications for a specific entity."""
    try:
        publications = await get_publications_for_entity(db, entity_id)
        logger.info(f"Retrieved {len(publications)} publications for entity {entity_id} by user {current_user}")
        return [PublicationResponse.from_orm(p) for p in publications]
    except Exception as e:
        logger.error(f"Failed to retrieve publications for entity {entity_id} by user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve publications: {str(e)}")


@router.post("/profile_backlinks", response_model=Dict)
async def create_backlink(backlink_data: dict, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Create a new profile backlink."""
    try:
        backlink = await create_profile_backlink(db, **backlink_data)
        if not backlink:
            raise HTTPException(status_code=500, detail="Failed to create backlink")
        logger.info(f"Backlink created by user {current_user}")
        return {"id": str(backlink.id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create backlink for user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create backlink: {str(e)}")

@router.post("/ecosystem_links", response_model=Dict)
async def create_ecosystem_link(link_data: dict, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Create a new ecosystem entity link."""
    try:
        link = await create_ecosystem_entity_link(db, **link_data)
        if not link:
            raise HTTPException(status_code=500, detail="Failed to create ecosystem link")
        logger.info(f"Ecosystem link created by user {current_user}")
        return {"id": str(link.id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create ecosystem link for user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create ecosystem link: {str(e)}")


# -------------------------
# Forgot Password Endpoints
# -------------------------

@router.post("/forgot-password", response_model=PasswordResetResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Initiate password reset by sending email with reset link.
    """
    try:
        logger.info(f"Password reset requested for email: {request.email}")

        # Verify reCAPTCHA
        if not request.recaptcha_response:
            raise HTTPException(status_code=400, detail="reCAPTCHA required")
        if not await verify_recaptcha(request.recaptcha_response):
            raise HTTPException(status_code=400, detail="Invalid reCAPTCHA")

        # Create password reset token
        password_reset = await create_password_reset_token(db, request.email)

        # Don't reveal if email exists (security best practice)
        # Always return success message even if user doesn't exist
        if password_reset:
            # Generate reset link
            base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            reset_link = generate_password_reset_link(base_url, password_reset.token)

            # Send reset email
            email_sent = await send_password_reset_email(
                email=request.email,
                reset_link=reset_link
            )

            if not email_sent:
                logger.error(f"Failed to send password reset email to {request.email}")
                # Still return success to avoid revealing user existence

        logger.info(f"Password reset initiated for email: {request.email}")

        return PasswordResetResponse(
            message="If an account exists with this email, you will receive a password reset link shortly.",
            email_sent=True
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing forgot password request: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred. Please try again.")


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Reset password using token from email.
    """
    try:
        logger.info(f"Password reset attempt with token: {request.token[:10]}...")

        # Verify reCAPTCHA
        if not request.recaptcha_response:
            raise HTTPException(status_code=400, detail="reCAPTCHA required")
        if not await verify_recaptcha(request.recaptcha_response):
            raise HTTPException(status_code=400, detail="Invalid reCAPTCHA")

        # Verify token exists and get user
        user = await verify_password_reset_token(db, request.token)

        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token. Please request a new password reset.")

        # Reset password
        success = await reset_password_util(db, request.token, request.new_password)

        if not success:
            raise HTTPException(status_code=500, detail="Failed to reset password. Please try again.")

        # Send confirmation email
        await send_password_reset_confirmation_email(user.email)

        logger.info(f"Password reset successful for user: {user.id}")

        return {
            "message": "Password reset successfully. You can now login with your new password."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred. Please try again.")


@router.get("/reset-password/validate")
async def validate_reset_token(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Validate if a reset token is still valid (used for pre-validation on frontend).
    """
    try:
        user = await verify_password_reset_token(db, token)

        if not user:
            return {
                "valid": False,
                "message": "Invalid or expired reset token"
            }

        return {
            "valid": True,
            "email": user.email
        }

    except Exception as e:
        logger.error(f"Error validating reset token: {str(e)}")
        return {
            "valid": False,
            "message": "Error validating token"
        }


@router.post("/complete-registration", response_model=CompleteRegistrationResponse)
async def complete_registration(
    request: CompleteRegistrationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Complete registration by setting a password from a token sent via email.
    This is used when users register for an event with 'create_account=True' but no password.
    """
    try:
        logger.info(f"Completing registration with token: {request.token[:10]}...")

        # Complete the registration
        base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        success, message, redirect_url = await complete_registration_password_setup(
            db,
            request.token,
            request.new_password,
            base_url
        )

        if not success:
            raise HTTPException(status_code=400, detail=message)

        logger.info(f"Registration completed successfully")

        return CompleteRegistrationResponse(
            message=message,
            redirect_url=redirect_url
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing registration: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred. Please try again.")


@router.get("/complete-registration/validate")
async def validate_registration_token(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Validate if a registration completion token is still valid.
    Handles both event registration tokens and bulk import invitation tokens.
    """
    try:
        # First check if this is a bulk import token
        profile = await verify_bulk_import_token(db, token)
        
        if profile:
            user = profile.user
            return {
                "valid": True,
                "email": user.email if user else None,
                "full_name": f"{profile.first_name or ''} {profile.last_name or ''}".strip() or None,
                "expired": False,
                "type": "bulk_import"
            }
        
        # Otherwise check if it's an event registration token
        registration = await verify_registration_setup_token(db, token)

        if not registration:
            return {
                "valid": False,
                "message": "Invalid or expired registration link",
                "expired": True
            }

        return {
            "valid": True,
            "email": registration.email,
            "full_name": f"{registration.first_name} {registration.last_name}",
            "expired": False,
            "type": "event_registration"
        }

    except Exception as e:
        logger.error(f"Error validating registration token: {str(e)}")
        return {
            "valid": False,
            "message": "Error validating token",
            "expired": False
        }


@router.get("/reject-registration")
async def get_reject_registration_page(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Render the rejection confirmation page.
    This is called when user clicks the reject link in email.
    Handles both event registration and bulk import tokens.
    """
    try:
        # First check if this is a bulk import token
        profile = await verify_bulk_import_token(db, token)
        
        if profile:
            user = profile.user
            return {
                "valid": True,
                "email": user.email if user else None,
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "event_id": None,
                "type": "bulk_import"
            }
        
        # Otherwise check if it's an event registration rejection token
        registration = await verify_rejection_token(db, token)

        if not registration:
            return {
                "valid": False,
                "message": "Invalid or expired rejection link"
            }

        return {
            "valid": True,
            "email": registration.email,
            "first_name": registration.first_name,
            "last_name": registration.last_name,
            "event_id": str(registration.event_id) if registration.event_id else None,
            "type": "event_registration"
        }

    except Exception as e:
        logger.error(f"Error validating rejection token: {str(e)}")
        return {
            "valid": False,
            "message": "Error validating token"
        }


@router.post("/reject-registration")
async def reject_registration_confirm(
    token: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Confirm rejection of a registration or bulk import invitation.
    This removes all user data associated with the registration/invitation.
    """
    try:
        logger.info(f"Rejecting registration/invitation with token: {token[:10]}...")

        # First check if this is a bulk import token
        profile = await verify_bulk_import_token(db, token)
        
        if profile:
            # This is a bulk import - reject it
            success, message = await reject_bulk_import_invitation(db, token)
            
            if not success:
                raise HTTPException(status_code=400, detail=message)
            
            return {"message": message}
        
        # Otherwise handle as event registration rejection
        # Get registration details before rejection for email
        registration = await verify_rejection_token(db, token)
        if not registration:
            raise HTTPException(status_code=400, detail="Invalid or expired rejection link")

        event_id = registration.event_id
        email = registration.email
        first_name = registration.first_name

        # Get event title
        from models.db_models import Event
        result = await db.execute(
            select(Event).where(Event.id == event_id)
        )
        event = result.scalar_one_or_none()
        event_title = event.title if event else "the event"

        # Reject the registration (this deletes all data)
        success, message = await reject_registration(db, token)

        if not success:
            raise HTTPException(status_code=400, detail=message)

        # Send confirmation email
        await send_registration_rejection_confirmation_email(
            email=email,
            first_name=first_name,
            event_title=event_title
        )

        logger.info(f"Registration rejected successfully for {email}")

        return {
            "message": message,
            "success": True
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting registration: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred. Please try again.")
