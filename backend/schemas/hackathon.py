from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from uuid import UUID


# ---- Scoring Criteria ----

class ScoringCriterionCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str = ""
    weight: float = Field(1.0, ge=0)
    min_score: float = Field(0, ge=0)
    max_score: float = Field(10, ge=0)
    order: int = 0
    rubric: Dict[str, Any] = {}

    @validator("max_score")
    def max_gt_min(cls, v, values):
        if "min_score" in values and v <= values["min_score"]:
            raise ValueError("max_score must be greater than min_score")
        return v


class ScoringCriterionResponse(BaseModel):
    id: UUID
    name: str
    description: str
    weight: float
    min_score: float
    max_score: float
    order: int
    rubric: Dict[str, Any]

    class Config:
        from_attributes = True


# ---- Scoring Schema ----

class ScoringSchemaCreate(BaseModel):
    criteria: List[ScoringCriterionCreate] = Field(..., min_items=1)


class ScoringSchemaResponse(BaseModel):
    id: UUID
    hackathon_id: UUID
    version: int
    is_locked: bool
    criteria: List[ScoringCriterionResponse] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---- Hackathon Config ----

class HackathonConfigResponse(BaseModel):
    id: UUID
    event_id: UUID
    judging_started_at: Optional[datetime] = None
    judging_ended_at: Optional[datetime] = None
    leaderboard_phase: str = "hidden"
    metadata_: Dict[str, Any] = {}
    created_at: Optional[datetime] = None
    participant_count: int = 0
    judge_count: int = 0
    schema_locked: bool = False

    class Config:
        from_attributes = True


# ---- Participants ----

class ParticipantCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    organization: Optional[str] = None
    team_name: Optional[str] = None
    project_title: Optional[str] = None
    project_description: Optional[str] = None


class HackathonParticipantResponse(BaseModel):
    id: UUID
    hackathon_id: UUID
    first_name: str
    last_name: str
    email: str
    organization: Optional[str] = None
    team_name: Optional[str] = None
    project_title: Optional[str] = None
    project_description: Optional[str] = None
    phone_number: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    theme: Optional[str] = None
    participant_type: Optional[str] = None
    occupation: Optional[str] = None
    department: Optional[str] = None
    major: Optional[str] = None
    position: Optional[str] = None
    specialization: Optional[str] = None
    metadata_: Dict[str, Any] = {}
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ColumnMapping(BaseModel):
    source_column: str
    target_field: str


class ParticipantUploadPreview(BaseModel):
    upload_batch_id: str
    total_rows: int
    inferred_mapping: Dict[str, str]  # source_col -> target_field
    unmapped_columns: List[str]
    preview_rows: List[Dict[str, Any]]
    filename: str


class ParticipantUploadConfirm(BaseModel):
    upload_batch_id: str
    column_mapping: Dict[str, str]  # source_col -> target_field


class ParticipantUploadResult(BaseModel):
    total_rows: int
    created: int
    skipped_duplicates: int
    errors: List[str] = []


# ---- Judges ----

class JudgeCreate(BaseModel):
    user_id: UUID
    display_name: Optional[str] = None


class JudgeResponse(BaseModel):
    id: UUID
    hackathon_id: UUID
    user_id: UUID
    display_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    assigned_count: int = 0
    scored_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class JudgeAssignmentCreate(BaseModel):
    participant_ids: List[UUID]


# ---- Scores ----

class ScoreItem(BaseModel):
    criterion_id: UUID
    score: float
    comment: Optional[str] = None


class ScoreSubmission(BaseModel):
    scores: List[ScoreItem]
    is_draft: bool = False


class ScoreResponse(BaseModel):
    id: UUID
    participant_id: UUID
    judge_id: UUID
    criterion_id: UUID
    score: float
    comment: Optional[str] = None
    is_draft: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---- Leaderboard ----

class CriterionScore(BaseModel):
    criterion_id: UUID
    criterion_name: str
    weight: float
    avg_score: float
    weighted_score: float


class LeaderboardEntry(BaseModel):
    participant_id: UUID
    first_name: str
    last_name: str
    email: str
    team_name: Optional[str] = None
    project_title: Optional[str] = None
    total_weighted_score: float
    rank: int
    criteria_scores: List[CriterionScore] = []
    judge_count: int = 0


# ---- Email ----

class HackathonEmailRequest(BaseModel):
    participant_ids: List[UUID]
    subject: str = Field(..., max_length=200)
    body: str
    meeting_link: Optional[str] = None


class HackathonEmailLogResponse(BaseModel):
    id: UUID
    hackathon_id: UUID
    subject: str
    body: str
    meeting_link: Optional[str] = None
    attachment_names: List[str] = []
    recipient_count: int = 0
    recipient_emails: List[str] = []
    sent_count: int = 0
    failed_count: int = 0
    sent_by: Optional[str] = None
    category_id: Optional[UUID] = None
    recipient_type: str = "participant"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---- Judge Progress ----

class JudgeProgress(BaseModel):
    judge_id: UUID
    display_name: Optional[str] = None
    assigned: int
    scored: int
    remaining: int
    progress_pct: float
