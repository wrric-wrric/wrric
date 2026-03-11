import logging
import uuid
import bcrypt
from datetime import datetime, timedelta,timezone
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from models.db_models import Event, EventCategory, EventCategoryMapping, LocationType, EventRegistration, Profile, User
from schemas.events import EventCreate, EventUpdate
from utils.database import check_and_reconnect
from api.dependencies import _get_presigned_url
from utils.registration_password_setup import (
    create_registration_password_setup,
    generate_registration_setup_link,
    generate_rejection_link,
    generate_username_from_email
)
from api.manager_email_service import send_event_registration_confirmation_email

logger = logging.getLogger(__name__)

logger = logging.getLogger(__name__)


class EventService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_event(self, event_data: EventCreate, user_id: uuid.UUID) -> Event:
        """Create a new event with categories."""
        await check_and_reconnect(self.db)
        
        try:
            # Generate slug from title
            slug = await self._generate_slug(event_data.title)
            
            # Create event
            event = Event(
                **event_data.dict(exclude={'categories'}),
                slug=slug,
                created_by=user_id,
                is_published=False  # Events are unpublished by default
            )
            
            # Add categories if provided
            if event_data.categories:
                categories = await self._get_categories_by_ids(event_data.categories)
                event.categories.extend(categories)
            
            self.db.add(event)
            await self.db.commit()
            await self.db.refresh(event)
            
            logger.info(f"Event created: {event.id} by user {user_id}")
            return event
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create event: {str(e)}")
            raise
    
    async def update_event(self, event_id: uuid.UUID, event_data: EventUpdate, user_id: uuid.UUID) -> Optional[Event]:
        """Update an existing event."""
        await check_and_reconnect(self.db)
        
        try:
            # Get event
            event = await self.get_event_admin(event_id)
            if not event:
                return None
            
            # Check if user is creator or admin (you can add admin check here)
            if event.created_by != user_id:
                # Add admin check if needed
                pass
            
            # Update fields
            update_data = event_data.dict(exclude_unset=True, exclude={'categories'})
            
            # Handle slug update if title changed
            if 'title' in update_data and update_data['title'] != event.title:
                update_data['slug'] = await self._generate_slug(update_data['title'])
            
            for field, value in update_data.items():
                setattr(event, field, value)
            
            # Update categories if provided
            if event_data.categories is not None:
                # Clear existing categories
                event.categories.clear()
                # Add new categories
                if event_data.categories:
                    categories = await self._get_categories_by_ids(event_data.categories)
                    event.categories.extend(categories)
            
            event.updated_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(event)
            
            logger.info(f"Event updated: {event.id} by user {user_id}")
            return event
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to update event {event_id}: {str(e)}")
            raise
    
    async def delete_event(self, event_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Soft delete an event (set is_published=False)."""
        await check_and_reconnect(self.db)
        
        try:
            event = await self.get_event_admin(event_id)
            if not event:
                return False
            
            # Check permissions
            if event.created_by != user_id:
                # Add admin check if needed
                pass
            
            event.is_published = False
            await self.db.commit()
            
            logger.info(f"Event soft deleted: {event.id} by user {user_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to delete event {event_id}: {str(e)}")
            raise
    
    async def publish_event(self, event_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Publish an event."""
        await check_and_reconnect(self.db)
        
        try:
            event = await self.get_event_admin(event_id)
            if not event:
                return False
            
            # Validate event can be published
            if event.event_datetime < datetime.now(timezone.utc):
                raise ValueError("Cannot publish past events")
            
            if event.location_type == LocationType.PHYSICAL and not event.physical_location:
                raise ValueError("Physical events require a location")
            
            if event.location_type in [LocationType.VIRTUAL, LocationType.HYBRID] and not event.virtual_link:
                raise ValueError("Virtual/Hybrid events require a virtual link")
            
            event.is_published = True
            event.published_at = datetime.now(timezone.utc)
            await self.db.commit()
            
            logger.info(f"Event published: {event.id} by user {user_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to publish event {event_id}: {str(e)}")
            raise
    
    async def unpublish_event(self, event_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Unpublish an event."""
        await check_and_reconnect(self.db)
        
        try:
            event = await self.get_event_admin(event_id)
            if not event:
                return False
            
            event.is_published = False
            event.published_at = None
            await self.db.commit()
            
            logger.info(f"Event unpublished: {event.id} by user {user_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to unpublish event {event_id}: {str(e)}")
            raise
    
    async def get_upcoming_events(
        self,
        limit: int = 20,
        page: int = 1,
        featured: Optional[bool] = None,
        location_type: Optional[LocationType] = None,
        category_ids: Optional[List[uuid.UUID]] = None,
        from_date: Optional[datetime] = None,
        sort_by: str = "date"
    ) -> tuple[List[Event], int]:
        """Get upcoming events for public view."""
        await check_and_reconnect(self.db)
        
        try:
            query = select(Event).where(
                and_(
                    Event.is_published == True,
                Event.event_datetime >= datetime.now(timezone.utc)
                )
            ).options(
                selectinload(Event.categories)
            )
            
            # Apply filters
            if featured is not None:
                query = query.where(Event.is_featured == featured)
            
            if location_type:
                query = query.where(Event.location_type == location_type)
            
            if category_ids:
                query = query.join(EventCategoryMapping).where(
                    EventCategoryMapping.category_id.in_(category_ids)
                )
            
            if from_date:
                query = query.where(Event.event_datetime >= from_date)
            
            # Sorting
            if sort_by == "priority":
                query = query.order_by(desc(Event.priority), asc(Event.event_datetime))
            elif sort_by == "created":
                query = query.order_by(desc(Event.created_at))
            else:  # date (default)
                query = query.order_by(asc(Event.event_datetime))
            
            # Count total
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await self.db.execute(count_query)
            total = total_result.scalar()
            
            # Pagination
            offset = (page - 1) * limit
            query = query.offset(offset).limit(limit)
            
            result = await self.db.execute(query)
            events = result.scalars().all()
            
            return events, total
            
        except Exception as e:
            logger.error(f"Failed to get upcoming events: {str(e)}")
            raise
    
    async def get_event_by_slug(self, slug: str) -> Optional[Event]:
        """Get a single event by slug for public view."""
        await check_and_reconnect(self.db)
        
        try:
            query = select(Event).where(
                and_(
                    Event.slug == slug,
                    Event.is_published == True
                )
            ).options(
                selectinload(Event.categories)
            )
            
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
            
        except Exception as e:
            logger.error(f"Failed to get event by slug {slug}: {str(e)}")
            raise
    
    async def get_banner_events(self) -> List[Event]:
        """Get events for banner display."""
        await check_and_reconnect(self.db)
        
        try:
            # Get featured events first, then upcoming events
            query = select(Event).where(
                and_(
                    Event.is_published == True,
                    Event.event_datetime >= datetime.utcnow(),
                    or_(
                        Event.is_featured == True,
                        Event.priority > 50,  # High priority events
                        Event.event_datetime <= datetime.now(timezone.utc) + timedelta(days=7)  # Next 7 days
                    )
                )
            ).options(
                selectinload(Event.categories)
            ).order_by(
                desc(Event.is_featured),
                desc(Event.priority),
                asc(Event.event_datetime)
            ).limit(5)  # Limit to 5 events for banner
            
            result = await self.db.execute(query)
            events = result.scalars().all()
            
            return events
            
        except Exception as e:
            logger.error(f"Failed to get banner events: {str(e)}")
            raise
    
    async def get_event_admin(self, event_id: uuid.UUID) -> Optional[Event]:
        """Get event for admin view (includes unpublished)."""
        await check_and_reconnect(self.db)
        
        try:
            query = select(Event).where(Event.id == event_id).options(
                selectinload(Event.categories)
            )
            
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
            
        except Exception as e:
            logger.error(f"Failed to get admin event {event_id}: {str(e)}")
            raise
    
    async def get_admin_events(
        self,
        limit: int = 20,
        page: int = 1,
        is_published: Optional[bool] = None,
        is_featured: Optional[bool] = None,
        created_by: Optional[uuid.UUID] = None,
        search: Optional[str] = None
    ) -> tuple[List[Event], int]:
        """Get all events for admin view."""
        await check_and_reconnect(self.db)
        
        try:
            query = select(Event).options(
                selectinload(Event.categories),
                selectinload(Event.creator)
            )
            
            # Apply filters
            if is_published is not None:
                query = query.where(Event.is_published == is_published)
            
            if is_featured is not None:
                query = query.where(Event.is_featured == is_featured)
            
            if created_by:
                query = query.where(Event.created_by == created_by)
            
            if search:
                search_term = f"%{search}%"
                query = query.where(
                    or_(
                        Event.title.ilike(search_term),
                        Event.description.ilike(search_term),
                        Event.slug.ilike(search_term)
                    )
                )
            
            # Count total
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await self.db.execute(count_query)
            total = total_result.scalar()
            
            # Sorting and pagination
            offset = (page - 1) * limit
            query = query.order_by(desc(Event.created_at)).offset(offset).limit(limit)
            
            result = await self.db.execute(query)
            events = result.scalars().all()
            
            return events, total
            
        except Exception as e:
            logger.error(f"Failed to get admin events: {str(e)}")
            raise
    
    async def get_event_stats(self) -> Dict[str, Any]:
        """Get event statistics."""
        await check_and_reconnect(self.db)
        
        try:
            now = datetime.now(timezone.utc)
            week_ago = now - timedelta(days=7)
            
            # Total events
            total_query = select(func.count(Event.id))
            total_result = await self.db.execute(total_query)
            total = total_result.scalar()
            
            # Published events
            published_query = select(func.count(Event.id)).where(Event.is_published == True)
            published_result = await self.db.execute(published_query)
            published = published_result.scalar()
            
            # Upcoming events
            upcoming_query = select(func.count(Event.id)).where(
                and_(
                    Event.is_published == True,
                    Event.event_datetime >= now
                )
            )
            upcoming_result = await self.db.execute(upcoming_query)
            upcoming = upcoming_result.scalar()
            
            # Featured events
            featured_query = select(func.count(Event.id)).where(
                and_(
                    Event.is_published == True,
                    Event.is_featured == True,
                    Event.event_datetime >= now
                )
            )
            featured_result = await self.db.execute(featured_query)
            featured = featured_result.scalar()
            
            # Recent events (last 7 days)
            recent_query = select(func.count(Event.id)).where(Event.created_at >= week_ago)
            recent_result = await self.db.execute(recent_query)
            recent = recent_result.scalar()
            
            return {
                "total_events": total,
                "published_events": published,
                "upcoming_events": upcoming,
                "featured_events": featured,
                "recent_events": recent
            }
            
        except Exception as e:
            logger.error(f"Failed to get event stats: {str(e)}")
            raise
    
    async def _generate_slug(self, title: str) -> str:
        """Generate a URL-friendly slug from title."""
        import re
        import unicodedata
        
        # Normalize and lowercase
        slug = unicodedata.normalize('NFKD', title)
        slug = slug.encode('ascii', 'ignore').decode('ascii')
        slug = slug.lower()
        
        # Replace non-alphanumeric with hyphens
        slug = re.sub(r'[^a-z0-9]+', '-', slug)
        slug = slug.strip('-')
        
        # Ensure uniqueness
        base_slug = slug
        counter = 1
        
        while True:
            query = select(Event).where(Event.slug == slug)
            result = await self.db.execute(query)
            existing = result.scalar_one_or_none()
            
            if not existing:
                return slug
            
            slug = f"{base_slug}-{counter}"
            counter += 1
    
    async def _get_categories_by_ids(self, category_ids: List[uuid.UUID]) -> List[EventCategory]:
        """Get categories by their IDs."""
        query = select(EventCategory).where(EventCategory.id.in_(category_ids))
        result = await self.db.execute(query)
        return result.scalars().all()


    async def update_event_image(self, event_id: uuid.UUID, image_type: str, image_key: str) -> bool:
        """Update event image URL in database."""
        await check_and_reconnect(self.db)
        
        try:
            event = await self.get_event_admin(event_id)
            if not event:
                return False
            
            if image_type == "featured":
                event.featured_image_url = image_key
            elif image_type == "banner":
                event.banner_image_url = image_key
            else:
                return False

            event.updated_at = datetime.now(timezone.utc)
            await self.db.commit()
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to update event image: {str(e)}")
            raise

    async def delete_event_image(self, event_id: uuid.UUID, image_type: str) -> bool:
        """Delete event image reference from database."""
        await check_and_reconnect(self.db)
        
        try:
            event = await self.get_event_admin(event_id)
            if not event:
                return False
            
            if image_type == "featured":
                event.featured_image_url = None
            elif image_type == "banner":
                event.banner_image_url = None
            else:
                return False

            event.updated_at = datetime.now(timezone.utc)
            await self.db.commit()
            return True

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to delete event image reference: {str(e)}")
            raise

    async def register_for_event(
        self,
        event_id: uuid.UUID,
        registration_data: Dict[str, Any],
        base_url: str = "http://localhost:3000"
    ) -> Tuple[EventRegistration, str, Optional[str]]:
        """
        Register for an event with multiple registration options.
        
        Returns:
            - registration: The EventRegistration object
            - message: User-facing message
            - redirect_url: URL to redirect user (for profile-first flow)
        """
        await check_and_reconnect(self.db)

        try:
            # Check if event exists
            event = await self.get_event_admin(event_id)
            if not event:
                raise ValueError(f"Event {event_id} not found")

            # Extract registration options
            email = registration_data['email'].lower().strip()
            first_name = registration_data['first_name']
            last_name = registration_data['last_name']
            create_account = registration_data.get('create_account', False)
            password = registration_data.get('new_password')  # Only for full registration
            is_anonymous = registration_data.get('is_anonymous', False)
            position = registration_data.get('position')
            organization = registration_data.get('organization')
            participation_type = registration_data.get('participation_type', 'attendee')
            attendance_type = registration_data.get('attendance_type', 'on_site')
            ticket_type = registration_data.get('ticket_type')
            wants_profile_visible = registration_data.get('wants_profile_visible', not is_anonymous)
            profile_visibility_types = registration_data.get('profile_visibility_types', [])
            special_requirements = registration_data.get('special_requirements')
            metadata_ = registration_data.get('metadata_', {})

            # Check if email already registered for this event
            existing_registration = await self.db.execute(
                select(EventRegistration).where(
                    and_(
                        EventRegistration.event_id == event_id,
                        EventRegistration.email == email,
                        EventRegistration.is_anonymous == False  # Don't count anonymous registrations
                    )
                )
            )
            reg = existing_registration.scalar_one_or_none()
            if reg:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": "duplicate_registration",
                        "message": f"You are already registered for this event",
                        "registration_id": str(reg.id),
                        "registration_status": reg.status,
                        "available_actions": ["view", "edit", "cancel"]
                    }
                )

            # Check if user already exists with this email
            result = await self.db.execute(
                select(Profile).options(selectinload(Profile.user)).where(
                    Profile.user.has(User.email == email)
                )
            )
            existing_profile = result.scalar_one_or_none()

            # Determine registration type and handle accordingly
            registration_type = ""
            redirect_url = None
            profile_id = None
            user_id = None

            if is_anonymous:
                # Anonymous registration - no profile, not visible
                registration_type = "anonymous"
                logger.info(f"Anonymous registration for event {event_id} with email {email}")

            elif create_account and password:
                # Full registration with immediate password
                registration_type = "full"
                profile_id, user_id = await self._create_full_registration(
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    position=position,
                    organization=organization,
                    password=password
                )
                logger.info(f"Full registration for event {event_id} with email {email}")

            elif create_account and not password:
                # Profile-first registration - send email to set password later
                registration_type = "profile_first"
                profile_id = existing_profile.id if existing_profile else None
                logger.info(f"Profile-first registration for event {event_id} with email {email}")

            else:
                # Basic registration - just register, no account creation
                registration_type = "basic"
                profile_id = existing_profile.id if existing_profile else None
                logger.info(f"Basic registration for event {event_id} with email {email}")

            # Create registration
            registration = EventRegistration(
                event_id=event_id,
                profile_id=profile_id,
                temp_user_id=user_id,
                first_name=first_name,
                last_name=last_name,
                email=email,
                position=position,
                organization=organization,
                participation_type=participation_type,
                attendance_type=attendance_type,
                ticket_type=ticket_type,
                wants_profile_visible=wants_profile_visible and not is_anonymous,
                profile_visibility_types=profile_visibility_types if not is_anonymous else [],
                status='pending',
                registration_date=datetime.utcnow(),
                create_account=create_account,
                is_anonymous=is_anonymous,
                metadata_=metadata_
            )

            if special_requirements:
                registration.special_requirements = special_requirements

            self.db.add(registration)
            await self.db.flush()
            await self.db.refresh(registration)

            # Handle profile-first registration setup
            if registration_type == "profile_first":
                # Create password setup token and rejection token
                setup_token, rejection_token = await create_registration_password_setup(
                    self.db, registration.id
                )
                if setup_token:
                    redirect_url = generate_registration_setup_link(base_url, setup_token)
                    rejection_url = generate_rejection_link(base_url, rejection_token)
                else:
                    logger.error(f"Failed to create password setup token for registration {registration.id}")
                    rejection_url = None
            else:
                rejection_url = None

            await self.db.commit()

            # Send confirmation email
            event_date = event.event_datetime.strftime("%B %d, %Y at %I:%M %p")
            event_location = event.physical_location or "TBA"

            await send_event_registration_confirmation_email(
                email=email,
                first_name=first_name,
                event_title=event.title,
                event_date=event_date,
                event_location=event_location,
                registration_type=registration_type,
                setup_password_url=redirect_url,
                reject_registration_url=rejection_url,
                virtual_link=event.virtual_link,
                location_type=event.location_type.value if event.location_type else None
            )

            # Generate user-facing message
            if registration_type == "anonymous":
                message = "Registration successful! Your registration is private."
            elif registration_type == "full":
                message = "Registration successful! Your account has been created."
            elif registration_type == "profile_first":
                message = "Registration successful! Please check your email to set up your password."
            else:
                message = "Registration successful!"

            logger.info(f"Event registration created: {registration.id} for event {event_id}")
            return registration, message, redirect_url

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create event registration: {str(e)}")
            raise

    async def _create_full_registration(
        self,
        email: str,
        first_name: str,
        last_name: str,
        position: Optional[str],
        organization: Optional[str],
        password: str
    ) -> Tuple[uuid.UUID, uuid.UUID]:
        """
        Create a full user account and profile for registration.
        Returns (profile_id, user_id).
        """
        # Check if user already exists
        result = await self.db.execute(
            select(Profile).options(selectinload(Profile.user)).where(
                Profile.user.has(User.email == email)
            )
        )
        existing_profile = result.scalar_one_or_none()

        if existing_profile:
            return existing_profile.id, existing_profile.user_id

        # Generate unique username
        username = generate_username_from_email(email)
        base_username = username
        counter = 1

        while True:
            result = await self.db.execute(
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
            email=email,
            password=hashed_password,
            is_admin=False
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)

        # Create profile
        profile = Profile(
            user_id=user.id,
            is_default=True,
            first_name=first_name,
            last_name=last_name,
            display_name=f"{first_name} {last_name}",
            type="attendee",
            organization=organization,
            title=position
        )
        self.db.add(profile)
        await self.db.flush()
        await self.db.refresh(profile)

        return profile.id, user.id

    async def get_event_registrations(self, event_id: uuid.UUID, limit: int = 100, page: int = 1, search: str = None, university: str = None, category: str = None, status: str = None) -> tuple[List[EventRegistration], int]:
        """Get event registrations with pagination and search."""
        await check_and_reconnect(self.db)

        try:
            query = select(EventRegistration).where(EventRegistration.event_id == event_id).options(
                selectinload(EventRegistration.event),
                selectinload(EventRegistration.profile).selectinload(Profile.user)
            )

            # Apply filters
            if search:
                search_term = f"%{search}%"
                query = query.where(
                    or_(
                        EventRegistration.first_name.ilike(search_term),
                        EventRegistration.last_name.ilike(search_term),
                        EventRegistration.email.ilike(search_term),
                        EventRegistration.organization.ilike(search_term)
                    )
                )

            if status and status != 'all':
                query = query.where(EventRegistration.status == status)

            if university:
                query = query.where(EventRegistration.metadata_['university'].astext == university)
            
            if category:
                query = query.where(EventRegistration.metadata_['category'].astext == category)

            # Count total
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await self.db.execute(count_query)
            total = total_result.scalar()

            # Apply pagination
            offset = (page - 1) * limit
            query = query.order_by(EventRegistration.registration_date.desc()).offset(offset).limit(limit)

            result = await self.db.execute(query)
            registrations = result.scalars().all()

            return registrations, total

        except Exception as e:
            logger.error(f"Failed to get event registrations: {str(e)}")
            raise

    async def get_event_registration_stats(self, event_id: uuid.UUID, university: str = None, category: str = None) -> Dict[str, Any]:
        """Get registration statistics for an event with filters."""
        await check_and_reconnect(self.db)

        try:
            # Base query for stats
            base_query = select(EventRegistration).where(EventRegistration.event_id == event_id)

            if university:
                base_query = base_query.where(EventRegistration.metadata_['university'].astext == university)
            if category:
                base_query = base_query.where(EventRegistration.metadata_['category'].astext == category)

            # 1. Total Groups
            group_count_query = select(func.count(EventRegistration.id)).where(
                base_query.where(EventRegistration.metadata_['participant_type'].astext == 'group').get_execution_options().get("whereclause")
            )
            # SQLAlchemy way to clone query with extra filters is tricky, let's just build it
            
            async def get_count(q):
                res = await self.db.execute(select(func.count()).select_from(q.subquery()))
                return res.scalar() or 0

            total_registrations = await get_count(base_query)
            
            group_query = base_query.where(EventRegistration.metadata_['participant_type'].astext == 'group')
            total_groups = await get_count(group_query)

            individual_query = base_query.where(
                or_(
                    EventRegistration.metadata_['participant_type'].astext == 'individual',
                    EventRegistration.metadata_['participant_type'].astext == None
                )
            )
            total_individuals = await get_count(individual_query)

            # 2. Total Attended/Registered Members (Headcount)
            # For each record: 1 if individual, else length of members array
            # This is complex in SQL, might be easier to fetch and sum if data is small, 
            # but let's try a JSON query
            
            # Since confirmed attendance is what user asked for ("confirm the attendance")
            # Let's count all registered members first, then those who are confirmed
            
            records_result = await self.db.execute(base_query)
            records = records_result.scalars().all()
            
            total_members = 0
            confirmed_members = 0
            
            for reg in records:
                m = reg.metadata_ or {}
                count = 1
                if m.get('participant_type') == 'group':
                    count = len(m.get('members', [])) or 1
                
                total_members += count
                if reg.status in ['confirmed', 'checked_in']:
                    confirmed_members += count

            return {
                "total_registrations": total_registrations,
                "total_groups": total_groups,
                "total_individuals": total_individuals,
                "total_members": total_members,
                "confirmed_members": confirmed_members
            }

        except Exception as e:
            logger.error(f"Failed to get registration stats: {str(e)}")
            raise

    async def update_registration_status(self, registration_id: uuid.UUID, status: str) -> Optional[EventRegistration]:
        """Update registration status (e.g., confirm, cancel, check-in)."""
        await check_and_reconnect(self.db)

        try:
            result = await self.db.execute(
                select(EventRegistration).where(EventRegistration.id == registration_id)
            )
            registration = result.scalar_one_or_none()

            if not registration:
                return None

            registration.status = status

            if status == 'confirmed' or status == 'checked_in':
                registration.checked_in_at = datetime.utcnow()

            registration.updated_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(registration)

            logger.info(f"Registration {registration_id} status updated to {status}")
            return registration

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to update registration status: {str(e)}")
            raise

    async def import_attendees_from_csv(self, event_id: uuid.UUID, csv_data: List[Dict[str, Any]], user_id: uuid.UUID) -> Dict[str, int]:
        """Import attendees from CSV (for existing event database)."""
        await check_and_reconnect(self.db)

        results = {
            'created': 0,
            'updated': 0,
            'existing': 0,
            'errors': 0
        }

        try:
            for row in csv_data:
                email = row.get('email', '').strip().lower()

                if not email:
                    results['errors'] += 1
                    continue

                # Check if user exists
                result = await self.db.execute(
                    select(Profile).options(selectinload(Profile.user)).where(
                        Profile.user.has(User.email == email)
                    )
                )
                user = result.scalar_one_or_none()

                # Check if already registered for this event
                result = await self.db.execute(
                    select(EventRegistration).where(
                        and_(
                            EventRegistration.event_id == event_id,
                            EventRegistration.email == email
                        )
                    )
                )
                existing_reg = result.scalar_one_or_none()

                if existing_reg:
                    results['existing'] += 1
                    continue

                # Create or update profile if user exists
                if user:
                    # Update profile with event data
                    user.first_name = row.get('first_name', user.first_name)
                    user.last_name = row.get('last_name', user.last_name)
                    user.organization = row.get('organization', user.organization)
                    user.position = row.get('position', user.title)

                    if row.get('participation_type'):
                        user.type = row['participation_type']

                    user.updated_at = datetime.now(timezone.utc)
                    results['updated'] += 1

                # Create registration
                registration = EventRegistration(
                    event_id=event_id,
                    profile_id=user.id if user else None,
                    first_name=row.get('first_name', ''),
                    last_name=row.get('last_name', ''),
                    email=email,
                    position=row.get('position'),
                    organization=row.get('organization'),
                    participation_type=row.get('participation_type', 'attendee'),
                    attendance_type=row.get('attendance_type', 'on_site'),
                    wants_profile_visible=row.get('wants_profile_visible', True),
                    profile_visibility_types=row.get('profile_visibility_types', []),
                    status='confirmed',
                    registration_date=datetime.utcnow()
                )

                self.db.add(registration)
                results['created'] += 1

            await self.db.commit()
            logger.info(f"Imported {results['created']} attendees for event {event_id}")
            return results

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to import attendees: {str(e)}")
            raise