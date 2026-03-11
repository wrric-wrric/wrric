import logging
from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.schemas import NotificationResponse
from models.db_models import Notification, User
from utils.database import get_db, create_notification, get_notifications_for_user
from api.dependencies import get_current_user
from services.social_notification_service import SocialNotificationService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["notifications"])


@router.post("/", response_model=NotificationResponse)
async def create_new_notification(
    notification_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new notification."""
    try:
        notification = await create_notification(db, **notification_data)
        if not notification:
            raise HTTPException(status_code=500, detail="Failed to create notification")
        return NotificationResponse.from_orm(notification)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating notification: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create notification: {str(e)}")


@router.get("/", response_model=List[NotificationResponse])
async def get_user_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve notifications for the current user."""
    try:
        notifications = await get_notifications_for_user(db, current_user, unread_only)
        return [NotificationResponse.from_orm(n) for n in notifications]
    except Exception as e:
        logger.exception(f"Failed to retrieve notifications: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve notifications: {str(e)}")


@router.get("/grouped")
async def get_grouped_notifications(
    unread_only: bool = False,
    limit: int = 30,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """U-3.3.2: Get notifications grouped (e.g. 'Alice and 4 others liked your lab')."""
    svc = SocialNotificationService(db)
    return await svc.get_grouped_notifications(current_user, limit=limit, unread_only=unread_only)


@router.get("/unread-count")
async def get_unread_count(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """U-3.3.4: Get unread notification count for badge."""
    svc = SocialNotificationService(db)
    count = await svc.get_unread_count(current_user)
    return {"count": count}


@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a single notification as read."""
    try:
        result = await db.execute(
            select(Notification).filter(
                Notification.id == notification_id,
                Notification.user_id == current_user
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")

        notification.is_read = True
        await db.commit()
        return {"message": "Notification marked as read"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to mark notification as read: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark notification as read: {str(e)}")


@router.put("/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read for the current user."""
    try:
        await db.execute(
            Notification.__table__.update()
            .where(Notification.user_id == current_user, Notification.is_read == False)
            .values(is_read=True)
        )
        await db.commit()
        return {"message": "All notifications marked as read"}
    except Exception as e:
        logger.exception(f"Failed to mark all notifications as read: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark all notifications as read: {str(e)}")


@router.put("/group/{group_key}/read")
async def mark_group_read(
    group_key: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications in a group as read."""
    svc = SocialNotificationService(db)
    await svc.mark_group_read(current_user, group_key)
    await db.commit()
    return {"message": "Group marked as read"}


@router.get("/preferences")
async def get_preferences(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """U-3.3.3: Get notification preferences."""
    svc = SocialNotificationService(db)
    prefs = await svc.get_preferences(current_user)
    await db.commit()
    return prefs


@router.patch("/preferences")
async def update_preferences(
    updates: dict,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """U-3.3.3: Update notification preferences."""
    svc = SocialNotificationService(db)
    return await svc.update_preferences(current_user, updates)


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a single notification."""
    svc = SocialNotificationService(db)
    deleted = await svc.delete_notification(current_user, notification_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}


@router.delete("/")
async def clear_all_notifications(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Clear all notifications for the current user."""
    svc = SocialNotificationService(db)
    count = await svc.clear_all(current_user)
    return {"message": f"Deleted {count} notifications"}
