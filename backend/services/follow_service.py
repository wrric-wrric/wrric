import uuid
from typing import Optional, List, Tuple

from sqlalchemy import select, func, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.db_models import Follow, User, Partner, Entity, Notification, PartnerMember
from services.activity_hooks import record_activity
from services.block_service import BlockService


VALID_TARGET_TYPES = {"user", "partner", "lab"}


class FollowService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def follow(self, follower_user_id: str, target_type: str, target_id: str) -> dict:
        """Follow a user, partner, or lab."""
        if target_type not in VALID_TARGET_TYPES:
            return {"error": f"Invalid target_type. Must be one of: {', '.join(sorted(VALID_TARGET_TYPES))}", "status": 400}

        # Cannot follow self (user type)
        if target_type == "user" and target_id == follower_user_id:
            return {"error": "Cannot follow yourself", "status": 400}

        # Verify target exists
        exists = await self._target_exists(target_type, target_id)
        if not exists:
            return {"error": f"{target_type.capitalize()} not found", "status": 404}

        # Check if blocked (for user follows)
        if target_type == "user":
            block_svc = BlockService(self.db)
            if await block_svc.is_blocked(follower_user_id, target_id):
                return {"error": "Action not allowed", "status": 403}

        # Check duplicate
        existing = await self.db.execute(
            select(Follow).where(
                and_(
                    Follow.follower_user_id == follower_user_id,
                    Follow.target_type == target_type,
                    Follow.target_id == target_id,
                )
            )
        )
        if existing.scalars().first():
            return {"error": "Already following", "status": 409}

        follow = Follow(
            id=uuid.uuid4(),
            follower_user_id=uuid.UUID(follower_user_id),
            target_type=target_type,
            target_id=uuid.UUID(target_id),
        )
        self.db.add(follow)

        # Send notifications
        await self._send_follow_notifications(follower_user_id, target_type, target_id)

        await record_activity(self.db, follower_user_id, "followed", target_type, target_id)

        await self.db.commit()

        follower_count = await self._get_follower_count(target_type, target_id)
        return {"followed": True, "follower_count": follower_count}

    async def unfollow(self, follower_user_id: str, target_type: str, target_id: str) -> dict:
        """Unfollow a user, partner, or lab."""
        if target_type not in VALID_TARGET_TYPES:
            return {"error": f"Invalid target_type", "status": 400}

        result = await self.db.execute(
            select(Follow).where(
                and_(
                    Follow.follower_user_id == follower_user_id,
                    Follow.target_type == target_type,
                    Follow.target_id == target_id,
                )
            )
        )
        follow = result.scalars().first()
        if not follow:
            return {"error": "Not following", "status": 404}

        await self.db.delete(follow)
        await self.db.commit()

        follower_count = await self._get_follower_count(target_type, target_id)
        return {"followed": False, "follower_count": follower_count}

    async def get_followers(
        self, target_type: str, target_id: str, page: int = 1, limit: int = 20
    ) -> Tuple[List[dict], int]:
        """Get followers of a target (paginated). Returns list of follower user info."""
        count_q = select(func.count()).select_from(Follow).where(
            and_(Follow.target_type == target_type, Follow.target_id == target_id)
        )
        total = (await self.db.execute(count_q)).scalar() or 0

        query = (
            select(Follow, User)
            .join(User, Follow.follower_user_id == User.id)
            .where(and_(Follow.target_type == target_type, Follow.target_id == target_id))
            .order_by(Follow.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        result = await self.db.execute(query)
        rows = result.all()

        followers = []
        for follow, user in rows:
            followers.append({
                "user_id": str(user.id),
                "username": user.username,
                "profile_image_url": user.profile_image_url,
                "followed_at": follow.created_at.isoformat() if follow.created_at else "",
            })

        return followers, total

    async def get_following(
        self, user_id: str, target_type: Optional[str] = None, page: int = 1, limit: int = 20
    ) -> Tuple[List[dict], int]:
        """Get what a user is following (paginated). Optionally filter by target_type."""
        conditions = [Follow.follower_user_id == user_id]
        if target_type:
            conditions.append(Follow.target_type == target_type)

        count_q = select(func.count()).select_from(Follow).where(and_(*conditions))
        total = (await self.db.execute(count_q)).scalar() or 0

        query = (
            select(Follow)
            .where(and_(*conditions))
            .order_by(Follow.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        result = await self.db.execute(query)
        follows = result.scalars().all()

        items = []
        for f in follows:
            item = {
                "target_type": f.target_type,
                "target_id": str(f.target_id),
                "followed_at": f.created_at.isoformat() if f.created_at else "",
            }
            # Enrich with target info
            info = await self._get_target_info(f.target_type, str(f.target_id))
            item.update(info)
            items.append(item)

        return items, total

    async def check_following_batch(
        self, user_id: str, targets: List[dict]
    ) -> dict:
        """Check if user follows multiple targets. targets = [{target_type, target_id}, ...]"""
        if not targets:
            return {}

        result_map = {}
        for t in targets:
            key = f"{t['target_type']}:{t['target_id']}"
            res = await self.db.execute(
                select(Follow.id).where(
                    and_(
                        Follow.follower_user_id == user_id,
                        Follow.target_type == t["target_type"],
                        Follow.target_id == t["target_id"],
                    )
                )
            )
            result_map[key] = res.scalar() is not None

        return result_map

    async def get_follow_status(
        self, follower_user_id: Optional[str], target_type: str, target_id: str
    ) -> dict:
        """Get follow status and follower count for a target."""
        count = await self._get_follower_count(target_type, target_id)
        is_following = False
        if follower_user_id:
            res = await self.db.execute(
                select(Follow.id).where(
                    and_(
                        Follow.follower_user_id == follower_user_id,
                        Follow.target_type == target_type,
                        Follow.target_id == target_id,
                    )
                )
            )
            is_following = res.scalar() is not None

        return {"follower_count": count, "is_following": is_following}

    # --- Private helpers ---

    async def _target_exists(self, target_type: str, target_id: str) -> bool:
        if target_type == "user":
            r = await self.db.execute(select(User.id).where(User.id == target_id))
        elif target_type == "partner":
            r = await self.db.execute(select(Partner.id).where(Partner.id == target_id))
        elif target_type == "lab":
            r = await self.db.execute(select(Entity.id).where(Entity.id == target_id))
        else:
            return False
        return r.scalar() is not None

    async def _get_follower_count(self, target_type: str, target_id: str) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(Follow).where(
                and_(Follow.target_type == target_type, Follow.target_id == target_id)
            )
        )
        return result.scalar() or 0

    async def _send_follow_notifications(self, follower_user_id: str, target_type: str, target_id: str):
        """Send notification to the target when followed."""
        # Get follower username
        follower_res = await self.db.execute(select(User.username).where(User.id == follower_user_id))
        follower_username = follower_res.scalar() or "Someone"

        if target_type == "user":
            notif = Notification(
                id=uuid.uuid4(),
                user_id=uuid.UUID(target_id),
                type="new_follower",
                content=f"{follower_username} started following you",
                related_id=uuid.UUID(follower_user_id),
                actor_user_id=uuid.UUID(follower_user_id),
                group_key=f"new_follower:{target_id}",
            )
            self.db.add(notif)

        elif target_type == "partner":
            owner_res = await self.db.execute(
                select(Partner.user_id).where(Partner.id == target_id)
            )
            owner_id = owner_res.scalar()
            if owner_id and str(owner_id) != follower_user_id:
                notif = Notification(
                    id=uuid.uuid4(),
                    user_id=owner_id,
                    type="partner_new_follower",
                    content=f"{follower_username} started following your partner organization",
                    related_id=uuid.UUID(target_id),
                    actor_user_id=uuid.UUID(follower_user_id),
                    group_key=f"partner_new_follower:{target_id}",
                )
                self.db.add(notif)

        elif target_type == "lab":
            owner_res = await self.db.execute(
                select(Entity.created_by_user_id).where(Entity.id == target_id)
            )
            owner_id = owner_res.scalar()
            if owner_id and str(owner_id) != follower_user_id:
                notif = Notification(
                    id=uuid.uuid4(),
                    user_id=owner_id,
                    type="lab_new_follower",
                    content=f"{follower_username} started following your lab",
                    related_id=uuid.UUID(target_id),
                    actor_user_id=uuid.UUID(follower_user_id),
                    group_key=f"lab_new_follower:{target_id}",
                )
                self.db.add(notif)

    async def _get_target_info(self, target_type: str, target_id: str) -> dict:
        """Get basic info about a follow target for display."""
        if target_type == "user":
            r = await self.db.execute(
                select(User.username, User.profile_image_url).where(User.id == target_id)
            )
            row = r.first()
            if row:
                return {"name": row[0], "image_url": row[1]}
        elif target_type == "partner":
            r = await self.db.execute(
                select(Partner.name, Partner.logo_url, Partner.slug).where(Partner.id == target_id)
            )
            row = r.first()
            if row:
                return {"name": row[0], "image_url": row[1], "slug": row[2]}
        elif target_type == "lab":
            r = await self.db.execute(
                select(Entity.university).where(Entity.id == target_id)
            )
            row = r.first()
            if row:
                return {"name": row[0] or "Unnamed Lab"}
        return {"name": "Unknown"}
