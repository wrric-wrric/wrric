import logging
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_
from pydantic import BaseModel

from models.db_models import Entity, EntityImage, EntityEmbedding, EcosystemEntityLink
from models.db_models import Verification, Publication, User, SessionEntity
from utils.database import get_db
from api.dependencies import get_current_user, verify_admin

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-entities"])


class EntitySummary(BaseModel):
    id: str
    name: str
    entity_type: Optional[str] = "lab"
    university: str
    source: str
    created_at: datetime
    last_updated: datetime
    image_count: int
    publication_count: int
    verification_count: int
    view_count: int
    ecosystem_links_count: int


class EntityDetail(BaseModel):
    id: str
    name: str
    entity_type: Optional[str] = "lab"
    university: str
    location: dict
    website: str
    source: str
    created_at: datetime
    last_updated: datetime
    created_by: Optional[str]
    images: List[dict]
    publications: List[dict]
    verifications: List[dict]
    ecosystem_links: List[dict]
    view_count: int
    interaction_count: int


class EntityUpdate(BaseModel):
    name: Optional[str] = None
    entity_type: Optional[str] = None
    university: Optional[str] = None
    website: Optional[str] = None


class EntityListResponse(BaseModel):
    entities: List[EntitySummary]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("", response_model=EntityListResponse)
async def list_entities(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    entity_type: Optional[str] = None,
    source: Optional[str] = None,
    sort_by: str = Query("created_at", regex="^(name|created_at|last_updated|view_count)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    List all entities with pagination, search, and filtering.
    Only accessible by admin users.
    """
    try:
        offset = (page - 1) * page_size
        
        query = select(
            Entity.id,
            Entity.university,
            Entity.entity_type,
            Entity.source,
            Entity.created_at,
            Entity.last_updated,
            func.coalesce(Entity.university, '').label("name"),
            func.count(EntityImage.id).label("image_count"),
            func.count(Publication.id).label("publication_count"),
            func.count(Verification.id).label("verification_count"),
            func.count(SessionEntity.id).label("view_count"),
            func.count(EcosystemEntityLink.id).label("ecosystem_links_count")
        ).outerjoin(EntityImage).outerjoin(Publication).outerjoin(Verification)\
         .outerjoin(SessionEntity).outerjoin(EcosystemEntityLink)\
         .group_by(Entity.id)
        
        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Entity.university.ilike(search_term),
                    Entity.website.ilike(search_term),
                    func.jsonb_path_query_text(Entity.department, '$[*].name').ilike(search_term)
                )
            )
        
        if entity_type:
            query = query.where(Entity.entity_type == entity_type)
        
        if source:
            query = query.where(Entity.source == source)
        
        sort_column = {
            "name": func.coalesce(Entity.university, ''),
            "created_at": Entity.created_at,
            "last_updated": Entity.last_updated,
            "view_count": func.count(SessionEntity.id)
        }.get(sort_by, Entity.created_at)
        
        if sort_order == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
        
        total_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(total_query)
        total = total_result.scalar()
        
        result = await db.execute(query.offset(offset).limit(page_size))
        rows = result.all()
        
        entities = [
            EntitySummary(
                id=str(row.id),
                name=row.name,
                entity_type=row.entity_type,
                university=row.university,
                source=row.source,
                created_at=row.created_at,
                last_updated=row.last_updated,
                image_count=row.image_count,
                publication_count=row.publication_count,
                verification_count=row.verification_count,
                view_count=row.view_count,
                ecosystem_links_count=row.ecosystem_links_count
            )
            for row in rows
        ]
        
        total_pages = (total + page_size - 1) // page_size
        
        logger.info(f"Admin {admin_user} listed {len(entities)} entities (page {page})")
        
        return EntityListResponse(
            entities=entities,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    except Exception as e:
        logger.error(f"Error listing entities: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list entities")

@router.get("/stats/overview")
async def get_entity_stats(
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get entity statistics for admin dashboard.
    """
    try:
        total_entities = await db.execute(
            select(func.count()).select_from(Entity)
        )
        total_entities = total_entities.scalar()
        
        scraped_entities = await db.execute(
            select(func.count()).where(Entity.source == "scraped")
        )
        scraped_entities = scraped_entities.scalar()
        
        user_created_entities = await db.execute(
            select(func.count()).where(Entity.source != "scraped")
        )
        user_created_entities = user_created_entities.scalar()
        
        entity_types_result = await db.execute(
            select(Entity.entity_type, func.count().label("count"))
            .group_by(Entity.entity_type)
        )
        entity_types = {row.entity_type: row.count for row in entity_types_result.all()}
        
        verified_entities = await db.execute(
            select(func.count()).select_from(Verification)
        )
        verified_entities = verified_entities.scalar()
        
        total_images = await db.execute(
            select(func.count()).select_from(EntityImage)
        )
        total_images = total_images.scalar()
        
        total_publications = await db.execute(
            select(func.count()).select_from(Publication)
        )
        total_publications = total_publications.scalar()
        
        new_entities_7d = await db.execute(
            select(func.count()).where(
                Entity.created_at >= datetime.utcnow() - timedelta(days=7)
            )
        )
        new_entities_7d = new_entities_7d.scalar()
        
        return {
            "total_entities": total_entities,
            "scraped_entities": scraped_entities,
            "user_created_entities": user_created_entities,
            "entity_types": entity_types,
            "verified_entities": verified_entities,
            "total_images": total_images,
            "total_publications": total_publications,
            "new_entities_7d": new_entities_7d
        }
    except Exception as e:
        logger.error(f"Error getting entity stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get entity statistics")



@router.get("/{entity_id}", response_model=EntityDetail)
async def get_entity_detail(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get detailed information about a specific entity.
    """
    try:
        result = await db.execute(
            select(Entity).where(Entity.id == entity_id)
        )
        entity = result.scalar_one_or_none()
        
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")
        
        images_result = await db.execute(
            select(EntityImage).where(EntityImage.entity_id == entity_id)
        )
        images = images_result.scalars().all()
        
        publications_result = await db.execute(
            select(Publication).where(Publication.entity_id == entity_id)\
            .limit(10)
        )
        publications = publications_result.scalars().all()
        
        verifications_result = await db.execute(
            select(Verification).where(Verification.entity_id == entity_id)
        )
        verifications = verifications_result.scalars().all()
        
        ecosystem_links_result = await db.execute(
            select(EcosystemEntityLink).where(EcosystemEntityLink.entity_id == entity_id)
        )
        ecosystem_links = ecosystem_links_result.scalars().all()
        
        view_count_result = await db.execute(
            select(func.count()).select_from(SessionEntity)\
            .where(SessionEntity.entity_id == entity_id)
        )
        view_count = view_count_result.scalar()
        
        entity_detail = EntityDetail(
            id=str(entity.id),
            name=entity.university or "Unnamed Entity",
            entity_type=entity.entity_type,
            university=entity.university,
            location=entity.location,
            website=entity.website,
            source=entity.source,
            created_at=entity.created_at,
            last_updated=entity.last_updated,
            created_by=str(entity.created_by_user_id) if entity.created_by_user_id else None,
            images=[
                {
                    "id": img.id,
                    "url": img.url,
                    "caption": img.caption,
                    "is_primary": img.is_primary
                }
                for img in images
            ],
            publications=[
                {
                    "id": str(pub.id),
                    "title": pub.title,
                    "journal": pub.journal,
                    "publication_date": pub.publication_date,
                    "citation_count": pub.citation_count
                }
                for pub in publications
            ],
            verifications=[
                {
                    "id": ver.id,
                    "verifier": ver.verifier,
                    "verified_at": ver.verified_at,
                    "level": ver.level,
                    "notes": ver.notes
                }
                for ver in verifications
            ],
            ecosystem_links=[
                {
                    "id": str(link.id),
                    "profile_id": str(link.profile_id),
                    "role": link.role,
                    "context": link.context
                }
                for link in ecosystem_links
            ],
            view_count=view_count,
            interaction_count=0
        )
        
        logger.info(f"Admin {admin_user} viewed entity {entity_id}")
        
        return entity_detail
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting entity detail: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get entity detail")


@router.put("/{entity_id}")
async def update_entity(
    entity_id: str,
    update_data: EntityUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Update entity information.
    """
    try:
        result = await db.execute(
            select(Entity).where(Entity.id == entity_id)
        )
        entity = result.scalar_one_or_none()
        
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")
        
        if update_data.name is not None:
            entity.university = update_data.name
        if update_data.entity_type is not None:
            entity.entity_type = update_data.entity_type
        if update_data.university is not None:
            entity.university = update_data.university
        if update_data.website is not None:
            entity.website = update_data.website
        
        entity.last_updated = datetime.utcnow()
        await db.commit()
        
        logger.info(f"Admin {admin_user} updated entity {entity_id}")
        
        return {"message": "Entity updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating entity: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update entity")


@router.delete("/{entity_id}")
async def delete_entity(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Delete an entity and all associated data.
    """
    try:
        result = await db.execute(
            select(Entity).where(Entity.id == entity_id)
        )
        entity = result.scalar_one_or_none()
        
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")
        
        await db.delete(entity)
        await db.commit()
        
        logger.info(f"Admin {admin_user} deleted entity {entity_id}")
        
        return {"message": "Entity deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting entity: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete entity")


