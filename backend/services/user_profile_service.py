"""
User Profile Service — public profile summary, user labs, and liked labs.
"""
import math
import uuid
from typing import Optional, List, Tuple

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.db_models import (
    User,
    Entity,
    UserEntityLink,
    LabLike,
    LabComment,
    Follow,
    Partner,
    Profile,
)


class UserProfileService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_summary(self, user_id: str) -> Optional[dict]:
        """
        Public profile summary: basic info, partner badge, stats, follower counts.
        """
        # Fetch user
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalars().first()
        if not user:
            return None

        # Partner badge: check if user owns an approved partner
        partner_result = await self.db.execute(
            select(Partner.name, Partner.slug).where(
                and_(Partner.user_id == user_id, Partner.status == "approved")
            )
        )
        partner_row = partner_result.first()
        partner_badge = None
        if partner_row:
            partner_badge = {"name": partner_row.name, "slug": partner_row.slug}

        # Stats
        labs_count = (await self.db.execute(
            select(func.count()).select_from(
                select(UserEntityLink.id)
                .where(UserEntityLink.user_id == user_id)
                .subquery()
            )
        )).scalar() or 0

        comments_count = (await self.db.execute(
            select(func.count()).select_from(
                select(LabComment.id)
                .where(
                    and_(LabComment.user_id == user_id, LabComment.deleted_at.is_(None))
                )
                .subquery()
            )
        )).scalar() or 0

        likes_given = (await self.db.execute(
            select(func.count()).select_from(
                select(LabLike.id)
                .where(LabLike.user_id == user_id)
                .subquery()
            )
        )).scalar() or 0

        # Follower / following counts
        follower_count = (await self.db.execute(
            select(func.count()).select_from(
                select(Follow.id)
                .where(and_(Follow.target_type == "user", Follow.target_id == user_id))
                .subquery()
            )
        )).scalar() or 0

        following_count = (await self.db.execute(
            select(func.count()).select_from(
                select(Follow.id)
                .where(Follow.follower_user_id == user_id)
                .subquery()
            )
        )).scalar() or 0

        return {
            "user_id": str(user.id),
            "username": user.username,
            "profile_image_url": user.profile_image_url,
            "partner_badge": partner_badge,
            "stats": {
                "labs_created": labs_count,
                "comments": comments_count,
                "likes_given": likes_given,
            },
            "follower_count": follower_count,
            "following_count": following_count,
        }

    async def get_user_labs(
        self, user_id: str, page: int = 1, limit: int = 20
    ) -> Tuple[list, int]:
        """Public: get labs created/linked by a user, paginated."""
        base = (
            select(Entity)
            .join(UserEntityLink, UserEntityLink.entity_id == Entity.id)
            .where(UserEntityLink.user_id == user_id)
        )

        total = (await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )).scalar() or 0

        query = (
            base
            .options(selectinload(Entity.images))
            .order_by(Entity.timestamp.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        result = await self.db.execute(query)
        entities = list(result.scalars().unique().all())

        items = []
        for e in entities:
            items.append({
                "id": str(e.id),
                "university": e.university or "",
                "research_abstract": e.research_abstract or "",
                "website": e.website or None,
                "location": e.get_json_field("location") if hasattr(e, "get_json_field") else (e.location or {}),
                "scopes": e.get_json_field("scopes") if hasattr(e, "get_json_field") else (e.scopes or []),
                "entity_type": e.entity_type or "lab",
                "like_count": e.like_count or 0,
                "comment_count": e.comment_count or 0,
                "images": [
                    {"id": str(img.id), "url": img.url, "caption": img.caption, "is_primary": img.is_primary}
                    for img in (e.images or [])
                ],
            })

        return items, total

    async def get_user_liked_labs(
        self, user_id: str, page: int = 1, limit: int = 20
    ) -> Tuple[list, int]:
        """Public: get labs liked by a user, paginated."""
        base = (
            select(Entity)
            .join(LabLike, LabLike.entity_id == Entity.id)
            .where(LabLike.user_id == user_id)
        )

        total = (await self.db.execute(
            select(func.count()).select_from(base.subquery())
        )).scalar() or 0

        query = (
            base
            .options(selectinload(Entity.images))
            .order_by(LabLike.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        result = await self.db.execute(query)
        entities = list(result.scalars().unique().all())

        items = []
        for e in entities:
            items.append({
                "id": str(e.id),
                "university": e.university or "",
                "research_abstract": e.research_abstract or "",
                "website": e.website or None,
                "location": e.get_json_field("location") if hasattr(e, "get_json_field") else (e.location or {}),
                "scopes": e.get_json_field("scopes") if hasattr(e, "get_json_field") else (e.scopes or []),
                "entity_type": e.entity_type or "lab",
                "like_count": e.like_count or 0,
                "comment_count": e.comment_count or 0,
                "images": [
                    {"id": str(img.id), "url": img.url, "caption": img.caption, "is_primary": img.is_primary}
                    for img in (e.images or [])
                ],
            })

        return items, total
