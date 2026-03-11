"""
Search service layer for Feature 3.2.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, func, or_, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from models.db_models import Entity, Partner, PartnerEntity, User

logger = logging.getLogger(__name__)

TRENDING_THRESHOLD = 10
TRENDING_DAYS = 7


async def global_search(db: AsyncSession, q: str, limit: int = 10):
    """Search across labs, partners, and users."""
    term = f"%{q.lower()}%"

    # Labs
    labs_result = await db.execute(
        select(
            Entity.id, Entity.university, Entity.location,
            Entity.department, Entity.like_count, Entity.comment_count,
            Entity.share_count, Entity.view_count, Entity.research_abstract,
        )
        .where(
            or_(
                func.lower(Entity.university).like(term),
                func.lower(Entity.research_abstract).like(term),
                func.lower(cast(Entity.scopes, String)).like(term),
                func.lower(cast(Entity.location, String)).like(term),
            )
        )
        .order_by(Entity.like_count.desc())
        .limit(limit)
    )
    labs = []
    for row in labs_result.all():
        labs.append({
            "id": str(row.id),
            "university": row.university or "",
            "location": row.location or {},
            "department": row.department or {},
            "research_abstract": (row.research_abstract or "")[:200],
            "like_count": row.like_count or 0,
            "comment_count": row.comment_count or 0,
            "share_count": row.share_count or 0,
            "view_count": row.view_count or 0,
        })

    # Partners
    partners_result = await db.execute(
        select(
            Partner.id, Partner.name, Partner.slug, Partner.description,
            Partner.logo_url, Partner.sector_focus, Partner.country,
            Partner.is_verified,
        )
        .where(
            Partner.status == "approved",
            or_(
                func.lower(Partner.name).like(term),
                func.lower(Partner.description).like(term),
                func.lower(cast(Partner.sector_focus, String)).like(term),
            ),
        )
        .order_by(Partner.name)
        .limit(limit)
    )
    partners = []
    for row in partners_result.all():
        partners.append({
            "id": str(row.id),
            "name": row.name,
            "slug": row.slug,
            "description": (row.description or "")[:200],
            "logo_url": row.logo_url,
            "sector_focus": row.sector_focus or [],
            "country": row.country,
            "is_verified": row.is_verified,
        })

    # Users
    users_result = await db.execute(
        select(User.id, User.username, User.profile_image_url)
        .where(func.lower(User.username).like(term))
        .order_by(User.username)
        .limit(limit)
    )
    users = []
    for row in users_result.all():
        users.append({
            "id": str(row.id),
            "username": row.username,
            "profile_image_url": row.profile_image_url,
        })

    return {
        "query": q,
        "labs": labs,
        "partners": partners,
        "users": users,
        "counts": {
            "labs": len(labs),
            "partners": len(partners),
            "users": len(users),
        },
    }


async def search_labs(
    db: AsyncSession,
    q: Optional[str] = None,
    sort: str = "newest",
    country: Optional[str] = None,
    sector: Optional[str] = None,
    partner_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
):
    """Search, sort, and filter labs."""
    query = select(
        Entity.id, Entity.university, Entity.location,
        Entity.department, Entity.like_count, Entity.comment_count,
        Entity.share_count, Entity.view_count, Entity.source,
        Entity.timestamp, Entity.climate_tech_focus, Entity.url,
    )

    if q:
        term = f"%{q.lower()}%"
        query = query.where(
            or_(
                func.lower(Entity.university).like(term),
                func.lower(Entity.research_abstract).like(term),
                func.lower(cast(Entity.scopes, String)).like(term),
                func.lower(cast(Entity.location, String)).like(term),
            )
        )

    if country:
        query = query.where(
            func.lower(cast(Entity.location, String)).like(f"%{country.lower()}%")
        )

    if sector:
        query = query.where(
            func.lower(cast(Entity.climate_tech_focus, String)).like(f"%{sector.lower()}%")
        )

    if partner_id:
        query = query.join(PartnerEntity, PartnerEntity.entity_id == Entity.id).where(
            PartnerEntity.partner_id == partner_id
        )

    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            query = query.where(Entity.timestamp >= dt)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            query = query.where(Entity.timestamp <= dt)
        except ValueError:
            pass

    sort_map = {
        "newest": Entity.timestamp.desc(),
        "most_liked": Entity.like_count.desc(),
        "most_commented": Entity.comment_count.desc(),
        "most_viewed": Entity.view_count.desc(),
    }
    query = query.order_by(sort_map.get(sort, Entity.timestamp.desc()))

    count_q = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)

    now = datetime.utcnow()
    cutoff = now - timedelta(days=TRENDING_DAYS)

    items = []
    for row in result.all():
        engagement = (row.like_count or 0) + (row.comment_count or 0) + (row.share_count or 0)
        is_trending = engagement >= TRENDING_THRESHOLD and (
            row.timestamp and row.timestamp >= cutoff
            if isinstance(row.timestamp, datetime) else False
        )
        items.append({
            "id": str(row.id),
            "university": row.university or "",
            "location": row.location or {},
            "department": row.department or {},
            "like_count": row.like_count or 0,
            "comment_count": row.comment_count or 0,
            "share_count": row.share_count or 0,
            "view_count": row.view_count or 0,
            "source": row.source or "scraped",
            "url": row.url,
            "climate_tech_focus": row.climate_tech_focus or [],
            "timestamp": row.timestamp.isoformat() if row.timestamp else None,
            "is_trending": is_trending,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": max(1, -(-total // limit)),
    }
