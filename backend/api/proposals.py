import logging
from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.schemas import ProposalResponse
from models.db_models import Proposal, User
from utils.database import get_db, create_proposal, get_proposals_for_entity
from api.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["proposals"])


@router.post("/", response_model=ProposalResponse)
async def create_new_proposal(
    proposal_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new proposal."""
    try:
        logger.debug(f"User {current_user} creating new proposal with data: {proposal_data}")

        proposal = await create_proposal(db, **proposal_data)
        if not proposal:
            logger.error(f"Proposal creation failed for user {current_user}")
            raise HTTPException(status_code=500, detail="Failed to create proposal")

        logger.info(f"Proposal created successfully by user {current_user}")
        return ProposalResponse.from_orm(proposal)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error creating proposal for user {current_user}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create proposal: {str(e)}")


@router.get("/entities/{entity_id}/", response_model=List[ProposalResponse])
async def get_entity_proposals(
    entity_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve proposals for a specific entity."""
    try:
        logger.debug(f"User {current_user} fetching proposals for entity {entity_id}")

        proposals = await get_proposals_for_entity(db, entity_id)
        logger.info(f"Retrieved {len(proposals)} proposals for entity {entity_id} (user {current_user})")

        return [ProposalResponse.from_orm(p) for p in proposals]

    except Exception as e:
        logger.exception(f"Failed to retrieve proposals for entity {entity_id} by user {current_user}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve proposals: {str(e)}")


@router.put("/{proposal_id}/status")
async def update_proposal_status(
    proposal_id: str,
    status_update: ProposalResponse,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update proposal status."""
    try:
        logger.debug(f"User {current_user} attempting to update proposal {proposal_id} to status {status_update.status}")

        result = await db.execute(select(Proposal).filter(Proposal.id == proposal_id))
        proposal = result.scalar_one_or_none()

        if not proposal:
            logger.warning(f"Proposal {proposal_id} not found for user {current_user}")
            raise HTTPException(status_code=404, detail="Proposal not found")

        # Optional: you could enforce that only the entity owner can update the proposal
        proposal.status = status_update.status
        await db.commit()

        logger.info(f"Proposal {proposal_id} status updated to '{proposal.status}' by user {current_user}")
        return {"message": "Proposal status updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to update proposal {proposal_id} for user {current_user}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update proposal status: {str(e)}")
