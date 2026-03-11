"""
Activity Feed API endpoints (Feature 2.5).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from utils.database import get_db
from api.dependencies import get_current_user
from services.activity_service import ActivityService

router = APIRouter()


@router.get("")
async def get_feed(
    cursor: str = Query(None),
    limit: int = Query(20, ge=1, le=50),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get personalized feed for the authenticated user."""
    service = ActivityService(db)
    items, next_cursor = await service.get_feed(current_user, cursor=cursor, limit=limit)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/discover")
async def get_discover_feed(
    cursor: str = Query(None),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get discover/trending feed (public)."""
    service = ActivityService(db)
    items, next_cursor = await service.get_discover_feed(cursor=cursor, limit=limit)
    stats = await service.get_platform_stats()
    return {"items": items, "next_cursor": next_cursor, "stats": stats}


@router.get("/trending")
async def get_trending_labs(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get trending labs based on recent engagement."""
    service = ActivityService(db)
    trending = await service.get_trending_labs(limit=limit)
    return {"trending": trending}
