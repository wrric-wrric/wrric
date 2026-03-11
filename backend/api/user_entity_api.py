import asyncio
import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, BackgroundTasks, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, delete, update
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from models.db_models import Entity, EntityImage, UserEntityLink
from api.schemas import EntityCreate, EntityUpdate, EntityResponse
from api.dependencies import get_db, get_current_user
from utils.database import save_user_entity_link, check_and_reconnect
from utils.database import engine
from sqlalchemy.ext.asyncio import AsyncSession as SQLAlchemyAsyncSession

from media.storage import CustomB2Storage

logger = logging.getLogger(__name__)
router = APIRouter(tags=["entities"])

# Storage client (single instance)
storage = CustomB2Storage()

# -------------------------
# Helpers
# -------------------------
async def _presign_url_maybe(key_or_url: Optional[str]) -> Optional[str]:
    """
    If key_or_url is an absolute URL (http/https), return as-is.
    If it's an object key, generate a presigned URL via storage.url in a thread.
    If falsy, return None.
    """
    if not key_or_url:
        return None
    if isinstance(key_or_url, str) and (key_or_url.startswith("http://") or key_or_url.startswith("https://")):
        return key_or_url
    return await asyncio.to_thread(storage.url, key_or_url)

async def _presign_images_list(images: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Given a list of image dicts (each containing an 'url' field that is either a key or absolute URL),
    return a new list where 'url' is replaced by a fresh presigned URL or left as-is for absolute URLs.
    """
    if not images:
        return []
    tasks = [_presign_url_maybe(img.get("url")) for img in images]
    presigned_urls = await asyncio.gather(*tasks, return_exceptions=False)
    out = []
    for img, pres in zip(images, presigned_urls):
        new_img = dict(img)
        new_img["url"] = pres
        out.append(new_img)
    return out

# -------------------------
# Background: record viewed actions (safe)
# -------------------------
async def record_viewed_actions_bg(user_id: str, entity_ids: List[str]):
    """
    Background worker that opens its own AsyncSession and writes 'viewed' records.
    Safe to attach to FastAPI BackgroundTasks.
    """
    try:
        async with SQLAlchemyAsyncSession(engine, expire_on_commit=False) as bg_db:
            bg_db = await check_and_reconnect(bg_db)
            for eid in entity_ids:
                try:
                    await save_user_entity_link(bg_db, user_id, eid, "viewed")
                except Exception as e:
                    logger.exception("Failed to save viewed link in background for %s -> %s: %s", user_id, eid, e)
    except Exception:
        logger.exception("Background viewed-actions worker failed")

# -------------------------
# Upload images endpoint
# -------------------------
@router.post("/{entity_id}/images", response_model=List[dict])
async def upload_entity_images(
    entity_id: uuid.UUID,
    files: List[UploadFile] = File(...),
    current_user: uuid.UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload one or more files for an existing entity.
    - Files are uploaded to S3-compatible storage using `storage.s3_client.put_object`.
    - The DB stores the object key in EntityImage.url.
    - Response returns created image records with object keys (not presigned URLs).
    """
    try:
        stmt = (
            select(Entity)
            .where(Entity.id == entity_id, Entity.created_by_user_id == current_user)
            .options(selectinload(Entity.images))
        )
        result = await db.execute(stmt)
        entity = result.scalars().first()
        if not entity:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entity not found or not authorized")

        created_images: List[Dict[str, Any]] = []
        for upload in files:
            key = f"entities/{str(entity_id)}/{uuid.uuid4().hex}_{upload.filename}"
            content = await upload.read()
            await asyncio.to_thread(
                storage.s3_client.put_object,
                Bucket=storage.bucket_name,
                Key=key,
                Body=content,
                ContentType=upload.content_type
            )
            entity_image = EntityImage(
                entity_id=entity.id,
                url=key,
                caption=upload.filename,
                is_primary=False,
                uploaded_by_user_id=current_user,
                created_at=datetime.utcnow()
            )
            db.add(entity_image)
            await db.flush()
            await db.refresh(entity_image)
            created_images.append({
                "id": str(entity_image.id),
                "entity_id": str(entity_image.entity_id),
                "url": entity_image.url,  # Return object key
                "caption": entity_image.caption,
                "is_primary": entity_image.is_primary,
                "uploaded_by_user_id": str(entity_image.uploaded_by_user_id) if entity_image.uploaded_by_user_id else None,
                "created_at": entity_image.created_at.isoformat() if isinstance(entity_image.created_at, datetime) else entity_image.created_at
            })
        await db.commit()
        return created_images  # Return object keys, not presigned URLs
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to upload entity images: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# -------------------------
# Patch single image metadata
# -------------------------
@router.patch("/{entity_id}/images/{image_id}", response_model=dict)
async def patch_entity_image(
    entity_id: uuid.UUID,
    image_id: int,
    payload: Dict[str, Any] = Body(...),
    current_user: uuid.UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update image metadata (caption, is_primary).
    If is_primary=True is set, clears is_primary on other images for the entity.
    Response returns object key (not presigned URL).
    """
    try:
        logger.debug("Patching image %s for entity %s by user %s payload=%s", image_id, entity_id, current_user, payload)
        stmt = (
            select(Entity)
            .where(Entity.id == entity_id, Entity.created_by_user_id == current_user)
            .options(selectinload(Entity.images))
        )
        res = await db.execute(stmt)
        entity = res.scalars().first()
        if not entity:
            logger.warning("Entity %s not found or not authorized for user %s", entity_id, current_user)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entity not found or not authorized")
        img_res = await db.execute(
            select(EntityImage).where(EntityImage.id == image_id, EntityImage.entity_id == entity.id)
        )
        img = img_res.scalars().first()
        if not img:
            logger.warning("Image %s not found for entity %s", image_id, entity_id)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
        caption = payload.get("caption")
        is_primary = payload.get("is_primary")
        if caption is not None:
            img.caption = caption
        if is_primary is not None:
            if is_primary:
                await db.execute(
                    update(EntityImage)
                    .where(EntityImage.entity_id == entity.id)
                    .values(is_primary=False)
                )
                img.is_primary = True
            else:
                img.is_primary = False
        await db.commit()
        await db.refresh(img)
        out = {
            "id": str(img.id),
            "entity_id": str(img.entity_id),
            "url": img.url,  # Return object key
            "caption": img.caption,
            "is_primary": img.is_primary,
            "uploaded_by_user_id": str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
            "created_at": img.created_at.isoformat() if isinstance(img.created_at, datetime) else img.created_at
        }
        logger.info("Patched image %s for entity %s (user=%s)", image_id, entity_id, current_user)
        return out
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to patch image %s for entity %s: %s", image_id, entity_id, e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# -------------------------
# Delete single image
# -------------------------
@router.delete("/{entity_id}/images/{image_id}")
async def delete_entity_image(
    entity_id: uuid.UUID,
    image_id: int,
    current_user: uuid.UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a single image by id for a given entity.
    - Verifies ownership/access.
    - Attempts to remove the storage object if the DB value is an object key (best-effort).
    - Removes the DB row.
    """
    try:
        logger.debug("Deleting image %s for entity %s by user %s", image_id, entity_id, current_user)
        stmt = (
            select(Entity)
            .where(Entity.id == entity_id, Entity.created_by_user_id == current_user)
            .options(selectinload(Entity.images))
        )
        res = await db.execute(stmt)
        entity = res.scalars().first()
        if not entity:
            logger.warning("Entity %s not found or not authorized for user %s", entity_id, current_user)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entity not found or not authorized")
        img_res = await db.execute(
            select(EntityImage).where(EntityImage.id == image_id, EntityImage.entity_id == entity.id)
        )
        img = img_res.scalars().first()
        if not img:
            logger.warning("Image %s not found for entity %s", image_id, entity_id)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")
        if img.url and not str(img.url).lower().startswith("http"):
            try:
                await asyncio.to_thread(
                    storage.s3_client.delete_object,
                    Bucket=storage.bucket_name,
                    Key=img.url
                )
                logger.debug("Deleted storage object for key %s", img.url)
            except Exception:
                logger.exception("Failed to delete storage object for key %s (best-effort)", img.url)
        await db.execute(delete(EntityImage).where(EntityImage.id == img.id))
        await db.commit()
        logger.info("Deleted image %s for entity %s (user=%s)", image_id, entity_id, current_user)
        return {"message": "Image deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to delete image %s for entity %s: %s", image_id, entity_id, e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# -------------------------
# Create entity
# -------------------------
@router.post("/", response_model=EntityResponse)
async def create_entity(
    request: EntityCreate,
    background_tasks: BackgroundTasks,
    current_user: uuid.UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new user-submitted entity.
    - Image DB rows store object keys only.
    - Response contains presigned URLs for client convenience.
    """
    try:
        logger.debug("Creating entity for user_id %s", current_user)
        logger.info("Request data: %s", request.dict())

        # Validate profile_id if provided
        profile_id = None
        if request.profile_id:
            # Verify profile ownership
            from models.db_models import Profile
            result = await db.execute(
                select(Profile).where(Profile.id == request.profile_id, Profile.user_id == current_user)
            )
            profile = result.scalar_one_or_none()
            if not profile:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Profile not found or not owned by user")
            profile_id = request.profile_id

        entity = Entity(
            created_by_user_id=current_user,
            profile_id=profile_id,
            source="user",
            url=str(request.url) if request.url else None,
            university=request.university,
            location=request.location,
            website=str(request.website) if request.website else None,
            edurank=request.edurank,
            department=request.department,
            publications_meta=request.publications_meta,
            related=request.related,
            point_of_contact=request.point_of_contact,
            scopes=request.scopes,
            research_abstract=request.research_abstract,
            lab_equipment=request.lab_equipment,
            climate_tech_focus=request.climate_tech_focus,
            climate_impact_metrics=request.climate_impact_metrics,
            embeddings=request.embeddings,
            timestamp=datetime.utcnow(),
            last_updated=datetime.utcnow()
        )
        for field in [
            'location', 'edurank', 'department', 'publications_meta',
            'point_of_contact', 'scopes', 'lab_equipment',
            'climate_tech_focus', 'climate_impact_metrics', 'embeddings'
        ]:
            entity.set_json_field(field, getattr(request, field))
        db.add(entity)
        await db.commit()
        await db.refresh(entity)
        images_response_list: List[Dict[str, Any]] = []
        if getattr(request, "images", None):
            for img in request.images:
                if not isinstance(img, dict):
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Each image must be an object with a 'url' key containing the object key.")
                raw_url = img.get("url")
                if not raw_url or not isinstance(raw_url, str):
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image 'url' must be a non-empty string containing the object key.")
                if raw_url.lower().startswith("http://") or raw_url.lower().startswith("https://"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Image URLs must be object keys (no http(s) URLs). Upload files using /{entity_id}/images endpoint which returns object keys."
                    )
                key = raw_url.lstrip("/")
                entity_image = EntityImage(
                    entity_id=entity.id,
                    url=key,
                    caption=img.get("caption") if img.get("caption") else None,
                    is_primary=bool(img.get("is_primary")),
                    uploaded_by_user_id=current_user,
                    created_at=datetime.utcnow()
                )
                db.add(entity_image)
                await db.flush()
                await db.refresh(entity_image)
                images_response_list.append({
                    "id": str(entity_image.id),
                    "entity_id": str(entity_image.entity_id),
                    "url": entity_image.url,
                    "caption": entity_image.caption,
                    "is_primary": entity_image.is_primary,
                    "uploaded_by_user_id": str(entity_image.uploaded_by_user_id) if entity_image.uploaded_by_user_id else None,
                    "created_at": entity_image.created_at.isoformat()
                })
            await db.commit()
        await save_user_entity_link(db, str(current_user), str(entity.id), "created")
        await save_user_entity_link(db, str(current_user), str(entity.id), "viewed")
        stmt = (
            select(Entity)
            .options(selectinload(Entity.user_links), selectinload(Entity.images))
            .where(Entity.id == entity.id)
        )
        result = await db.execute(stmt)
        entity = result.scalar_one()
        raw_images = [
            {
                "id": str(img.id),
                "entity_id": str(img.entity_id),
                "url": img.url,
                "caption": img.caption,
                "is_primary": img.is_primary,
                "uploaded_by_user_id": str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                "created_at": img.created_at.isoformat() if isinstance(img.created_at, datetime) else img.created_at
            } for img in entity.images
        ]
        presigned_images = await _presign_images_list(raw_images)
        user_interactions = [
            {
                "id": link.id,
                "user_id": str(link.user_id),
                "entity_id": str(link.entity_id),
                "interaction_type": link.interaction_type,
                "notes": link.notes,
                "metadata_": link.metadata_,
                "timestamp": link.timestamp.isoformat() if isinstance(link.timestamp, datetime) else link.timestamp
            } for link in entity.user_links if link.user_id == current_user
        ]

        # Build profile info if available
        profile_dict = None
        if entity.profile:
            profile_dict = {
                "id": str(entity.profile.id),
                "user_id": str(entity.profile.user_id),
                "is_default": entity.profile.is_default,
                "type": entity.profile.type,
                "display_name": entity.profile.display_name,
                "first_name": entity.profile.first_name,
                "last_name": entity.profile.last_name,
                "bio": entity.profile.bio,
                "title": entity.profile.title,
                "organization": entity.profile.organization,
                "profile_image": entity.profile.profile_image,
                "created_at": entity.profile.created_at.isoformat() if isinstance(entity.profile.created_at, datetime) else None
            }

        entity_dict = {
            "id": str(entity.id),
            "source": entity.source,
            "created_by_user_id": str(entity.created_by_user_id) if entity.created_by_user_id else None,
            "profile_id": str(entity.profile_id) if entity.profile_id else None,
            "profile": profile_dict,
            "url": entity.url,
            "university": entity.university,
            "website": entity.website if entity.website else None,
            "related": entity.related,
            "research_abstract": entity.research_abstract,
            "timestamp": entity.timestamp.isoformat() if isinstance(entity.timestamp, datetime) else entity.timestamp,
            "last_updated": entity.last_updated.isoformat() if isinstance(entity.last_updated, datetime) else entity.last_updated,
            "location": entity.get_json_field("location"),
            "edurank": entity.get_json_field("edurank"),
            "department": entity.get_json_field("department"),
            "publications_meta": entity.get_json_field("publications_meta"),
            "point_of_contact": entity.get_json_field("point_of_contact"),
            "scopes": entity.get_json_field("scopes"),
            "lab_equipment": entity.get_json_field("lab_equipment"),
            "climate_tech_focus": entity.get_json_field("climate_tech_focus"),
            "climate_impact_metrics": entity.get_json_field("climate_impact_metrics"),
            "embeddings": entity.get_json_field("embeddings"),
            "images": presigned_images,
            "user_interactions": user_interactions
        }
        logger.info("Entity created with ID %s for user %s", entity.id, current_user)
        return EntityResponse(**entity_dict)
    except IntegrityError as e:
        await db.rollback()
        if 'ix_entities_url' in str(getattr(e, "orig", "")):
            logger.warning("Duplicate entity URL detected: %s", request.url)
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Entity with URL '{request.url}' already exists.")
        logger.exception("Integrity error creating entity")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database integrity error")
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to create entity for user %s: %s", current_user, e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# -------------------------
# Get entities
# -------------------------
@router.get("/", response_model=List[EntityResponse])
async def get_entities(
    current_user: uuid.UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """
    Retrieve entities created by the current user.
    Response contains presigned URLs for images.
    """
    try:
        logger.debug("Fetching entities created by user_id %s skip=%s limit=%s", current_user, skip, limit)
        result = await db.execute(
            select(Entity)
            .where(
                and_(
                    Entity.created_by_user_id == current_user,
                    Entity.source != "scraped"
                )
            )
            .options(selectinload(Entity.images), selectinload(Entity.user_links), selectinload(Entity.profile))
            .offset(skip)
            .limit(limit)
        )
        entities = result.scalars().unique().all()
        response_entities = []
        for entity in entities:
            raw_images = [
                {
                    "id": str(img.id),
                    "entity_id": str(img.entity_id),
                    "url": img.url,
                    "caption": img.caption,
                    "is_primary": img.is_primary,
                    "uploaded_by_user_id": str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                    "created_at": img.created_at.isoformat() if isinstance(img.created_at, datetime) else img.created_at
                } for img in entity.images
            ]
            presigned_images = await _presign_images_list(raw_images)

            entity_dict = {
                "id": str(entity.id),
                "source": entity.source,
                "created_by_user_id": str(entity.created_by_user_id) if entity.created_by_user_id else None,
                "profile_id": str(entity.profile_id) if entity.profile_id else None,
                "url": entity.url,
                "university": entity.university,
                "website": entity.website if entity.website else None,
                "related": entity.related,
                "research_abstract": entity.research_abstract,
                "timestamp": entity.timestamp.isoformat() if isinstance(entity.timestamp, datetime) else entity.timestamp,
                "last_updated": entity.last_updated.isoformat() if isinstance(entity.last_updated, datetime) else entity.last_updated,
                "location": entity.get_json_field("location"),
                "edurank": entity.get_json_field("edurank"),
                "department": entity.get_json_field("department"),
                "publications_meta": entity.get_json_field("publications_meta"),
                "point_of_contact": entity.get_json_field("point_of_contact"),
                "scopes": entity.get_json_field("scopes"),
                "lab_equipment": entity.get_json_field("lab_equipment"),
                "climate_tech_focus": entity.get_json_field("climate_tech_focus"),
                "climate_impact_metrics": entity.get_json_field("climate_impact_metrics"),
                "embeddings": entity.get_json_field("embeddings"),
                "images": presigned_images,
                "user_interactions": []
            }
            response_entities.append(EntityResponse(**entity_dict))

        logger.info("Retrieved %d entities created by user %s (skip=%s limit=%s)", len(entities), current_user, skip, limit)
        return response_entities
    except Exception as e:
        logger.exception("Failed to retrieve entities created by user %s: %s", current_user, e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# -------------------------
# Get single entity
# -------------------------
@router.get("/{entity_id}", response_model=EntityResponse)
async def get_entity(
    entity_id: uuid.UUID,
    current_user: uuid.UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve a single entity.
    Response contains presigned URLs for images.
    """
    try:
        logger.debug("Fetching entity %s for user %s", entity_id, current_user)
        result = await db.execute(
            select(Entity)
            .join(UserEntityLink, UserEntityLink.entity_id == Entity.id)
            .where((Entity.id == entity_id) & (UserEntityLink.user_id == current_user))
            .options(selectinload(Entity.images), selectinload(Entity.user_links), selectinload(Entity.profile))
        )
        entity = result.scalars().first()
        if not entity:
            logger.warning("Entity %s not found for user %s", entity_id, current_user)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entity not found")
        raw_images = [
            {
                "id": str(img.id),
                "entity_id": str(img.entity_id),
                "url": img.url,
                "caption": img.caption,
                "is_primary": img.is_primary,
                "uploaded_by_user_id": str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                "created_at": img.created_at.isoformat() if isinstance(img.created_at, datetime) else img.created_at
            } for img in entity.images
        ]
        presigned_images = await _presign_images_list(raw_images)
        user_interactions = [
            {
                "id": link.id,
                "user_id": str(link.user_id),
                "entity_id": str(link.entity_id),
                "interaction_type": link.interaction_type,
                "notes": link.notes,
                "metadata_": link.metadata_,
                "timestamp": link.timestamp.isoformat() if isinstance(link.timestamp, datetime) else link.timestamp
            } for link in entity.user_links if link.user_id == current_user
        ]

        profile_dict = None
        if entity.profile:
            profile_dict = {
                "id": str(entity.profile.id),
                "user_id": str(entity.profile.user_id),
                "is_default": entity.profile.is_default,
                "type": entity.profile.type,
                "display_name": entity.profile.display_name,
                "first_name": entity.profile.first_name,
                "last_name": entity.profile.last_name,
                "bio": entity.profile.bio,
                "title": entity.profile.title,
                "organization": entity.profile.organization,
                "profile_image": entity.profile.profile_image,
                "created_at": entity.profile.created_at.isoformat() if isinstance(entity.profile.created_at, datetime) else None
            }

        entity_dict = {
            "id": str(entity.id),
            "source": entity.source,
            "created_by_user_id": str(entity.created_by_user_id) if entity.created_by_user_id else None,
            "profile_id": str(entity.profile_id) if entity.profile_id else None,
            "profile": profile_dict,
            "url": entity.url,
            "university": entity.university,
            "website": entity.website if entity.website else None,
            "related": entity.related,
            "research_abstract": entity.research_abstract,
            "timestamp": entity.timestamp.isoformat() if isinstance(entity.timestamp, datetime) else entity.timestamp,
            "last_updated": entity.last_updated.isoformat() if isinstance(entity.last_updated, datetime) else entity.last_updated,
            "location": entity.get_json_field("location"),
            "edurank": entity.get_json_field("edurank"),
            "department": entity.get_json_field("department"),
            "publications_meta": entity.get_json_field("publications_meta"),
            "point_of_contact": entity.get_json_field("point_of_contact"),
            "scopes": entity.get_json_field("scopes"),
            "lab_equipment": entity.get_json_field("lab_equipment"),
            "climate_tech_focus": entity.get_json_field("climate_tech_focus"),
            "climate_impact_metrics": entity.get_json_field("climate_impact_metrics"),
            "embeddings": entity.get_json_field("embeddings"),
            "images": presigned_images,
            "user_interactions": user_interactions
        }
        await save_user_entity_link(db, str(current_user), str(entity.id), "viewed")
        await db.commit()
        logger.info("Retrieved entity %s for user %s", entity_id, current_user)
        return EntityResponse(**entity_dict)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to retrieve entity %s for user %s: %s", entity_id, current_user, e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# -------------------------
# Update entity
# -------------------------
@router.put("/{entity_id}", response_model=EntityResponse)
async def update_entity(
    entity_id: uuid.UUID,
    request: EntityUpdate,
    current_user: uuid.UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update entity fields.
    If request.images is provided, existing EntityImage rows are replaced.
    Image URLs must be object keys.
    Response contains presigned URLs for images.
    """
    try:
        logger.debug("Updating entity %s for user %s", entity_id, current_user)
        result = await db.execute(
            select(Entity)
                .join(UserEntityLink, UserEntityLink.entity_id == Entity.id)
                .where((Entity.id == entity_id) & (UserEntityLink.user_id == current_user))
            .options(selectinload(Entity.images), selectinload(Entity.user_links))
        )
        entity = result.scalars().first()
        if not entity:
            logger.warning("Entity %s not found for user %s", entity_id, current_user)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entity not found")

        update_data = request.dict(exclude_unset=True)

        # Handle profile_id update with ownership validation
        if 'profile_id' in update_data and update_data['profile_id'] is not None:
            from models.db_models import Profile
            profile_result = await db.execute(
                select(Profile).where(Profile.id == update_data['profile_id'], Profile.user_id == current_user)
            )
            profile = profile_result.scalar_one_or_none()
            if not profile:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Profile not found or not owned by user")

        for key, value in update_data.items():
            if key == 'images':
                if value:
                    for img in value:
                        if not isinstance(img, dict):
                            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Each image must be an object with a 'url' key containing the object key.")
                        raw_url = img.get("url")
                        if not raw_url or not isinstance(raw_url, str):
                            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image 'url' must be a non-empty string containing the object key.")
                        if raw_url.lower().startswith("http://") or raw_url.lower().startswith("https://"):
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Image URLs must be object keys (no http(s) URLs). Upload files using /{entity_id}/images endpoint which returns object keys."
                            )
                    await db.execute(delete(EntityImage).where(EntityImage.entity_id == entity.id))
                    for img in value:
                        key = img.get("url").lstrip("/")
                        entity_image = EntityImage(
                            entity_id=entity.id,
                            url=key,
                            caption=img.get("caption"),
                            is_primary=bool(img.get("is_primary")),
                            uploaded_by_user_id=current_user,
                            created_at=datetime.utcnow()
                        )
                        db.add(entity_image)
            elif key == 'profile_id' and value is not None:
                # Already validated above, set the profile_id
                setattr(entity, key, value)
            elif key in ['location', 'edurank', 'department', 'publications_meta', 'point_of_contact', 'scopes', 'lab_equipment', 'climate_tech_focus', 'climate_impact_metrics', 'embeddings']:
                entity.set_json_field(key, value)
            elif key in ['url', 'website'] and value is not None:
                setattr(entity, key, str(value) if value else None)
            else:
                setattr(entity, key, value)
        entity.last_updated = datetime.utcnow()
        await db.commit()
        await db.refresh(entity)
        raw_images = [
            {
                "id": str(img.id),
                "entity_id": str(img.entity_id),
                "url": img.url,
                "caption": img.caption,
                "is_primary": img.is_primary,
                "uploaded_by_user_id": str(img.uploaded_by_user_id) if img.uploaded_by_user_id else None,
                "created_at": img.created_at.isoformat() if isinstance(img.created_at, datetime) else img.created_at
            } for img in entity.images
        ]
        presigned_images = await _presign_images_list(raw_images)
        user_interactions = [
            {
                "id": link.id,
                "user_id": str(link.user_id),
                "entity_id": str(link.entity_id),
                "interaction_type": link.interaction_type,
                "notes": link.notes,
                "metadata_": link.metadata_,
                "timestamp": link.timestamp.isoformat() if isinstance(link.timestamp, datetime) else link.timestamp
            } for link in entity.user_links if link.user_id == current_user
        ]

        # Build profile info if available
        profile_dict = None
        if entity.profile:
            profile_dict = {
                "id": str(entity.profile.id),
                "user_id": str(entity.profile.user_id),
                "is_default": entity.profile.is_default,
                "type": entity.profile.type,
                "display_name": entity.profile.display_name,
                "first_name": entity.profile.first_name,
                "last_name": entity.profile.last_name,
                "bio": entity.profile.bio,
                "title": entity.profile.title,
                "organization": entity.profile.organization,
                "profile_image": entity.profile.profile_image,
                "created_at": entity.profile.created_at.isoformat() if isinstance(entity.profile.created_at, datetime) else None
            }

        entity_dict = {
            "id": str(entity.id),
            "source": entity.source,
            "created_by_user_id": str(entity.created_by_user_id) if entity.created_by_user_id else None,
            "profile_id": str(entity.profile_id) if entity.profile_id else None,
            "profile": profile_dict,
            "url": entity.url,
            "university": entity.university,
            "website": entity.website if entity.website else None,
            "related": entity.related,
            "research_abstract": entity.research_abstract,
            "timestamp": entity.timestamp.isoformat() if isinstance(entity.timestamp, datetime) else entity.timestamp,
            "last_updated": entity.last_updated.isoformat() if isinstance(entity.last_updated, datetime) else entity.last_updated,
            "location": entity.get_json_field("location"),
            "edurank": entity.get_json_field("edurank"),
            "department": entity.get_json_field("department"),
            "publications_meta": entity.get_json_field("publications_meta"),
            "point_of_contact": entity.get_json_field("point_of_contact"),
            "scopes": entity.get_json_field("scopes"),
            "lab_equipment": entity.get_json_field("lab_equipment"),
            "climate_tech_focus": entity.get_json_field("climate_tech_focus"),
            "climate_impact_metrics": entity.get_json_field("climate_impact_metrics"),
            "embeddings": entity.get_json_field("embeddings"),
            "images": presigned_images,
            "user_interactions": user_interactions
        }
        await save_user_entity_link(db, str(current_user), str(entity.id), "viewed")
        await db.commit()
        logger.info("Entity %s updated for user %s", entity_id, current_user)
        return EntityResponse(**entity_dict)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to update entity %s for user %s: %s", entity_id, current_user, e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# -------------------------
# Delete entity
# -------------------------
@router.delete("/{entity_id}")
async def delete_entity(
    entity_id: uuid.UUID,
    current_user: uuid.UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete entity and related images/links (owned by the current user).
    """
    try:
        logger.debug("Deleting entity %s for user %s", entity_id, current_user)
        result = await db.execute(
            select(Entity)
            .join(UserEntityLink, UserEntityLink.entity_id == Entity.id)
            .where((Entity.id == entity_id) & (UserEntityLink.user_id == current_user))
            .options(selectinload(Entity.images), selectinload(Entity.user_links))
        )
        entity = result.scalars().first()
        if not entity:
            logger.warning("Entity %s not found for user %s", entity_id, current_user)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entity not found")
        for img in entity.images:
            if img.url and not img.url.startswith("http"):
                try:
                    await asyncio.to_thread(
                        storage.s3_client.delete_object,
                        Bucket=storage.bucket_name,
                        Key=img.url
                    )
                except Exception:
                    logger.exception("Failed to delete object %s from storage", img.url)
        await db.execute(delete(EntityImage).where(EntityImage.entity_id == entity.id))
        await db.execute(delete(UserEntityLink).where(UserEntityLink.entity_id == entity.id))
        await db.execute(delete(Entity).where(Entity.id == entity_id))
        await db.commit()
        logger.info("Entity %s deleted for user %s", entity_id, current_user)
        return {"message": "Entity deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to delete entity %s for user %s: %s", entity_id, current_user, e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))