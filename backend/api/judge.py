import logging
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from api.dependencies import get_current_user
from utils.database import get_db
from models.db_models import (
    Event,
    HackathonConfig,
    ScoringSchema,
    ScoringCriterion,
    HackathonParticipant,
    HackathonJudge,
    JudgeAssignment,
    ParticipantScore,
    HackathonCategory,
    CategoryParticipantMembership,
    CategoryJudgeMembership,
)
from schemas.hackathon import (
    ScoringSchemaResponse,
    HackathonParticipantResponse,
    ScoreSubmission,
    ScoreResponse,
)
from services.hackathon_scoring_service import validate_score_submission, get_judge_progress, calculate_leaderboard

logger = logging.getLogger(__name__)
router = APIRouter(tags=["judge"])


async def _get_judge(db: AsyncSession, user_id: str, event_id: uuid.UUID) -> HackathonJudge:
    """Verify user is an authorized judge for this event."""
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Hackathon not found")

    judge_result = await db.execute(
        select(HackathonJudge).where(
            HackathonJudge.hackathon_id == config.id,
            HackathonJudge.user_id == uuid.UUID(user_id),
        )
    )
    judge = judge_result.scalar_one_or_none()
    if not judge:
        raise HTTPException(status_code=403, detail="Not authorized as a judge for this hackathon")
    return judge


async def _can_judge_access_participant(db: AsyncSession, judge: HackathonJudge, participant_id: uuid.UUID) -> bool:
    """
    Check if a judge can access/score a participant.
    Access is granted if:
    1. Judge and participant share at least one category, OR
    2. Judge has no category assignments (can access all participants)
    """
    # Get judge's categories
    judge_categories = await db.execute(
        select(CategoryJudgeMembership.category_id)
        .where(CategoryJudgeMembership.judge_id == judge.id)
    )
    judge_category_ids = [r[0] for r in judge_categories.fetchall()]
    
    # If judge has no categories, they can access all participants
    if not judge_category_ids:
        return True
    
    # Check if participant is in any of the judge's categories
    participant_in_category = await db.execute(
        select(CategoryParticipantMembership.id)
        .where(
            CategoryParticipantMembership.participant_id == participant_id,
            CategoryParticipantMembership.category_id.in_(judge_category_ids)
        )
        .limit(1)
    )
    return participant_in_category.scalar_one_or_none() is not None


# ---- List hackathons where user is judge ----

@router.get("/hackathons")
async def list_judge_hackathons(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(HackathonJudge)
        .where(HackathonJudge.user_id == uuid.UUID(current_user))
    )
    judge_roles = result.scalars().all()

    items = []
    for jr in judge_roles:
        config = await db.get(HackathonConfig, jr.hackathon_id)
        if not config:
            continue
        event = await db.get(Event, config.event_id)
        items.append({
            "event_id": str(config.event_id),
            "event_title": event.title if event else "",
            "hackathon_id": str(config.id),
            "judge_id": str(jr.id),
            "display_name": jr.display_name,
            "judging_started_at": config.judging_started_at,
            "judging_ended_at": config.judging_ended_at,
        })
    return items


# ---- Assigned participants (via categories) ----

@router.get("/hackathons/{event_id}/assignments")
async def get_assignments(
    event_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get participants assigned to this judge.
    Assignment is based on shared categories - a judge can score all participants
    in the same categories they belong to.
    """
    judge = await _get_judge(db, current_user, event_id)
    
    # Get categories this judge belongs to
    judge_categories_result = await db.execute(
        select(CategoryJudgeMembership.category_id)
        .where(CategoryJudgeMembership.judge_id == judge.id)
    )
    judge_category_ids = [r[0] for r in judge_categories_result.fetchall()]
    
    # Get participants in those categories (or all if judge has no category assignments)
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    config = config_result.scalar_one()
    
    if judge_category_ids:
        # Get participants in the same categories as the judge
        participants_result = await db.execute(
            select(HackathonParticipant)
            .join(CategoryParticipantMembership, CategoryParticipantMembership.participant_id == HackathonParticipant.id)
            .where(CategoryParticipantMembership.category_id.in_(judge_category_ids))
            .distinct()
        )
    else:
        # If judge has no category assignments, they can score all participants
        participants_result = await db.execute(
            select(HackathonParticipant)
            .where(HackathonParticipant.hackathon_id == config.id)
        )
    
    participants = participants_result.scalars().all()
    
    items = []
    for p in participants:
        # Check scoring status: final scores
        final_score_count = await db.execute(
            select(func.count(ParticipantScore.id)).where(
                ParticipantScore.judge_id == judge.id,
                ParticipantScore.participant_id == p.id,
                ParticipantScore.is_draft == False,
            )
        )
        final_count = final_score_count.scalar() or 0

        # Check for draft scores
        draft_score_count = await db.execute(
            select(func.count(ParticipantScore.id)).where(
                ParticipantScore.judge_id == judge.id,
                ParticipantScore.participant_id == p.id,
                ParticipantScore.is_draft == True,
            )
        )
        draft_count = draft_score_count.scalar() or 0

        # Determine status: "submitted", "draft", or "pending"
        if final_count > 0:
            status = "submitted"
        elif draft_count > 0:
            status = "draft"
        else:
            status = "pending"

        items.append({
            **HackathonParticipantResponse.model_validate(p).model_dump(),
            "is_scored": final_count > 0,
            "has_draft": draft_count > 0,
            "scoring_status": status,
        })
    return items


# ---- Get judge's categories ----

@router.get("/hackathons/{event_id}/my-categories")
async def get_judge_categories(
    event_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the categories this judge belongs to."""
    judge = await _get_judge(db, current_user, event_id)
    
    result = await db.execute(
        select(HackathonCategory)
        .join(CategoryJudgeMembership, CategoryJudgeMembership.category_id == HackathonCategory.id)
        .where(CategoryJudgeMembership.judge_id == judge.id)
    )
    categories = result.scalars().all()
    
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "description": c.description,
            "category_type": c.category_type,
            "metadata": c.metadata_,
        }
        for c in categories
    ]


# ---- Scoring schema ----

@router.get("/hackathons/{event_id}/scoring-schema")
async def get_judge_schema(
    event_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    judge = await _get_judge(db, current_user, event_id)

    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    config = config_result.scalar_one()

    result = await db.execute(
        select(ScoringSchema)
        .options(selectinload(ScoringSchema.criteria))
        .where(ScoringSchema.hackathon_id == config.id)
    )
    schema = result.scalar_one_or_none()
    if not schema:
        return None
    return ScoringSchemaResponse.model_validate(schema).model_dump()


# ---- Participant detail ----

@router.get("/hackathons/{event_id}/participants/{participant_id}")
async def get_participant_detail(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    judge = await _get_judge(db, current_user, event_id)

    # Verify access via category membership
    if not await _can_judge_access_participant(db, judge, participant_id):
        raise HTTPException(status_code=403, detail="Not assigned to this participant")

    p = await db.get(HackathonParticipant, participant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Participant not found")
    return HackathonParticipantResponse.model_validate(p).model_dump()


# ---- Submit/save scores ----

@router.post("/hackathons/{event_id}/participants/{participant_id}/scores")
async def submit_scores(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
    body: ScoreSubmission,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    judge = await _get_judge(db, current_user, event_id)

    # Verify access via category membership
    if not await _can_judge_access_participant(db, judge, participant_id):
        raise HTTPException(status_code=403, detail="Not assigned to this participant")

    # Check judging is active
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    config = config_result.scalar_one()
    if not config.judging_started_at:
        raise HTTPException(status_code=400, detail="Judging has not started yet")

    # Check if finalized
    metadata = config.metadata_ or {}
    if metadata.get("is_finalized"):
        raise HTTPException(status_code=400, detail="Judging has been finalized. No further score submissions allowed.")

    if config.judging_ended_at:
        raise HTTPException(status_code=400, detail="Judging is currently paused. Please wait for the admin to resume judging.")

    # Get valid criterion IDs from current schema
    schema_result = await db.execute(
        select(ScoringSchema).where(ScoringSchema.hackathon_id == config.id)
    )
    schema = schema_result.scalar_one_or_none()
    if not schema:
        raise HTTPException(status_code=400, detail="No scoring schema found")

    criteria_result = await db.execute(
        select(ScoringCriterion.id).where(ScoringCriterion.schema_id == schema.id)
    )
    valid_criterion_ids = {str(r[0]) for r in criteria_result.fetchall()}

    # Check all submitted criterion IDs are valid
    invalid_criteria = []
    for s in body.scores:
        if str(s.criterion_id) not in valid_criterion_ids:
            invalid_criteria.append(str(s.criterion_id))

    if invalid_criteria:
        raise HTTPException(
            status_code=400,
            detail=f"The scoring schema has been updated. Please refresh the page and try again. Invalid criteria: {', '.join(invalid_criteria[:3])}..."
        )

    # Validate score ranges
    if not body.is_draft:
        errors = await validate_score_submission(
            db, config.id,
            [{"criterion_id": s.criterion_id, "score": s.score} for s in body.scores],
        )
        if errors:
            raise HTTPException(status_code=400, detail=errors)

    # Upsert scores
    for s in body.scores:
        existing = await db.execute(
            select(ParticipantScore).where(
                ParticipantScore.participant_id == participant_id,
                ParticipantScore.judge_id == judge.id,
                ParticipantScore.criterion_id == s.criterion_id,
            )
        )
        score_obj = existing.scalar_one_or_none()
        if score_obj:
            score_obj.score = s.score
            score_obj.comment = s.comment
            score_obj.is_draft = body.is_draft
        else:
            db.add(ParticipantScore(
                participant_id=participant_id,
                judge_id=judge.id,
                criterion_id=s.criterion_id,
                score=s.score,
                comment=s.comment,
                is_draft=body.is_draft,
            ))

    await db.commit()
    return {"message": "Scores saved", "is_draft": body.is_draft}


# ---- Get own scores ----

@router.get("/hackathons/{event_id}/participants/{participant_id}/scores")
async def get_own_scores(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    judge = await _get_judge(db, current_user, event_id)

    result = await db.execute(
        select(ParticipantScore).where(
            ParticipantScore.judge_id == judge.id,
            ParticipantScore.participant_id == participant_id,
        )
    )
    scores = result.scalars().all()

    # Check if any scores are drafts
    has_drafts = any(s.is_draft for s in scores)

    return {
        "scores": [ScoreResponse.model_validate(s).model_dump() for s in scores],
        "is_draft": has_drafts,
        "has_scores": len(scores) > 0,
    }


# ---- Submit all drafts ----

@router.post("/hackathons/{event_id}/submit-all-drafts")
async def submit_all_drafts(
    event_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit all draft scores for this judge.
    Validates all drafts before submitting.
    """
    judge = await _get_judge(db, current_user, event_id)

    # Check judging is active
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    config = config_result.scalar_one()
    if not config.judging_started_at:
        raise HTTPException(status_code=400, detail="Judging has not started yet")

    # Check if finalized
    metadata = config.metadata_ or {}
    if metadata.get("is_finalized"):
        raise HTTPException(status_code=400, detail="Judging has been finalized. No further score submissions allowed.")

    if config.judging_ended_at:
        raise HTTPException(status_code=400, detail="Judging is currently paused. Please wait for the admin to resume judging.")

    # Get all draft scores for this judge
    draft_scores_result = await db.execute(
        select(ParticipantScore).where(
            ParticipantScore.judge_id == judge.id,
            ParticipantScore.is_draft == True,
        )
    )
    draft_scores = draft_scores_result.scalars().all()

    if not draft_scores:
        return {"message": "No drafts to submit", "submitted_count": 0}

    # Group by participant for validation
    participant_scores: dict = {}
    for s in draft_scores:
        pid = str(s.participant_id)
        if pid not in participant_scores:
            participant_scores[pid] = []
        participant_scores[pid].append({"criterion_id": s.criterion_id, "score": s.score})

    # Validate each participant's scores
    all_errors = []
    for pid, scores in participant_scores.items():
        errors = await validate_score_submission(db, config.id, scores)
        if errors:
            all_errors.append(f"Participant {pid[:8]}...: {'; '.join(errors)}")

    if all_errors:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Some drafts have validation errors",
                "errors": all_errors,
            }
        )

    # Submit all drafts
    for s in draft_scores:
        s.is_draft = False

    await db.commit()

    return {
        "message": "All drafts submitted successfully",
        "submitted_count": len(participant_scores),
    }


# ---- Progress ----

@router.get("/hackathons/{event_id}/progress")
async def get_progress(
    event_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    judge = await _get_judge(db, current_user, event_id)

    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    config = config_result.scalar_one()

    # Get categories this judge belongs to
    judge_categories = await db.execute(
        select(CategoryJudgeMembership.category_id)
        .where(CategoryJudgeMembership.judge_id == judge.id)
    )
    judge_category_ids = [r[0] for r in judge_categories.fetchall()]
    
    # Count assigned participants (based on categories)
    if judge_category_ids:
        assigned_result = await db.execute(
            select(func.count(func.distinct(CategoryParticipantMembership.participant_id)))
            .where(CategoryParticipantMembership.category_id.in_(judge_category_ids))
        )
    else:
        # If no categories, count all participants
        assigned_result = await db.execute(
            select(func.count(HackathonParticipant.id))
            .where(HackathonParticipant.hackathon_id == config.id)
        )
    assigned = assigned_result.scalar() or 0
    
    # Count scored participants (non-draft scores by this judge)
    scored_result = await db.execute(
        select(func.count(func.distinct(ParticipantScore.participant_id)))
        .where(
            ParticipantScore.judge_id == judge.id,
            ParticipantScore.is_draft == False
        )
    )
    scored = scored_result.scalar() or 0
    
    # Count participants with draft scores (not yet submitted)
    draft_result = await db.execute(
        select(func.count(func.distinct(ParticipantScore.participant_id)))
        .where(
            ParticipantScore.judge_id == judge.id,
            ParticipantScore.is_draft == True
        )
    )
    drafts = draft_result.scalar() or 0

    remaining = max(0, assigned - scored)
    progress_pct = round((scored / assigned * 100) if assigned > 0 else 0, 1)

    return {
        "assigned": assigned,
        "scored": scored,
        "drafts": drafts,
        "remaining": remaining,
        "progress_pct": progress_pct,
    }


# ---- Leaderboard (read-only for judges, respects phase) ----

@router.get("/hackathons/{event_id}/leaderboard")
async def get_judge_leaderboard(
    event_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get leaderboard for the hackathon.
    Judges can only view if phase is 'hidden' (for judges/admins), 'locked', or 'public'.
    """
    judge = await _get_judge(db, current_user, event_id)
    
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    config = config_result.scalar_one()
    
    # Judges can always see leaderboard (hidden means visible to judges/admins)
    entries = await calculate_leaderboard(db, config.id)
    return entries


@router.get("/hackathons/{event_id}/leaderboard/by-category/{category_id}")
async def get_judge_leaderboard_by_category(
    event_id: uuid.UUID,
    category_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get leaderboard for participants in a specific category.
    Useful for judges to see rankings within their assigned categories.
    """
    judge = await _get_judge(db, current_user, event_id)
    
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    config = config_result.scalar_one()
    
    # Verify category exists and belongs to this hackathon
    category_result = await db.execute(
        select(HackathonCategory).where(
            HackathonCategory.id == category_id,
            HackathonCategory.hackathon_id == config.id
        )
    )
    category = category_result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Get participants in this category
    participants_result = await db.execute(
        select(HackathonParticipant)
        .join(CategoryParticipantMembership, CategoryParticipantMembership.participant_id == HackathonParticipant.id)
        .where(CategoryParticipantMembership.category_id == category_id)
    )
    participants = participants_result.scalars().all()
    participant_ids = {p.id for p in participants}
    
    if not participant_ids:
        return []
    
    # Get scoring schema
    schema_result = await db.execute(
        select(ScoringSchema)
        .options(selectinload(ScoringSchema.criteria))
        .where(ScoringSchema.hackathon_id == config.id)
    )
    schema = schema_result.scalar_one_or_none()
    if not schema or not schema.criteria:
        return []
    
    criteria = sorted(schema.criteria, key=lambda c: c.order)
    total_weight = sum(c.weight for c in criteria)
    
    leaderboard = []
    for p in participants:
        criteria_scores = []
        total_weighted = 0.0
        judge_ids_set = set()
        
        for c in criteria:
            # Get non-draft scores for this criterion
            scores_result = await db.execute(
                select(ParticipantScore)
                .where(
                    ParticipantScore.participant_id == p.id,
                    ParticipantScore.criterion_id == c.id,
                    ParticipantScore.is_draft == False
                )
            )
            scores = scores_result.scalars().all()
            
            if scores:
                avg_score = sum(s.score for s in scores) / len(scores)
                weighted = (avg_score * c.weight / total_weight) if total_weight > 0 else 0
                for s in scores:
                    judge_ids_set.add(s.judge_id)
            else:
                avg_score = 0
                weighted = 0
            
            criteria_scores.append({
                "criterion_id": str(c.id),
                "criterion_name": c.name,
                "avg_score": round(avg_score, 2),
                "weighted_score": round(weighted, 2),
            })
            total_weighted += weighted
        
        leaderboard.append({
            "participant_id": str(p.id),
            "first_name": p.first_name,
            "last_name": p.last_name,
            "name": f"{p.first_name} {p.last_name}",
            "team_name": p.team_name,
            "project_title": p.project_title,
            "criteria_scores": criteria_scores,
            "total_weighted_score": round(total_weighted, 2),
            "judge_count": len(judge_ids_set),
        })
    
    # Sort by total weighted score
    leaderboard.sort(key=lambda x: x["total_weighted_score"], reverse=True)
    
    # Assign ranks
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1
    
    return leaderboard


@router.get("/hackathons/{event_id}/leaderboard-phase")
async def get_judge_leaderboard_phase(
    event_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current leaderboard visibility phase."""
    judge = await _get_judge(db, current_user, event_id)
    
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    config = config_result.scalar_one()
    
    return {
        "phase": config.leaderboard_phase or "hidden",
        "judging_started_at": config.judging_started_at,
        "judging_ended_at": config.judging_ended_at,
    }


@router.get("/hackathons/{event_id}/categories")
async def get_hackathon_categories(
    event_id: uuid.UUID,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all categories for this hackathon (for filtering leaderboard)."""
    judge = await _get_judge(db, current_user, event_id)
    
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    config = config_result.scalar_one()
    
    result = await db.execute(
        select(HackathonCategory).where(HackathonCategory.hackathon_id == config.id)
    )
    categories = result.scalars().all()
    
    # Get participant count per category
    category_list = []
    for c in categories:
        count_result = await db.execute(
            select(func.count(CategoryParticipantMembership.id))
            .where(CategoryParticipantMembership.category_id == c.id)
        )
        participant_count = count_result.scalar() or 0
        
        category_list.append({
            "id": str(c.id),
            "name": c.name,
            "description": c.description,
            "category_type": c.category_type,
            "participant_count": participant_count,
        })
    
    return category_list
