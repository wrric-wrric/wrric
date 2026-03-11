"""
Public user profile endpoints.

GET /users/{user_id}/summary     — profile summary (public)
GET /users/{user_id}/labs        — paginated labs created by user (public)
GET /users/{user_id}/liked-labs  — paginated liked labs (public)
"""
import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from services.user_profile_service import UserProfileService
from utils.database import get_db

router = APIRouter()


@router.get("/{user_id}/summary")
async def get_user_summary(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Public user profile summary."""
    service = UserProfileService(db)
    summary = await service.get_user_summary(user_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="User not found")
    return summary


@router.get("/{user_id}/labs")
async def get_user_labs(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Public: paginated labs created by a user."""
    service = UserProfileService(db)
    items, total = await service.get_user_labs(user_id, page, limit)
    total_pages = math.ceil(total / limit) if total > 0 else 0
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }


@router.get("/{user_id}/liked-labs")
async def get_user_liked_labs(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Public: paginated labs liked by a user."""
    service = UserProfileService(db)
    items, total = await service.get_user_liked_labs(user_id, page, limit)
    total_pages = math.ceil(total / limit) if total > 0 else 0
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }
