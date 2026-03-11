import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_current_user
from services.block_service import BlockService
from utils.database import get_db

router = APIRouter()


class BlockRequest(BaseModel):
    user_id: str


@router.post("", status_code=status.HTTP_201_CREATED)
async def block_user(
    data: BlockRequest,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Block a user."""
    service = BlockService(db)
    result = await service.block_user(current_user, data.user_id)
    if "error" in result:
        raise HTTPException(status_code=result["status"], detail=result["error"])
    return result


@router.delete("/{user_id}")
async def unblock_user(
    user_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unblock a user."""
    service = BlockService(db)
    result = await service.unblock_user(current_user, user_id)
    if "error" in result:
        raise HTTPException(status_code=result["status"], detail=result["error"])
    return result


@router.get("")
async def list_blocked_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List users blocked by the current user."""
    service = BlockService(db)
    users, total = await service.get_blocked_users(current_user, page, limit)
    total_pages = math.ceil(total / limit) if total > 0 else 0
    return {
        "items": users,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }


@router.get("/check/{user_id}")
async def check_blocked(
    user_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if a specific user is blocked (bidirectional)."""
    service = BlockService(db)
    blocked = await service.is_blocked(current_user, user_id)
    return {"blocked": blocked}
