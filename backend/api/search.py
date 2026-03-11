"""
Global search across labs, partners, and users (Feature 3.2).
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from services.search_service import global_search as _global_search, search_labs as _search_labs
from utils.database import get_db

router = APIRouter()


@router.get("/global")
async def global_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    return await _global_search(db, q, limit)


@router.get("/labs")
async def search_labs(
    q: Optional[str] = Query(None),
    sort: str = Query("newest", regex="^(newest|most_liked|most_commented|most_viewed)$"),
    country: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    partner_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await _search_labs(
        db, q=q, sort=sort, country=country, sector=sector,
        partner_id=partner_id, date_from=date_from, date_to=date_to,
        page=page, limit=limit,
    )
