import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.db_models import PasswordReset, User, Profile
from utils.database import get_db

logger = logging.getLogger(__name__)


async def cleanup_expired_invitations():
    """
    Clean up expired invitation tokens and delete associated users.
    This function runs every hour to remove users who haven't accepted
    their invitations within 24 hours.
    """
    try:
        logger.info("Starting expired invitation cleanup...")
        
        # Get expired password reset tokens
        async for db in get_db():
            result = await db.execute(
                select(PasswordReset).where(
                    PasswordReset.expires_at < datetime.utcnow(),
                    PasswordReset.is_used == False
                )
            )
            expired_tokens = result.scalars().all()
            
            if not expired_tokens:
                logger.info("No expired invitations found.")
                return
            
            logger.info(f"Found {len(expired_tokens)} expired invitations")
            
            deleted_count = 0
            for token in expired_tokens:
                try:
                    # Get the user associated with this token
                    user_result = await db.execute(
                        select(User).where(User.id == token.user_id)
                    )
                    user = user_result.scalar_one_or_none()
                    
                    if user:
                        # Update profile status before deletion
                        profile_result = await db.execute(
                            select(Profile).where(
                                Profile.user_id == token.user_id,
                                Profile.import_batch_id.isnot(None)
                            )
                        )
                        profile = profile_result.scalar_one_or_none()
                        
                        if profile:
                            profile.invitation_status = 'expired'
                            profile.invitation_responded_at = datetime.utcnow()
                        
                        # Log the deletion for audit purposes
                        logger.info(f"Removing expired invitation user: {user.email} (ID: {user.id})")
                        
                        # Delete the user (this cascades to profiles and password resets)
                        await db.delete(user)
                        deleted_count += 1
                    else:
                        # If no user found, just delete the orphaned token
                        await db.delete(token)
                        
                except Exception as e:
                    logger.error(f"Error cleaning up expired invitation {token.id}: {str(e)}")
                    continue
            
            # Commit all deletions
            await db.commit()
            
            logger.info(f"Successfully cleaned up {deleted_count} expired invitation users")
            
    except Exception as e:
        logger.error(f"Error in invitation cleanup: {str(e)}")
        # Don't raise the exception to prevent the scheduler from stopping