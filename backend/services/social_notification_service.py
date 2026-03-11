"""
Enhanced notification service for social engagement (Feature 3.3).
Handles creation, grouping, preferences, and WebSocket delivery.
"""
import uuid
import logging
from typing import Optional, List
from datetime import datetime

from sqlalchemy import select, func, and_, update, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from models.db_models import Notification, NotificationPreference, User

logger = logging.getLogger(__name__)

# Notification type → preference field prefix mapping
TYPE_TO_PREF = {
    "lab_liked": "like",
    "lab_comment": "comment",
    "comment_reply": "reply",
    "new_follower": "follow",
    "partner_new_follower": "follow",
    "lab_new_follower": "follow",
    "lab_shared": "share",
    "partner_approved": "partner",
    "partner_rejected": "partner",
    "new_lab_from_followed": "new_lab",
}


class SocialNotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notification(
        self,
        user_id: str,
        type: str,
        content: str,
        related_id: Optional[str] = None,
        actor_user_id: Optional[str] = None,
        group_key: Optional[str] = None,
    ) -> Optional[Notification]:
        """Create a notification respecting user preferences."""
        # Check preferences
        if not await self._should_notify_in_app(user_id, type):
            return None

        notif = Notification(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            type=type,
            content=content,
            related_id=uuid.UUID(related_id) if related_id else None,
            is_read=False,
            actor_user_id=uuid.UUID(actor_user_id) if actor_user_id else None,
            group_key=group_key,
        )
        self.db.add(notif)
        return notif

    async def get_grouped_notifications(
        self, user_id: str, limit: int = 30, unread_only: bool = False
    ) -> List[dict]:
        """
        U-3.3.2: Get notifications grouped by group_key.
        E.g. "Alice and 4 others liked your lab" instead of 5 separate notifications.
        """
        conditions = [Notification.user_id == user_id]
        if unread_only:
            conditions.append(Notification.is_read == False)

        # Get all recent notifications
        result = await self.db.execute(
            select(Notification)
            .where(and_(*conditions))
            .order_by(Notification.created_at.desc())
            .limit(limit * 3)  # fetch extra for grouping
        )
        notifications = list(result.scalars().all())

        # Group by group_key
        grouped = {}
        ungrouped = []
        for n in notifications:
            if n.group_key:
                if n.group_key not in grouped:
                    grouped[n.group_key] = []
                grouped[n.group_key].append(n)
            else:
                ungrouped.append(n)

        items = []

        # Process grouped notifications
        for key, notifs in grouped.items():
            latest = notifs[0]  # already sorted desc
            count = len(notifs)
            all_ids = [str(n.id) for n in notifs]
            is_read = all(n.is_read for n in notifs)

            # Build grouped content
            if count > 1:
                # Get actor names
                actor_ids = list({str(n.actor_user_id) for n in notifs if n.actor_user_id})
                actor_names = await self._get_usernames(actor_ids[:2])
                if count == 2 and len(actor_names) == 2:
                    summary = f"{actor_names[0]} and {actor_names[1]}"
                elif actor_names:
                    others = count - 1
                    summary = f"{actor_names[0]} and {others} other{'s' if others > 1 else ''}"
                else:
                    summary = f"{count} people"

                # Determine action verb from type
                verb = self._type_to_verb(latest.type)
                content = f"{summary} {verb}"
            else:
                content = latest.content

            items.append({
                "id": str(latest.id),
                "ids": all_ids,
                "type": latest.type,
                "content": content,
                "related_id": str(latest.related_id) if latest.related_id else None,
                "is_read": is_read,
                "count": count,
                "created_at": latest.created_at.isoformat() if latest.created_at else None,
                "group_key": key,
            })

        # Process ungrouped
        for n in ungrouped:
            items.append({
                "id": str(n.id),
                "ids": [str(n.id)],
                "type": n.type,
                "content": n.content,
                "related_id": str(n.related_id) if n.related_id else None,
                "is_read": n.is_read,
                "count": 1,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "group_key": None,
            })

        # Sort by created_at desc and limit
        items.sort(key=lambda x: x["created_at"] or "", reverse=True)
        return items[:limit]

    async def get_unread_count(self, user_id: str) -> int:
        """Get unread notification count for badge."""
        result = await self.db.execute(
            select(func.count()).select_from(Notification).where(
                and_(Notification.user_id == user_id, Notification.is_read == False)
            )
        )
        return result.scalar() or 0

    async def mark_group_read(self, user_id: str, group_key: str):
        """Mark all notifications in a group as read."""
        await self.db.execute(
            update(Notification)
            .where(
                and_(
                    Notification.user_id == user_id,
                    Notification.group_key == group_key,
                    Notification.is_read == False,
                )
            )
            .values(is_read=True)
        )

    _PREF_DEFAULTS = dict(
        like_in_app=True, like_email=False,
        comment_in_app=True, comment_email=False,
        reply_in_app=True, reply_email=False,
        follow_in_app=True, follow_email=False,
        share_in_app=True, share_email=False,
        partner_in_app=True, partner_email=True,
        new_lab_in_app=True, new_lab_email=False,
    )

    async def get_preferences(self, user_id: str) -> dict:
        """Get user notification preferences, creating defaults if needed."""
        result = await self.db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        pref = result.scalars().first()
        if not pref:
            pref = NotificationPreference(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id),
                **self._PREF_DEFAULTS,
            )
            self.db.add(pref)
            await self.db.flush()

        return {
            "like": {"in_app": pref.like_in_app, "email": pref.like_email},
            "comment": {"in_app": pref.comment_in_app, "email": pref.comment_email},
            "reply": {"in_app": pref.reply_in_app, "email": pref.reply_email},
            "follow": {"in_app": pref.follow_in_app, "email": pref.follow_email},
            "share": {"in_app": pref.share_in_app, "email": pref.share_email},
            "partner": {"in_app": pref.partner_in_app, "email": pref.partner_email},
            "new_lab": {"in_app": pref.new_lab_in_app, "email": pref.new_lab_email},
        }

    async def update_preferences(self, user_id: str, updates: dict) -> dict:
        """Update user notification preferences."""
        result = await self.db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        pref = result.scalars().first()
        if not pref:
            pref = NotificationPreference(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id),
                **self._PREF_DEFAULTS,
            )
            self.db.add(pref)
            await self.db.flush()

        # Apply updates like {"like": {"in_app": true, "email": false}}
        for category, settings in updates.items():
            if isinstance(settings, dict):
                for channel, value in settings.items():
                    field = f"{category}_{channel}"
                    if hasattr(pref, field) and isinstance(value, bool):
                        setattr(pref, field, value)

        await self.db.commit()
        return await self.get_preferences(user_id)

    async def delete_notification(self, user_id: str, notification_id: str) -> bool:
        """Delete a single notification."""
        result = await self.db.execute(
            select(Notification).where(
                and_(Notification.id == notification_id, Notification.user_id == user_id)
            )
        )
        notif = result.scalars().first()
        if not notif:
            return False
        await self.db.delete(notif)
        await self.db.commit()
        return True

    async def clear_all(self, user_id: str) -> int:
        """Delete all notifications for a user."""
        result = await self.db.execute(
            sa_delete(Notification).where(Notification.user_id == user_id)
        )
        await self.db.commit()
        return result.rowcount

    # --- Private helpers ---

    async def _should_notify_in_app(self, user_id: str, notif_type: str) -> bool:
        """Check if user has in-app notifications enabled for this type."""
        pref_prefix = TYPE_TO_PREF.get(notif_type)
        if not pref_prefix:
            return True  # Unknown types always notify

        result = await self.db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        pref = result.scalars().first()
        if not pref:
            return True  # Default: notify

        field = f"{pref_prefix}_in_app"
        return getattr(pref, field, True)

    async def _get_usernames(self, user_ids: List[str]) -> List[str]:
        """Get usernames for a list of user IDs."""
        if not user_ids:
            return []
        result = await self.db.execute(
            select(User.id, User.username).where(User.id.in_(user_ids))
        )
        id_to_name = {str(r.id): r.username for r in result.all()}
        return [id_to_name.get(uid, "Someone") for uid in user_ids]

    @staticmethod
    def _type_to_verb(notif_type: str) -> str:
        verbs = {
            "lab_liked": "liked your lab",
            "lab_comment": "commented on your lab",
            "comment_reply": "replied to your comment",
            "new_follower": "started following you",
            "partner_new_follower": "started following your partner organization",
            "lab_new_follower": "started following your lab",
            "lab_shared": "shared your lab",
            "new_lab_from_followed": "published a new lab",
        }
        return verbs.get(notif_type, "interacted with your content")
