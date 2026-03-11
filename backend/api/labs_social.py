import logging
import math
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, UUID4
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_current_user
from services.like_service import LikeService
from services.comment_service import CommentService
from services.share_service import ShareService
from services.rate_limiter import rate_limiter
from utils.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Schemas ---

class LikeToggleResponse(BaseModel):
    liked: bool
    like_count: int


class LikeStatusResponse(BaseModel):
    count: int
    liked: bool


class LikedLabItem(BaseModel):
    id: UUID4
    university: str = ""
    research_abstract: str = ""
    website: Optional[str] = None
    location: dict = {}
    scopes: list = []
    entity_type: str = "lab"
    like_count: int = 0
    images: list = []


class PaginatedLikedLabs(BaseModel):
    items: list
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_prev: bool


class BatchLikeCheckRequest(BaseModel):
    entity_ids: List[str]


# --- Endpoints ---

@router.post("/{entity_id}/like", response_model=LikeToggleResponse)
async def toggle_like(
    entity_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Like or unlike a lab (toggle)."""
    if not await rate_limiter.check(f"like:{current_user}", 100, 3600):
        raise HTTPException(status_code=429, detail="Rate limit exceeded: max 100 likes/hour")
    service = LikeService(db)
    result = await service.toggle_like(entity_id, current_user)
    if "error" in result:
        code = 403 if result["error"] == "Action not allowed" else 404
        raise HTTPException(status_code=code, detail=result["error"])
    return LikeToggleResponse(liked=result["liked"], like_count=result["like_count"])


@router.get("/{entity_id}/likes", response_model=LikeStatusResponse)
async def get_like_status(
    entity_id: str,
    current_user: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get like count and whether current user has liked. Public endpoint."""
    # Try to get user from token if provided
    user_id = None
    try:
        from fastapi.security import OAuth2PasswordBearer
        from jose import jwt, JWTError
        import os
        # This is a public endpoint - we try to extract user but don't require it
    except Exception:
        pass

    service = LikeService(db)
    result = await service.get_like_status(entity_id, user_id=current_user)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return LikeStatusResponse(count=result["count"], liked=result["liked"])


@router.get("/{entity_id}/likes/check")
async def check_like_authenticated(
    entity_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if authenticated user has liked a lab."""
    service = LikeService(db)
    result = await service.get_like_status(entity_id, user_id=current_user)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return {"count": result["count"], "liked": result["liked"]}


@router.post("/likes/batch-check")
async def batch_check_likes(
    data: BatchLikeCheckRequest,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check like status for multiple labs at once."""
    service = LikeService(db)
    result = await service.check_likes_batch(data.entity_ids, current_user)
    return result


@router.get("/me/liked", response_model=PaginatedLikedLabs)
async def get_liked_labs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get labs liked by the current user."""
    service = LikeService(db)
    entities, total = await service.get_user_liked_labs(current_user, page, limit)
    total_pages = math.ceil(total / limit) if total > 0 else 0

    items = []
    for e in entities:
        items.append({
            "id": str(e.id),
            "university": e.university or "",
            "research_abstract": e.research_abstract or "",
            "website": e.website or None,
            "location": e.get_json_field("location") if hasattr(e, "get_json_field") else (e.location or {}),
            "scopes": e.get_json_field("scopes") if hasattr(e, "get_json_field") else (e.scopes or []),
            "entity_type": e.entity_type or "lab",
            "like_count": e.like_count or 0,
            "images": [
                {"id": str(img.id), "url": img.url, "caption": img.caption, "is_primary": img.is_primary}
                for img in (e.images or [])
            ],
        })

    return PaginatedLikedLabs(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


# --- Comment Schemas ---

class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None


class CommentEdit(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: str
    entity_id: str
    user_id: str
    username: str
    profile_image_url: Optional[str] = None
    parent_id: Optional[str] = None
    content: str
    is_edited: bool = False
    is_deleted: bool = False
    created_at: str
    updated_at: Optional[str] = None
    replies: list = []


class ReportCreate(BaseModel):
    reason: str


def _comment_to_response(c) -> dict:
    is_deleted = c.deleted_at is not None
    return {
        "id": str(c.id),
        "entity_id": str(c.entity_id),
        "user_id": str(c.user_id),
        "username": c.user.username if c.user else "",
        "profile_image_url": c.user.profile_image_url if c.user else None,
        "parent_id": str(c.parent_id) if c.parent_id else None,
        "content": "[Comment deleted]" if is_deleted else c.content,
        "is_edited": c.is_edited if not is_deleted else False,
        "is_deleted": is_deleted,
        "created_at": c.created_at.isoformat() if c.created_at else "",
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "replies": [
            _comment_to_response(r)
            for r in sorted(getattr(c, "replies", []) or [], key=lambda x: x.created_at or "")
        ],
    }


# --- Comment Endpoints ---

@router.post("/{entity_id}/comments", status_code=status.HTTP_201_CREATED)
async def create_comment(
    entity_id: str,
    data: CommentCreate,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Post a comment on a lab."""
    if not data.content or not data.content.strip():
        raise HTTPException(status_code=422, detail="Content cannot be empty")

    if not await rate_limiter.check(f"comment:{current_user}", 50, 3600):
        raise HTTPException(status_code=429, detail="Rate limit exceeded: max 50 comments/hour")

    service = CommentService(db)
    result = await service.create_comment(entity_id, current_user, data.content.strip(), data.parent_id)

    if result is None:
        raise HTTPException(status_code=404, detail="Lab not found")
    if result == "parent_not_found":
        raise HTTPException(status_code=404, detail="Parent comment not found")
    if result == "blocked":
        raise HTTPException(status_code=403, detail="Action not allowed")
    if result == "spam_detected":
        raise HTTPException(status_code=400, detail="Comment rejected: detected as spam")

    return _comment_to_response(result)


@router.get("/{entity_id}/comments")
async def list_comments(
    entity_id: str,
    cursor: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """List comments on a lab (public, paginated with cursor)."""
    service = CommentService(db)
    comments, next_cursor = await service.list_comments(entity_id, cursor, limit)
    return {
        "items": [_comment_to_response(c) for c in comments],
        "next_cursor": next_cursor,
    }


@router.get("/{entity_id}/comments/count")
async def get_comment_count(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get comment count for a lab (public)."""
    service = CommentService(db)
    count = await service.get_comment_count(entity_id)
    return {"count": count}


# --- Share Schemas ---

class ShareCreate(BaseModel):
    platform: str
    recipient_user_id: Optional[str] = None


# --- Share Endpoints ---

@router.post("/{entity_id}/share", status_code=status.HTTP_201_CREATED)
async def record_share(
    entity_id: str,
    data: ShareCreate,
    current_user: Optional[str] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a share event for a lab."""
    if current_user and not await rate_limiter.check(f"share:{current_user}", 100, 3600):
        raise HTTPException(status_code=429, detail="Rate limit exceeded: max 100 shares/hour")
    service = ShareService(db)
    result = await service.record_share(
        entity_id, data.platform, current_user, data.recipient_user_id
    )
    if "error" in result:
        raise HTTPException(status_code=result["status"], detail=result["error"])
    return result


@router.get("/{entity_id}/shares")
async def get_share_count(
    entity_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get share count for a lab (public)."""
    service = ShareService(db)
    count = await service.get_share_count(entity_id)
    if count is None:
        raise HTTPException(status_code=404, detail="Lab not found")
    return {"count": count}
