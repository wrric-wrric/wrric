import logging
import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import verify_admin
from services.comment_service import CommentService
from utils.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


class ReviewReportRequest(BaseModel):
    status: str  # reviewed or dismissed


@router.get("/reports")
async def list_reports(
    status: Optional[str] = Query("pending"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """List comment reports (admin only)."""
    service = CommentService(db)
    reports, total = await service.list_reports(status, page, limit)
    total_pages = math.ceil(total / limit) if total > 0 else 0
    return {
        "items": [
            {
                "id": str(r.id),
                "comment_id": str(r.comment_id),
                "reporter_user_id": str(r.reporter_user_id),
                "reporter_username": r.reporter.username if r.reporter else "",
                "reason": r.reason,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else "",
                "comment_content": r.comment.content if r.comment and not r.comment.deleted_at else "[deleted]",
                "comment_author": r.comment.user.username if r.comment and r.comment.user else "",
            }
            for r in reports
        ],
        "total": total,
        "page": page,
        "total_pages": total_pages,
    }


@router.patch("/reports/{report_id}")
async def review_report(
    report_id: str,
    data: ReviewReportRequest,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Review a comment report (admin only)."""
    if data.status not in ("reviewed", "dismissed"):
        raise HTTPException(status_code=422, detail="Status must be 'reviewed' or 'dismissed'")

    service = CommentService(db)
    report = await service.review_report(report_id, data.status)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"message": f"Report {data.status}", "id": str(report.id)}
