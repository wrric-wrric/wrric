from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict, Any, Union
from uuid import UUID as UUID4
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.future import select
import logging

from api.dependencies import get_current_user, get_db
from api.schemas import MatchRecordResponse, FunderResponse, EntityResponse, MatchRecordWithEntityResponse
from models.db_models import Profile, Funder, MatchRecord, User, Entity, Proposal, UserEntityLink
from utils.database import create_match_record, get_match_records_for_entity


router = APIRouter(tags=["match_records"])
logger = logging.getLogger(__name__)


@router.post("/", response_model=MatchRecordResponse)
async def create_new_match_record(
    match_data: dict,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new match record."""
    logger.debug(f"Received match record creation request: {match_data}")

    try:
        match_record = await create_match_record(db, **match_data)

        if not match_record:
            logger.warning("Match record creation returned None")
            raise HTTPException(status_code=500, detail="Failed to create match record")

        logger.info(f"✅ Match record created by user {current_user} with ID: {match_record.id}")
        return MatchRecordResponse.from_orm(match_record)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ Failed to create match record for user {current_user}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create match record: {str(e)}")

@router.get("/funder", response_model=List[MatchRecordResponse])
async def get_funder_matches_for_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve all match records associated with the current user's funder profile, including funder details.
    """
    logger.debug(f"Fetching funder matches for user_id={current_user}")

    try:
        profile_result = await db.execute(
            select(Profile).where(Profile.user_id == current_user, Profile.type == "funder")
        )
        funder_profile = profile_result.scalars().first()

        if not funder_profile:
            logger.warning(f"❌ No funder profile found for user_id={current_user}")
            raise HTTPException(status_code=404, detail="No funder profile found for this user")

        logger.debug(f"Found funder profile with ID={funder_profile.id}")

        funder_result = await db.execute(
            select(Funder).where(Funder.profile_id == funder_profile.id)
        )
        funder = funder_result.scalars().first()

        if not funder:
            logger.warning(f"❌ No Funder found linked to profile_id={funder_profile.id}")
            raise HTTPException(status_code=404, detail="No funder found linked to this profile")

        logger.debug(f"Found Funder with ID={funder.id} for profile {funder_profile.id}")

        match_result = await db.execute(
            select(MatchRecord, Funder)
            .outerjoin(Funder, MatchRecord.funder_id == Funder.id)
            .where(MatchRecord.funder_id == funder.id)
        )
        matches = match_result.all()

        match_records = [
            MatchRecordResponse(
                id=match.MatchRecord.id,
                funder_id=match.MatchRecord.funder_id,
                entity_id=match.MatchRecord.entity_id,
                funder=FunderResponse.from_orm(match.Funder) if match.Funder else None,
                score=match.MatchRecord.score,
                reason=match.MatchRecord.reason,
                status=match.MatchRecord.status,
                created_at=match.MatchRecord.created_at,
                last_updated=getattr(match.MatchRecord, 'last_updated', match.MatchRecord.created_at),
                metadata_=match.MatchRecord.metadata_ or {}
            )
            for match in matches
        ]

        logger.info(f"✅ Retrieved {len(match_records)} match records for funder_id={funder.id}")
        return match_records

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ Failed to retrieve funder matches for user_id={current_user}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve funder matches: {str(e)}")

@router.get("/entities/{entity_id}", response_model=List[MatchRecordResponse])
async def get_entity_match_records(
    entity_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve match records for a specific entity."""
    logger.debug(f"Fetching match records for entity_id={entity_id}, requested by user={current_user}")

    try:
        match_records = await get_match_records_for_entity(db, entity_id)

        logger.info(f"✅ Retrieved {len(match_records)} match records for entity {entity_id} by user {current_user}")
        return [MatchRecordResponse.from_orm(m) for m in match_records]

    except Exception as e:
        logger.exception(f"❌ Failed to retrieve match records for entity {entity_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve match records: {str(e)}")


@router.get("/funders/matches", response_model=List[MatchRecordWithEntityResponse])
async def get_funder_matches_with_entities(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = None,
    min_score: Optional[float] = None,
    search: Optional[str] = None
):
    """
    Retrieve all match records for the current user's funder profile, including entity details.
    Supports filtering by status, minimum score, and search term.
    """

    logger.debug(
        f"Fetching funder matches with entities for user_id={current_user}, "
        f"status={status}, min_score={min_score}, search={search}"
    )

    try:
        # Step 1: Find user's funder profile
        profile_result = await db.execute(
            select(Profile).where(Profile.user_id == current_user, Profile.type == "funder")
        )
        funder_profile = profile_result.scalars().first()

        if not funder_profile:
            logger.warning(f"❌ No funder profile found for user_id={current_user}")
            raise HTTPException(status_code=404, detail="No funder profile found for this user")

        logger.debug(f"Found funder profile with ID={funder_profile.id}")

        # Step 2: Find funder linked to this profile
        funder_result = await db.execute(
            select(Funder).where(Funder.profile_id == funder_profile.id)
        )
        funder = funder_result.scalars().first()

        if not funder:
            logger.warning(f"❌ No Funder found linked to profile_id={funder_profile.id}")
            raise HTTPException(status_code=404, detail="No funder found linked to this profile")

        logger.debug(f"Found Funder with ID={funder.id} for profile {funder_profile.id}")

        # Step 3: Build query for match records with entity details
        query = (
            select(MatchRecord, Entity)
            .outerjoin(Entity, MatchRecord.entity_id == Entity.id)
            .options(
                selectinload(MatchRecord.entity),
                selectinload(Entity.images),
                selectinload(Entity.proposals),
                selectinload(Entity.match_records),
                selectinload(Entity.verifications),
                selectinload(Entity.embeddings_records),
            )
            .where(MatchRecord.funder_id == funder.id)
        )

        # Apply filters
        if status and status != "all":
            query = query.where(MatchRecord.status == status)
        if min_score is not None:
            query = query.where(MatchRecord.score >= min_score)
        if search:
            query = query.where(
                Entity.name.ilike(f"%{search}%") |
                Entity.university.ilike(f"%{search}%") |
                Entity.research_abstract.ilike(f"%{search}%")
            )

        # Step 4: Execute query
        match_result = await db.execute(query)
        matches = match_result.all()

        # Step 5: Build structured response
        match_records = []
        for match in matches:
            match_record = match.MatchRecord
            entity = match.Entity

            # Safely handle missing optional fields
            last_interaction = getattr(match_record, "last_updated", match_record.created_at)
            proposal_count = getattr(match_record, "proposal_count", 0)
            favorite = getattr(match_record, "favorite", False)

            match_records.append(
                MatchRecordWithEntityResponse(
                    id=match_record.id,
                    funder_id=match_record.funder_id,
                    entity_id=match_record.entity_id,
                    entity=EntityResponse.from_orm(entity) if entity else None,
                    score=match_record.score,
                    reason=match_record.reason,
                    status=match_record.status,
                    created_at=match_record.created_at,
                    last_updated=last_interaction,
                    metadata_=match_record.metadata_ or {},
                    proposal_count=proposal_count,
                    last_interaction=last_interaction,
                    favorite=favorite
                )
            )

        logger.info(f"✅ Retrieved {len(match_records)} match records for funder_id={funder.id}")
        return match_records

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            f"❌ Failed to retrieve funder matches with entities for user_id={current_user}: {e}"
        )
        raise HTTPException(status_code=500, detail=f"Failed to retrieve funder matches: {str(e)}")



@router.put("/{match_id}/status", response_model=dict)
async def update_match_status(
    match_id: str,
    status_update: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update match record status (e.g., interested, rejected)."""
    logger.debug(f"Attempting to update status for match_id={match_id} with data={status_update}")

    try:
        result = await db.execute(
            select(MatchRecord).where(MatchRecord.id == match_id)
        )
        match_record = result.scalars().first()

        if not match_record:
            logger.warning(f"No match record found for match_id={match_id}")
            raise HTTPException(status_code=404, detail="Match record not found")

        match_record.status = status_update.get("status")
        match_record.last_updated = datetime.utcnow()  # Update last_updated
        await db.commit()

        logger.info(f"✅ Match record {match_id} status updated to {status_update.get('status')} by {current_user}")
        return {"message": "Match status updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ Failed to update match status for {match_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update match status: {str(e)}")

@router.put("/{match_id}/favorite", response_model=dict)
async def update_match_favorite(
    match_id: str,
    favorite_update: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update favorite status for a match record."""
    logger.debug(f"Attempting to update favorite status for match_id={match_id} with data={favorite_update}")

    try:
        result = await db.execute(
            select(MatchRecord).where(MatchRecord.id == match_id)
        )
        match_record = result.scalars().first()

        if not match_record:
            logger.warning(f"No match record found for match_id={match_id}")
            raise HTTPException(status_code=404, detail="Match record not found")

        # Update or create UserEntityLink for favorite status
        favorite = favorite_update.get("favorite", False)
        user_entity_link_result = await db.execute(
            select(UserEntityLink).where(
                UserEntityLink.user_id == current_user,
                UserEntityLink.entity_id == match_record.entity_id
            )
        )
        user_entity_link = user_entity_link_result.scalars().first()

        if user_entity_link:
            user_entity_link.favorite = favorite
        else:
            new_link = UserEntityLink(
                user_id=current_user,
                entity_id=match_record.entity_id,
                favorite=favorite
            )
            db.add(new_link)

        await db.commit()

        logger.info(f"✅ Match record {match_id} favorite status updated to {favorite} by {current_user}")
        return {"message": "Favorite status updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ Failed to update favorite status for {match_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update favorite status: {str(e)}")