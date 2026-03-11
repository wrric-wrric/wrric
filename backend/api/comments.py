import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_current_user, verify_admin
from services.comment_service import CommentService
from services.rate_limiter import rate_limiter
from utils.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


class CommentEditRequest(BaseModel):
    content: str


class ReportRequest(BaseModel):
    reason: str


@router.patch("/{comment_id}")
async def edit_comment(
    comment_id: str,
    data: CommentEditRequest,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit a comment (author only, within 15 minutes)."""
    if not data.content or not data.content.strip():
        raise HTTPException(status_code=422, detail="Content cannot be empty")

    service = CommentService(db)
    result = await service.edit_comment(comment_id, current_user, data.content.strip())
    if result and "error" in result:
        raise HTTPException(status_code=result["status"], detail=result["error"])
    return {"message": "Comment updated", "is_edited": True}


@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a comment (soft delete). Author, lab owner, or admin."""
    from models.db_models import User
    from sqlalchemy import select

    # Check if admin
    user_result = await db.execute(select(User).where(User.id == current_user))
    user = user_result.scalars().first()
    is_admin = user.is_admin if user else False

    service = CommentService(db)
    result = await service.delete_comment(comment_id, current_user, is_admin=is_admin)
    if result and "error" in result:
        raise HTTPException(status_code=result["status"], detail=result["error"])
    return {"message": "Comment deleted"}


@router.post("/{comment_id}/report", status_code=status.HTTP_201_CREATED)
async def report_comment(
    comment_id: str,
    data: ReportRequest,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Report an inappropriate comment."""
    if not data.reason or not data.reason.strip():
        raise HTTPException(status_code=422, detail="Reason is required")

    if not await rate_limiter.check(f"report:{current_user}", 20, 3600):
        raise HTTPException(status_code=429, detail="Rate limit exceeded: max 20 reports/hour")

    service = CommentService(db)
    result = await service.report_comment(comment_id, current_user, data.reason.strip())
    if result and "error" in result:
        raise HTTPException(status_code=result["status"], detail=result["error"])
    return {"message": "Comment reported", "report_id": str(result["report"].id)}
