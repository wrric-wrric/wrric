import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload

from api.dependencies import verify_admin
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
    User,
    HackathonEmailLog,
    HackathonCategory,
    CategoryParticipantMembership,
    CategoryJudgeMembership,
    JudgeGroup,
    JudgeGroupMembership,
    EventRegistration,
)
from schemas.hackathon import (
    HackathonConfigResponse,
    ScoringSchemaCreate,
    ScoringSchemaResponse,
    ScoringCriterionResponse,
    HackathonParticipantResponse,
    ParticipantCreate,
    ParticipantUploadPreview,
    ParticipantUploadConfirm,
    ParticipantUploadResult,
    JudgeCreate,
    JudgeResponse,
    JudgeAssignmentCreate,
    ScoreResponse,
    LeaderboardEntry,
    HackathonEmailRequest,
    HackathonEmailLogResponse,
)
from services.hackathon_upload_service import parse_upload, infer_column_mapping, build_preview, confirm_upload
from services.hackathon_scoring_service import (
    lock_schema,
    pause_judging,
    resume_judging,
    finalize_judging,
    unlock_schema,
    calculate_leaderboard,
)
from services.hackathon_email_service import send_hackathon_participant_email, send_hackathon_judge_email

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-hackathons"])

# In-memory store for upload previews (batch_id -> (df, filename))
_upload_cache: dict = {}


# ---- Helpers ----

async def _get_hackathon_config(db: AsyncSession, event_id: uuid.UUID) -> HackathonConfig:
    result = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Hackathon not enabled for this event")
    return config


# ---- Enable Hackathon ----

@router.post("/{event_id}/enable")
async def enable_hackathon(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = await db.execute(
        select(HackathonConfig).where(HackathonConfig.event_id == event_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Hackathon already enabled")

    event.is_hackathon = True
    config = HackathonConfig(event_id=event_id)
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return {"id": str(config.id), "event_id": str(event_id), "message": "Hackathon enabled"}


# ---- Get Config ----

@router.get("/{event_id}")
async def get_hackathon_config(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)

    # Stats
    p_count = await db.execute(
        select(func.count(HackathonParticipant.id)).where(HackathonParticipant.hackathon_id == config.id)
    )
    j_count = await db.execute(
        select(func.count(HackathonJudge.id)).where(HackathonJudge.hackathon_id == config.id)
    )
    schema_result = await db.execute(
        select(ScoringSchema).where(ScoringSchema.hackathon_id == config.id)
    )
    schema = schema_result.scalar_one_or_none()

    event = await db.get(Event, event_id)

    return {
        "id": str(config.id),
        "event_id": str(config.event_id),
        "event_title": event.title if event else "",
        "judging_started_at": config.judging_started_at,
        "judging_ended_at": config.judging_ended_at,
        "metadata_": config.metadata_ or {},
        "created_at": config.created_at,
        "participant_count": p_count.scalar() or 0,
        "judge_count": j_count.scalar() or 0,
        "schema_locked": schema.is_locked if schema else False,
    }


# ---- Participant Upload ----

@router.post("/{event_id}/participants/upload")
async def upload_participants(
    event_id: uuid.UUID,
    file: UploadFile = File(...),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    try:
        df, batch_id = await parse_upload(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    mapping, unmapped = infer_column_mapping(list(df.columns))
    preview = build_preview(df, mapping, unmapped, batch_id, file.filename)

    _upload_cache[batch_id] = (df, file.filename)
    return preview


@router.post("/{event_id}/participants/upload/confirm")
async def confirm_participant_upload(
    event_id: uuid.UUID,
    body: ParticipantUploadConfirm,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)

    cached = _upload_cache.pop(body.upload_batch_id, None)
    if not cached:
        raise HTTPException(status_code=400, detail="Upload session expired. Please re-upload the file.")

    df, filename = cached
    result = await confirm_upload(db, df, body.column_mapping, config.id, body.upload_batch_id)
    await db.commit()
    return result


# ---- Participants CRUD ----

@router.get("/{event_id}/participants/groups")
async def get_participant_groups(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Return distinct countries and timezones with participant counts."""
    config = await _get_hackathon_config(db, event_id)

    country_result = await db.execute(
        select(HackathonParticipant.country, func.count(HackathonParticipant.id))
        .where(HackathonParticipant.hackathon_id == config.id, HackathonParticipant.country.isnot(None))
        .group_by(HackathonParticipant.country)
        .order_by(func.count(HackathonParticipant.id).desc())
    )
    countries = [{"name": row[0], "count": row[1]} for row in country_result.all()]

    tz_result = await db.execute(
        select(HackathonParticipant.timezone, func.count(HackathonParticipant.id))
        .where(HackathonParticipant.hackathon_id == config.id, HackathonParticipant.timezone.isnot(None))
        .group_by(HackathonParticipant.timezone)
        .order_by(func.count(HackathonParticipant.id).desc())
    )
    timezones = [{"name": row[0], "count": row[1]} for row in tz_result.all()]

    return {"countries": countries, "timezones": timezones}


@router.get("/{event_id}/participants")
async def list_participants(
    event_id: uuid.UUID,
    search: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    timezone: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    List participants for a hackathon event.
    First checks dedicated HackathonParticipant records; if none exist,
    falls back to EventRegistration records for the same event so that
    participants registered via the event registration system are visible.
    """
    config = await _get_hackathon_config(db, event_id)

    # ── Primary source: HackathonParticipant table ───────────────────────
    from models.db_models import EventRegistration

    hp_query = select(HackathonParticipant).where(HackathonParticipant.hackathon_id == config.id)
    hp_count_result = await db.execute(select(func.count()).select_from(hp_query.subquery()))
    hp_count = hp_count_result.scalar() or 0

    if hp_count > 0:
        # Use dedicated hackathon participants
        query = hp_query
        if country:
            query = query.where(HackathonParticipant.country == country)
        if timezone:
            query = query.where(HackathonParticipant.timezone == timezone)
        if search:
            pattern = f"%{search}%"
            query = query.where(
                HackathonParticipant.first_name.ilike(pattern)
                | HackathonParticipant.last_name.ilike(pattern)
                | HackathonParticipant.email.ilike(pattern)
                | HackathonParticipant.team_name.ilike(pattern)
                | HackathonParticipant.project_title.ilike(pattern)
            )
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar() or 0
        result = await db.execute(query.order_by(HackathonParticipant.created_at.desc()).offset(skip).limit(limit))
        participants = result.scalars().all()
        items = [HackathonParticipantResponse.model_validate(p).model_dump() for p in participants]

    else:
        # ── Fallback: pull from EventRegistration ────────────────────────
        er_query = select(EventRegistration).where(
            EventRegistration.event_id == event_id,
            EventRegistration.status != "cancelled",
        )
        if search:
            pattern = f"%{search}%"
            er_query = er_query.where(
                EventRegistration.first_name.ilike(pattern)
                | EventRegistration.last_name.ilike(pattern)
                | EventRegistration.email.ilike(pattern)
                | EventRegistration.organization.ilike(pattern)
            )
        total_result = await db.execute(select(func.count()).select_from(er_query.subquery()))
        total = total_result.scalar() or 0
        result = await db.execute(er_query.order_by(EventRegistration.registration_date.desc()).offset(skip).limit(limit))
        registrations = result.scalars().all()

        # Shape EventRegistration into the same dict format as HackathonParticipant
        items = []
        for reg in registrations:
            meta = reg.metadata_ or {}
            participant_type = meta.get("participation_type") or reg.participation_type or "Individual"
            team_name = meta.get("group_name") or meta.get("team_name") or None
            project_title = meta.get("project_name") or meta.get("project_title") or None

            items.append({
                "id": str(reg.id),
                "hackathon_id": None,
                "first_name": reg.first_name,
                "last_name": reg.last_name,
                "email": reg.email,
                "organization": reg.organization,
                "team_name": team_name,
                "project_title": project_title,
                "project_description": None,
                "phone_number": None,
                "country": None,
                "timezone": None,
                "theme": None,
                "participant_type": "Group" if team_name else "Individual",
                "occupation": reg.position,
                "department": None,
                "major": None,
                "position": reg.position,
                "specialization": None,
                "created_at": reg.registration_date.isoformat() if reg.registration_date else None,
                "status": reg.status,
                # Source indicator for the UI
                "source": "event_registration",
            })

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.delete("/{event_id}/participants")
async def delete_all_participants(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)
    result = await db.execute(
        delete(HackathonParticipant).where(HackathonParticipant.hackathon_id == config.id)
    )
    await db.commit()
    return {"message": f"Deleted {result.rowcount} participants"}


@router.delete("/{event_id}/participants/{participant_id}")
async def delete_participant(
    event_id: uuid.UUID,
    participant_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)
    p = await db.get(HackathonParticipant, participant_id)
    if not p or p.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Participant not found")
    await db.delete(p)
    await db.commit()
    return {"message": "Participant removed"}


# ---- Scoring Schema ----

@router.post("/{event_id}/scoring-schema")
async def create_or_update_schema(
    event_id: uuid.UUID,
    body: ScoringSchemaCreate,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)

    existing = await db.execute(
        select(ScoringSchema).where(ScoringSchema.hackathon_id == config.id)
    )
    schema = existing.scalar_one_or_none()

    if schema and schema.is_locked:
        raise HTTPException(status_code=400, detail="Schema is locked. Cannot modify after judging started.")

    if schema:
        # Delete old criteria
        await db.execute(delete(ScoringCriterion).where(ScoringCriterion.schema_id == schema.id))
        schema.version += 1
    else:
        schema = ScoringSchema(hackathon_id=config.id)
        db.add(schema)
        await db.flush()

    for i, c in enumerate(body.criteria):
        criterion = ScoringCriterion(
            schema_id=schema.id,
            name=c.name,
            description=c.description,
            weight=c.weight,
            min_score=c.min_score,
            max_score=c.max_score,
            order=i,
            rubric=c.rubric,
        )
        db.add(criterion)

    await db.commit()
    await db.refresh(schema)

    # Re-fetch with criteria
    result = await db.execute(
        select(ScoringSchema)
        .options(selectinload(ScoringSchema.criteria))
        .where(ScoringSchema.id == schema.id)
    )
    schema = result.scalar_one()
    return ScoringSchemaResponse.model_validate(schema).model_dump()


@router.get("/{event_id}/scoring-schema")
async def get_schema(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)
    result = await db.execute(
        select(ScoringSchema)
        .options(selectinload(ScoringSchema.criteria))
        .where(ScoringSchema.hackathon_id == config.id)
    )
    schema = result.scalar_one_or_none()
    if not schema:
        return None
    return ScoringSchemaResponse.model_validate(schema).model_dump()


@router.delete("/{event_id}/scoring-schema/criteria/{criterion_id}")
async def delete_criterion(
    event_id: uuid.UUID,
    criterion_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single scoring criterion."""
    config = await _get_hackathon_config(db, event_id)

    # Get schema and check if locked
    result = await db.execute(
        select(ScoringSchema).where(ScoringSchema.hackathon_id == config.id)
    )
    schema = result.scalar_one_or_none()
    if not schema:
        raise HTTPException(status_code=404, detail="Scoring schema not found")

    if schema.is_locked:
        raise HTTPException(status_code=400, detail="Schema is locked. Cannot modify after judging started.")

    # Find and delete the criterion
    criterion = await db.get(ScoringCriterion, criterion_id)
    if not criterion or criterion.schema_id != schema.id:
        raise HTTPException(status_code=404, detail="Criterion not found")

    await db.delete(criterion)
    schema.version += 1
    await db.commit()

    return {"message": "Criterion deleted", "version": schema.version}


# ---- Judges ----

@router.post("/{event_id}/judges")
async def add_judge(
    event_id: uuid.UUID,
    body: JudgeCreate,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)

    user = await db.get(User, body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(HackathonJudge).where(
            HackathonJudge.hackathon_id == config.id,
            HackathonJudge.user_id == body.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a judge for this hackathon")

    judge = HackathonJudge(
        hackathon_id=config.id,
        user_id=body.user_id,
        display_name=body.display_name or user.username,
    )
    db.add(judge)
    await db.commit()
    await db.refresh(judge)
    return {
        "id": str(judge.id),
        "hackathon_id": str(judge.hackathon_id),
        "user_id": str(judge.user_id),
        "display_name": judge.display_name,
    }


@router.get("/{event_id}/judges")
async def list_judges(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)
    result = await db.execute(
        select(HackathonJudge)
        .options(selectinload(HackathonJudge.user))
        .where(HackathonJudge.hackathon_id == config.id)
    )
    judges = result.scalars().all()

    items = []
    for j in judges:
        # Count assignments and scores
        assigned = await db.execute(
            select(func.count(JudgeAssignment.id)).where(JudgeAssignment.judge_id == j.id)
        )
        scored = await db.execute(
            select(func.count(func.distinct(ParticipantScore.participant_id))).where(
                ParticipantScore.judge_id == j.id, ParticipantScore.is_draft == False
            )
        )
        # Fetch the IDs of participants already assigned to this judge
        assigned_ids_result = await db.execute(
            select(JudgeAssignment.participant_id).where(JudgeAssignment.judge_id == j.id)
        )
        assigned_participant_ids = [str(row[0]) for row in assigned_ids_result.all()]

        items.append({
            "id": str(j.id),
            "hackathon_id": str(j.hackathon_id),
            "user_id": str(j.user_id),
            "display_name": j.display_name,
            "username": j.user.username if j.user else None,
            "email": j.user.email if j.user else None,
            "assigned_count": assigned.scalar() or 0,
            "scored_count": scored.scalar() or 0,
            "assigned_participant_ids": assigned_participant_ids,
            "created_at": j.created_at,
        })
    return items


@router.delete("/{event_id}/judges/{judge_id}")
async def remove_judge(
    event_id: uuid.UUID,
    judge_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)
    j = await db.get(HackathonJudge, judge_id)
    if not j or j.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Judge not found")
    await db.delete(j)
    await db.commit()
    return {"message": "Judge removed"}


@router.post("/{event_id}/judges/{judge_id}/assign")
async def assign_participants_to_judge(
    event_id: uuid.UUID,
    judge_id: uuid.UUID,
    body: JudgeAssignmentCreate,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)
    j = await db.get(HackathonJudge, judge_id)
    if not j or j.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Judge not found")

    created = 0
    for pid in body.participant_ids:
        try:
            pid_uuid = uuid.UUID(str(pid))
        except (ValueError, AttributeError):
            continue

        # ── Try HackathonParticipant first ───────────────────────────────
        p = await db.get(HackathonParticipant, pid_uuid)

        if not p or p.hackathon_id != config.id:
            # ── Fallback: look up in EventRegistration ────────────────────
            er_result = await db.execute(
                select(EventRegistration).where(EventRegistration.id == pid_uuid)
            )
            er = er_result.scalar_one_or_none()

            if er is not None:
                # Check if a shadow HackathonParticipant was already created for this registration
                shadow_result = await db.execute(
                    select(HackathonParticipant).where(
                        HackathonParticipant.hackathon_id == config.id,
                        HackathonParticipant.email == er.email,
                    )
                )
                p = shadow_result.scalar_one_or_none()

                if not p:
                    # Create a shadow participant from the EventRegistration data
                    meta = er.metadata_ or {}
                    team_name = meta.get("group_name") or meta.get("team_name")
                    project_title = meta.get("project_name") or meta.get("project_title")
                    p = HackathonParticipant(
                        id=pid_uuid,  # preserve the original ID so the frontend stays in sync
                        hackathon_id=config.id,
                        first_name=er.first_name,
                        last_name=er.last_name,
                        email=er.email,
                        organization=er.organization,
                        team_name=team_name,
                        project_title=project_title,
                        position=er.position,
                    )
                    db.add(p)
                    await db.flush()  # generate ID before using in JudgeAssignment

        if not p:
            continue

        # Check for duplicate assignment
        existing = await db.execute(
            select(JudgeAssignment).where(
                JudgeAssignment.judge_id == judge_id,
                JudgeAssignment.participant_id == p.id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        db.add(JudgeAssignment(judge_id=judge_id, participant_id=p.id))
        created += 1

    await db.commit()
    return {"assigned": created}


# ---- Judging Control ----

@router.post("/{event_id}/judging/start")
async def start_judging(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Start judging. Locks the schema and enables score submission."""
    config = await _get_hackathon_config(db, event_id)
    try:
        schema = await lock_schema(db, config.id)
        await db.commit()
        return {"message": "Judging started", "schema_locked": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{event_id}/judging/pause")
async def pause_judging_endpoint(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Temporarily pause judging. Judges cannot submit scores until resumed."""
    config = await _get_hackathon_config(db, event_id)
    try:
        await pause_judging(db, config.id)
        await db.commit()
        return {"message": "Judging paused", "can_resume": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{event_id}/judging/resume")
async def resume_judging_endpoint(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Resume judging after a pause. Schema is automatically locked if it was unlocked."""
    config = await _get_hackathon_config(db, event_id)
    try:
        await resume_judging(db, config.id)
        await db.commit()
        return {"message": "Judging resumed. Schema has been locked.", "schema_locked": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{event_id}/judging/finalize")
async def finalize_judging_endpoint(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently finalize judging. This action CANNOT be undone.
    All draft scores will be converted to final scores.
    """
    config = await _get_hackathon_config(db, event_id)
    try:
        await finalize_judging(db, config.id)
        await db.commit()
        return {"message": "Judging finalized", "is_permanent": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{event_id}/judging/end")
async def end_judging_endpoint(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Pause judging (alias for /pause for backwards compatibility)."""
    config = await _get_hackathon_config(db, event_id)
    try:
        await pause_judging(db, config.id)
        await db.commit()
        return {"message": "Judging paused", "can_resume": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{event_id}/scoring-schema/unlock")
async def unlock_schema_endpoint(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Unlock the scoring schema to allow modifications.
    Warning: Modifying the schema after scores have been submitted may cause inconsistencies.
    """
    config = await _get_hackathon_config(db, event_id)
    try:
        schema = await unlock_schema(db, config.id)
        await db.commit()
        return {"message": "Schema unlocked", "schema_locked": False}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{event_id}/judging/status")
async def get_judging_status(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get current judging status including whether it can be resumed."""
    config = await _get_hackathon_config(db, event_id)

    # Get schema lock status
    schema_result = await db.execute(
        select(ScoringSchema).where(ScoringSchema.hackathon_id == config.id)
    )
    schema = schema_result.scalar_one_or_none()

    metadata = config.metadata_ or {}
    is_finalized = metadata.get("is_finalized", False)

    # Determine status
    if is_finalized:
        status = "finalized"
    elif config.judging_ended_at:
        status = "paused"
    elif config.judging_started_at:
        status = "active"
    else:
        status = "not_started"

    return {
        "status": status,
        "judging_started_at": config.judging_started_at,
        "judging_ended_at": config.judging_ended_at,
        "is_finalized": is_finalized,
        "finalized_at": metadata.get("finalized_at"),
        "schema_locked": schema.is_locked if schema else False,
        "can_start": status == "not_started" and not is_finalized,
        "can_pause": status == "active",
        "can_resume": status == "paused" and not is_finalized,
        "can_finalize": status in ("active", "paused") and not is_finalized,
        "can_unlock_schema": schema.is_locked if schema else False and not is_finalized,
    }


# ---- Leaderboard ----

@router.get("/{event_id}/leaderboard")
async def get_leaderboard(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)
    entries = await calculate_leaderboard(db, config.id)
    return entries


# ---- Scores (admin view) ----

@router.get("/{event_id}/scores")
async def get_all_scores(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)

    judge_ids_result = await db.execute(
        select(HackathonJudge.id).where(HackathonJudge.hackathon_id == config.id)
    )
    judge_ids = [r[0] for r in judge_ids_result.all()]
    if not judge_ids:
        return []

    result = await db.execute(
        select(ParticipantScore).where(ParticipantScore.judge_id.in_(judge_ids))
    )
    scores = result.scalars().all()
    return [ScoreResponse.model_validate(s).model_dump() for s in scores]


# ---- Email ----

@router.post("/{event_id}/email")
async def send_email_to_participants(
    event_id: uuid.UUID,
    participant_ids: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    meeting_link: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None),  # Optional: assign recipients to this category
    create_category_name: Optional[str] = Form(None),  # Optional: create new category and assign
    additional_emails: Optional[str] = Form(None),  # JSON list of extra email addresses
    attachments: List[UploadFile] = File(default=[]),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Send email to participants with optional category assignment."""
    import json
    try:
        pid_list = json.loads(participant_ids)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid participant_ids format")

    config = await _get_hackathon_config(db, event_id)
    event = await db.get(Event, event_id)

    # Get participant emails
    participants = []
    if pid_list:
        result = await db.execute(
            select(HackathonParticipant).where(
                HackathonParticipant.hackathon_id == config.id,
                HackathonParticipant.id.in_([uuid.UUID(p) for p in pid_list]),
            )
        )
        participants = result.scalars().all()

    # Check if we have any recipients (participants or additional emails)
    has_additional = False
    if additional_emails:
        try:
            has_additional = len(json.loads(additional_emails)) > 0
        except Exception:
            pass
    if not participants and not has_additional:
        raise HTTPException(status_code=400, detail="No recipients found. Select participants or add email addresses.")

    # Read attachment data
    attachment_data = []
    for att in attachments:
        content = await att.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"Attachment '{att.filename}' too large (max 10MB)")
        attachment_data.append({
            "filename": att.filename,
            "content": content,
            "content_type": att.content_type or "application/octet-stream",
        })

    # Convert participants to dicts for personalization
    participant_data = [
        {
            "email": p.email,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "organization": p.organization,
            "team_name": p.team_name,
            "project_title": p.project_title,
            "theme": p.theme,
            "participant_type": p.participant_type,
            "country": p.country,
            "phone_number": p.phone_number,
            "occupation": getattr(p, "occupation", None),
            "department": getattr(p, "department", None),
            "major": getattr(p, "major", None),
            "position": getattr(p, "position", None),
            "specialization": getattr(p, "specialization", None),
        }
        for p in participants
    ]

    # Handle additional individual email addresses
    if additional_emails:
        import re
        try:
            extra_list = json.loads(additional_emails)
        except Exception:
            extra_list = []
        email_pattern = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
        existing_emails = {p["email"].lower() for p in participant_data if p.get("email")}
        for email_addr in extra_list:
            email_addr = email_addr.strip().lower()
            if email_pattern.match(email_addr) and email_addr not in existing_emails:
                existing_emails.add(email_addr)
                participant_data.append({
                    "email": email_addr,
                    "first_name": "",
                    "last_name": "",
                    "organization": "",
                    "team_name": "",
                    "project_title": "",
                    "theme": "",
                    "participant_type": "",
                    "country": "",
                    "phone_number": "",
                    "occupation": "",
                    "department": "",
                    "major": "",
                    "position": "",
                    "specialization": "",
                })

    emails = [p["email"] for p in participant_data if p.get("email")]
    email_result = send_hackathon_participant_email(
        participants=participant_data,
        subject=subject,
        body=body,
        event_title=event.title if event else "Hackathon",
        meeting_link=meeting_link if meeting_link else None,
        attachments=attachment_data,
    )

    # Handle optional category assignment
    assigned_category_id = None
    if create_category_name and create_category_name.strip():
        # Create new category
        existing = await db.execute(
            select(HackathonCategory).where(
                HackathonCategory.hackathon_id == config.id,
                HackathonCategory.name == create_category_name.strip()
            )
        )
        cat = existing.scalar()
        if not cat:
            cat = HackathonCategory(
                hackathon_id=config.id,
                name=create_category_name.strip(),
                category_type="email_group",
                metadata_={"meeting_link": meeting_link} if meeting_link else {},
            )
            db.add(cat)
            await db.flush()
        assigned_category_id = cat.id
    elif category_id and category_id.strip():
        assigned_category_id = uuid.UUID(category_id)
    
    # Assign participants to category if specified
    if assigned_category_id:
        for p in participants:
            # Check if already member
            existing = await db.execute(
                select(CategoryParticipantMembership).where(
                    CategoryParticipantMembership.category_id == assigned_category_id,
                    CategoryParticipantMembership.participant_id == p.id
                )
            )
            if not existing.scalar():
                membership = CategoryParticipantMembership(
                    category_id=assigned_category_id,
                    participant_id=p.id,
                )
                db.add(membership)

    # Log the email
    attachment_names = [a["filename"] for a in attachment_data]
    log = HackathonEmailLog(
        hackathon_id=config.id,
        subject=subject,
        body=body,
        meeting_link=meeting_link if meeting_link else None,
        attachment_names=attachment_names if attachment_names else [],
        recipient_count=len(emails),
        recipient_emails=emails,
        sent_count=email_result["sent"],
        failed_count=email_result["failed"],
        sent_by=admin_user,
        category_id=assigned_category_id,
        recipient_type="participant",
    )
    db.add(log)
    await db.commit()

    return {
        **email_result,
        "category_assigned": str(assigned_category_id) if assigned_category_id else None,
    }


@router.get("/{event_id}/email/history")
async def get_email_history(
    event_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_hackathon_config(db, event_id)
    query = select(HackathonEmailLog).where(HackathonEmailLog.hackathon_id == config.id)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

    result = await db.execute(
        query.order_by(HackathonEmailLog.created_at.desc()).offset(skip).limit(limit)
    )
    logs = result.scalars().all()

    return {
        "items": [HackathonEmailLogResponse.model_validate(l).model_dump() for l in logs],
        "total": total,
    }


# ---- Judge Email ----

@router.post("/{event_id}/judges/email")
async def send_email_to_judges(
    event_id: uuid.UUID,
    judge_ids: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    judge_portal_url: Optional[str] = Form(None),
    meeting_link: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None),  # Optional: assign recipients to this category
    create_category_name: Optional[str] = Form(None),  # Optional: create new category and assign
    additional_emails: Optional[str] = Form(None),  # JSON list of extra email addresses
    attachments: List[UploadFile] = File(default=[]),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Send email to selected judges with optional attachments, meeting link, and category assignment."""
    import json
    try:
        jid_list = json.loads(judge_ids)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid judge_ids format")

    config = await _get_hackathon_config(db, event_id)
    event = await db.get(Event, event_id)

    # Get judges with their user info
    judges = []
    if jid_list:
        result = await db.execute(
            select(HackathonJudge)
            .options(selectinload(HackathonJudge.user))
            .where(
                HackathonJudge.hackathon_id == config.id,
                HackathonJudge.id.in_([uuid.UUID(j) for j in jid_list]),
            )
        )
        judges = result.scalars().all()

    # Check if we have any recipients (judges or additional emails)
    has_additional = False
    if additional_emails:
        try:
            has_additional = len(json.loads(additional_emails)) > 0
        except Exception:
            pass
    if not judges and not has_additional:
        raise HTTPException(status_code=400, detail="No recipients found. Select judges or add email addresses.")

    # Read attachment data
    attachment_data = []
    for att in attachments:
        content = await att.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"Attachment '{att.filename}' too large (max 10MB)")
        attachment_data.append({
            "filename": att.filename,
            "content": content,
            "content_type": att.content_type or "application/octet-stream",
        })

    # Build judge data
    judge_data = []
    for j in judges:
        judge_data.append({
            "email": j.user.email if j.user else None,
            "display_name": j.display_name,
            "username": j.user.username if j.user else None,
        })

    # Filter out judges without email
    judge_data = [j for j in judge_data if j.get("email")]

    # Handle additional individual email addresses
    if additional_emails:
        import re
        try:
            extra_list = json.loads(additional_emails)
        except Exception:
            extra_list = []
        email_pattern = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
        existing_emails = {j["email"].lower() for j in judge_data}
        for email_addr in extra_list:
            email_addr = email_addr.strip().lower()
            if email_pattern.match(email_addr) and email_addr not in existing_emails:
                existing_emails.add(email_addr)
                judge_data.append({
                    "email": email_addr,
                    "display_name": "",
                    "username": "",
                })

    emails = [j["email"] for j in judge_data]
    email_result = send_hackathon_judge_email(
        judges=judge_data,
        subject=subject,
        body=body,
        event_title=event.title if event else "Hackathon",
        judge_portal_url=judge_portal_url if judge_portal_url else None,
        meeting_link=meeting_link if meeting_link else None,
        attachments=attachment_data,
    )

    # Handle optional category assignment
    assigned_category_id = None
    if create_category_name and create_category_name.strip():
        # Create new category
        existing = await db.execute(
            select(HackathonCategory).where(
                HackathonCategory.hackathon_id == config.id,
                HackathonCategory.name == create_category_name.strip()
            )
        )
        cat = existing.scalar()
        if not cat:
            cat = HackathonCategory(
                hackathon_id=config.id,
                name=create_category_name.strip(),
                category_type="judge_panel",
                metadata_={"meeting_link": meeting_link} if meeting_link else {},
            )
            db.add(cat)
            await db.flush()
        assigned_category_id = cat.id
    elif category_id and category_id.strip():
        assigned_category_id = uuid.UUID(category_id)
    
    # Assign judges to category if specified
    if assigned_category_id:
        for j in judges:
            # Check if already member
            existing = await db.execute(
                select(CategoryJudgeMembership).where(
                    CategoryJudgeMembership.category_id == assigned_category_id,
                    CategoryJudgeMembership.judge_id == j.id
                )
            )
            if not existing.scalar():
                membership = CategoryJudgeMembership(
                    category_id=assigned_category_id,
                    judge_id=j.id,
                )
                db.add(membership)

    # Log the email
    attachment_names = [a["filename"] for a in attachment_data]
    log = HackathonEmailLog(
        hackathon_id=config.id,
        subject=subject,
        body=body,
        meeting_link=meeting_link if meeting_link else None,
        attachment_names=attachment_names if attachment_names else [],
        recipient_count=len(emails),
        recipient_emails=emails,
        sent_count=email_result["sent"],
        failed_count=email_result["failed"],
        sent_by=admin_user,
        category_id=assigned_category_id,
        recipient_type="judge",
    )
    db.add(log)
    await db.commit()

    return {
        **email_result,
        "category_assigned": str(assigned_category_id) if assigned_category_id else None,
    }


@router.get("/{event_id}/judges/list-for-email")
async def list_judges_for_email(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get list of judges with email info for the email compose UI."""
    config = await _get_hackathon_config(db, event_id)
    result = await db.execute(
        select(HackathonJudge)
        .options(selectinload(HackathonJudge.user))
        .where(HackathonJudge.hackathon_id == config.id)
    )
    judges = result.scalars().all()

    items = []
    for j in judges:
        items.append({
            "id": str(j.id),
            "display_name": j.display_name,
            "username": j.user.username if j.user else None,
            "email": j.user.email if j.user else None,
        })
    return items


# ==================== Categories ====================

@router.get("/{event_id}/categories")
async def list_categories(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all categories for a hackathon."""
    config = await _get_hackathon_config(db, event_id)
    result = await db.execute(
        select(HackathonCategory)
        .where(HackathonCategory.hackathon_id == config.id)
        .order_by(HackathonCategory.created_at.desc())
    )
    categories = result.scalars().all()
    
    items = []
    for c in categories:
        # Count participants and judges in this category
        p_count = await db.execute(
            select(func.count(CategoryParticipantMembership.id))
            .where(CategoryParticipantMembership.category_id == c.id)
        )
        j_count = await db.execute(
            select(func.count(CategoryJudgeMembership.id))
            .where(CategoryJudgeMembership.category_id == c.id)
        )
        items.append({
            "id": str(c.id),
            "name": c.name,
            "description": c.description,
            "category_type": c.category_type,
            "metadata": c.metadata_ or {},
            "participant_count": p_count.scalar() or 0,
            "judge_count": j_count.scalar() or 0,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return items


@router.post("/{event_id}/categories")
async def create_category(
    event_id: uuid.UUID,
    name: str = Form(...),
    description: Optional[str] = Form(None),
    category_type: Optional[str] = Form(None),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new category."""
    config = await _get_hackathon_config(db, event_id)
    
    # Check for duplicate name
    existing = await db.execute(
        select(HackathonCategory).where(
            HackathonCategory.hackathon_id == config.id,
            HackathonCategory.name == name.strip()
        )
    )
    if existing.scalar():
        raise HTTPException(status_code=400, detail="Category with this name already exists")
    
    category = HackathonCategory(
        hackathon_id=config.id,
        name=name.strip(),
        description=description,
        category_type=category_type,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    
    return {
        "id": str(category.id),
        "name": category.name,
        "description": category.description,
        "category_type": category.category_type,
    }


@router.delete("/{event_id}/categories/{category_id}")
async def delete_category(
    event_id: uuid.UUID,
    category_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a category and all its memberships."""
    config = await _get_hackathon_config(db, event_id)
    category = await db.get(HackathonCategory, category_id)
    if not category or category.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Category not found")
    
    await db.delete(category)
    await db.commit()
    return {"status": "deleted"}


@router.get("/{event_id}/categories/{category_id}/members")
async def get_category_members(
    event_id: uuid.UUID,
    category_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get all participants and judges in a category."""
    config = await _get_hackathon_config(db, event_id)
    category = await db.get(HackathonCategory, category_id)
    if not category or category.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Get participants
    p_result = await db.execute(
        select(CategoryParticipantMembership)
        .options(selectinload(CategoryParticipantMembership.participant))
        .where(CategoryParticipantMembership.category_id == category_id)
    )
    participants = []
    for m in p_result.scalars().all():
        p = m.participant
        participants.append({
            "id": str(p.id),
            "name": f"{p.first_name} {p.last_name}",
            "email": p.email,
            "team_name": p.team_name,
        })
    
    # Get judges
    j_result = await db.execute(
        select(CategoryJudgeMembership)
        .options(selectinload(CategoryJudgeMembership.judge).selectinload(HackathonJudge.user))
        .where(CategoryJudgeMembership.category_id == category_id)
    )
    judges = []
    for m in j_result.scalars().all():
        j = m.judge
        judges.append({
            "id": str(j.id),
            "display_name": j.display_name,
            "email": j.user.email if j.user else None,
        })
    
    return {"participants": participants, "judges": judges}


@router.post("/{event_id}/categories/{category_id}/participants")
async def add_participants_to_category(
    event_id: uuid.UUID,
    category_id: uuid.UUID,
    body: dict,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add participants to a category."""
    config = await _get_hackathon_config(db, event_id)
    category = await db.get(HackathonCategory, category_id)
    if not category or category.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Category not found")
    
    participant_ids = body.get("participant_ids", [])
    added = 0
    for pid in participant_ids:
        try:
            participant = await db.get(HackathonParticipant, uuid.UUID(pid))
            if not participant or participant.hackathon_id != config.id:
                continue
            # Check if already exists
            existing = await db.execute(
                select(CategoryParticipantMembership).where(
                    CategoryParticipantMembership.category_id == category_id,
                    CategoryParticipantMembership.participant_id == uuid.UUID(pid)
                )
            )
            if existing.scalar_one_or_none():
                continue
            db.add(CategoryParticipantMembership(
                category_id=category_id,
                participant_id=uuid.UUID(pid)
            ))
            added += 1
        except Exception:
            continue
    
    await db.commit()
    return {"added": added}


@router.delete("/{event_id}/categories/{category_id}/participants/{participant_id}")
async def remove_participant_from_category(
    event_id: uuid.UUID,
    category_id: uuid.UUID,
    participant_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a participant from a category."""
    config = await _get_hackathon_config(db, event_id)
    category = await db.get(HackathonCategory, category_id)
    if not category or category.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Category not found")
    
    result = await db.execute(
        select(CategoryParticipantMembership).where(
            CategoryParticipantMembership.category_id == category_id,
            CategoryParticipantMembership.participant_id == participant_id
        )
    )
    membership = result.scalar_one_or_none()
    if membership:
        await db.delete(membership)
        await db.commit()
    return {"message": "Removed"}


@router.post("/{event_id}/categories/{category_id}/judges")
async def add_judges_to_category(
    event_id: uuid.UUID,
    category_id: uuid.UUID,
    body: dict,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add judges to a category."""
    config = await _get_hackathon_config(db, event_id)
    category = await db.get(HackathonCategory, category_id)
    if not category or category.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Category not found")
    
    judge_ids = body.get("judge_ids", [])
    added = 0
    for jid in judge_ids:
        try:
            judge = await db.get(HackathonJudge, uuid.UUID(jid))
            if not judge or judge.hackathon_id != config.id:
                continue
            # Check if already exists
            existing = await db.execute(
                select(CategoryJudgeMembership).where(
                    CategoryJudgeMembership.category_id == category_id,
                    CategoryJudgeMembership.judge_id == uuid.UUID(jid)
                )
            )
            if existing.scalar_one_or_none():
                continue
            db.add(CategoryJudgeMembership(
                category_id=category_id,
                judge_id=uuid.UUID(jid)
            ))
            added += 1
        except Exception:
            continue
    
    await db.commit()
    return {"added": added}


@router.delete("/{event_id}/categories/{category_id}/judges/{judge_id}")
async def remove_judge_from_category(
    event_id: uuid.UUID,
    category_id: uuid.UUID,
    judge_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a judge from a category."""
    config = await _get_hackathon_config(db, event_id)
    category = await db.get(HackathonCategory, category_id)
    if not category or category.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Category not found")
    
    result = await db.execute(
        select(CategoryJudgeMembership).where(
            CategoryJudgeMembership.category_id == category_id,
            CategoryJudgeMembership.judge_id == judge_id
        )
    )
    membership = result.scalar_one_or_none()
    if membership:
        await db.delete(membership)
        await db.commit()
    return {"message": "Removed"}


# ==================== Judge Groups ====================

@router.get("/{event_id}/judge-groups")
async def list_judge_groups(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all judge groups for a hackathon."""
    config = await _get_hackathon_config(db, event_id)
    result = await db.execute(
        select(JudgeGroup)
        .where(JudgeGroup.hackathon_id == config.id)
        .order_by(JudgeGroup.created_at.desc())
    )
    groups = result.scalars().all()
    
    items = []
    for g in groups:
        # Count judges in this group
        j_count = await db.execute(
            select(func.count(JudgeGroupMembership.id))
            .where(JudgeGroupMembership.group_id == g.id)
        )
        items.append({
            "id": str(g.id),
            "name": g.name,
            "description": g.description,
            "judge_count": j_count.scalar() or 0,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        })
    return items


@router.post("/{event_id}/judge-groups")
async def create_judge_group(
    event_id: uuid.UUID,
    name: str = Form(...),
    description: Optional[str] = Form(None),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new judge group."""
    config = await _get_hackathon_config(db, event_id)
    
    # Check for duplicate name
    existing = await db.execute(
        select(JudgeGroup).where(
            JudgeGroup.hackathon_id == config.id,
            JudgeGroup.name == name.strip()
        )
    )
    if existing.scalar():
        raise HTTPException(status_code=400, detail="Judge group with this name already exists")
    
    group = JudgeGroup(
        hackathon_id=config.id,
        name=name.strip(),
        description=description,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    
    return {
        "id": str(group.id),
        "name": group.name,
        "description": group.description,
    }


@router.delete("/{event_id}/judge-groups/{group_id}")
async def delete_judge_group(
    event_id: uuid.UUID,
    group_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a judge group and all its memberships."""
    config = await _get_hackathon_config(db, event_id)
    group = await db.get(JudgeGroup, group_id)
    if not group or group.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Judge group not found")
    
    await db.delete(group)
    await db.commit()
    return {"status": "deleted"}


@router.post("/{event_id}/judge-groups/{group_id}/members")
async def add_judges_to_group(
    event_id: uuid.UUID,
    group_id: uuid.UUID,
    judge_ids: str = Form(...),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add judges to a judge group."""
    import json
    config = await _get_hackathon_config(db, event_id)
    group = await db.get(JudgeGroup, group_id)
    if not group or group.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Judge group not found")
    
    try:
        jid_list = json.loads(judge_ids)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid judge_ids format")
    
    added = 0
    for jid in jid_list:
        try:
            judge_uuid = uuid.UUID(jid)
            # Check if already member
            existing = await db.execute(
                select(JudgeGroupMembership).where(
                    JudgeGroupMembership.group_id == group_id,
                    JudgeGroupMembership.judge_id == judge_uuid
                )
            )
            if not existing.scalar():
                membership = JudgeGroupMembership(group_id=group_id, judge_id=judge_uuid)
                db.add(membership)
                added += 1
        except Exception:
            continue
    
    await db.commit()
    return {"added": added}


@router.delete("/{event_id}/judge-groups/{group_id}/members/{judge_id}")
async def remove_judge_from_group(
    event_id: uuid.UUID,
    group_id: uuid.UUID,
    judge_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a judge from a judge group."""
    config = await _get_hackathon_config(db, event_id)
    group = await db.get(JudgeGroup, group_id)
    if not group or group.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Judge group not found")
    
    result = await db.execute(
        select(JudgeGroupMembership).where(
            JudgeGroupMembership.group_id == group_id,
            JudgeGroupMembership.judge_id == judge_id
        )
    )
    membership = result.scalar()
    if membership:
        await db.delete(membership)
        await db.commit()
    
    return {"status": "removed"}


@router.get("/{event_id}/judge-groups/{group_id}/members")
async def get_judge_group_members(
    event_id: uuid.UUID,
    group_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get all judges in a judge group."""
    config = await _get_hackathon_config(db, event_id)
    group = await db.get(JudgeGroup, group_id)
    if not group or group.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Judge group not found")
    
    result = await db.execute(
        select(JudgeGroupMembership)
        .options(selectinload(JudgeGroupMembership.judge).selectinload(HackathonJudge.user))
        .where(JudgeGroupMembership.group_id == group_id)
    )
    judges = []
    for m in result.scalars().all():
        j = m.judge
        judges.append({
            "id": str(j.id),
            "display_name": j.display_name,
            "username": j.user.username if j.user else None,
            "email": j.user.email if j.user else None,
        })
    return judges


# ==================== Leaderboard Phase ====================

@router.get("/{event_id}/leaderboard-phase")
async def get_leaderboard_phase(
    event_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get current leaderboard visibility phase."""
    config = await _get_hackathon_config(db, event_id)
    return {
        "phase": config.leaderboard_phase or "hidden",
        "judging_started_at": config.judging_started_at.isoformat() if config.judging_started_at else None,
        "judging_ended_at": config.judging_ended_at.isoformat() if config.judging_ended_at else None,
    }


@router.put("/{event_id}/leaderboard-phase")
async def set_leaderboard_phase(
    event_id: uuid.UUID,
    phase: str = Form(...),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Set leaderboard visibility phase.
    
    Phases:
    - 'hidden': Only admins and judges can view scores
    - 'locked': Final scores visible to judges/admins, rankings computed
    - 'public': Everyone can view the leaderboard
    """
    if phase not in ("hidden", "locked", "public"):
        raise HTTPException(status_code=400, detail="Invalid phase. Must be 'hidden', 'locked', or 'public'")
    
    config = await _get_hackathon_config(db, event_id)
    config.leaderboard_phase = phase
    await db.commit()
    
    return {"phase": phase}


# ==================== Leaderboard with Filters ====================

@router.get("/{event_id}/leaderboard/by-group/{group_id}")
async def get_leaderboard_by_judge_group(
    event_id: uuid.UUID,
    group_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get leaderboard based only on scores from a specific judge group.
    Used for session-level analysis.
    """
    config = await _get_hackathon_config(db, event_id)
    
    # Verify group exists
    group = await db.get(JudgeGroup, group_id)
    if not group or group.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Judge group not found")
    
    # Get scoring schema
    schema = await db.execute(
        select(ScoringSchema)
        .options(selectinload(ScoringSchema.criteria))
        .where(ScoringSchema.hackathon_id == config.id)
    )
    schema = schema.scalar()
    if not schema:
        raise HTTPException(status_code=400, detail="No scoring schema configured")
    
    # Get participants
    participants = await db.execute(
        select(HackathonParticipant).where(HackathonParticipant.hackathon_id == config.id)
    )
    participants = participants.scalars().all()
    
    # Get judges in this group
    judges_in_group = await db.execute(
        select(JudgeGroupMembership.judge_id).where(JudgeGroupMembership.group_id == group_id)
    )
    judge_ids = [j[0] for j in judges_in_group.all()]
    
    if not judge_ids:
        return []
    
    # Calculate scores for each participant (only from judges in this group)
    leaderboard = []
    for p in participants:
        scores_result = await db.execute(
            select(ParticipantScore)
            .where(
                ParticipantScore.participant_id == p.id,
                ParticipantScore.is_draft == False,
                ParticipantScore.judge_id.in_(judge_ids)
            )
        )
        scores = scores_result.scalars().all()
        
        if not scores:
            continue
        
        # Aggregate by criterion
        criterion_scores = {}
        for s in scores:
            if s.criterion_id not in criterion_scores:
                criterion_scores[s.criterion_id] = []
            criterion_scores[s.criterion_id].append(s.score)
        
        # Calculate weighted total
        total_weighted = 0
        criteria_breakdown = []
        for crit in schema.criteria:
            if crit.id in criterion_scores:
                avg_score = sum(criterion_scores[crit.id]) / len(criterion_scores[crit.id])
                weighted = avg_score * crit.weight
                total_weighted += weighted
                criteria_breakdown.append({
                    "criterion_id": str(crit.id),
                    "name": crit.name,
                    "weight": crit.weight,
                    "avg_score": round(avg_score, 2),
                    "weighted_score": round(weighted, 2),
                })
        
        leaderboard.append({
            "participant_id": str(p.id),
            "name": f"{p.first_name} {p.last_name}",
            "team_name": p.team_name,
            "project_title": p.project_title,
            "total_weighted_score": round(total_weighted, 2),
            "judge_count": len(set(s.judge_id for s in scores)),
            "criteria_scores": criteria_breakdown,
        })
    
    # Sort by total weighted score
    leaderboard.sort(key=lambda x: x["total_weighted_score"], reverse=True)
    
    # Add rank
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1
    
    return leaderboard


@router.get("/{event_id}/leaderboard/by-category/{category_id}")
async def get_leaderboard_by_category(
    event_id: uuid.UUID,
    category_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get leaderboard for participants in a specific category.
    Used for track/session-based rankings.
    """
    config = await _get_hackathon_config(db, event_id)
    
    # Verify category exists
    category = await db.get(HackathonCategory, category_id)
    if not category or category.hackathon_id != config.id:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Get participants in this category
    members = await db.execute(
        select(CategoryParticipantMembership.participant_id)
        .where(CategoryParticipantMembership.category_id == category_id)
    )
    participant_ids = [m[0] for m in members.all()]
    
    if not participant_ids:
        return []
    
    # Get scoring schema
    schema = await db.execute(
        select(ScoringSchema)
        .options(selectinload(ScoringSchema.criteria))
        .where(ScoringSchema.hackathon_id == config.id)
    )
    schema = schema.scalar()
    if not schema:
        raise HTTPException(status_code=400, detail="No scoring schema configured")
    
    # Get participants
    participants = await db.execute(
        select(HackathonParticipant).where(HackathonParticipant.id.in_(participant_ids))
    )
    participants = participants.scalars().all()
    
    # Calculate scores for each participant
    leaderboard = []
    for p in participants:
        scores_result = await db.execute(
            select(ParticipantScore)
            .where(
                ParticipantScore.participant_id == p.id,
                ParticipantScore.is_draft == False
            )
        )
        scores = scores_result.scalars().all()
        
        if not scores:
            continue
        
        # Aggregate by criterion
        criterion_scores = {}
        for s in scores:
            if s.criterion_id not in criterion_scores:
                criterion_scores[s.criterion_id] = []
            criterion_scores[s.criterion_id].append(s.score)
        
        # Calculate weighted total
        total_weighted = 0
        criteria_breakdown = []
        for crit in schema.criteria:
            if crit.id in criterion_scores:
                avg_score = sum(criterion_scores[crit.id]) / len(criterion_scores[crit.id])
                weighted = avg_score * crit.weight
                total_weighted += weighted
                criteria_breakdown.append({
                    "criterion_id": str(crit.id),
                    "name": crit.name,
                    "weight": crit.weight,
                    "avg_score": round(avg_score, 2),
                    "weighted_score": round(weighted, 2),
                })
        
        leaderboard.append({
            "participant_id": str(p.id),
            "name": f"{p.first_name} {p.last_name}",
            "team_name": p.team_name,
            "project_title": p.project_title,
            "total_weighted_score": round(total_weighted, 2),
            "judge_count": len(set(s.judge_id for s in scores)),
            "criteria_scores": criteria_breakdown,
        })
    
    # Sort by total weighted score
    leaderboard.sort(key=lambda x: x["total_weighted_score"], reverse=True)
    
    # Add rank
    for i, entry in enumerate(leaderboard):
        entry["rank"] = i + 1
    
    return leaderboard


@router.post("/{event_id}/participants/manual")
async def add_participant_manual(
    event_id: uuid.UUID,
    body: ParticipantCreate,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add a single participant manually."""
    config = await _get_hackathon_config(db, event_id)

    # Check for duplicate email within this hackathon
    existing = await db.execute(
        select(HackathonParticipant).where(
            HackathonParticipant.hackathon_id == config.id,
            HackathonParticipant.email == body.email
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Participant with this email already exists")

    participant = HackathonParticipant(
        hackathon_id=config.id,
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        organization=body.organization,
        team_name=body.team_name,
        project_title=body.project_title,
        project_description=body.project_description,
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)
    return HackathonParticipantResponse.model_validate(participant)
