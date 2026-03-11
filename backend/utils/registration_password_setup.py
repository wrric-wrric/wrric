import logging
import uuid
import bcrypt
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.db_models import EventRegistration, User, Profile

logger = logging.getLogger(__name__)


def generate_registration_setup_token() -> str:
    """Generate a unique token for password setup from registration."""
    return str(uuid.uuid4())


def generate_rejection_token() -> str:
    """Generate a unique token for rejecting a registration."""
    return str(uuid.uuid4())


def generate_username_from_email(email: str) -> str:
    """Generate a unique username from email."""
    base_username = email.split('@')[0]
    # Remove special characters and lowercase
    username = ''.join(c for c in base_username if c.isalnum()).lower()
    return username


async def create_registration_password_setup(
    db: AsyncSession,
    registration_id: uuid.UUID,
    expires_hours: int = 24
) -> tuple[str, str]:
    """
    Create a password setup token and rejection token for a registration.
    Returns (setup_token, rejection_token) if successful.
    """
    # Get the registration
    result = await db.execute(
        select(EventRegistration).where(EventRegistration.id == registration_id)
    )
    registration = result.scalar_one_or_none()

    if not registration:
        logger.error(f"Registration not found: {registration_id}")
        return None, None

    # Generate tokens
    setup_token = generate_registration_setup_token()
    rejection_token = generate_rejection_token()
    expires_at = datetime.utcnow() + timedelta(hours=expires_hours)

    # Update registration
    registration.password_setup_token = setup_token
    registration.password_setup_expires_at = expires_at
    registration.needs_password_setup = True
    registration.rejection_token = rejection_token
    registration.rejection_expires_at = expires_at

    await db.commit()
    await db.refresh(registration)

    logger.info(f"Password setup and rejection tokens created for registration {registration_id}")
    return setup_token, rejection_token


async def verify_registration_setup_token(
    db: AsyncSession,
    token: str
) -> Optional[EventRegistration]:
    """
    Verify a password setup token and return the registration if valid.
    Returns None if token is invalid or expired.
    """
    result = await db.execute(
        select(EventRegistration).where(EventRegistration.password_setup_token == token)
    )
    registration = result.scalar_one_or_none()

    if not registration:
        logger.warning(f"Invalid registration setup token: {token}")
        return None

    if not registration.needs_password_setup:
        logger.warning(f"Registration does not need password setup: {token}")
        return None

    if registration.password_setup_expires_at and datetime.utcnow() > registration.password_setup_expires_at:
        logger.warning(f"Registration setup token expired: {token}")
        return None

    # Check if registration already has a user account
    if registration.profile_id and registration.profile.user:
        logger.warning(f"Registration already has user account: {token}")
        return None

    return registration


async def verify_bulk_import_token(
    db: AsyncSession,
    token: str
) -> Optional[Profile]:
    """
    Verify a bulk import invitation token and return the profile if valid.
    Returns None if token is invalid or expired.
    """
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(Profile)
        .options(selectinload(Profile.user))  # Eagerly load user relationship
        .where(Profile.invitation_token == token)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        logger.warning(f"Invalid bulk import token: {token}")
        return None

    if profile.invitation_status not in ['pending', None]:
        logger.warning(f"Invitation already processed (status: {profile.invitation_status}): {token}")
        return None

    # Check if token is expired (24 hours from invitation_sent_at)
    if profile.invitation_sent_at:
        expiry_time = profile.invitation_sent_at + timedelta(hours=24)
        if datetime.utcnow() > expiry_time:
            logger.warning(f"Bulk import token expired: {token}")
            return None

    return profile


async def verify_rejection_token(
    db: AsyncSession,
    token: str
) -> Optional[EventRegistration]:
    """
    Verify a rejection token and return the registration if valid.
    Returns None if token is invalid or expired.
    """
    result = await db.execute(
        select(EventRegistration).where(EventRegistration.rejection_token == token)
    )
    registration = result.scalar_one_or_none()

    if not registration:
        logger.warning(f"Invalid rejection token: {token}")
        return None

    if registration.is_rejected:
        logger.warning(f"Registration already rejected: {token}")
        return None

    if registration.rejection_expires_at and datetime.utcnow() > registration.rejection_expires_at:
        logger.warning(f"Rejection token expired: {token}")
        return None

    return registration


async def reject_bulk_import_invitation(
    db: AsyncSession,
    token: str
) -> tuple[bool, str]:
    """
    Reject a bulk import invitation.
    Marks invitation as declined and deletes the user account.
    Returns (success, message).
    """
    profile = await verify_bulk_import_token(db, token)
    
    if not profile:
        return False, "Invalid or expired invitation link"
    
    try:
        user = profile.user
        user_id = user.id if user else None
        
        # Mark invitation as declined
        profile.invitation_status = 'declined'
        profile.invitation_responded_at = datetime.utcnow()
        
        await db.flush()
        
        # Delete the user account (cascade will delete profile)
        if user_id:
            from sqlalchemy import delete
            await db.execute(delete(User).where(User.id == user_id))
        
        await db.commit()
        
        logger.info(f"Bulk import invitation rejected and user deleted: {user_id}")
        return True, "Your invitation has been declined and your account has been removed."
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to reject bulk import invitation: {str(e)}")
        return False, "Failed to process your request. Please try again."


async def reject_registration(
    db: AsyncSession,
    token: str
) -> tuple[bool, str]:
    """
    Reject/cancel a registration and remove all associated data.
    Deletes the EventRegistration, User, and Profile if they exist.
    Returns (success, message).
    """
    registration = await verify_rejection_token(db, token)

    if not registration:
        return False, "Invalid or expired rejection link"

    try:
        user_id = None
        profile_id = registration.profile_id

        # Get user_id from profile or temp_user_id
        if profile_id:
            result = await db.execute(
                select(Profile).where(Profile.id == profile_id)
            )
            profile = result.scalar_one_or_none()
            if profile:
                user_id = profile.user_id
        else:
            user_id = registration.temp_user_id

        # Mark registration as rejected
        registration.is_rejected = True
        registration.rejection_token = None
        registration.rejection_expires_at = None
        await db.flush()

        # Delete profile if exists
        if profile_id:
            await db.execute(
                select(Profile).where(Profile.id == profile_id)
            )
            from sqlalchemy import delete
            await db.execute(delete(Profile).where(Profile.id == profile_id))

        # Delete user if exists
        if user_id:
            from sqlalchemy import delete
            await db.execute(delete(User).where(User.id == user_id))

        # Delete registration
        from sqlalchemy import delete
        await db.execute(delete(EventRegistration).where(EventRegistration.id == registration.id))

        await db.commit()

        logger.info(f"Registration {registration.id} rejected and all data removed")
        return True, "Your registration has been cancelled and all your data has been removed."

    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to reject registration: {str(e)}")
        return False, "Failed to process your request. Please try again."


async def complete_bulk_import_password_setup(
    db: AsyncSession,
    token: str,
    password: str
) -> tuple[bool, str, Optional[str]]:
    """
    Complete the password setup for a bulk imported user.
    Updates the existing user's password and marks invitation as accepted.
    Returns (success, message, redirect_url).
    """
    profile = await verify_bulk_import_token(db, token)

    if not profile:
        return False, "Invalid or expired invitation link", None

    try:
        # Get the user associated with this profile
        user = profile.user
        
        if not user:
            logger.error(f"Profile {profile.id} has no associated user")
            return False, "Account configuration error. Please contact support.", None

        # Hash the new password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Update user password
        user.password = hashed_password

        # Mark invitation as accepted
        profile.invitation_status = 'accepted'
        profile.invitation_responded_at = datetime.utcnow()

        await db.commit()

        logger.info(f"Bulk import password setup completed for user {user.id} (email: {user.email})")

        return True, "Password set successfully. You can now log in.", "/login"

    except Exception as e:
        await db.rollback()
        logger.error(f"Error completing bulk import password setup: {str(e)}")
        return False, "An error occurred. Please try again.", None


async def complete_registration_password_setup(
    db: AsyncSession,
    token: str,
    password: str,
    base_url: str
) -> tuple[bool, str, Optional[str]]:
    """
    Complete the password setup for a registration.
    Creates User, Profile, and links them to Returns ( the registration.
   success, message, redirect_url).
    """
    # First check if this is a bulk import token
    profile = await verify_bulk_import_token(db, token)
    
    if profile:
        # This is a bulk import token - use the bulk import completion
        return await complete_bulk_import_password_setup(db, token, password)
    
    # Otherwise, check if it's an event registration token
    registration = await verify_registration_setup_token(db, token)

    if not registration:
        return False, "Invalid or expired setup link", None

    try:
        # Generate unique username
        username = generate_username_from_email(registration.email)
        base_username = username
        counter = 1

        while True:
            result = await db.execute(
                select(User).where(User.username == username)
            )
            if not result.scalar_one_or_none():
                break
            username = f"{base_username}_{counter}"
            counter += 1

        # Hash password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Create user
        user = User(
            username=username,
            email=registration.email,
            password=hashed_password,
            is_admin=False
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        # Create profile
        profile = Profile(
            user_id=user.id,
            is_default=True,
            first_name=registration.first_name,
            last_name=registration.last_name,
            display_name=f"{registration.first_name} {registration.last_name}",
            type="attendee",
            organization=registration.organization,
            title=registration.position
        )
        db.add(profile)
        await db.flush()
        await db.refresh(profile)

        # Update registration
        registration.profile_id = profile.id
        registration.needs_password_setup = False
        registration.password_setup_token = None
        registration.password_setup_expires_at = None
        registration.temp_user_id = user.id

        await db.commit()

        logger.info(f"Registration password setup completed for registration {registration.id}")
        return True, "Account created successfully!", f"{base_url}/dashboard"

    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to complete registration password setup: {str(e)}")
        return False, "Failed to create account. Please try again.", None


def generate_registration_setup_link(base_url: str, token: str) -> str:
    """
    Generate a password setup link for registration.
    """
    return f"{base_url}/auth/complete-registration?token={token}"


def generate_rejection_link(base_url: str, token: str) -> str:
    """
    Generate a rejection link for registration.
    """
    return f"{base_url}/auth/reject-registration?token={token}"


async def cleanup_expired_registration_tokens(db: AsyncSession):
    """
    Clean up expired registration setup tokens.
    Should be run periodically (e.g., via scheduled task).
    """
    from sqlalchemy import update

    # Update registrations with expired tokens
    result = await db.execute(
        update(EventRegistration)
        .where(
            EventRegistration.needs_password_setup == True,
            EventRegistration.password_setup_expires_at < datetime.utcnow()
        )
        .values(
            needs_password_setup=False,
            password_setup_token=None,
            password_setup_expires_at=None
        )
    )

    await db.commit()
    logger.info(f"Cleaned up {result.rowcount} expired registration setup tokens")
