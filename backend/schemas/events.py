from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator, HttpUrl
from uuid import UUID
import pytz
from datetime import timezone

from models.db_models import LocationType


class AdditionalLink(BaseModel):
    """Schema for additional event links with metadata"""
    url: str = Field(..., max_length=500)
    title: str = Field(..., max_length=100)
    description: Optional[str] = Field(None, max_length=200)
    icon_url: Optional[str] = None  # Favicon or custom icon URL

    @validator('url')
    def validate_url(cls, v):
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError("URL must start with http:// or https://")
        return v


class EventBase(BaseModel):
    title: str = Field(..., max_length=200)
    description: str
    short_description: str = Field(..., max_length=150)
    event_datetime: datetime
    timezone: str
    location_type: LocationType
    physical_location: Optional[str] = None
    virtual_link: Optional[str] = None
    virtual_link_description: Optional[str] = Field(None, max_length=200)
    registration_url: Optional[str] = None
    additional_links: List[AdditionalLink] = Field(default_factory=list)
    featured_image_url: Optional[str] = None
    banner_image_url: Optional[str] = None
    is_featured: bool = False
    priority: int = Field(0, ge=0, le=100)
    
    @validator('timezone')
    def validate_timezone(cls, v):
        if v not in pytz.all_timezones:
            raise ValueError(f"Invalid timezone. Must be a valid IANA timezone.")
        return v
    
    @validator('physical_location')
    def validate_physical_location(cls, v, values):
        if values.get('location_type') == LocationType.PHYSICAL and not v:
            raise ValueError("Physical location is required for physical events")
        return v
    
    @validator('virtual_link')
    def validate_virtual_link(cls, v, values):
        if not v:
            # If empty string or None, set to None
            return None
        if values.get('location_type') in [LocationType.VIRTUAL, LocationType.HYBRID] and not v:
            raise ValueError("Virtual link is required for virtual or hybrid events")
        # Validate URL format
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError("Virtual link must be a valid URL starting with http:// or https://")
        return v
    
    @validator('registration_url')
    def validate_registration_url(cls, v):
        if not v:
            return None
        # Validate URL format
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError("Registration URL must be a valid URL starting with http:// or https://")
        return v


class EventCreate(EventBase):
    categories: List[UUID] = Field(default_factory=list)
    
    @validator('event_datetime')
    def validate_future_date(cls, v):
        if v < datetime.now(timezone.utc):
            raise ValueError("Event datetime must be in the future")
        return v


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    short_description: Optional[str] = Field(None, max_length=150)
    event_datetime: Optional[datetime] = None
    timezone: Optional[str] = None
    location_type: Optional[LocationType] = None
    physical_location: Optional[str] = None
    virtual_link: Optional[str] = None
    virtual_link_description: Optional[str] = Field(None, max_length=200)
    registration_url: Optional[str] = None
    additional_links: Optional[List[AdditionalLink]] = None
    featured_image_url: Optional[str] = None
    banner_image_url: Optional[str] = None
    is_featured: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=0, le=100)
    categories: Optional[List[UUID]] = None


class EventPublic(BaseModel):
    id: UUID
    title: str
    slug: str
    description: str
    short_description: str
    event_datetime: datetime
    timezone: str
    location_type: LocationType
    physical_location: Optional[str]
    virtual_link: Optional[str]
    virtual_link_description: Optional[str]
    registration_url: Optional[str]
    additional_links: Optional[List[dict]] = []
    featured_image_url: Optional[str]
    banner_image_url: Optional[str]
    is_featured: bool
    categories: List[dict]
    created_at: datetime
    updated_at: Optional[datetime]

    @validator('additional_links', pre=True, always=True)
    def default_additional_links(cls, v):
        return v if v is not None else []

    class Config:
        from_attributes = True


class EventAdmin(EventPublic):
    is_published: bool
    is_hackathon: bool = False
    published_at: Optional[datetime]
    created_by: Optional[UUID]
    
    class Config:
        from_attributes = True


class EventBanner(BaseModel):
    id: UUID
    title: str
    slug: str
    short_description: str
    event_datetime: datetime
    location_type: LocationType
    banner_image_url: Optional[str]
    registration_url: Optional[str]
    
    class Config:
        from_attributes = True


class EventCategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    color_code: str = Field("#000000", pattern="^#[0-9A-Fa-f]{6}$")
    description: Optional[str] = None


class EventCategoryCreate(EventCategoryBase):
    pass


class EventCategoryResponse(EventCategoryBase):
    id: UUID
    slug: str
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


from typing import Optional, List, Generic, TypeVar

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    pages: int


class EventStats(BaseModel):
    total_events: int
    published_events: int
    upcoming_events: int
    featured_events: int
    recent_events: int  # Events created in last 7 days


class EventRegistrationBase(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: str = Field(..., max_length=255)
    position: Optional[str] = Field(None, max_length=255)
    organization: Optional[str] = Field(None, max_length=255)
    participation_type: str = Field('attendee', max_length=50)
    attendance_type: str = Field('on_site', max_length=50)
    ticket_type: Optional[str] = Field(None, max_length=50)
    wants_profile_visible: bool = Field(True)
    profile_visibility_types: List[str] = Field(default_factory=list)
    special_requirements: Optional[str] = Field(None)
    create_account: bool = Field(False)
    metadata_: Optional[dict] = Field(default_factory=dict)


class EventRegistrationCreate(EventRegistrationBase):
    event_id: UUID
    pass


class EventRegistrationResponse(EventRegistrationBase):
    id: UUID
    event_id: UUID
    profile_id: Optional[UUID]
    status: str
    registration_date: datetime
    checked_in_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]


class EventRegistrationAdminResponse(EventRegistrationResponse):
    profile_name: Optional[str]
    profile_type: Optional[str]
    user_email: Optional[str]


class ImportAttendeeData(BaseModel):
    first_name: str
    last_name: str
    email: str
    position: Optional[str] = None
    organization: Optional[str] = None
    participation_type: Optional[str] = 'attendee'
    attendance_type: Optional[str] = 'on_site'


class ImportAttendeesRequest(BaseModel):
    event_id: UUID
    attendees: List[ImportAttendeeData]


class ImportAttendeesResponse(BaseModel):
    created: int
    updated: int
    existing: int
    errors: int


class EventRegistrationFullResponse(EventRegistrationResponse):
    message: str
    redirect_url: Optional[str] = None
    registration_type: str  # 'full', 'profile_first', 'anonymous', 'basic'


class EventRegistrationUpdate(BaseModel):
    """Schema for updating user's own registration"""
    position: Optional[str] = Field(None, max_length=255)
    organization: Optional[str] = Field(None, max_length=255)
    participation_type: Optional[str] = Field(None, max_length=50)
    attendance_type: Optional[str] = Field(None, max_length=50)
    special_requirements: Optional[str] = None
    wants_profile_visible: Optional[bool] = None


class EventParticipantResponse(BaseModel):
    """Public participant information for event pages"""
    first_name: str
    last_name: str
    organization: Optional[str]
    title: Optional[str]
    participation_type: str
    profile_image: Optional[str]
    registration_date: datetime
    
    class Config:
        from_attributes = True