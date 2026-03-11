import uuid
from typing import Optional, List, Tuple

from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.db_models import UserBlock, User, Follow


class BlockService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def block_user(self, blocker_id: str, blocked_id: str) -> dict:
        """Block a user. Auto-unfollows both directions."""
        if blocker_id == blocked_id:
            return {"error": "Cannot block yourself", "status": 400}

        # Verify target exists
        target = await self.db.execute(select(User.id).where(User.id == blocked_id))
        if not target.scalar():
            return {"error": "User not found", "status": 404}

        # Check if already blocked
        existing = await self.db.execute(
            select(UserBlock).where(
                and_(
                    UserBlock.blocker_user_id == blocker_id,
                    UserBlock.blocked_user_id == blocked_id,
                )
            )
        )
        if existing.scalars().first():
            return {"error": "Already blocked", "status": 409}

        block = UserBlock(
            id=uuid.uuid4(),
            blocker_user_id=uuid.UUID(blocker_id),
            blocked_user_id=uuid.UUID(blocked_id),
        )
        self.db.add(block)

        # Auto-unfollow both directions
        await self.db.execute(
            delete(Follow).where(
                and_(
                    Follow.follower_user_id == blocker_id,
                    Follow.target_type == "user",
                    Follow.target_id == blocked_id,
                )
            )
        )
        await self.db.execute(
            delete(Follow).where(
                and_(
                    Follow.follower_user_id == blocked_id,
                    Follow.target_type == "user",
                    Follow.target_id == blocker_id,
                )
            )
        )

        await self.db.commit()
        return {"blocked": True}

    async def unblock_user(self, blocker_id: str, blocked_id: str) -> dict:
        """Unblock a user."""
        result = await self.db.execute(
            select(UserBlock).where(
                and_(
                    UserBlock.blocker_user_id == blocker_id,
                    UserBlock.blocked_user_id == blocked_id,
                )
            )
        )
        block = result.scalars().first()
        if not block:
            return {"error": "Not blocked", "status": 404}

        await self.db.delete(block)
        await self.db.commit()
        return {"blocked": False}

    async def is_blocked(self, user_a: str, user_b: str) -> bool:
        """Check if either user has blocked the other (bidirectional)."""
        result = await self.db.execute(
            select(UserBlock.id).where(
                or_(
                    and_(
                        UserBlock.blocker_user_id == user_a,
                        UserBlock.blocked_user_id == user_b,
                    ),
                    and_(
                        UserBlock.blocker_user_id == user_b,
                        UserBlock.blocked_user_id == user_a,
                    ),
                )
            )
        )
        return result.scalar() is not None

    async def get_blocked_users(
        self, user_id: str, page: int = 1, limit: int = 20
    ) -> Tuple[List[dict], int]:
        """Get paginated list of users blocked by user_id."""
        count_q = select(func.count()).select_from(UserBlock).where(
            UserBlock.blocker_user_id == user_id
        )
        total = (await self.db.execute(count_q)).scalar() or 0

        query = (
            select(UserBlock, User)
            .join(User, UserBlock.blocked_user_id == User.id)
            .where(UserBlock.blocker_user_id == user_id)
            .order_by(UserBlock.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        result = await self.db.execute(query)
        rows = result.all()

        users = []
        for block, user in rows:
            users.append({
                "user_id": str(user.id),
                "username": user.username,
                "profile_image_url": user.profile_image_url,
                "blocked_at": block.created_at.isoformat() if block.created_at else "",
            })

        return users, total
