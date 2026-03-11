"""
Hooks to create ActivityEvent records when social actions occur.
Import and call these from existing service methods.
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from models.db_models import ActivityEvent


async def record_activity(
    db: AsyncSession,
    actor_user_id: str,
    action: str,
    target_type: str,
    target_id: str,
    metadata: dict | None = None,
):
    """Record an activity event. Non-blocking — failures are silently ignored."""
    try:
        event = ActivityEvent(
            id=uuid.uuid4(),
            actor_user_id=uuid.UUID(actor_user_id),
            action=action,
            target_type=target_type,
            target_id=uuid.UUID(target_id),
            metadata_=metadata or {},
        )
        db.add(event)
        # Don't commit here — let the caller's commit handle it
    except Exception:
        pass  # Non-critical, don't break the main operation
