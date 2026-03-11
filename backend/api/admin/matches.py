import logging
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from pydantic import BaseModel, Field

from models.db_models import MatchRecord, Funder, Entity, Proposal
from utils.database import get_db
from api.dependencies import get_current_user, verify_admin

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-matches"])


class MatchSummary(BaseModel):
    id: int
    funder_id: str
    funder_name: str
    entity_id: str
    entity_name: str
    score: float
    status: str
    created_at: datetime


class MatchDetail(BaseModel):
    id: int
    funder_id: str
    funder_name: str
    entity_id: str
    entity_name: str
    score: float
    reason: Optional[str]
    status: str
    created_at: datetime
    metadata_: dict


class MatchUpdate(BaseModel):
    status: str = Field(..., pattern="^(suggested|contacted|interested|declined|funded)$")
    reason: Optional[str] = None


class MatchListResponse(BaseModel):
    matches: List[MatchSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("/", response_model=MatchListResponse)
async def list_matches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    min_score: Optional[float] = None,
    sort_by: str = Query("created_at", pattern="^(score|created_at|status)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    List all match records with pagination, search, and filtering.
    Only accessible by admin users.
    """
    try:
        offset = (page - 1) * page_size
        
        query = select(
            MatchRecord.id,
            MatchRecord.funder_id,
            Funder.name.label("funder_name"),
            MatchRecord.entity_id,
            func.coalesce(Entity.university, 'Unknown Entity').label("entity_name"),
            MatchRecord.score,
            MatchRecord.status,
            MatchRecord.created_at
        ).join(Funder, MatchRecord.funder_id == Funder.id)\
         .join(Entity, MatchRecord.entity_id == Entity.id)
        
        if status:
            query = query.where(MatchRecord.status == status)
        
        if min_score is not None:
            query = query.where(MatchRecord.score >= min_score)
        
        sort_column = {
            "score": MatchRecord.score,
            "created_at": MatchRecord.created_at,
            "status": MatchRecord.status
        }.get(sort_by, MatchRecord.created_at)
        
        if sort_order == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
        
        total_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(total_query)
        total = total_result.scalar()
        
        result = await db.execute(query.offset(offset).limit(page_size))
        rows = result.all()
        
        matches = [
            MatchSummary(
                id=row.id,
                funder_id=str(row.funder_id),
                funder_name=row.funder_name,
                entity_id=str(row.entity_id),
                entity_name=row.entity_name,
                score=row.score,
                status=row.status,
                created_at=row.created_at
            )
            for row in rows
        ]
        
        total_pages = (total + page_size - 1) // page_size
        
        logger.info(f"Admin {admin_user} listed {len(matches)} matches (page {page})")
        
        return MatchListResponse(
            matches=matches,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    except Exception as e:
        logger.error(f"Error listing matches: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list matches")


@router.get("/stats/overview")
async def get_match_stats(
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get match statistics for admin dashboard.
    """
    try:
        total_matches = await db.execute(
            select(func.count()).select_from(MatchRecord)
        )
        total_matches = total_matches.scalar()
        
        avg_score_result = await db.execute(
            select(func.avg(MatchRecord.score))
        )
        avg_score = avg_score_result.scalar() or 0
        
        status_counts_result = await db.execute(
            select(MatchRecord.status, func.count().label("count"))
            .group_by(MatchRecord.status)
        )
        status_counts = {row.status: row.count for row in status_counts_result.all()}
        
        recent_matches = await db.execute(
            select(func.count()).where(
                MatchRecord.created_at >= datetime.utcnow() - timedelta(days=7)
            )
        )
        recent_matches = recent_matches.scalar()
        
        high_quality_matches = await db.execute(
            select(func.count()).where(MatchRecord.score >= 0.8)
        )
        high_quality_matches = high_quality_matches.scalar()
        
        return {
            "total_matches": total_matches,
            "average_score": round(avg_score, 4),
            "status_counts": status_counts,
            "recent_matches_7d": recent_matches,
            "high_quality_matches": high_quality_matches
        }
    except Exception as e:
        logger.error(f"Error getting match stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get match statistics")



@router.get("/{match_id}", response_model=MatchDetail)
async def get_match_detail(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get detailed information about a specific match.
    """
    try:
        result = await db.execute(
            select(MatchRecord, Funder, Entity)
            .join(Funder, MatchRecord.funder_id == Funder.id)
            .join(Entity, MatchRecord.entity_id == Entity.id)
            .where(MatchRecord.id == match_id)
        )
        match_record = result.first()
        
        if not match_record:
            raise HTTPException(status_code=404, detail="Match not found")
        
        match, funder, entity = match_record
        
        proposals_result = await db.execute(
            select(Proposal).where(
                and_(
                    Proposal.entity_id == match.entity_id,
                    Proposal.funder_id == match.funder_id
                )
            )
        )
        proposals = proposals_result.scalars().all()
        
        match_detail = MatchDetail(
            id=match.id,
            funder_id=str(match.funder_id),
            funder_name=funder.name,
            entity_id=str(match.entity_id),
            entity_name=entity.university or "Unknown Entity",
            score=match.score,
            reason=match.reason,
            status=match.status,
            created_at=match.created_at,
            metadata_=match.metadata_
        )
        
        logger.info(f"Admin {admin_user} viewed match {match_id}")
        
        return match_detail
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting match detail: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get match detail")


@router.put("/{match_id}")
async def update_match(
    match_id: int,
    update_data: MatchUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Update match status and reason.
    """
    try:
        result = await db.execute(
            select(MatchRecord).where(MatchRecord.id == match_id)
        )
        match = result.scalar_one_or_none()
        
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        
        match.status = update_data.status
        if update_data.reason is not None:
            match.reason = update_data.reason
        
        await db.commit()
        
        logger.info(f"Admin {admin_user} updated match {match_id} to {update_data.status}")
        
        return {"message": "Match updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating match: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update match")


@router.delete("/{match_id}")
async def delete_match(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Delete a match record.
    """
    try:
        result = await db.execute(
            select(MatchRecord).where(MatchRecord.id == match_id)
        )
        match = result.scalar_one_or_none()
        
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        
        await db.delete(match)
        await db.commit()
        
        logger.info(f"Admin {admin_user} deleted match {match_id}")
        
        return {"message": "Match deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting match: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete match")


