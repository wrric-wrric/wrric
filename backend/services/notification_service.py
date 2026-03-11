# services/notification_service.py
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from ws_module.messages.connection_manager import manager
from utils.database import create_notification
from models.db_models import User, Profile

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def send_message_notification(self, message_id: str, sender_profile_id: str, 
                                      receiver_profile_id: str, content_preview: str):
        """Send notification for new message"""
        try:
            # Get receiver's user ID (you'll need to implement this)
            receiver_user_id = await self._get_user_id_by_profile(receiver_profile_id)
            if not receiver_user_id:
                return

            # Create database notification
            notification = await create_notification(
                self.db,
                user_id=receiver_user_id,
                type="new_message",
                content=f"New message: {content_preview}",
                related_id=message_id
            )

            if notification:
                # Send real-time notification via WebSocket
                notification_data = {
                    "id": str(notification.id),
                    "type": "new_message",
                    "content": notification.content,
                    "related_id": str(notification.related_id) if notification.related_id else None,
                    "created_at": notification.created_at.isoformat(),
                    "is_read": notification.is_read
                }
                
                await manager.send_notification(receiver_user_id, notification_data)
                logger.info(f"Message notification sent to user {receiver_user_id}")

        except Exception as e:
            logger.error(f"Error sending message notification: {e}")

    async def send_match_notification(self, user_id: str, match_id: str, match_type: str):
        """Send notification for new match"""
        try:
            notification = await create_notification(
                self.db,
                user_id=user_id,
                type="match_suggested",
                content=f"New {match_type} match suggested for you",
                related_id=match_id
            )

            if notification:
                notification_data = {
                    "id": str(notification.id),
                    "type": "match_suggested",
                    "content": notification.content,
                    "related_id": str(notification.related_id) if notification.related_id else None,
                    "created_at": notification.created_at.isoformat(),
                    "is_read": notification.is_read
                }
                
                await manager.send_notification(user_id, notification_data)
                logger.info(f"Match notification sent to user {user_id}")

        except Exception as e:
            logger.error(f"Error sending match notification: {e}")

    async def _get_user_id_by_profile(self, profile_id: str) -> Optional[str]:
        """Get user ID by profile ID"""
        try:
            from sqlalchemy import select
            from models.db_models import Profile
            
            result = await self.db.execute(
                select(Profile).where(Profile.id == profile_id)
            )
            profile = result.scalar_one_or_none()
            return str(profile.user_id) if profile else None
            
        except Exception as e:
            logger.error(f"Error getting user ID for profile {profile_id}: {e}")
            return None