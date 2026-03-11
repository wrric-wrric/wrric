import logging
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.schemas import FunderResponse
from models.db_models import Profile, Funder
from utils.database import get_db, create_funder, get_funder_by_id, check_and_reconnect
from api.dependencies import get_current_user
from utils.embeddings import generate_funder_embeddings  

logger = logging.getLogger(__name__)

router = APIRouter(tags=["funders"])

@router.post("/", response_model=FunderResponse)
async def create_new_funder(
    funder_data: Dict[str, Any],
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new funder.
    Automatically links the funder to the current user's funder profile.
    """
    logger.info("==== Incoming create_new_funder request ====")
    logger.info(f"Current user: {current_user}")
    logger.info(f"Raw funder_data: {funder_data}")

    if not funder_data or not isinstance(funder_data, dict):
        logger.error("Invalid or empty funder_data received.")
        raise HTTPException(status_code=422, detail="Invalid request body: expected a JSON object.")

    try:
        # ✅ Step 1: Get the funder profile for this user
        result = await db.execute(
            select(Profile).where(Profile.user_id == current_user, Profile.type == "funder")
        )
        profile = result.scalars().first()

        if not profile:
            logger.error(f"No 'funder' profile found for user {current_user}")
            raise HTTPException(status_code=404, detail="No funder profile found for this user.")

        # ✅ Step 2: Create funder using the profile_id (embeddings handled in create_funder)
        logger.debug(f"Found funder profile {profile.id} for user {current_user}")
        funder = await create_funder(db=db, profile_id=str(profile.id), **funder_data)

        if not funder:
            raise HTTPException(status_code=500, detail="Failed to create funder")

        logger.info(f"✅ Funder successfully created for profile {profile.id}")
        return FunderResponse.from_orm(funder)

    except HTTPException:
        raise
    except TypeError as e:
        logger.error(f"TypeError while creating funder: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid field(s) in funder_data: {str(e)}")
    except Exception as e:
        logger.exception(f"Unexpected error while creating funder for user {current_user}")
        raise HTTPException(status_code=500, detail=f"Failed to create funder: {str(e)}")

@router.get("/{funder_id}", response_model=FunderResponse)
async def get_funder(funder_id: str, current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Retrieve a funder by ID."""
    try:
        funder = await get_funder_by_id(db, funder_id)
        if not funder:
            raise HTTPException(status_code=404, detail="Funder not found")
        logger.info(f"Retrieved funder {funder_id} for user {current_user}")
        return FunderResponse.from_orm(funder)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve funder {funder_id} for user {current_user}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve funder: {str(e)}")

@router.get("/admin", response_model=List[FunderResponse])
async def get_all_funders(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve all funders (Admin access).
    """
    try:
        logger.info(f"Admin {current_user} requested all funders")

        result = await db.execute(select(Funder))
        funders = result.scalars().all()

        logger.info(f"Fetched {len(funders)} funders from database")
        return [FunderResponse.from_orm(f) for f in funders]

    except Exception as e:
        logger.exception("Error fetching all funders")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve funders: {str(e)}")

        

@router.get("/", response_model=List[FunderResponse])
async def get_user_funders(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve all funders associated with the logged-in user.
    """
    try:
        logger.info(f"Fetching funders for user {current_user}")

        # 1️⃣ Find all funder-type profiles belonging to this user
        result = await db.execute(
            select(Profile.id).where(
                Profile.user_id == current_user,
                Profile.type == "funder"
            )
        )
        profile_ids = [row[0] for row in result.fetchall()]

        if not profile_ids:
            logger.warning(f"No funder profiles found for user {current_user}")
            return []

        # 2️⃣ Fetch funders linked to those profile IDs
        result = await db.execute(select(Funder).where(Funder.profile_id.in_(profile_ids)))
        funders = result.scalars().all()

        logger.info(f"User {current_user} has {len(funders)} associated funders")
        return [FunderResponse.from_orm(f) for f in funders]

    except Exception as e:
        logger.exception(f"Failed to fetch funders for user {current_user}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve user's funders: {str(e)}")

@router.put("/{funder_id}", response_model=FunderResponse)
async def update_funder(
    funder_id: str,
    updated_data: Dict[str, Any],
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a funder (only if it belongs to the current user).
    """
    try:
        logger.info(f"User {current_user} requested update for funder {funder_id}")
        db = await check_and_reconnect(db)

        # Get the funder
        result = await db.execute(select(Funder).where(Funder.id == uuid.UUID(funder_id)))
        funder = result.scalars().first()
        if not funder:
            raise HTTPException(status_code=404, detail="Funder not found")

        # Verify ownership via profile → user link
        result = await db.execute(select(Profile).where(Profile.id == funder.profile_id))
        profile = result.scalars().first()

        logger.info(f"Profile user_id={profile.user_id} | current_user={current_user}")

        if not profile or str(profile.user_id) != str(current_user):
            raise HTTPException(status_code=403, detail="Not authorized to update this funder")

        # Update fields dynamically
        for key, value in updated_data.items():
            if hasattr(funder, key):
                setattr(funder, key, value)

        # Regenerate embeddings based on updated fields
        funder_data = {
            "name": funder.name,
            "profile": funder.profile,
            "org_type": funder.org_type,
            "regions": funder.regions,
            "thematic_focus": funder.thematic_focus,
            "investment_history": funder.investment_history
        }
        embeddings = await generate_funder_embeddings(funder_data)
        funder.embeddings = embeddings

        await db.commit()
        await db.refresh(funder)

        logger.info(f"✅ Updated funder {funder_id} by user {current_user} with new embeddings")
        return FunderResponse.from_orm(funder)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to update funder {funder_id} for user {current_user}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update funder: {str(e)}")

@router.delete("/{funder_id}", status_code=204)
async def delete_funder(
    funder_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a funder if it belongs to the current user.
    """
    try:
        logger.info(f"User {current_user} requested deletion for funder {funder_id}")
        db = await check_and_reconnect(db)

        # Find the funder
        result = await db.execute(select(Funder).where(Funder.id == uuid.UUID(funder_id)))
        funder = result.scalars().first()
        if not funder:
            raise HTTPException(status_code=404, detail="Funder not found")

        # Verify ownership through the profile
        result = await db.execute(select(Profile).where(Profile.id == funder.profile_id))
        profile = result.scalars().first()
        if not profile or profile.user_id != current_user:
            raise HTTPException(status_code=403, detail="Not authorized to delete this funder")

        # Perform delete
        await db.delete(funder)
        await db.commit()

        logger.info(f"✅ Funder {funder_id} deleted by user {current_user}")
        return Response(status_code=204)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to delete funder {funder_id} for user {current_user}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete funder: {str(e)}")