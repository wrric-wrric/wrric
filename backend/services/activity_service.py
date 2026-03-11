import uuid
from datetime import datetime
from typing import Optional, List, Tuple

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.db_models import ActivityEvent, Follow, User, Entity, LabLike


VALID_ACTIONS = {
    "created_lab", "liked_lab", "commented", "followed",
    "shared", "updated_lab",
}


class ActivityService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_event(
        self,
        actor_user_id: str,
        action: str,
        target_type: str,
        target_id: str,
        metadata: Optional[dict] = None,
    ) -> ActivityEvent:
        """Record an activity event."""
        event = ActivityEvent(
            id=uuid.uuid4(),
            actor_user_id=uuid.UUID(actor_user_id),
            action=action,
            target_type=target_type,
            target_id=uuid.UUID(target_id),
            metadata_=metadata or {},
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def get_feed(
        self,
        user_id: str,
        cursor: Optional[str] = None,
        limit: int = 20,
    ) -> Tuple[List[dict], Optional[str]]:
        """
        Get personalized feed for a user.
        Shows activities from users/partners/labs they follow.
        """
        # Get all followed user IDs
        followed_users_q = select(Follow.target_id).where(
            and_(
                Follow.follower_user_id == user_id,
                Follow.target_type == "user",
            )
        )
        result = await self.db.execute(followed_users_q)
        followed_user_ids = [row[0] for row in result.all()]

        # Get all followed partner IDs (we'll look for labs owned by partner owners)
        followed_partners_q = select(Follow.target_id).where(
            and_(
                Follow.follower_user_id == user_id,
                Follow.target_type == "partner",
            )
        )
        result = await self.db.execute(followed_partners_q)
        followed_partner_ids = [row[0] for row in result.all()]

        # Get all followed lab IDs
        followed_labs_q = select(Follow.target_id).where(
            and_(
                Follow.follower_user_id == user_id,
                Follow.target_type == "lab",
            )
        )
        result = await self.db.execute(followed_labs_q)
        followed_lab_ids = [row[0] for row in result.all()]

        if not followed_user_ids and not followed_partner_ids and not followed_lab_ids:
            return [], None

        # Build conditions: events from followed users OR events targeting followed labs
        conditions = []
        if followed_user_ids:
            conditions.append(ActivityEvent.actor_user_id.in_(followed_user_ids))
        if followed_lab_ids:
            conditions.append(
                and_(
                    ActivityEvent.target_type == "lab",
                    ActivityEvent.target_id.in_(followed_lab_ids),
                )
            )

        if not conditions:
            return [], None

        query = (
            select(ActivityEvent)
            .options(selectinload(ActivityEvent.actor))
            .where(or_(*conditions))
            .order_by(desc(ActivityEvent.created_at))
        )

        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                query = query.where(ActivityEvent.created_at < cursor_dt)
            except ValueError:
                pass

        query = query.limit(limit + 1)
        result = await self.db.execute(query)
        events = list(result.scalars().unique().all())

        next_cursor = None
        if len(events) > limit:
            events = events[:limit]
            last = events[-1]
            next_cursor = last.created_at.isoformat() if last.created_at else None

        items = [self._event_to_dict(e) for e in events]
        return items, next_cursor

    async def get_discover_feed(
        self,
        cursor: Optional[str] = None,
        limit: int = 20,
    ) -> Tuple[List[dict], Optional[str]]:
        """
        Get discover/trending feed.
        Shows recent popular activities across the platform, sorted by recency.
        Focuses on created_lab, liked_lab, commented, shared actions.
        """
        query = (
            select(ActivityEvent)
            .options(selectinload(ActivityEvent.actor))
            .where(
                ActivityEvent.action.in_(["created_lab", "liked_lab", "commented", "shared"])
            )
            .order_by(desc(ActivityEvent.created_at))
        )

        if cursor:
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                query = query.where(ActivityEvent.created_at < cursor_dt)
            except ValueError:
                pass

        query = query.limit(limit + 1)
        result = await self.db.execute(query)
        events = list(result.scalars().unique().all())

        next_cursor = None
        if len(events) > limit:
            events = events[:limit]
            last = events[-1]
            next_cursor = last.created_at.isoformat() if last.created_at else None

        items = [self._event_to_dict(e) for e in events]
        return items, next_cursor

    async def get_trending_labs(self, limit: int = 10) -> List[dict]:
        """Get trending labs based on recent engagement (likes + comments + shares)."""
        # Get labs with most activity events in recent period
        query = (
            select(
                ActivityEvent.target_id,
                func.count(ActivityEvent.id).label("event_count"),
            )
            .where(
                and_(
                    ActivityEvent.target_type == "lab",
                    ActivityEvent.action.in_(["liked_lab", "commented", "shared"]),
                )
            )
            .group_by(ActivityEvent.target_id)
            .order_by(desc("event_count"))
            .limit(limit)
        )
        result = await self.db.execute(query)
        rows = result.all()

        trending = []
        for target_id, event_count in rows:
            lab_result = await self.db.execute(
                select(Entity).where(Entity.id == target_id)
            )
            lab = lab_result.scalars().first()
            if lab:
                trending.append({
                    "id": str(lab.id),
                    "university": lab.university or "",
                    "like_count": lab.like_count or 0,
                    "comment_count": lab.comment_count or 0,
                    "share_count": lab.share_count or 0,
                    "engagement_score": event_count,
                })

        return trending

    async def get_platform_stats(self) -> dict:
        """Get platform-wide activity stats."""
        total_q = select(func.count(ActivityEvent.id))
        result = await self.db.execute(total_q)
        total_activities = result.scalar() or 0

        users_q = select(func.count(func.distinct(ActivityEvent.actor_user_id)))
        result = await self.db.execute(users_q)
        active_users = result.scalar() or 0

        labs_q = select(func.count(func.distinct(ActivityEvent.target_id))).where(
            ActivityEvent.target_type == "lab"
        )
        result = await self.db.execute(labs_q)
        trending_labs = result.scalar() or 0

        return {
            "total_activities": total_activities,
            "active_users": active_users,
            "trending_labs": trending_labs,
        }

    def _event_to_dict(self, event: ActivityEvent) -> dict:
        return {
            "id": str(event.id),
            "actor_user_id": str(event.actor_user_id),
            "actor_username": event.actor.username if event.actor else "",
            "actor_profile_image": event.actor.profile_image_url if event.actor else None,
            "action": event.action,
            "target_type": event.target_type,
            "target_id": str(event.target_id),
            "metadata": event.metadata_ or {},
            "created_at": event.created_at.isoformat() if event.created_at else "",
        }
