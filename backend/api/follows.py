import math
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_current_user
from services.follow_service import FollowService
from services.rate_limiter import rate_limiter
from utils.database import get_db

router = APIRouter()


# --- Schemas ---

class FollowRequest(BaseModel):
    target_type: str  # user, partner, lab
    target_id: str


class BatchCheckRequest(BaseModel):
    targets: List[FollowRequest]


# --- Endpoints ---

@router.post("", status_code=status.HTTP_201_CREATED)
async def follow(
    data: FollowRequest,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Follow a user, partner, or lab."""
    if not await rate_limiter.check(f"follow:{current_user}", 60, 3600):
        raise HTTPException(status_code=429, detail="Rate limit exceeded: max 60 follows/hour")
    service = FollowService(db)
    result = await service.follow(current_user, data.target_type, data.target_id)
    if "error" in result:
        raise HTTPException(status_code=result["status"], detail=result["error"])
    return result


@router.delete("")
async def unfollow(
    data: FollowRequest,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unfollow a user, partner, or lab."""
    service = FollowService(db)
    result = await service.unfollow(current_user, data.target_type, data.target_id)
    if "error" in result:
        raise HTTPException(status_code=result["status"], detail=result["error"])
    return result


@router.get("/status")
async def get_follow_status(
    target_type: str,
    target_id: str,
    current_user: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get follow status and follower count for a target. Public endpoint."""
    service = FollowService(db)
    return await service.get_follow_status(current_user, target_type, target_id)


@router.get("/status/check")
async def get_follow_status_authenticated(
    target_type: str,
    target_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get follow status for authenticated user."""
    service = FollowService(db)
    return await service.get_follow_status(current_user, target_type, target_id)


@router.post("/batch-check")
async def batch_check(
    data: BatchCheckRequest,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check follow status for multiple targets at once."""
    service = FollowService(db)
    targets = [{"target_type": t.target_type, "target_id": t.target_id} for t in data.targets]
    return await service.check_following_batch(current_user, targets)


@router.get("/users/{user_id}/followers")
async def get_followers(
    user_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get followers of a user (public, paginated)."""
    service = FollowService(db)
    followers, total = await service.get_followers("user", user_id, page, limit)
    total_pages = math.ceil(total / limit) if total > 0 else 0
    return {
        "items": followers,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }


@router.get("/users/{user_id}/following")
async def get_following(
    user_id: str,
    target_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get what a user is following (public, paginated). Optionally filter by target_type."""
    service = FollowService(db)
    items, total = await service.get_following(user_id, target_type, page, limit)
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


@router.get("/me/following")
async def get_my_following(
    target_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get what the current user is following."""
    service = FollowService(db)
    items, total = await service.get_following(current_user, target_type, page, limit)
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
