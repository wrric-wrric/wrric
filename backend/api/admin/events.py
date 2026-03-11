import logging
import uuid
import json
from typing import Optional, List, Dict, Any
import asyncio

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
    UploadFile,
    File,
    Form,
    Request,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone as py_timezone
import pytz

from api.dependencies import get_current_user, verify_admin, _get_presigned_url
from schemas.events import (
    EventCreate,
    EventUpdate,
    EventAdmin,
    PaginatedResponse,
    EventStats,
    EventRegistrationCreate,
    EventRegistrationResponse,
    EventRegistrationAdminResponse,
    ImportAttendeesRequest,
    ImportAttendeesResponse,
    EventRegistrationFullResponse,
)
from services.event_service import EventService
from utils.database import get_db
from models.db_models import Event, LocationType, EventRegistration, Profile
from media.storage import CustomB2Storage

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-events"])
storage = CustomB2Storage()


# -------------------------
# Image Upload Helpers (Following your pattern)
# -------------------------

async def _upload_event_image(
    file: UploadFile,
    event_id: uuid.UUID,
    image_type: str,
    user_id: uuid.UUID
) -> str:
    """
    Upload event image and return object key (not presigned URL).
    Follows the same pattern as your entities image upload.
    """
    try:
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type: {file.content_type}. Allowed: JPEG, PNG, WebP, GIF"
            )
        
        # Validate file size (max 10MB)
        content = await file.read()
        file_size = len(content)
        if file_size > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Max size: 10MB")
        
        # Generate unique key following your pattern
        file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
        key = f"events/{event_id}/{image_type}/{uuid.uuid4().hex}_{file.filename}"
        
        # Upload to storage using your pattern
        await file.seek(0)  # Reset file pointer
        await asyncio.to_thread(
            storage.s3_client.put_object,
            Bucket=storage.bucket_name,
            Key=key,
            Body=content,
            ContentType=file.content_type
        )
        
        logger.info(f"Uploaded {image_type} image for event {event_id} to key: {key}")
        return key  # Return object key, not presigned URL
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload event image: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload image")


async def _delete_event_image(image_key: str) -> bool:
    """
    Delete an event image from storage.
    """
    try:
        if image_key and not str(image_key).lower().startswith("http"):
            await asyncio.to_thread(
                storage.s3_client.delete_object,
                Bucket=storage.bucket_name,
                Key=image_key
            )
            logger.debug(f"Deleted storage object for key {image_key}")
            return True
    except Exception as e:
        logger.error(f"Failed to delete storage object {image_key}: {str(e)}")
    return False


# -------------------------
# Event Serialization Helper
# -------------------------

async def _serialize_event_with_presigned_urls(event: Event) -> Dict[str, Any]:
    """
    Serialize event and generate presigned URLs for images.
    """
    event_dict = {
        "id": event.id,
        "title": event.title,
        "slug": event.slug,
        "description": event.description,
        "short_description": event.short_description,
        "event_datetime": event.event_datetime,
        "timezone": event.timezone,
        "location_type": event.location_type,
        "physical_location": event.physical_location,
        "virtual_link": event.virtual_link,
        "virtual_link_description": event.virtual_link_description,
        "registration_url": event.registration_url,
        "additional_links": event.additional_links or [],
        "is_featured": event.is_featured,
        "priority": event.priority,
        "is_published": event.is_published,
        "is_hackathon": event.is_hackathon,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "published_at": event.published_at,
        "created_by": event.created_by,
        "featured_image_url": await _get_presigned_url(event.featured_image_url) if event.featured_image_url else None,
        "banner_image_url": await _get_presigned_url(event.banner_image_url) if event.banner_image_url else None,
        "categories": [
            {
                "id": c.id,
                "name": c.name,
                "slug": c.slug,
                "color_code": c.color_code,
            }
            for c in event.categories
        ],
    }
    return event_dict


# -------------------------
# Create Event (Fixed image handling)
# -------------------------

@router.post("", response_model=EventAdmin)
async def create_event(
    title: str = Form(...),
    description: str = Form(...),
    short_description: str = Form(..., max_length=150),
    event_datetime: str = Form(...),
    timezone: str = Form(...),
    location_type: str = Form(...),
    physical_location: Optional[str] = Form(None),
    virtual_link: Optional[str] = Form(None),
    virtual_link_description: Optional[str] = Form(None),
    registration_url: Optional[str] = Form(None),
    additional_links: Optional[str] = Form(None),  # JSON string of link objects
    is_featured: bool = Form(False),
    priority: int = Form(0),
    is_published: bool = Form(False),
    categories: Optional[str] = Form(None),
    featured_image: Optional[UploadFile] = File(None),
    banner_image: Optional[UploadFile] = File(None),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new event with proper image upload handling.
    Only admins can create events.

    additional_links should be a JSON array of objects with: url, title, description, icon_url
    """
    try:
        # Parse categories if provided
        category_ids = []
        if categories:
            try:
                category_ids = [uuid.UUID(cid) for cid in json.loads(categories)]
            except Exception as e:
                logger.error(f"Error parsing categories: {str(e)}")
                raise HTTPException(status_code=400, detail="Invalid categories format")

        # Validate location type
        try:
            location_enum = LocationType(location_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid location type")

        # Parse and validate datetime
        try:
            dt = datetime.fromisoformat(event_datetime.replace("Z", "+00:00"))
            tz = pytz.timezone(timezone)
            dt = tz.localize(dt) if dt.tzinfo is None else dt.astimezone(tz)
            dt_utc = dt.astimezone(py_timezone.utc)
        except Exception as e:
            logger.error(f"Error parsing datetime: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid date format")

        # Parse additional links if provided
        parsed_additional_links = []
        if additional_links:
            try:
                parsed_additional_links = json.loads(additional_links)
                # Validate each link has required fields
                for link in parsed_additional_links:
                    if not link.get('url') or not link.get('title'):
                        raise ValueError("Each link must have 'url' and 'title'")
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid additional_links format - must be valid JSON")
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

        # Create event data (without images first)
        event_data = EventCreate(
            title=title,
            description=description,
            short_description=short_description,
            event_datetime=dt_utc,
            timezone=timezone,
            location_type=location_enum,
            physical_location=physical_location,
            virtual_link=virtual_link,
            virtual_link_description=virtual_link_description,
            registration_url=registration_url,
            additional_links=parsed_additional_links,
            is_featured=is_featured,
            priority=priority,
            categories=category_ids,
        )

        user_id = uuid.UUID(admin_user)
        service = EventService(db)
        
        # Create event in database first
        event = await service.create_event(event_data, user_id)
        
        # Handle image uploads
        try:
            if featured_image and featured_image.filename:
                # Upload featured image and get object key
                featured_key = await _upload_event_image(
                    featured_image, 
                    event.id, 
                    "featured", 
                    user_id
                )
                # Update event with image key
                event.featured_image_url = featured_key
            
            if banner_image and banner_image.filename:
                # Upload banner image and get object key
                banner_key = await _upload_event_image(
                    banner_image, 
                    event.id, 
                    "banner", 
                    user_id
                )
                # Update event with image key
                event.banner_image_url = banner_key
            
            # Commit image changes
            await db.commit()
            await db.refresh(event)
            
        except HTTPException as img_err:
            # If image upload fails, we still have the event created
            logger.error(f"Image upload failed but event created: {img_err}")
            # Don't rollback the event creation, just continue
        
        # Handle publication if requested
        if is_published:
            await service.publish_event(event.id, user_id)
        
        # Load event with categories
        event_with_cats = await _load_event_with_categories(db, event.id)
        
        # Serialize with presigned URLs
        event_dict = await _serialize_event_with_presigned_urls(event_with_cats)
        
        return EventAdmin(**event_dict)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to create event: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create event")


# -------------------------
# Update Event (Fixed image handling)
# -------------------------

@router.put("/{event_id}", response_model=EventAdmin)
async def update_event(
    event_id: uuid.UUID,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    short_description: Optional[str] = Form(None, max_length=150),
    event_datetime: Optional[str] = Form(None),
    timezone: Optional[str] = Form(None),
    location_type: Optional[str] = Form(None),
    physical_location: Optional[str] = Form(None),
    virtual_link: Optional[str] = Form(None),
    virtual_link_description: Optional[str] = Form(None),
    registration_url: Optional[str] = Form(None),
    additional_links: Optional[str] = Form(None),  # JSON string of link objects
    is_featured: Optional[bool] = Form(None),
    priority: Optional[int] = Form(None),
    categories: Optional[str] = Form(None),
    featured_image: Optional[UploadFile] = File(None),
    banner_image: Optional[UploadFile] = File(None),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing event with proper image handling.
    Only admins can update events.

    additional_links should be a JSON array of objects with: url, title, description, icon_url
    """
    try:
        user_uuid = uuid.UUID(admin_user)
        event_service = EventService(db)
        
        # Get existing event
        event = await event_service.get_event_admin(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Prepare update data
        update_data = {}
        
        # Parse categories if provided
        category_ids = None
        if categories is not None:
            try:
                category_ids = json.loads(categories) if categories else []
                category_ids = [uuid.UUID(cat_id) for cat_id in category_ids]
            except Exception as e:
                logger.error(f"Error parsing categories: {str(e)}")
                category_ids = []
        
        # Parse event datetime if provided
        event_dt = None
        if event_datetime is not None:
            try:
                dt = datetime.fromisoformat(event_datetime.replace("Z", "+00:00"))
                if timezone:
                    tz = pytz.timezone(timezone)
                    dt = tz.localize(dt) if dt.tzinfo is None else dt.astimezone(tz)
                event_dt = dt.astimezone(py_timezone.utc)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format")

        # Parse additional links if provided
        parsed_additional_links = None
        if additional_links is not None:
            try:
                parsed_additional_links = json.loads(additional_links) if additional_links else []
                # Validate each link has required fields
                for link in parsed_additional_links:
                    if not link.get('url') or not link.get('title'):
                        raise ValueError("Each link must have 'url' and 'title'")
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid additional_links format - must be valid JSON")
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

        # Create EventUpdate object with provided fields
        event_update = EventUpdate(
            title=title,
            description=description,
            short_description=short_description,
            event_datetime=event_dt,
            timezone=timezone,
            location_type=location_type,
            physical_location=physical_location,
            virtual_link=virtual_link,
            virtual_link_description=virtual_link_description,
            registration_url=registration_url,
            additional_links=parsed_additional_links,
            is_featured=is_featured,
            priority=priority,
            categories=category_ids
        )

        # Filter out None values for partial update
        update_dict = {k: v for k, v in event_update.dict().items() if v is not None}
        
        # Handle image uploads
        try:
            # Handle featured image
            if featured_image and featured_image.filename:
                # Delete old image if exists
                if event.featured_image_url:
                    await _delete_event_image(event.featured_image_url)
                
                # Upload new image
                featured_key = await _upload_event_image(
                    featured_image, 
                    event_id, 
                    "featured", 
                    user_uuid
                )
                update_dict['featured_image_url'] = featured_key
            
            # Handle banner image
            if banner_image and banner_image.filename:
                # Delete old image if exists
                if event.banner_image_url:
                    await _delete_event_image(event.banner_image_url)
                
                # Upload new image
                banner_key = await _upload_event_image(
                    banner_image, 
                    event_id, 
                    "banner", 
                    user_uuid
                )
                update_dict['banner_image_url'] = banner_key
                
        except Exception as e:
            logger.error(f"Image upload failed during update: {str(e)}")
            # Don't fail the entire update if image upload fails
        
        # Create EventUpdate object with the filtered dictionary
        filtered_update = EventUpdate(**update_dict) if update_dict else EventUpdate()
        
        # Update the event
        updated_event = await event_service.update_event(event_id, filtered_update, user_uuid)
        
        if not updated_event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Load with categories
        updated_event_with_cats = await _load_event_with_categories(db, event_id)
        
        # Serialize with presigned URLs
        event_dict = await _serialize_event_with_presigned_urls(updated_event_with_cats)
        
        return EventAdmin(**event_dict)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to update event {event_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update event")


# -------------------------
# Helper Functions (Need to add these)
# -------------------------

async def _load_event_with_categories(db: AsyncSession, event_id: uuid.UUID) -> Event:
    """
    Load event with categories eager loaded.
    """
    stmt = (
        select(Event)
        .options(selectinload(Event.categories))
        .where(Event.id == event_id)
    )
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


# -------------------------
# Other endpoints (unchanged except for serialization)
# -------------------------

@router.get("", response_model=PaginatedResponse)
async def get_admin_events(
    limit: int = Query(20, ge=1, le=100),
    page: int = Query(1, ge=1),
    is_published: Optional[bool] = None,
    is_featured: Optional[bool] = None,
    search: Optional[str] = None,
    my_events_only: bool = Query(False, description="If true, only show events created by current user"),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all events for admin view.
    By default, admins see ALL events.
    Set my_events_only=true to filter to only events you created.
    """
    try:
        user_id = uuid.UUID(admin_user)
        service = EventService(db)

        # Admins see all events by default
        events, total = await service.get_admin_events(
            limit=limit,
            page=page,
            is_published=is_published,
            is_featured=is_featured,
            created_by=user_id if my_events_only else None,
            search=search
        )
        
        items = []
        for e in events:
            # Load each event with categories
            event_with_cats = await _load_event_with_categories(db, e.id)
            # Serialize with presigned URLs
            event_dict = await _serialize_event_with_presigned_urls(event_with_cats)
            items.append(event_dict)
        
        pages = (total + limit - 1) // limit
        
        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=limit,
            pages=pages,
        )
        
    except Exception as e:
        logger.exception(f"Failed to fetch events: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve events")


@router.get("/{event_id}", response_model=EventAdmin)
async def get_admin_event(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        event = await _load_event_with_categories(db, event_id)
        event_dict = await _serialize_event_with_presigned_urls(event)
        return EventAdmin(**event_dict)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to get event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve event")


# ... (rest of the endpoints remain the same, just use the new serialization)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Soft delete an event (admin only).
    """
    try:
        user_uuid = uuid.UUID(admin_user)
        event_service = EventService(db)
        
        success = await event_service.delete_event(event_id, user_uuid)
        
        if not success:
            raise HTTPException(status_code=404, detail="Event not found")
        
        return None
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete event")


@router.post("/{event_id}/publish", status_code=status.HTTP_200_OK)
async def publish_event(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Publish an event (admin only).
    """
    try:
        user_uuid = uuid.UUID(admin_user)
        event_service = EventService(db)
        
        success = await event_service.publish_event(event_id, user_uuid)
        
        if not success:
            raise HTTPException(status_code=404, detail="Event not found")
        
        return {"message": "Event published successfully"}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to publish event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to publish event")


@router.post("/{event_id}/unpublish", status_code=status.HTTP_200_OK)
async def unpublish_event(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Unpublish an event (admin only).
    """
    try:
        user_uuid = uuid.UUID(admin_user)
        event_service = EventService(db)
        
        success = await event_service.unpublish_event(event_id, user_uuid)
        
        if not success:
            raise HTTPException(status_code=404, detail="Event not found")
        
        return {"message": "Event unpublished successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to unpublish event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to unpublish event")


@router.post("/link-preview")
async def get_link_preview(
    url: str = Form(...),
    admin_user: str = Depends(verify_admin),
):
    """
    Fetch metadata (title, description, favicon) for a URL.
    Used for link previews in the event form.
    """
    import httpx
    from bs4 import BeautifulSoup
    from urllib.parse import urljoin, urlparse

    try:
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0)'
            })
            response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract title
        title = None
        if soup.find('meta', property='og:title'):
            title = soup.find('meta', property='og:title').get('content')
        elif soup.find('title'):
            title = soup.find('title').text.strip()

        # Extract description
        description = None
        if soup.find('meta', property='og:description'):
            description = soup.find('meta', property='og:description').get('content')
        elif soup.find('meta', attrs={'name': 'description'}):
            description = soup.find('meta', attrs={'name': 'description'}).get('content')

        # Extract favicon
        icon_url = None
        parsed_url = urlparse(url)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"

        # Try various favicon sources
        if soup.find('link', rel=lambda x: x and 'icon' in x.lower() if x else False):
            icon_link = soup.find('link', rel=lambda x: x and 'icon' in x.lower() if x else False)
            icon_url = icon_link.get('href')
            if icon_url and not icon_url.startswith('http'):
                icon_url = urljoin(base_url, icon_url)
        else:
            # Try default favicon location
            icon_url = f"{base_url}/favicon.ico"

        return {
            "url": url,
            "title": title or urlparse(url).netloc,
            "description": description,
            "icon_url": icon_url
        }

    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Request timeout - URL took too long to respond")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch URL: {e.response.status_code}")
    except Exception as e:
        logger.error(f"Failed to fetch link preview: {str(e)}")
        # Return partial data on error
        return {
            "url": url,
            "title": urlparse(url).netloc if url.startswith('http') else url,
            "description": None,
            "icon_url": None
        }


@router.get("/stats/overview", response_model=EventStats)
async def get_event_stats(
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get event statistics (admin only).
    """
    try:
        event_service = EventService(db)
        stats = await event_service.get_event_stats()
        
        return EventStats(**stats)

    except Exception as e:
        logger.error(f"Failed to get event stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve event statistics")


# -------------------------
# Event Registration Endpoints
# -------------------------

@router.post("/{event_id}/register", response_model=EventRegistrationFullResponse)
async def register_for_event(
    event_id: uuid.UUID,
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(...),
    position: Optional[str] = Form(None),
    organization: Optional[str] = Form(None),
    participation_type: str = Form('attendee'),
    attendance_type: str = Form('on_site'),
    ticket_type: Optional[str] = Form(None),
    wants_profile_visible: bool = Form(True),
    profile_visibility_types: Optional[str] = Form(None),
    special_requirements: Optional[str] = Form(None),
    create_account: bool = Form(False),
    new_password: Optional[str] = Form(None),
    is_anonymous: bool = Form(False),
    recaptcha_token: Optional[str] = Form(None),
    metadata_: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> EventRegistrationFullResponse:
    """
    Register for an event with multiple options:
    
    1. **Full Registration**: create_account=True + new_password provided
       - Creates user account immediately with password
       - Profile is created and linked
       - User can login immediately
    
    2. **Profile-First Registration**: create_account=True + no password
       - Profile is created
       - Email sent with link to set password
       - User completes account setup via email link
    
    3. **Anonymous Registration**: is_anonymous=True
       - Registration only, no profile created
       - Not visible in attendee list
       - No account created
    
    4. **Basic Registration**: create_account=False
       - Registration only
       - Profile linked if user exists with email
       - No account created
    """
    try:
        # Skip reCAPTCHA for admin manual registration
        # (Already protected by current_admin dependency)
        pass

        # Validate: can't have both anonymous and profile visibility
        if is_anonymous and wants_profile_visible:
            wants_profile_visible = False

        # Validate: password requires create_account
        if new_password and not create_account:
            raise HTTPException(status_code=400, detail="Password can only be set when creating an account")

        # Validate password length if provided
        if new_password and len(new_password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        # Get base URL for email links
        base_url = str(request.base_url) if request else "http://localhost:3000"

        registration_data = {
            'first_name': first_name,
            'last_name': last_name,
            'email': email.lower().strip(),
            'position': position,
            'organization': organization,
            'participation_type': participation_type,
            'attendance_type': attendance_type,
            'ticket_type': ticket_type,
            'wants_profile_visible': wants_profile_visible,
            'profile_visibility_types': json.loads(profile_visibility_types) if profile_visibility_types else [],
            'special_requirements': special_requirements,
            'create_account': create_account,
            'new_password': new_password,
            'is_anonymous': is_anonymous,
            'metadata_': json.loads(metadata_) if metadata_ else {}
        }

        service = EventService(db)
        registration, message, redirect_url = await service.register_for_event(
            event_id, 
            registration_data,
            base_url=base_url
        )

        return EventRegistrationFullResponse(
            id=registration.id,
            event_id=registration.event_id,
            profile_id=registration.profile_id,
            first_name=registration.first_name,
            last_name=registration.last_name,
            email=registration.email,
            position=registration.position,
            organization=registration.organization,
            participation_type=registration.participation_type,
            attendance_type=registration.attendance_type,
            ticket_type=registration.ticket_type,
            wants_profile_visible=registration.wants_profile_visible,
            profile_visibility_types=registration.profile_visibility_types,
            special_requirements=registration.special_requirements,
            status=registration.status,
            registration_date=registration.registration_date,
            checked_in_at=registration.checked_in_at,
            created_at=registration.created_at,
            updated_at=registration.updated_at,
            message=message,
            redirect_url=redirect_url,
            registration_type="full" if (create_account and new_password) else "profile_first" if create_account else "anonymous" if is_anonymous else "basic"
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 409 duplicate registration) with their original status and detail
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to register for event: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to register for event")


@router.get("/{event_id}/registrations", response_model=PaginatedResponse[EventRegistrationAdminResponse])
async def get_event_registrations(
    event_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    university: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> PaginatedResponse[EventRegistrationAdminResponse]:
    """
    Get all registrations for a specific event with pagination and search/filters.
    """
    try:
        service = EventService(db)
        registrations, total = await service.get_event_registrations(
            event_id=event_id,
            page=page,
            limit=limit,
            search=search,
            status=status,
            university=university,
            category=category
        )

        # Manually map to AdminResponse to handle nested fields and potential NULLs
        mapped_items = []
        for reg in registrations:
            # Safely get profile info
            profile = reg.profile
            user = profile.user if profile else None
            
            # Create the response item
            item = EventRegistrationAdminResponse(
                id=reg.id,
                event_id=reg.event_id,
                profile_id=reg.profile_id,
                first_name=reg.first_name,
                last_name=reg.last_name,
                email=reg.email,
                position=reg.position,
                organization=reg.organization,
                participation_type=reg.participation_type,
                attendance_type=reg.attendance_type,
                ticket_type=reg.ticket_type,
                wants_profile_visible=reg.wants_profile_visible,
                profile_visibility_types=reg.profile_visibility_types or [],  # Handle potential NULL
                status=reg.status,
                registration_date=reg.registration_date,
                checked_in_at=reg.checked_in_at,
                created_at=getattr(reg, 'created_at', reg.registration_date),
                updated_at=getattr(reg, 'updated_at', None),
                metadata_=reg.metadata_ or {},
                # Populating nested fields
                profile_name=f"{profile.first_name} {profile.last_name}" if profile else None,
                profile_type=getattr(profile, 'type', None) if profile else None,
                user_email=user.email if user else None
            )
            mapped_items.append(item)

        return PaginatedResponse(
            items=mapped_items,
            total=total,
            page=page,
            page_size=limit,
            pages=(total + limit - 1) // limit
        )

    except Exception as e:
        logger.error(f"Failed to get event registrations: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve registrations")


@router.get("/{event_id}/registrations/stats")
async def get_registration_stats(
    event_id: uuid.UUID,
    university: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get registration statistics for a specific event with filters.
    """
    try:
        service = EventService(db)
        stats = await service.get_event_registration_stats(
            event_id=event_id,
            university=university,
            category=category
        )
        return stats
    except Exception as e:
        logger.error(f"Failed to get registration stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get registration stats")


@router.patch("/{event_id}/registrations/{registration_id}/status", response_model=EventRegistrationResponse)
async def update_registration_status(
    registration_id: uuid.UUID,
    status: str = Form(...),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
) -> EventRegistrationResponse:
    """
    Update registration status (confirm, cancel, check-in).
    """
    try:
        service = EventService(db)
        registration = await service.update_registration_status(registration_id, status)

        if not registration:
            raise HTTPException(status_code=404, detail="Registration not found")

        return EventRegistrationResponse(
            id=registration.id,
            event_id=registration.event_id,
            profile_id=registration.profile_id,
            first_name=registration.first_name,
            last_name=registration.last_name,
            email=registration.email,
            position=registration.position,
            organization=registration.organization,
            participation_type=registration.participation_type,
            attendance_type=registration.attendance_type,
            ticket_type=registration.ticket_type,
            wants_profile_visible=registration.wants_profile_visible,
            profile_visibility_types=registration.profile_visibility_types,
            status=registration.status,
            registration_date=registration.registration_date,
            checked_in_at=registration.checked_in_at,
            created_at=registration.created_at,
            updated_at=registration.updated_at
        )

    except Exception as e:
        logger.error(f"Failed to update registration status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update registration status")


@router.post("/import-attendees", response_model=ImportAttendeesResponse)
async def import_attendees(
    event_id: uuid.UUID = Form(...),
    attendees: UploadFile = File(...),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
) -> ImportAttendeesResponse:
    """
    Import attendees from CSV file (for existing event database).
    """
    try:
        import csv
        from io import StringIO

        contents = await attendees.read()
        csv_file = StringIO(contents.decode('utf-8-sig'))
        reader = csv.DictReader(csv_file)

        csv_data = []
        for row in reader:
            csv_data.append({
                'first_name': row.get('first_name', ''),
                'last_name': row.get('last_name', ''),
                'email': row.get('email', ''),
                'position': row.get('position'),
                'organization': row.get('organization'),
                'participation_type': row.get('participation_type'),
                'attendance_type': row.get('attendance_type'),
                'wants_profile_visible': row.get('wants_profile_visible', 'true').lower() == 'true',
                'profile_visibility_types': row.get('profile_visibility_types', '[]'),
            })

        service = EventService(db)
        results = await service.import_attendees_from_csv(event_id, csv_data, uuid.UUID(admin_user))

        return ImportAttendeesResponse(
            created=results['created'],
            updated=results['updated'],
            existing=results['existing'],
            errors=results['errors']
        )

    except Exception as e:
        logger.error(f"Failed to import attendees: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to import attendees")