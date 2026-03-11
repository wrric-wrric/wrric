import logging
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_current_user, _get_presigned_url
from models.db_models import LocationType
from schemas.events import (
    EventCreate,
    EventUpdate,
    EventPublic,
    EventAdmin,
    EventBanner,
    PaginatedResponse,
    EventStats
)
from services.event_service import EventService
from utils.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["events"])


@router.get("/upcoming", response_model=PaginatedResponse)
async def get_upcoming_events(
    limit: int = Query(20, ge=1, le=100),
    page: int = Query(1, ge=1),
    featured: Optional[bool] = None,
    location_type: Optional[LocationType] = None,
    category_ids: Optional[List[uuid.UUID]] = Query(None),
    from_date: Optional[datetime] = None,
    sort_by: str = Query("date", regex="^(date|priority|created)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get upcoming events for public viewing.
    """
    try:
        event_service = EventService(db)
        events, total = await event_service.get_upcoming_events(
            limit=limit,
            page=page,
            featured=featured,
            location_type=location_type,
            category_ids=category_ids,
            from_date=from_date,
            sort_by=sort_by
        )
        
        # Process images for presigned URLs
        processed_events = []
        for event in events:
            event_dict = EventPublic.from_orm(event).dict()
            
            # Get presigned URLs for images
            if event.featured_image_url:
                event_dict["featured_image_url"] = await _get_presigned_url(event.featured_image_url)
            if event.banner_image_url:
                event_dict["banner_image_url"] = await _get_presigned_url(event.banner_image_url)
            
            # Format categories
            event_dict["categories"] = [
                {"id": cat.id, "name": cat.name, "slug": cat.slug, "color_code": cat.color_code}
                for cat in event.categories
            ]
            
            processed_events.append(event_dict)
        
        pages = (total + limit - 1) // limit
        
        return PaginatedResponse(
            items=processed_events,
            total=total,
            page=page,
            page_size=limit,
            pages=pages
        )
        
    except Exception as e:
        logger.error(f"Failed to get upcoming events: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve events")


@router.get("/{event_slug}", response_model=EventPublic)
async def get_event_by_slug(
    event_slug: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single event by slug for public viewing.
    """
    try:
        event_service = EventService(db)
        event = await event_service.get_event_by_slug(event_slug)
        
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        event_dict = EventPublic.from_orm(event).dict()
        
        # Get presigned URLs for images
        if event.featured_image_url:
            event_dict["featured_image_url"] = await _get_presigned_url(event.featured_image_url)
        if event.banner_image_url:
            event_dict["banner_image_url"] = await _get_presigned_url(event.banner_image_url)
        
        # Format categories
        event_dict["categories"] = [
            {"id": cat.id, "name": cat.name, "slug": cat.slug, "color_code": cat.color_code}
            for cat in event.categories
        ]
        
        return event_dict
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get event {event_slug}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve event")


@router.get("/banner/events", response_model=List[EventBanner])
async def get_banner_events(
    db: AsyncSession = Depends(get_db)
):
    """
    Get events for banner display.
    """
    try:
        event_service = EventService(db)
        events = await event_service.get_banner_events()
        
        processed_events = []
        for event in events:
            event_dict = EventBanner.from_orm(event).dict()
            
            # Get presigned URL for banner image
            if event.banner_image_url:
                event_dict["banner_image_url"] = await _get_presigned_url(event.banner_image_url)
            
            processed_events.append(event_dict)
        
        return processed_events
        
    except Exception as e:
        logger.error(f"Failed to get banner events: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve banner events")