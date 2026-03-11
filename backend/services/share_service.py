import uuid
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.db_models import LabShare, Entity, Notification, Message, User, Profile
from services.activity_hooks import record_activity


VALID_PLATFORMS = {"link", "twitter", "linkedin", "whatsapp", "email", "internal", "qr"}


class ShareService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def record_share(
        self,
        entity_id: str,
        platform: str,
        user_id: Optional[str] = None,
        recipient_user_id: Optional[str] = None,
    ) -> dict:
        """Record a share event. Returns share info or error dict."""
        if platform not in VALID_PLATFORMS:
            return {"error": f"Invalid platform. Must be one of: {', '.join(sorted(VALID_PLATFORMS))}", "status": 400}

        # Verify entity exists
        ent_result = await self.db.execute(select(Entity).where(Entity.id == entity_id))
        entity = ent_result.scalars().first()
        if not entity:
            return {"error": "Lab not found", "status": 404}

        share = LabShare(
            id=uuid.uuid4(),
            entity_id=uuid.UUID(entity_id),
            user_id=uuid.UUID(user_id) if user_id else None,
            platform=platform,
            recipient_user_id=uuid.UUID(recipient_user_id) if recipient_user_id else None,
        )
        self.db.add(share)

        # Increment share_count
        entity.share_count = (entity.share_count or 0) + 1

        # Internal share: create a message and notify lab owner
        if platform == "internal" and user_id and recipient_user_id:
            await self._handle_internal_share(entity, user_id, recipient_user_id)

        # Notify lab owner about the share (U-3.3.1)
        if user_id and entity.created_by_user_id and str(entity.created_by_user_id) != user_id:
            share_notif = Notification(
                id=uuid.uuid4(),
                user_id=entity.created_by_user_id,
                type="lab_shared",
                content=f"Someone shared your lab \"{entity.university or 'Unnamed Lab'}\"",
                related_id=uuid.UUID(entity_id),
                actor_user_id=uuid.UUID(user_id),
                group_key=f"lab_shared:{entity_id}",
            )
            self.db.add(share_notif)

        if user_id:
            await record_activity(self.db, user_id, "shared", "lab", entity_id, {"platform": platform})

        await self.db.commit()
        return {
            "id": str(share.id),
            "entity_id": entity_id,
            "platform": platform,
            "share_count": entity.share_count,
        }

    async def _handle_internal_share(self, entity: Entity, sender_user_id: str, recipient_user_id: str):
        """Create a message for internal share and notify lab owner."""
        # Get sender's default profile
        sender_profile = await self.db.execute(
            select(Profile).where(Profile.user_id == sender_user_id, Profile.is_default == True)
        )
        sender_prof = sender_profile.scalars().first()

        # Get recipient's default profile
        recipient_profile = await self.db.execute(
            select(Profile).where(Profile.user_id == recipient_user_id, Profile.is_default == True)
        )
        recipient_prof = recipient_profile.scalars().first()

        if sender_prof and recipient_prof:
            msg = Message(
                id=uuid.uuid4(),
                sender_profile_id=sender_prof.id,
                receiver_profile_id=recipient_prof.id,
                content=f"Shared a lab with you: {entity.university or 'Unnamed Lab'}",
                message_type="lab_share",
                metadata_={"entity_id": str(entity.id), "lab_name": entity.university or ""},
            )
            self.db.add(msg)

        # Notify recipient
        notif = Notification(
            id=uuid.uuid4(),
            user_id=uuid.UUID(recipient_user_id),
            type="lab_shared",
            content=f"Someone shared a lab with you: \"{entity.university or 'Unnamed Lab'}\"",
            related_id=entity.id,
        )
        self.db.add(notif)

        # Notify lab owner (if different from sender)
        if entity.created_by_user_id and str(entity.created_by_user_id) != sender_user_id:
            owner_notif = Notification(
                id=uuid.uuid4(),
                user_id=entity.created_by_user_id,
                type="lab_shared_internal",
                content=f"Your lab \"{entity.university or 'Unnamed Lab'}\" was shared with another user",
                related_id=entity.id,
            )
            self.db.add(owner_notif)

    async def get_share_count(self, entity_id: str) -> Optional[int]:
        """Get share count for an entity."""
        result = await self.db.execute(
            select(Entity.share_count).where(Entity.id == entity_id)
        )
        count = result.scalar()
        if count is None:
            # Check if entity exists
            ent = await self.db.execute(select(Entity.id).where(Entity.id == entity_id))
            if not ent.scalar():
                return None
            return 0
        return count
