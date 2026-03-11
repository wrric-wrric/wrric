import uuid
from typing import Optional, List, Tuple

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.db_models import LabLike, Entity, Notification
from services.activity_hooks import record_activity
from services.block_service import BlockService


class LikeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def toggle_like(self, entity_id: str, user_id: str) -> dict:
        """Toggle like on a lab. Returns {liked: bool, like_count: int}."""
        # Verify entity exists
        entity = await self.db.execute(
            select(Entity).where(Entity.id == entity_id)
        )
        entity_obj = entity.scalars().first()
        if not entity_obj:
            return {"error": "Lab not found"}

        # Check if blocked by lab owner
        if entity_obj.created_by_user_id and str(entity_obj.created_by_user_id) != user_id:
            block_svc = BlockService(self.db)
            if await block_svc.is_blocked(user_id, str(entity_obj.created_by_user_id)):
                return {"error": "Action not allowed"}

        # Check existing like
        result = await self.db.execute(
            select(LabLike).where(
                and_(
                    LabLike.user_id == user_id,
                    LabLike.entity_id == entity_id,
                )
            )
        )
        existing = result.scalars().first()

        if existing:
            # Unlike
            await self.db.delete(existing)
            entity_obj.like_count = max(0, (entity_obj.like_count or 0) - 1)
            await self.db.commit()
            return {"liked": False, "like_count": entity_obj.like_count}
        else:
            # Like
            like = LabLike(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id),
                entity_id=uuid.UUID(entity_id),
            )
            self.db.add(like)
            entity_obj.like_count = (entity_obj.like_count or 0) + 1
            await self.db.flush()

            # Create notification for lab owner (if not self-like)
            if entity_obj.created_by_user_id and str(entity_obj.created_by_user_id) != user_id:
                notification = Notification(
                    id=uuid.uuid4(),
                    user_id=entity_obj.created_by_user_id,
                    type="lab_liked",
                    content=f"Someone liked your lab \"{entity_obj.university or 'Unnamed Lab'}\"",
                    related_id=uuid.UUID(entity_id),
                    actor_user_id=uuid.UUID(user_id),
                    group_key=f"lab_liked:{entity_id}",
                )
                self.db.add(notification)

            await record_activity(self.db, user_id, "liked_lab", "lab", entity_id)
            await self.db.commit()
            return {"liked": True, "like_count": entity_obj.like_count}

    async def get_like_status(self, entity_id: str, user_id: Optional[str] = None) -> dict:
        """Get like count and whether the user has liked."""
        # Get count from denormalized field
        result = await self.db.execute(
            select(Entity.like_count).where(Entity.id == entity_id)
        )
        count = result.scalar()
        if count is None:
            return {"error": "Lab not found"}

        liked = False
        if user_id:
            like_result = await self.db.execute(
                select(LabLike).where(
                    and_(
                        LabLike.user_id == user_id,
                        LabLike.entity_id == entity_id,
                    )
                )
            )
            liked = like_result.scalars().first() is not None

        return {"count": count or 0, "liked": liked}

    async def get_user_liked_labs(
        self, user_id: str, page: int = 1, limit: int = 20
    ) -> Tuple[List[Entity], int]:
        """Get labs liked by a user, paginated."""
        base = (
            select(Entity)
            .join(LabLike, LabLike.entity_id == Entity.id)
            .where(LabLike.user_id == user_id)
        )

        # Count
        count_q = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_q)).scalar() or 0

        # Fetch
        query = (
            base
            .options(selectinload(Entity.images))
            .order_by(LabLike.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        result = await self.db.execute(query)
        entities = list(result.scalars().unique().all())
        return entities, total

    async def check_likes_batch(self, entity_ids: List[str], user_id: str) -> dict:
        """Check like status for multiple entities at once."""
        if not entity_ids:
            return {}

        result = await self.db.execute(
            select(LabLike.entity_id).where(
                and_(
                    LabLike.user_id == user_id,
                    LabLike.entity_id.in_(entity_ids),
                )
            )
        )
        liked_ids = {str(row[0]) for row in result.all()}
        return {eid: eid in liked_ids for eid in entity_ids}
