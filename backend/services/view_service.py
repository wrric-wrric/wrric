import logging
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.db_models import LabView, Entity

logger = logging.getLogger(__name__)


async def record_view(db: AsyncSession, entity_id, user_id=None):
    """Record a unique view per user per day. Returns True if new view was recorded."""
    today = date.today()
    try:
        # Check if view already exists for today
        query = select(LabView).where(
            LabView.entity_id == entity_id,
            LabView.view_date == today,
        )
        if user_id:
            query = query.where(LabView.user_id == user_id)
        else:
            query = query.where(LabView.user_id.is_(None))

        result = await db.execute(query)
        existing = result.scalars().first()

        if existing:
            return False

        # Insert new view record
        view = LabView(entity_id=entity_id, user_id=user_id, view_date=today)
        db.add(view)

        # Increment entity view_count
        entity_result = await db.execute(select(Entity).where(Entity.id == entity_id))
        entity = entity_result.scalars().first()
        if entity:
            entity.view_count = (entity.view_count or 0) + 1

        await db.flush()
        return True
    except Exception as e:
        logger.error(f"Error recording view for entity {entity_id}: {e}")
        await db.rollback()
        return False
