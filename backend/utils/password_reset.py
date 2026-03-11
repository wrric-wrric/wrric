import logging
import uuid
import bcrypt
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.db_models import User, PasswordReset

logger = logging.getLogger(__name__)


async def create_password_reset_token(db: AsyncSession, email: str, expires_hours: int = 1) -> Optional[PasswordReset]:
    """
    Create a password reset token for the given email.
    Returns the reset token if user exists, None otherwise.
    """
    # Check if user exists with this email
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()  # now safe

    if not user:
        # Don't reveal if user exists - return None
        logger.info(f"Password reset requested for non-existent email: {email}")
        return None

    # Generate unique token
    token = str(uuid.uuid4())

    # Set expiration time
    expires_at = datetime.utcnow() + timedelta(hours=expires_hours)

    # Create password reset record
    password_reset = PasswordReset(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
        is_used=False
    )

    db.add(password_reset)
    await db.commit()
    await db.refresh(password_reset)

    logger.info(f"Password reset token created for user {user.id}")
    return password_reset


async def verify_password_reset_token(db: AsyncSession, token: str) -> Optional[User]:
    """
    Verify a password reset token and return the associated user if valid.
    Returns None if token is invalid, expired, or already used.
    """
    # Find the password reset record
    result = await db.execute(
        select(PasswordReset).where(PasswordReset.token == token)
    )
    password_reset = result.scalar_one_or_none()

    if not password_reset:
        logger.warning(f"Invalid password reset token: {token}")
        return None

    # Check if token is used
    if password_reset.is_used:
        logger.warning(f"Password reset token already used: {token}")
        return None

    # Check if token is expired
    if datetime.utcnow() > password_reset.expires_at:
        logger.warning(f"Password reset token expired: {token}")
        return None

    # Token is valid, return user
    result = await db.execute(
        select(User).where(User.id == password_reset.user_id)
    )
    user = result.scalar_one_or_none()

    return user


async def reset_password(db: AsyncSession, token: str, new_password: str) -> bool:
    """
    Reset user password using the given token.
    Returns True if successful, False otherwise.
    """
    # Verify token and get user
    user = await verify_password_reset_token(db, token)

    if not user:
        logger.error(f"Failed to reset password: invalid token {token}")
        return False

    # Update user password (hash it first)
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user.password = hashed_password
    user.updated_at = datetime.utcnow()

    # Mark token as used
    result = await db.execute(
        select(PasswordReset).where(PasswordReset.token == token)
    )
    password_reset = result.scalar_one_or_none()

    if password_reset:
        password_reset.is_used = True

    await db.commit()

    logger.info(f"Password reset successfully for user {user.id}")
    return True


async def invalidate_all_password_resets(db: AsyncSession, user_id: uuid.UUID):
    """
    Invalidate all password reset tokens for a user.
    Used when user successfully logs in or resets password.
    """
    from sqlalchemy import delete

    await db.execute(
        delete(PasswordReset).where(PasswordReset.user_id == user_id)
    )
    await db.commit()

    logger.info(f"Invalidated all password reset tokens for user {user_id}")


def generate_password_reset_link(base_url: str, token: str) -> str:
    """
    Generate a password reset link for the user.
    Example: http://localhost:3000/reset-password?token=abc-123-def
    """
    return f"{base_url}/reset-password?token={token}"


async def cleanup_expired_tokens(db: AsyncSession):
    """
    Clean up expired password reset tokens.
    Should be run periodically (e.g., via scheduled task).
    """
    from sqlalchemy import delete

    # Delete tokens that have expired or are older than 24 hours
    cutoff_time = datetime.utcnow() - timedelta(hours=24)

    result = await db.execute(
        delete(PasswordReset).where(PasswordReset.expires_at < cutoff_time)
    )

    await db.commit()
    logger.info(f"Cleaned up {result.rowcount} expired password reset tokens")


async def get_user_by_reset_token(db: AsyncSession, token: str) -> Optional[User]:
    """
    Get user by password reset token without marking as used.
    Used for validation before password reset form submission.
    """
    user = await verify_password_reset_token(db, token)
    return user
