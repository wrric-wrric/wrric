import logging
import uuid
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from api.dependencies import get_current_user
from schemas.events import (
    EventRegistrationResponse,
    EventRegistrationUpdate,
    EventParticipantResponse,
    PaginatedResponse,
)
from services.event_service import EventService
from utils.database import get_db
from models.db_models import EventRegistration, Profile, User, Event

logger = logging.getLogger(__name__)
router = APIRouter(tags=["user-events"])


# -------------------------
# User Registration Management
# -------------------------

@router.get("/{event_id}/registrations/me", response_model=EventRegistrationResponse)
async def get_my_registration(
    event_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's registration for an event.
    Returns 404 if not registered.
    """
    try:
        user_uuid = uuid.UUID(current_user) if isinstance(current_user, str) else current_user
        
        # Get user's email
        result = await db.execute(
            select(User).where(User.id == user_uuid)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Find registration by email
        result = await db.execute(
            select(EventRegistration)
            .where(
                and_(
                    EventRegistration.event_id == event_id,
                    EventRegistration.email == user.email
                )
            )
        )
        registration = result.scalar_one_or_none()
        
        if not registration:
            raise HTTPException(
                status_code=404,
                detail="You are not registered for this event"
            )
        
        logger.info(f"User {user_uuid} retrieved registration {registration.id} for event {event_id}")
        return registration
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving registration: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve registration")


@router.put("/{event_id}/registrations/me", response_model=EventRegistrationResponse)
async def update_my_registration(
    event_id: uuid.UUID,
    update_data: EventRegistrationUpdate,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current user's registration for an event.
    Only certain fields can be updated (position, organization, special_requirements, etc.)
    """
    try:
        user_uuid = uuid.UUID(current_user) if isinstance(current_user, str) else current_user
        
        # Get user's email
        result = await db.execute(
            select(User).where(User.id == user_uuid)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Find registration
        result = await db.execute(
            select(EventRegistration)
            .where(
                and_(
                    EventRegistration.event_id == event_id,
                    EventRegistration.email == user.email
                )
            )
        )
        registration = result.scalar_one_or_none()
        
        if not registration:
            raise HTTPException(
                status_code=404,
                detail="You are not registered for this event"
            )
        
        # Check if event has passed
        result = await db.execute(
            select(Event).where(Event.id == event_id)
        )
        event = result.scalar_one_or_none()
        
        if event and event.event_datetime < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=400,
                detail="Cannot update registration for past events"
            )
        
        # Update allowed fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if hasattr(registration, field):
                setattr(registration, field, value)
        
        registration.updated_at = datetime.now(timezone.utc)
        
        await db.commit()
        await db.refresh(registration)
        
        logger.info(f"User {user_uuid} updated registration {registration.id} for event {event_id}")
        return registration
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating registration: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update registration")


@router.delete("/{event_id}/registrations/me", status_code=status.HTTP_200_OK)
async def cancel_my_registration(
    event_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel (delete) current user's registration for an event.
    """
    try:
        user_uuid = uuid.UUID(current_user) if isinstance(current_user, str) else current_user
        
        # Get user's email
        result = await db.execute(
            select(User).where(User.id == user_uuid)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Find registration
        result = await db.execute(
            select(EventRegistration)
            .where(
                and_(
                    EventRegistration.event_id == event_id,
                    EventRegistration.email == user.email
                )
            )
        )
        registration = result.scalar_one_or_none()
        
        if not registration:
            raise HTTPException(
                status_code=404,
                detail="You are not registered for this event"
            )
        
        # Check if event has passed
        result = await db.execute(
            select(Event).where(Event.id == event_id)
        )
        event = result.scalar_one_or_none()
        
        if event and event.event_datetime < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=400,
                detail="Cannot cancel registration for past events"
            )
        
        # Delete registration
        await db.delete(registration)
        await db.commit()
        
        logger.info(f"User {user_uuid} cancelled registration {registration.id} for event {event_id}")
        return {
            "message": "Registration cancelled successfully",
            "event_id": str(event_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling registration: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to cancel registration")


# -------------------------
# Event Participants (Public)
# -------------------------

@router.get("/{event_id}/participants", response_model=PaginatedResponse[EventParticipantResponse])
async def get_event_participants(
    event_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    Get list of visible participants for an event.
    Only shows non-anonymous participants who opted to be visible.
    """
    try:
        event_service = EventService(db)
        
        # Verify event exists
        event = await event_service.get_event_admin(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Query participants
        # Only include:
        # - Non-anonymous registrations
        # - Participants who want to be visible
        # - With profile linked (for display info)
        offset = (page - 1) * page_size
        
        result = await db.execute(
            select(EventRegistration)
            .options(selectinload(EventRegistration.profile))
            .where(
                and_(
                    EventRegistration.event_id == event_id,
                    EventRegistration.is_anonymous == False,
                    EventRegistration.wants_profile_visible == True,
                    EventRegistration.status == 'confirmed'  # Only confirmed registrations
                )
            )
            .order_by(EventRegistration.registration_date.desc())
            .offset(offset)
            .limit(page_size)
        )
        registrations = result.scalars().all()
        
        # Count total
        count_result = await db.execute(
            select(func.count(EventRegistration.id))
            .where(
                and_(
                    EventRegistration.event_id == event_id,
                    EventRegistration.is_anonymous == False,
                    EventRegistration.wants_profile_visible == True,
                    EventRegistration.status == 'confirmed'
                )
            )
        )
        total = count_result.scalar_one()
        
        # Build participant responses
        participants = []
        for reg in registrations:
            participant = {
                "first_name": reg.first_name,
                "last_name": reg.last_name,
                "organization": reg.organization,
                "title": reg.position,
                "participation_type": reg.participation_type,
                "profile_image": reg.profile.profile_image if reg.profile else None,
                "registration_date": reg.registration_date
            }
            participants.append(participant)
        
        return {
            "items": participants,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching participants: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch participants")


# -------------------------
# Check Registration Status
# -------------------------

@router.get("/{event_id}/registration-status")
async def check_registration_status(
    event_id: uuid.UUID,
    current_user: Optional[str] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if current user is registered for an event.
    Returns registration status and available actions.
    """
    try:
        if not current_user:
            return {
                "registered": False,
                "has_account": False,
                "available_actions": ["register"],
                "message": "Please log in or create an account to register"
            }
        
        user_uuid = uuid.UUID(current_user) if isinstance(current_user, str) else current_user
        
        # Get user's email
        result = await db.execute(
            select(User).where(User.id == user_uuid)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return {
                "registered": False,
                "has_account": False,
                "available_actions": ["register"],
                "message": "User not found"
            }
        
        # Check registration
        result = await db.execute(
            select(EventRegistration)
            .where(
                and_(
                    EventRegistration.event_id == event_id,
                    EventRegistration.email == user.email
                )
            )
        )
        registration = result.scalar_one_or_none()
        
        if registration:
            # Check if event has passed
            result = await db.execute(
                select(Event).where(Event.id == event_id)
            )
            event = result.scalar_one_or_none()
            event_passed = event and event.event_datetime < datetime.now(timezone.utc)
            
            return {
                "registered": True,
                "has_account": True,
                "registration_id": str(registration.id),
                "status": registration.status,
                "available_actions": [] if event_passed else ["edit", "cancel"],
                "message": "You are already registered for this event",
                "event_passed": event_passed
            }
        else:
            return {
                "registered": False,
                "has_account": True,
                "available_actions": ["register"],
                "message": "You can register for this event"
            }
        
    except Exception as e:
        logger.error(f"Error checking registration status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to check registration status")
