from pydantic import BaseModel, UUID4, HttpUrl, EmailStr, Field, validator, field_validator
from datetime import datetime, date
from typing import Optional, List, Dict, Any, Union
import uuid
import json

class UUIDEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle UUID objects."""
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

class Config(BaseModel):
    REQUEST_TIMEOUT: int
    MAX_WORKERS: int
    MAX_DEPTH: int
    MAX_URLS: int
    TIMEOUT_SECONDS: int
    ENABLE_005: Optional[bool] = False
    OCR_LANGUAGE: Optional[str] = "eng"
    GLOBAL_MAX_WORKERS: Optional[int] = None
    DDGS_MAX_RESULTS: Optional[int] = None
    SEARCH_MAX: Optional[int] = None
    MAX_LINKS_PER_PAGE: Optional[int] = None
    LAB_KEYWORDS: Optional[List[str]] = None
    EDUCATIONAL_DOMAINS: Optional[List[str]] = None

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}


class FeedbackRequest(BaseModel):
    name: Optional[str] = Field(None, description="Name of the user submitting feedback, if provided")
    email: Optional[EmailStr] = Field(None, description="Email address of the user submitting feedback, if provided")
    user_id: Optional[UUID4] = Field(None, description="ID of the user submitting feedback, if authenticated")
    feedback: str = Field(..., min_length=10, max_length=2000, description="Feedback or suggestion content")

    class Config:
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}

class QueryResponse(BaseModel):
    id: int
    session_id: UUID4
    query_text: str
    timestamp: datetime

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}

class DeleteSessionResponse(BaseModel):
    message: str

class EntityImageResponse(BaseModel):
    id: int
    entity_id: Optional[UUID4] = None
    url: HttpUrl
    caption: Optional[str] = None
    is_primary: bool = False
    uploaded_by_user_id: Optional[UUID4] = None
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}


class UserEntityLinkResponse(BaseModel):
    id: int
    user_id: UUID4
    entity_id: UUID4
    interaction_type: str = "viewed"
    notes: str = ""
    metadata_: Dict[str, Any] = {}
    timestamp: datetime

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}


class ProfileResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    is_default: bool = False

    # Personal identity fields
    display_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None  # or HttpUrl if you want validation
    
    # Role-specific info
    type: str
    title: Optional[str] = None
    organization: Optional[str] = None
    bio: str = ""
    
    # Structured fields
    location: Dict[str, Any] = {}
    social_links: Dict[str, Any] = {}
    expertise: List[str] = []
    profile_image: Optional[str] = None
    metadata_: Dict[str, Any] = {}
    
    # Timestamps
    created_at: datetime

    class Config:
        from_attributes = True  # replaces orm_mode in Pydantic v2
        populate_by_name = True  # allows use of alias "metadata" for metadata_
        
        # Custom JSON encoders for clean output
        json_encoders = {
            UUID4: str,
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat() if v else None,
        }

        
class FunderResponse(BaseModel):
    id: UUID4
    name: str
    website: Optional[str] = ""
    contact: Dict[str, Any] = {}
    profile: str = ""
    org_type: str = "vc"
    regions: List[str] = []
    thematic_focus: List[str] = []
    min_ticket: Optional[int] = None
    max_ticket: Optional[int] = None
    created_at: datetime
    last_seen: Optional[datetime] = None
    verified: bool = False
    metadata_: Dict[str, Any] = {}
    profile_id: Optional[UUID4] = None
    investment_history: List[Dict[str, Any]] = []

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}

class ProposalResponse(BaseModel):
    id: UUID4
    entity_id: UUID4
    funder_id: Optional[UUID4] = None
    title: str
    summary: str = ""
    ask_amount: Optional[int] = None
    equity_seek: Optional[float] = None
    stage: str = "early"
    documents: List[str] = []
    status: str = "open"
    created_at: datetime
    last_updated: datetime
    climate_focus: List[str] = []

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}



class VerificationResponse(BaseModel):
    id: int
    entity_id: UUID4
    verifier: Optional[str] = None
    verified_at: datetime
    level: str = "basic"
    notes: str = ""
    documents: List[str] = []

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}

class EntityEmbeddingResponse(BaseModel):
    id: int
    entity_id: UUID4
    model: str
    vector: List[float]
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}


class PublicationCreate(BaseModel):
    entity_id: Optional[UUID4] = None
    title: str
    abstract: str = ""
    authors: List[str] = []
    doi: Optional[str] = None
    publication_date: Optional[date] = None
    journal: Optional[str] = None
    keywords: List[str] = []
    pdf_url: Optional[HttpUrl] = None


class PublicationResponse(BaseModel):
    id: UUID4
    entity_id: Optional[UUID4] = None
    title: str
    abstract: str = ""
    authors: List[str] = []
    doi: Optional[str] = None
    publication_date: Optional[date] = None
    journal: Optional[str] = None
    keywords: List[str] = []
    pdf_url: Optional[HttpUrl] = None
    citation_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}

class NotificationCreate(BaseModel):
    user_id: UUID4
    type: str
    content: str
    related_id: Optional[Union[int, UUID4]] = None 

class NotificationResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    type: str
    content: str
    related_id: Optional[Union[int, UUID4]] = None
    is_read: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            UUID4: str,
            datetime: lambda v: v.isoformat()
        }


class MessageResponse(BaseModel):
    id: UUID4
    sender_profile_id: UUID4
    receiver_profile_id: UUID4
    content: str
    is_read: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}


class MatchRecordResponse(BaseModel):
    id: int
    funder_id: UUID4
    entity_id: UUID4
    funder: Optional[FunderResponse] = None  # Made optional to avoid breaking existing uses
    score: float
    reason: Optional[str] = None
    status: str = "suggested"
    created_at: datetime
    last_updated: Optional[datetime] = None  # Made optional to avoid breaking existing uses
    metadata_: Dict[str, Any] = {}

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}



class EntityResponse(BaseModel):
    id: UUID4
    url: Optional[HttpUrl] = None
    source: str = "scraped"
    created_by_user_id: Optional[UUID4] = None
    profile_id: Optional[UUID4] = None
    profile: Optional['ProfileResponse'] = None
    university: str = ""
    location: Dict[str, Any] = {}
    website: Optional[HttpUrl] = None
    edurank: Dict[str, Any] = {}
    department: Dict[str, Any] = {}
    publications_meta: Dict[str, Any] = {}
    related: str = ""
    point_of_contact: Dict[str, Any] = {}
    scopes: List[str] = []
    research_abstract: str = ""
    lab_equipment: Dict[str, Any] = {}
    climate_tech_focus: Optional[Union[List[str], dict]] = None
    climate_impact_metrics: Dict[str, Any] = {}
    timestamp: datetime
    last_updated: datetime
    embeddings: Dict[str, Any] | List[float] | None = None
    images: List[EntityImageResponse] = []
    user_interactions: List[UserEntityLinkResponse] = []
    proposals: List[ProposalResponse] = []
    match_records: List[MatchRecordResponse] = []
    verifications: List[VerificationResponse] = []
    embeddings_records: List[EntityEmbeddingResponse] = []
    publications_list: List[PublicationResponse] = Field(default=[], alias="publications")

    university_favicon: Optional[str] = None
    source_favicon: Optional[str] = None


    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}

    @field_validator("website", mode="before")
    def normalize_website(cls, v):
        """
        Normalize or clean the website field before validation.
        - Converts empty strings to None
        - Adds https:// prefix if missing
        """
        if not v:  # catches None, '', etc.
            return None
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return None
            if not v.startswith(("http://", "https://")):
                v = "https://" + v
        return v



class EntityImageCreate(BaseModel):
    url: str
    caption: Optional[str] = None
    is_primary: bool = False


class EntityBase(BaseModel):
    url: Optional[HttpUrl] = None
    profile_id: Optional[UUID4] = None
    university: Optional[str] = ""
    location: Optional[Dict[str, Any]] = {}
    website: Optional[HttpUrl] = None
    edurank: Optional[Dict[str, Any]] = {}
    department: Optional[Dict[str, Any]] = {}
    publications_meta: Optional[Dict[str, Any]] = {}
    related: Optional[str] = ""
    point_of_contact: Optional[Dict[str, Any]] = {}
    scopes: Optional[List[str]] = []
    research_abstract: Optional[str] = ""
    lab_equipment: Optional[Dict[str, Any]] = {}
    climate_tech_focus: Optional[List[str]] = []
    climate_impact_metrics: Optional[Dict[str, Any]] = {}
    embeddings: Optional[Dict[str, Any]] = {}
    images: Optional[List[EntityImageCreate]] = []

class EntityCreate(EntityBase):
    university: str  # Required for creation
    research_abstract: str  # Required for creation

class EntityUpdate(EntityBase):
    pass
        


class MatchRecordWithEntityResponse(MatchRecordResponse):
    entity: Optional[EntityResponse] = None
    proposal_count: int = 0
    last_interaction: Optional[datetime] = None
    favorite: bool = False

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}


class SessionResponse(BaseModel):
    id: UUID4
    user_id: Optional[UUID4] = None
    title: str = "Untitled Session"
    description: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str = "running"
    is_active: bool = True
    metadata_: Dict[str, Any] = {}
    queries: List[QueryResponse] = []
    entities: List[EntityResponse] = []

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}

class UserResponse(BaseModel):
    id: UUID4
    username: str
    email: EmailStr
    profile_image_url: Optional[HttpUrl] = None
    sessions: List[SessionResponse] = []
    entity_links: List[UserEntityLinkResponse] = []
    created_entities: List[EntityResponse] = []
    profiles: List[ProfileResponse] = []
    notifications: List[NotificationResponse] = []

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}


class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: UUID4
    username: str
    email: str
    is_admin: bool = False
    profile_image_url: Optional[str] = None
    profiles: List['ProfileResponse'] = []
    default_profile_id: Optional[UUID4] = None


class SignupCredentials(BaseModel):
    username: str
    email: EmailStr
    password: str
    recaptcha_response: str = Field(validation_alias='recaptchaResponse')


class UserCredentials(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: str
    recaptcha_response: str = Field(validation_alias='recaptchaResponse')


class InquiryRequest(BaseModel):
    user_id: UUID4
    entity_ids: Optional[List[UUID4]] = None
    entity_urls: Optional[List[str]] = None
    inquiry: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    recaptcha_response: str = Field(validation_alias='recaptchaResponse')


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    recaptcha_response: str = Field(validation_alias='recaptchaResponse')


class PasswordResetResponse(BaseModel):
    message: str
    email_sent: bool


class CompleteRegistrationRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class CompleteRegistrationResponse(BaseModel):
    message: str
    redirect_url: Optional[str] = None


class PartnerCreate(BaseModel):
    name: str
    description: str = ""
    website: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    sector_focus: List[str] = []
    country: Optional[str] = None
    region: Optional[str] = None
    organization_type: Optional[str] = None
    social_links: Dict[str, str] = {}


class PartnerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    sector_focus: Optional[List[str]] = None
    country: Optional[str] = None
    region: Optional[str] = None
    organization_type: Optional[str] = None
    social_links: Optional[Dict[str, str]] = None


class PartnerOwnerInfo(BaseModel):
    id: UUID4
    username: str

    class Config:
        from_attributes = True


class PartnerResponse(BaseModel):
    id: UUID4
    name: str
    slug: str
    description: str = ""
    website: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    contact_email: Optional[str] = None
    sector_focus: List[str] = []
    country: Optional[str] = None
    region: Optional[str] = None
    social_links: Dict[str, str] = {}
    status: str = "pending"
    is_verified: bool = False
    is_featured: bool = False
    organization_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    member_count: int = 0
    lab_count: int = 0
    created_at: datetime
    owner: Optional[PartnerOwnerInfo] = None

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}


class PaginatedPartnerResponse(BaseModel):
    items: List[PartnerResponse]
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_prev: bool


class PartnerMemberResponse(BaseModel):
    id: UUID4
    user_id: UUID4
    username: str = ""
    email: str = ""
    role: str = "viewer"
    joined_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}


class PartnerInviteRequest(BaseModel):
    email: EmailStr
    role: str = "viewer"


class PartnerEntityAssign(BaseModel):
    entity_id: UUID4


class PartnerEntityBulkAssign(BaseModel):
    entity_ids: List[UUID4]


class PartnerEntityResponse(BaseModel):
    id: UUID4
    partner_id: UUID4
    entity_id: UUID4
    assigned_by_user_id: Optional[UUID4] = None
    assigned_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {UUID4: str, datetime: lambda v: v.isoformat()}