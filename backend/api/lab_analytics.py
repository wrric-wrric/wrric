import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.db_models import Entity, PartnerMember
from utils.database import get_db
from api.dependencies import get_current_user
from services.analytics_service import (
    get_lab_analytics,
    get_lab_summary,
    get_partner_analytics,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["lab-analytics"])


@router.get("/labs/{entity_id}/analytics")
async def lab_analytics(
    entity_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get analytics for a specific lab. Must be lab owner or admin."""
    try:
        entity_uuid = uuid.UUID(entity_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid entity ID")

    # Verify ownership or admin
    result = await db.execute(select(Entity).where(Entity.id == entity_uuid))
    entity = result.scalars().first()
    if not entity:
        raise HTTPException(status_code=404, detail="Lab not found")

    from models.db_models import User
    user_result = await db.execute(select(User).where(User.id == uuid.UUID(current_user)))
    user = user_result.scalars().first()

    is_owner = entity.created_by_user_id and str(entity.created_by_user_id) == current_user
    is_admin = user and user.is_admin
    if not is_owner and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view analytics for this lab")

    summary = await get_lab_summary(db, entity_uuid)
    daily = await get_lab_analytics(db, entity_uuid, days)

    return {
        "entity_id": entity_id,
        "period_days": days,
        "summary": summary,
        **daily,
    }


@router.get("/partners/{partner_id}/analytics")
async def partner_analytics(
    partner_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get analytics for a partner. Must be a partner member."""
    try:
        partner_uuid = uuid.UUID(partner_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid partner ID")

    # Check membership
    from models.db_models import User
    user_result = await db.execute(select(User).where(User.id == uuid.UUID(current_user)))
    user = user_result.scalars().first()

    member_result = await db.execute(
        select(PartnerMember).where(
            PartnerMember.partner_id == partner_uuid,
            PartnerMember.user_id == uuid.UUID(current_user),
        )
    )
    is_member = member_result.scalars().first() is not None
    is_admin = user and user.is_admin

    if not is_member and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view partner analytics")

    data = await get_partner_analytics(db, partner_uuid, days)
    return {
        "partner_id": partner_id,
        "period_days": days,
        **data,
    }
