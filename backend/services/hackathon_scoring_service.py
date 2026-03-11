import logging
from typing import List, Dict, Any, Optional
from uuid import UUID
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from models.db_models import (
    HackathonConfig,
    ScoringSchema,
    ScoringCriterion,
    HackathonParticipant,
    HackathonJudge,
    JudgeAssignment,
    ParticipantScore,
)

logger = logging.getLogger(__name__)


async def lock_schema(db: AsyncSession, hackathon_id: UUID) -> ScoringSchema:
    """Lock the scoring schema and mark judging as started."""
    result = await db.execute(
        select(ScoringSchema).where(ScoringSchema.hackathon_id == hackathon_id)
    )
    schema = result.scalar_one_or_none()
    if not schema:
        raise ValueError("No scoring schema found for this hackathon")

    # Check if judging is finalized
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.id == hackathon_id)
    )
    config = config_result.scalar_one()
    metadata = config.metadata_ or {}
    if metadata.get("is_finalized"):
        raise ValueError("Cannot start judging - hackathon has been finalized")

    # Check criteria exist
    criteria_result = await db.execute(
        select(func.count(ScoringCriterion.id)).where(ScoringCriterion.schema_id == schema.id)
    )
    count = criteria_result.scalar()
    if not count:
        raise ValueError("Cannot start judging without scoring criteria")

    # Lock schema (even if already locked - idempotent)
    schema.is_locked = True

    # Set judging_started_at only if not already set (first time)
    if not config.judging_started_at:
        config.judging_started_at = datetime.utcnow()

    # Clear judging_ended_at if it was paused
    if config.judging_ended_at:
        config.judging_ended_at = None

    await db.flush()
    return schema


async def pause_judging(db: AsyncSession, hackathon_id: UUID) -> HackathonConfig:
    """Temporarily pause judging. Can be resumed later."""
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.id == hackathon_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise ValueError("Hackathon config not found")
    if not config.judging_started_at:
        raise ValueError("Judging has not been started")

    # Check if already finalized
    metadata = config.metadata_ or {}
    if metadata.get("is_finalized"):
        raise ValueError("Judging has been finalized and cannot be paused")

    if config.judging_ended_at:
        raise ValueError("Judging is already paused")

    config.judging_ended_at = datetime.utcnow()
    await db.flush()
    return config


async def resume_judging(db: AsyncSession, hackathon_id: UUID) -> HackathonConfig:
    """Resume judging after a pause. Automatically locks schema if unlocked."""
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.id == hackathon_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise ValueError("Hackathon config not found")
    if not config.judging_started_at:
        raise ValueError("Judging has not been started")

    # Check if finalized
    metadata = config.metadata_ or {}
    if metadata.get("is_finalized"):
        raise ValueError("Judging has been finalized and cannot be resumed")

    if not config.judging_ended_at:
        raise ValueError("Judging is not paused")

    # Check criteria exist before resuming
    schema_result = await db.execute(
        select(ScoringSchema).where(ScoringSchema.hackathon_id == hackathon_id)
    )
    schema = schema_result.scalar_one_or_none()
    if schema:
        criteria_result = await db.execute(
            select(func.count(ScoringCriterion.id)).where(ScoringCriterion.schema_id == schema.id)
        )
        count = criteria_result.scalar()
        if not count:
            raise ValueError("Cannot resume judging without scoring criteria")

        # Auto-lock schema when resuming (in case it was unlocked for edits)
        if not schema.is_locked:
            schema.is_locked = True

    config.judging_ended_at = None
    await db.flush()
    return config


async def finalize_judging(db: AsyncSession, hackathon_id: UUID) -> HackathonConfig:
    """Permanently end judging. Finalize all draft scores. Cannot be undone."""
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.id == hackathon_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise ValueError("Hackathon config not found")
    if not config.judging_started_at:
        raise ValueError("Judging has not been started")

    metadata = config.metadata_ or {}
    if metadata.get("is_finalized"):
        raise ValueError("Judging has already been finalized")

    # Set end time if not already set
    if not config.judging_ended_at:
        config.judging_ended_at = datetime.utcnow()

    # Mark as finalized in metadata
    metadata["is_finalized"] = True
    metadata["finalized_at"] = datetime.utcnow().isoformat()
    config.metadata_ = metadata

    # Finalize all draft scores
    judges_result = await db.execute(
        select(HackathonJudge.id).where(HackathonJudge.hackathon_id == hackathon_id)
    )
    judge_ids = [r[0] for r in judges_result.all()]
    if judge_ids:
        from sqlalchemy import update
        await db.execute(
            update(ParticipantScore)
            .where(ParticipantScore.judge_id.in_(judge_ids), ParticipantScore.is_draft == True)
            .values(is_draft=False)
        )

    await db.flush()
    return config


async def unlock_schema(db: AsyncSession, hackathon_id: UUID) -> ScoringSchema:
    """Unlock the scoring schema for modifications. Use with caution."""
    result = await db.execute(
        select(ScoringSchema).where(ScoringSchema.hackathon_id == hackathon_id)
    )
    schema = result.scalar_one_or_none()
    if not schema:
        raise ValueError("No scoring schema found for this hackathon")
    if not schema.is_locked:
        raise ValueError("Schema is not locked")

    # Check if judging is finalized
    config_result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.id == hackathon_id)
    )
    config = config_result.scalar_one_or_none()
    if config:
        metadata = config.metadata_ or {}
        if metadata.get("is_finalized"):
            raise ValueError("Cannot unlock schema after judging is finalized")

    schema.is_locked = False
    await db.flush()
    return schema


# Keep old function name for backwards compatibility
async def end_judging(db: AsyncSession, hackathon_id: UUID) -> HackathonConfig:
    """Deprecated: Use pause_judging or finalize_judging instead."""
    return await pause_judging(db, hackathon_id)


async def validate_score_submission(
    db: AsyncSession,
    hackathon_id: UUID,
    scores: List[Dict[str, Any]],
) -> List[str]:
    """Validate that all criteria are present and scores within range. Returns error list."""
    errors = []

    schema_result = await db.execute(
        select(ScoringSchema).where(ScoringSchema.hackathon_id == hackathon_id)
    )
    schema = schema_result.scalar_one_or_none()
    if not schema:
        return ["No scoring schema found"]

    criteria_result = await db.execute(
        select(ScoringCriterion).where(ScoringCriterion.schema_id == schema.id)
    )
    criteria = {str(c.id): c for c in criteria_result.scalars().all()}

    submitted_ids = {str(s["criterion_id"]) for s in scores}
    missing = set(criteria.keys()) - submitted_ids
    if missing:
        errors.append(f"Missing scores for criteria: {', '.join(missing)}")

    for s in scores:
        cid = str(s["criterion_id"])
        if cid not in criteria:
            errors.append(f"Unknown criterion: {cid}")
            continue
        c = criteria[cid]
        if s["score"] < c.min_score or s["score"] > c.max_score:
            errors.append(f"Score {s['score']} out of range [{c.min_score}, {c.max_score}] for '{c.name}'")

    return errors


async def calculate_leaderboard(
    db: AsyncSession,
    hackathon_id: UUID,
) -> List[Dict[str, Any]]:
    """Calculate weighted leaderboard. Returns sorted list of entries."""
    # Get schema + criteria
    schema_result = await db.execute(
        select(ScoringSchema).where(ScoringSchema.hackathon_id == hackathon_id)
    )
    schema = schema_result.scalar_one_or_none()
    if not schema:
        return []

    criteria_result = await db.execute(
        select(ScoringCriterion).where(ScoringCriterion.schema_id == schema.id).order_by(ScoringCriterion.order)
    )
    criteria = criteria_result.scalars().all()
    if not criteria:
        return []

    total_weight = sum(c.weight for c in criteria)
    if total_weight == 0:
        total_weight = 1

    # Get participants
    part_result = await db.execute(
        select(HackathonParticipant).where(HackathonParticipant.hackathon_id == hackathon_id)
    )
    participants = part_result.scalars().all()

    # Get all finalized scores
    judge_ids_result = await db.execute(
        select(HackathonJudge.id).where(HackathonJudge.hackathon_id == hackathon_id)
    )
    judge_ids = [r[0] for r in judge_ids_result.all()]

    if not judge_ids:
        return []

    scores_result = await db.execute(
        select(ParticipantScore).where(
            ParticipantScore.judge_id.in_(judge_ids),
            ParticipantScore.is_draft == False,
        )
    )
    all_scores = scores_result.scalars().all()

    # Build lookup: (participant_id, criterion_id) -> [scores]
    score_map: Dict[tuple, list] = {}
    judge_count_map: Dict[str, set] = {}  # participant_id -> set of judge_ids
    for s in all_scores:
        key = (str(s.participant_id), str(s.criterion_id))
        score_map.setdefault(key, []).append(s.score)
        judge_count_map.setdefault(str(s.participant_id), set()).add(str(s.judge_id))

    entries = []
    for p in participants:
        pid = str(p.id)
        criteria_scores = []
        total_weighted = 0.0

        for c in criteria:
            cid = str(c.id)
            raw_scores = score_map.get((pid, cid), [])
            avg = sum(raw_scores) / len(raw_scores) if raw_scores else 0
            weighted = avg * (c.weight / total_weight)
            total_weighted += weighted
            criteria_scores.append({
                "criterion_id": c.id,
                "criterion_name": c.name,
                "weight": c.weight,
                "avg_score": round(avg, 2),
                "weighted_score": round(weighted, 2),
            })

        entries.append({
            "participant_id": p.id,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "email": p.email,
            "team_name": p.team_name,
            "project_title": p.project_title,
            "total_weighted_score": round(total_weighted, 2),
            "criteria_scores": criteria_scores,
            "judge_count": len(judge_count_map.get(pid, set())),
        })

    # Sort by total_weighted_score descending
    entries.sort(key=lambda e: e["total_weighted_score"], reverse=True)

    # Assign ranks
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1

    return entries


async def get_judge_progress(
    db: AsyncSession,
    hackathon_id: UUID,
    judge_id: Optional[UUID] = None,
) -> List[Dict[str, Any]]:
    """Get progress for judge(s): assigned vs scored."""
    query = select(HackathonJudge).where(HackathonJudge.hackathon_id == hackathon_id)
    if judge_id:
        query = query.where(HackathonJudge.id == judge_id)

    judges_result = await db.execute(query)
    judges = judges_result.scalars().all()

    # Get criteria count
    schema_result = await db.execute(
        select(ScoringSchema).where(ScoringSchema.hackathon_id == hackathon_id)
    )
    schema = schema_result.scalar_one_or_none()
    criteria_count = 0
    if schema:
        cc = await db.execute(
            select(func.count(ScoringCriterion.id)).where(ScoringCriterion.schema_id == schema.id)
        )
        criteria_count = cc.scalar() or 0

    progress = []
    for j in judges:
        # Count assignments
        assigned_result = await db.execute(
            select(func.count(JudgeAssignment.id)).where(JudgeAssignment.judge_id == j.id)
        )
        assigned = assigned_result.scalar() or 0

        # Count fully scored participants (all criteria submitted, not draft)
        scored_result = await db.execute(
            select(ParticipantScore.participant_id)
            .where(
                ParticipantScore.judge_id == j.id,
                ParticipantScore.is_draft == False,
            )
            .group_by(ParticipantScore.participant_id)
            .having(func.count(ParticipantScore.id) >= criteria_count)
        )
        scored = len(scored_result.all()) if criteria_count > 0 else 0

        remaining = max(0, assigned - scored)
        pct = (scored / assigned * 100) if assigned > 0 else 0

        progress.append({
            "judge_id": j.id,
            "display_name": j.display_name,
            "assigned": assigned,
            "scored": scored,
            "remaining": remaining,
            "progress_pct": round(pct, 1),
        })

    return progress
