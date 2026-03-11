from datetime import datetime
import uuid
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Index, func, Float, ARRAY, Date, Enum
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, TSVECTOR
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, relationship
from .mixins import TimestampMixin

from sqlalchemy.sql import func
from enum import Enum as PyEnum


class Base(AsyncAttrs, DeclarativeBase):
    pass


class User(Base, TimestampMixin):
    """User account."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    profile_image_url = Column(String, nullable=True)

    # relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    entity_links = relationship("UserEntityLink", back_populates="user", cascade="all, delete-orphan")
    created_entities = relationship("Entity", back_populates="created_by_user")
    uploaded_images = relationship("EntityImage", back_populates="uploaded_by_user", cascade="all, delete-orphan")
    profiles = relationship("Profile", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", foreign_keys="[Notification.user_id]")
    password_resets = relationship("PasswordReset", back_populates="user", cascade="all, delete-orphan")
    partner_memberships = relationship("PartnerMember", back_populates="user")
    is_suspended = Column(Boolean, default=False, nullable=False, server_default='false')
    suspended_at = Column(DateTime, nullable=True)
    suspension_reason = Column(String, nullable=True)

    hackathon_judge_roles = relationship("HackathonJudge", back_populates="user")
    lab_likes = relationship("LabLike", back_populates="user", cascade="all, delete-orphan")
    lab_comments = relationship("LabComment", back_populates="user", cascade="all, delete-orphan")


class Profile(Base, TimestampMixin):
    """
    Represents role-specific identities under a User.
    Examples: lab manager, entrepreneur, academic, funder, etc.
    """
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_default = Column(Boolean, nullable=False, default=False, server_default='false')

    # --- Personal identity ---
    display_name = Column(String, nullable=True)  # "What should we call you?"
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)

    date_of_birth = Column(Date, nullable=True)
    gender = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    website = Column(String, nullable=True)

    # --- Role-specific info ---
    type = Column(String, nullable=False)  # 'lab', 'entrepreneur', 'academic', 'funder'
    title = Column(String, nullable=True)
    organization = Column(String, nullable=True)
    bio = Column(Text, default="")

# --- Structured & flexible fields ---
    location = Column(JSONB, default=dict)
    social_links = Column(JSONB, default=dict)
    expertise = Column(JSONB, default=list)
    metadata_ = Column(JSONB, default=dict)
    
    # --- Import tracking ---
    invitation_status = Column(String, default="pending", nullable=False)  # 'pending', 'accepted', 'declined', 'expired'
    invitation_token = Column(String(255), nullable=True, index=True)
    invitation_sent_at = Column(DateTime, nullable=True)
    invitation_responded_at = Column(DateTime, nullable=True)
    import_batch_id = Column(String, nullable=True, index=True)  # Track batch imports

    profile_image = Column(String, nullable=True)

    # --- Relationships ---
    user = relationship("User", back_populates="profiles")

    backlinks = relationship(
        "ProfileBacklink",
        back_populates="source_profile",
        cascade="all, delete-orphan",
        foreign_keys="ProfileBacklink.source_profile_id"
    )
    connected_backlinks = relationship(
        "ProfileBacklink",
        back_populates="target_profile",
        foreign_keys="ProfileBacklink.target_profile_id"
    )

    ecosystem_links = relationship(
        "EcosystemEntityLink",
        back_populates="profile",
        cascade="all, delete-orphan"
    )

    funder = relationship("Funder", back_populates="funder_profile")
    sent_messages = relationship("Message", back_populates="sender", foreign_keys="Message.sender_profile_id")
    received_messages = relationship("Message", back_populates="receiver", foreign_keys="Message.receiver_profile_id")
    event_registrations = relationship("EventRegistration", back_populates="profile")


class ProfileBacklink(Base, TimestampMixin):
    """
    Connects profiles within the ecosystem — used for collaboration, mentorship,
    investment, and 'You may want to talk to...' recommendations.
    """
    __tablename__ = "profile_backlinks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    target_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    link_type = Column(String, default="collaboration")  # 'collaboration', 'mentorship', 'funding', 'academic-partner', etc.
    context = Column(Text, default="")
    weight = Column(Integer, default=1)
    metadata_ = Column(JSONB, default=dict)

    source_profile = relationship("Profile", back_populates="backlinks", foreign_keys=[source_profile_id])
    target_profile = relationship("Profile", back_populates="connected_backlinks", foreign_keys=[target_profile_id])


class Session(Base, TimestampMixin):
    """Tracks scraping/searching sessions for users."""
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String, nullable=False, server_default="Untitled Session")
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False, server_default=func.now())
    end_time = Column(DateTime, nullable=True)
    status = Column(String, nullable=False, default="running")
    is_active = Column(Boolean, default=True)
    metadata_ = Column(JSONB, default=dict)

    queries = relationship("Query", back_populates="session", cascade="all, delete-orphan")
    session_entities = relationship("SessionEntity", back_populates="session", cascade="all, delete-orphan")
    entities = relationship("Entity", secondary="session_entities", viewonly=True)
    user = relationship("User", back_populates="sessions")
    shared_sessions = relationship("SharedSession", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_sessions_user_id_start_time_active', 'user_id', 'start_time', 'is_active'),
    )


class Query(Base, TimestampMixin):
    """Stores user queries submitted during a session (e.g., via WebSocket)."""
    __tablename__ = "queries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    query_text = Column(Text, nullable=False)
    timestamp = Column(DateTime, nullable=False, server_default=func.now(), index=True)

    session = relationship("Session", back_populates="queries")


class Entity(Base, TimestampMixin):
    """
    Global, deduplicated entity record (scraped results or user-created).
    Represents labs, startups, or academic groups.
    """
    __tablename__ = "entities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(String, unique=True, nullable=True, index=True)
    source = Column(String, default="scraped")
    entity_type = Column(String, default="lab")  # 'lab', 'startup', 'organization', 'university'
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True, index=True)

    university = Column(Text, default="")
    location = Column(JSONB, default=dict)
    website = Column(String, default="")
    edurank = Column(JSONB, default=dict)
    department = Column(JSONB, default=dict)
    publications_meta = Column(JSONB, default=dict)
    related = Column(Text, default="")
    point_of_contact = Column(JSONB, default=dict)
    scopes = Column(JSONB, default=list)
    research_abstract = Column(Text, default="")
    lab_equipment = Column(JSONB, default=dict)
    climate_tech_focus = Column(JSONB, default=list)  # Added: e.g., ['carbon_capture', 'renewable_energy']
    climate_impact_metrics = Column(JSONB, default=dict)  # Added: e.g., {'co2_reduced': 1000, 'projects': 5}
    tsv_document = Column(TSVECTOR)  # Added for full-text search
    like_count = Column(Integer, default=0, nullable=False, server_default="0")
    comment_count = Column(Integer, default=0, nullable=False, server_default="0")
    share_count = Column(Integer, default=0, nullable=False, server_default="0")
    view_count = Column(Integer, default=0, nullable=False, server_default="0")

    timestamp = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    last_updated = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), index=True)
    embeddings = Column(JSONB, default=dict)

    created_by_user = relationship("User", back_populates="created_entities")
    profile = relationship("Profile", foreign_keys=[profile_id], backref="entities")
    user_links = relationship("UserEntityLink", back_populates="entity", cascade="all, delete-orphan")
    session_entities = relationship("SessionEntity", back_populates="entity", cascade="all, delete-orphan")
    images = relationship("EntityImage", back_populates="entity", cascade="all, delete-orphan")
    ecosystem_links = relationship("EcosystemEntityLink", back_populates="entity", cascade="all, delete-orphan")
    proposals = relationship("Proposal", back_populates="entity", cascade="all, delete-orphan")
    match_records = relationship("MatchRecord", back_populates="entity", cascade="all, delete-orphan")
    verifications = relationship("Verification", back_populates="entity", cascade="all, delete-orphan")
    embeddings_records = relationship("EntityEmbedding", back_populates="entity", cascade="all, delete-orphan")
    publication_objects = relationship("Publication", back_populates="entity", cascade="all, delete-orphan")  # Added relationship
    partner_entities = relationship("PartnerEntity", back_populates="entity", cascade="all, delete-orphan")
    likes = relationship("LabLike", back_populates="entity", cascade="all, delete-orphan")
    comments = relationship("LabComment", back_populates="entity", cascade="all, delete-orphan")
    shares = relationship("LabShare", back_populates="entity", cascade="all, delete-orphan")

    def set_json_field(self, field_name: str, value):
        setattr(self, field_name, value)

    def get_json_field(self, field_name: str):
        value = getattr(self, field_name)
        if value is None:
            # Return appropriate type depending on field
            list_fields = {"scopes", "climate_tech_focus"}
            return [] if field_name in list_fields else {}
        return value



class EntityImage(Base, TimestampMixin):
    """Stores image URLs related to an Entity (lab/startup)."""
    __tablename__ = "entity_images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String, nullable=False)
    caption = Column(String, nullable=True)
    is_primary = Column(Boolean, default=False)
    uploaded_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    entity = relationship("Entity", back_populates="images")
    uploaded_by_user = relationship("User", back_populates="uploaded_images")


class EcosystemEntityLink(Base, TimestampMixin):
    """
    Links a profile (entrepreneur, academic, etc.) to an Entity (lab/startup).
    Supports the Climatech ecosystem mapping feature.
    """
    __tablename__ = "ecosystem_entity_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, default="collaborator")  # e.g., 'founder', 'researcher', 'funder', etc.
    context = Column(Text, default="")
    metadata_ = Column(JSONB, default=dict)

    profile = relationship("Profile", back_populates="ecosystem_links")
    entity = relationship("Entity", back_populates="ecosystem_links")


class UserEntityLink(Base, TimestampMixin):
    """User interactions with Entities."""
    __tablename__ = "user_entity_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    interaction_type = Column(String, nullable=False, default="viewed")
    notes = Column(Text, default="")
    metadata_ = Column(JSONB, default=dict)
    timestamp = Column(DateTime, nullable=False, server_default=func.now(), index=True)

    __table_args__ = (
        Index('ix_user_entity_links_user_id_interaction_type', 'user_id', 'interaction_type'),
        Index('ix_user_entity_links_user_id_timestamp', 'user_id', 'timestamp'),
    )

    user = relationship("User", back_populates="entity_links")
    entity = relationship("Entity", back_populates="user_links")


class SessionEntity(Base, TimestampMixin):
    """Links Entities returned in a Session."""
    __tablename__ = "session_entities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(String, nullable=True)
    timestamp = Column(DateTime, nullable=False, server_default=func.now(), index=True)

    __table_args__ = (
        Index('ix_session_entities_session_id_timestamp', 'session_id', 'timestamp'),
    )

    session = relationship("Session", back_populates="session_entities")
    entity = relationship("Entity", back_populates="session_entities")


class SharedSession(Base, TimestampMixin):
    """Stores a snapshot of a session for read-only shares."""
    __tablename__ = "shared_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    snapshot = Column(JSONB, default=dict)

    session = relationship("Session", back_populates="shared_sessions")


class Funder(Base, TimestampMixin):
    __tablename__ = "funders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True)
    website = Column(String, default="")
    contact = Column(JSONB, default=dict)  # e.g., {"email":..., "phone":...}
    profile = Column(Text, default="")
    org_type = Column(String, default="vc")  # vc | angel | gov | foundation | corporate
    regions = Column(JSONB, default=list)  # list of supported regions/countries
    thematic_focus = Column(JSONB, default=list)  # climate, health, agri, etc.
    min_ticket = Column(Integer, nullable=True)
    max_ticket = Column(Integer, nullable=True)
    last_seen = Column(DateTime, nullable=True)
    verified = Column(Boolean, default=False)
    metadata_ = Column(JSONB, default=dict)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)  # Link to Profile if funder is a user
    investment_history = Column(JSONB, default=list)  # Added: list of past investments
    embeddings = Column(JSONB, default=dict)

    # relationships
    proposals = relationship("Proposal", back_populates="funder", cascade="all, delete-orphan")
    matches = relationship("MatchRecord", back_populates="funder", cascade="all, delete-orphan")
    funder_profile = relationship("Profile", back_populates="funder")


class Proposal(Base, TimestampMixin):
    __tablename__ = "proposals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    funder_id = Column(UUID(as_uuid=True), ForeignKey("funders.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String, nullable=False)
    summary = Column(Text, default="")
    ask_amount = Column(Integer, nullable=True)
    equity_seek = Column(Float, nullable=True)
    stage = Column(String, default="early")  # pre-seed | seed | series_a | later
    documents = Column(JSONB, default=list)  # urls to PDFs / pitch decks
    status = Column(String, default="open")  # open | closed | funded | withdrawn
    climate_focus = Column(JSONB, default=list)  # Added: specific climate areas
    tsv_document = Column(TSVECTOR)  # Added for full-text search

    entity = relationship("Entity", back_populates="proposals")
    funder = relationship("Funder", back_populates="proposals")


class MatchRecord(Base, TimestampMixin):
    __tablename__ = "match_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    funder_id = Column(UUID(as_uuid=True), ForeignKey("funders.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Float, nullable=False)  # computed match score
    reason = Column(Text, nullable=True)  # short explanation
    status = Column(String, default="suggested")  # suggested | contacted | interested | declined | funded
    metadata_ = Column(JSONB, default=dict)

    funder = relationship("Funder", back_populates="matches")
    entity = relationship("Entity", back_populates="match_records")


class Verification(Base, TimestampMixin):
    __tablename__ = "verifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    verifier = Column(String, nullable=True)  # org or user that verified
    verified_at = Column(DateTime, nullable=False, server_default=func.now())
    level = Column(String, default="basic")  # basic | document | onsite
    notes = Column(Text, default="")
    documents = Column(JSONB, default=list)

    entity = relationship("Entity", back_populates="verifications")


class EntityEmbedding(Base, TimestampMixin):
    __tablename__ = "entity_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    model = Column(String, nullable=False)  # e.g., "text-embedding-3-large"
    vector = Column(ARRAY(Float))  # Fallback to ARRAY for vector

    entity = relationship("Entity", back_populates="embeddings_records")


class Publication(Base, TimestampMixin):
    __tablename__ = "publications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String, nullable=False, index=True)
    abstract = Column(Text, default="")
    authors = Column(JSONB, default=list)
    doi = Column(String, unique=True, nullable=True)
    publication_date = Column(DateTime, nullable=True)
    journal = Column(String, nullable=True)
    keywords = Column(JSONB, default=list)
    pdf_url = Column(String, nullable=True)
    citation_count = Column(Integer, default=0)
    tsv_document = Column(TSVECTOR)  # For full-text search

    entity = relationship("Entity", back_populates="publication_objects")


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False)  # 'match_suggested', 'proposal_update', 'message'
    content = Column(Text, nullable=False)
    related_id = Column(UUID(as_uuid=True), nullable=True)  # e.g., match_id or proposal_id
    is_read = Column(Boolean, default=False)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    group_key = Column(String, nullable=True, index=True)  # e.g. "lab_liked:<entity_id>" for grouping

    user = relationship("User", back_populates="notifications", foreign_keys=[user_id])
    actor = relationship("User", foreign_keys=[actor_user_id])


class NotificationPreference(Base):
    """Per-user notification preferences (Feature 3.3.3)."""
    __tablename__ = "notification_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    like_in_app = Column(Boolean, default=True, nullable=False)
    like_email = Column(Boolean, default=False, nullable=False)
    comment_in_app = Column(Boolean, default=True, nullable=False)
    comment_email = Column(Boolean, default=False, nullable=False)
    reply_in_app = Column(Boolean, default=True, nullable=False)
    reply_email = Column(Boolean, default=False, nullable=False)
    follow_in_app = Column(Boolean, default=True, nullable=False)
    follow_email = Column(Boolean, default=False, nullable=False)
    share_in_app = Column(Boolean, default=True, nullable=False)
    share_email = Column(Boolean, default=False, nullable=False)
    partner_in_app = Column(Boolean, default=True, nullable=False)
    partner_email = Column(Boolean, default=True, nullable=False)
    new_lab_in_app = Column(Boolean, default=True, nullable=False)
    new_lab_email = Column(Boolean, default=False, nullable=False)

    user = relationship("User")



class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    receiver_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=True)  # Nullable for media-only messages
    message_type = Column(String, default="text")  # 'text', 'image', 'document', 'video'
    metadata_ = Column(JSONB, default=dict)  # File size, mime type, dimensions, etc.
    is_read = Column(Boolean, default=False)
    is_delivered = Column(Boolean, default=False)
    encrypted = Column(Boolean, default=False)

    # Relationships
    sender = relationship("Profile", back_populates="sent_messages", foreign_keys=[sender_profile_id])
    receiver = relationship("Profile", back_populates="received_messages", foreign_keys=[receiver_profile_id])
    attachments = relationship("MessageAttachment", back_populates="message", cascade="all, delete-orphan")

class MessageAttachment(Base, TimestampMixin):
    __tablename__ = "message_attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    file_key = Column(String, nullable=False)  # Backblaze B2 object key
    file_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)  # in bytes
    mime_type = Column(String, nullable=False)
    thumbnail_key = Column(String, nullable=True)  # For images/videos
    is_encrypted = Column(Boolean, default=False)

    message = relationship("Message", back_populates="attachments")


# Events
class LocationType(str, PyEnum):
    PHYSICAL = "physical"
    VIRTUAL = "virtual"
    HYBRID = "hybrid"


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)
    short_description = Column(String(150), nullable=False)
    event_datetime = Column(DateTime(timezone=True), nullable=False)
    timezone = Column(String(50), nullable=False)  # IANA timezone
    location_type = Column(Enum(LocationType), nullable=False)
    physical_location = Column(String(500), nullable=True)
    virtual_link = Column(String(500), nullable=True)
    virtual_link_description = Column(String(200), nullable=True)  # Short description for virtual link
    registration_url = Column(String(500), nullable=True)
    additional_links = Column(JSONB, default=list)  # Array of {url, title, description, icon_url}
    featured_image_url = Column(String(500), nullable=True)
    banner_image_url = Column(String(500), nullable=True)
    is_published = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    is_hackathon = Column(Boolean, default=False, server_default="false")
    priority = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    
    # Relationships
    categories = relationship("EventCategory", secondary="event_category_mapping", back_populates="events")
    creator = relationship("User")
    registrations = relationship("EventRegistration", back_populates="event")
    hackathon_config = relationship("HackathonConfig", back_populates="event", uselist=False)
    
    def __repr__(self):
        return f"<Event {self.title} ({self.slug})>"


class EventCategory(Base):
    __tablename__ = "event_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    color_code = Column(String(7), nullable=False, default="#000000")  # Hex color
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    events = relationship("Event", secondary="event_category_mapping", back_populates="categories")
    
    def __repr__(self):
        return f"<EventCategory {self.name}>"


class EventCategoryMapping(Base):
    __tablename__ = "event_category_mapping"

    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("event_categories.id", ondelete="CASCADE"), primary_key=True)
    
    def __repr__(self):
        return f"<EventCategoryMapping event:{self.event_id} category:{self.category_id}>"


class EventRegistration(Base, TimestampMixin):
    """Event registrations with optional profile linking (profile-first approach)."""
    __tablename__ = "event_registrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Basic registration info (collected from event page)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    position = Column(String(255), nullable=True)
    organization = Column(String(255), nullable=True)
    
    # Participation details
    participation_type = Column(String(50), nullable=False, default="attendee")  # attendee, jury, speaker, idea_holder
    attendance_type = Column(String(50), nullable=False, default="on_site")  # on_site, remote, hybrid
    ticket_type = Column(String(50), nullable=True)
    
    # Profile visibility preferences
    wants_profile_visible = Column(Boolean, default=True, nullable=False)
    profile_visibility_types = Column(ARRAY(String), default=list)  # ['attendee', 'jury', 'idea_holder']
    
    # Status tracking
    status = Column(String(50), default="pending", nullable=False)  # pending, confirmed, cancelled, waitlisted
    registration_date = Column(DateTime, default=func.now(), nullable=False, index=True)
    checked_in_at = Column(DateTime, nullable=True)
    
    # Optional account creation flag
    create_account = Column(Boolean, default=False, nullable=False)
    
    # Password setup for profile-first registration
    needs_password_setup = Column(Boolean, default=False, nullable=False)
    password_setup_token = Column(String(255), nullable=True, index=True)
    password_setup_expires_at = Column(DateTime, nullable=True)
    
    # Rejection token for profile-first registration
    rejection_token = Column(String(255), nullable=True, index=True)
    rejection_expires_at = Column(DateTime, nullable=True)
    is_rejected = Column(Boolean, default=False, nullable=False)
    
    # Anonymous registration (not visible in attendee list)
    is_anonymous = Column(Boolean, default=False, nullable=False)
    
    # For users registering without full account creation
    temp_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Additional metadata
    metadata_ = Column(JSONB, default=dict)
    special_requirements = Column(Text, nullable=True)
    
    # Relationships
    event = relationship("Event", back_populates="registrations")
    profile = relationship("Profile", back_populates="event_registrations")
    temp_user = relationship("User", foreign_keys=[temp_user_id])


class PasswordReset(Base, TimestampMixin):
    """Password reset tokens for users who forgot their passwords."""
    __tablename__ = "password_resets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="password_resets")

    def __repr__(self):
        return f"<PasswordReset user:{self.user_id} used:{self.is_used}>"


class ImportBatch(Base, TimestampMixin):
    """Track bulk import batches for analytics and management."""
    __tablename__ = "import_batches"

    id = Column(String(64), primary_key=True)  # UUID string
    admin_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    total_rows = Column(Integer, nullable=False, default=0)
    successful_imports = Column(Integer, nullable=False, default=0)
    failed_imports = Column(Integer, nullable=False, default=0)
    skipped_imports = Column(Integer, nullable=False, default=0)
    status = Column(String, default="processing", nullable=False)  # 'processing', 'completed', 'failed'
    
    # Relationships
    admin_user = relationship("User")

    def __repr__(self):
        return f"<ImportBatch {self.id} status:{self.status}>"


class Partner(Base, TimestampMixin):
    """Partner organization in the ecosystem."""
    __tablename__ = "partners"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    slug = Column(String(200), unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    website = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    banner_url = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    sector_focus = Column(JSONB, default=list)
    country = Column(String, nullable=True)
    region = Column(String, nullable=True)
    social_links = Column(JSONB, default=dict)
    status = Column(String, default="pending")
    is_verified = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    is_hackathon = Column(Boolean, default=False, server_default="false")
    featured_at = Column(DateTime, nullable=True)
    organization_type = Column(String, nullable=True)  # e.g. university, startup, ngo, corporate
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    metadata_ = Column(JSONB, default=dict)

    # Relationships
    owner = relationship("User", foreign_keys=[user_id])
    members = relationship("PartnerMember", back_populates="partner", cascade="all, delete-orphan")
    invitations = relationship("PartnerInvitation", back_populates="partner", cascade="all, delete-orphan")
    partner_entities = relationship("PartnerEntity", back_populates="partner", cascade="all, delete-orphan")


class PartnerMember(Base):
    """Members of a partner organization."""
    __tablename__ = "partner_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, default="viewer")
    joined_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('ix_partner_members_unique', 'partner_id', 'user_id', unique=True),
    )

    partner = relationship("Partner", back_populates="members")
    user = relationship("User", back_populates="partner_memberships")


class PartnerInvitation(Base):
    """Invitations to join a partner organization."""
    __tablename__ = "partner_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String, nullable=False)
    role = Column(String, default="viewer")
    token = Column(String(255), unique=True, index=True)
    expires_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    partner = relationship("Partner", back_populates="invitations")


class PartnerEntity(Base):
    """Links entities (labs) to partner organizations."""
    __tablename__ = "partner_entities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id = Column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime, server_default=func.now())
    metadata_ = Column(JSONB, default=dict)

    __table_args__ = (
        Index('ix_partner_entities_unique', 'partner_id', 'entity_id', unique=True),
    )

    partner = relationship("Partner", back_populates="partner_entities")
    entity = relationship("Entity", back_populates="partner_entities")
    assigned_by = relationship("User")


class LabLike(Base):
    """User likes on labs/entities."""
    __tablename__ = "lab_likes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('ix_lab_likes_unique', 'user_id', 'entity_id', unique=True),
    )

    user = relationship("User", back_populates="lab_likes")
    entity = relationship("Entity", back_populates="likes")


class LabComment(Base):
    """User comments on labs/entities. Supports one level of threading."""
    __tablename__ = "lab_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("lab_comments.id", ondelete="CASCADE"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    is_edited = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)  # soft delete

    user = relationship("User", back_populates="lab_comments")
    entity = relationship("Entity", back_populates="comments")
    parent = relationship("LabComment", remote_side=[id], backref="replies")
    reports = relationship("CommentReport", back_populates="comment", cascade="all, delete-orphan")


class CommentReport(Base):
    """Reports on inappropriate comments."""
    __tablename__ = "comment_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id = Column(UUID(as_uuid=True), ForeignKey("lab_comments.id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(String, nullable=False)  # spam, harassment, misinformation, other
    status = Column(String, default="pending")  # pending, reviewed, dismissed
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('ix_comment_reports_unique', 'comment_id', 'reporter_user_id', unique=True),
    )

    comment = relationship("LabComment", back_populates="reports")
    reporter = relationship("User")


class LabShare(Base):
    """Tracks share events for labs."""
    __tablename__ = "lab_shares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    platform = Column(String, nullable=False)  # link, twitter, linkedin, whatsapp, email, internal, qr
    recipient_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    entity = relationship("Entity", back_populates="shares")
    user = relationship("User", foreign_keys=[user_id])
    recipient = relationship("User", foreign_keys=[recipient_user_id])


class Follow(Base):
    """Follow relationships between users, partners, and labs."""
    __tablename__ = "follows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    follower_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String, nullable=False)  # user, partner, lab
    target_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('ix_follows_unique', 'follower_user_id', 'target_type', 'target_id', unique=True),
        Index('ix_follows_target', 'target_type', 'target_id'),
    )

    follower = relationship("User", foreign_keys=[follower_user_id])


class LabView(Base):
    """Tracks unique views per user per day for deduplication."""
    __tablename__ = "lab_views"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    view_date = Column(Date, nullable=False)

    __table_args__ = (
        Index('ix_lab_views_unique', 'entity_id', 'user_id', 'view_date', unique=True),
    )

    entity = relationship("Entity")
    user = relationship("User")


class ActivityEvent(Base):
    """Activity events for the social feed."""
    __tablename__ = "activity_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String, nullable=False)  # created_lab, liked_lab, commented, followed, shared, updated_lab
    target_type = Column(String, nullable=False)  # lab, user, partner
    target_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    metadata_ = Column(JSONB, default=dict)  # extra context (lab name, etc.)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    __table_args__ = (
        Index('ix_activity_events_actor_created', 'actor_user_id', 'created_at'),
    )

    actor = relationship("User", foreign_keys=[actor_user_id])


class Bookmark(Base):
    """A user's bookmark on a lab."""
    __tablename__ = "bookmarks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('ix_bookmarks_unique', 'user_id', 'entity_id', unique=True),
    )

    user = relationship("User", foreign_keys=[user_id])
    entity = relationship("Entity", foreign_keys=[entity_id])
    collection_items = relationship("BookmarkCollectionItem", back_populates="bookmark", cascade="all, delete-orphan")


class BookmarkCollection(Base):
    """A named collection of bookmarks."""
    __tablename__ = "bookmark_collections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index('ix_bookmark_collections_user', 'user_id'),
    )

    user = relationship("User", foreign_keys=[user_id])
    items = relationship("BookmarkCollectionItem", back_populates="collection", cascade="all, delete-orphan")


class BookmarkCollectionItem(Base):
    """Link between a bookmark and a collection."""
    __tablename__ = "bookmark_collection_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id = Column(UUID(as_uuid=True), ForeignKey("bookmark_collections.id", ondelete="CASCADE"), nullable=False, index=True)
    bookmark_id = Column(UUID(as_uuid=True), ForeignKey("bookmarks.id", ondelete="CASCADE"), nullable=False, index=True)
    added_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('ix_collection_items_unique', 'collection_id', 'bookmark_id', unique=True),
    )

    collection = relationship("BookmarkCollection", back_populates="items")
    bookmark = relationship("Bookmark", back_populates="collection_items")


class UserBlock(Base):
    """Tracks user blocks for moderation."""
    __tablename__ = "user_blocks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blocker_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    blocked_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('ix_user_blocks_unique', 'blocker_user_id', 'blocked_user_id', unique=True),
    )

    blocker = relationship("User", foreign_keys=[blocker_user_id])
    blocked = relationship("User", foreign_keys=[blocked_user_id])

# ============================
# Hackathon Scoring System
# ============================

class HackathonConfig(Base, TimestampMixin):
    """1:1 hackathon settings per event."""
    __tablename__ = "hackathon_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    judging_started_at = Column(DateTime, nullable=True)
    judging_ended_at = Column(DateTime, nullable=True)
    # Leaderboard visibility phase: 'hidden' (admin/judges only), 'locked' (final scores visible), 'public' (everyone)
    leaderboard_phase = Column(String, default="hidden", server_default="hidden", nullable=False)
    metadata_ = Column(JSONB, default=dict)

    event = relationship("Event", back_populates="hackathon_config")
    scoring_schema = relationship("ScoringSchema", back_populates="hackathon", uselist=False, cascade="all, delete-orphan")
    participants = relationship("HackathonParticipant", back_populates="hackathon", cascade="all, delete-orphan")
    judges = relationship("HackathonJudge", back_populates="hackathon", cascade="all, delete-orphan")
    email_logs = relationship("HackathonEmailLog", back_populates="hackathon", cascade="all, delete-orphan")
    categories = relationship("HackathonCategory", back_populates="hackathon", cascade="all, delete-orphan")
    judge_groups = relationship("JudgeGroup", back_populates="hackathon", cascade="all, delete-orphan")


class ScoringSchema(Base, TimestampMixin):
    """Scoring template per hackathon. Locked once judging starts."""
    __tablename__ = "scoring_schemas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hackathon_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_configs.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    version = Column(Integer, default=1)
    is_locked = Column(Boolean, default=False, server_default="false")

    hackathon = relationship("HackathonConfig", back_populates="scoring_schema")
    criteria = relationship("ScoringCriterion", back_populates="schema", cascade="all, delete-orphan", order_by="ScoringCriterion.order")


class ScoringCriterion(Base, TimestampMixin):
    """Individual scoring criterion within a schema."""
    __tablename__ = "scoring_criteria"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schema_id = Column(UUID(as_uuid=True), ForeignKey("scoring_schemas.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    weight = Column(Float, default=1.0, nullable=False)
    min_score = Column(Float, default=0, nullable=False)
    max_score = Column(Float, default=10, nullable=False)
    order = Column(Integer, default=0, nullable=False)
    rubric = Column(JSONB, default=dict)

    schema = relationship("ScoringSchema", back_populates="criteria")
    scores = relationship("ParticipantScore", back_populates="criterion", cascade="all, delete-orphan")


class HackathonParticipant(Base, TimestampMixin):
    """Uploaded participant for a hackathon."""
    __tablename__ = "hackathon_participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hackathon_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    upload_batch_id = Column(String, nullable=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
    organization = Column(String, nullable=True)
    team_name = Column(String, nullable=True)
    project_title = Column(String, nullable=True)
    project_description = Column(Text, nullable=True)
    phone_number = Column(String, nullable=True)
    country = Column(String, nullable=True, index=True)
    timezone = Column(String, nullable=True, index=True)
    # New fields for extended CSV support
    theme = Column(String, nullable=True)
    participant_type = Column(String, nullable=True, index=True)  # "Individual" or "Group"
    occupation = Column(String, nullable=True)
    department = Column(String, nullable=True)
    major = Column(String, nullable=True)
    position = Column(String, nullable=True)
    specialization = Column(String, nullable=True)
    metadata_ = Column(JSONB, default=dict)

    __table_args__ = (
        # Updated unique constraint: email + participant_type to allow both Individual and Group entries
        Index("ix_hackathon_participants_unique_email_type", "hackathon_id", "email", "participant_type", unique=True),
    )

    hackathon = relationship("HackathonConfig", back_populates="participants")
    assignments = relationship("JudgeAssignment", back_populates="participant", cascade="all, delete-orphan")
    scores = relationship("ParticipantScore", back_populates="participant", cascade="all, delete-orphan")
    category_memberships = relationship("CategoryParticipantMembership", back_populates="participant", cascade="all, delete-orphan")


class HackathonEmailLog(Base, TimestampMixin):
    """Log of emails sent to hackathon participants/judges."""
    __tablename__ = "hackathon_email_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hackathon_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    subject = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    meeting_link = Column(String, nullable=True)
    attachment_names = Column(JSONB, default=list)
    recipient_count = Column(Integer, nullable=False, default=0)
    recipient_emails = Column(JSONB, default=list)
    sent_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    sent_by = Column(String, nullable=True)
    # Category assignment: if set, recipients were assigned to this category
    category_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_categories.id", ondelete="SET NULL"), nullable=True, index=True)
    recipient_type = Column(String, default="participant", nullable=False)  # "participant" or "judge"

    hackathon = relationship("HackathonConfig", back_populates="email_logs")
    category = relationship("HackathonCategory")


class HackathonJudge(Base, TimestampMixin):
    """Authorized judge for a hackathon."""
    __tablename__ = "hackathon_judges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hackathon_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    display_name = Column(String, nullable=True)

    __table_args__ = (
        Index("ix_hackathon_judges_unique", "hackathon_id", "user_id", unique=True),
    )

    hackathon = relationship("HackathonConfig", back_populates="judges")
    user = relationship("User", back_populates="hackathon_judge_roles")
    assignments = relationship("JudgeAssignment", back_populates="judge", cascade="all, delete-orphan")
    scores = relationship("ParticipantScore", back_populates="judge", cascade="all, delete-orphan")
    category_memberships = relationship("CategoryJudgeMembership", back_populates="judge", cascade="all, delete-orphan")
    group_memberships = relationship("JudgeGroupMembership", back_populates="judge", cascade="all, delete-orphan")


class JudgeAssignment(Base, TimestampMixin):
    """Which judge scores which participant."""
    __tablename__ = "judge_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    judge_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_judges.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_participants.id", ondelete="CASCADE"), nullable=False, index=True)

    __table_args__ = (
        Index("ix_judge_assignments_unique", "judge_id", "participant_id", unique=True),
    )

    judge = relationship("HackathonJudge", back_populates="assignments")
    participant = relationship("HackathonParticipant", back_populates="assignments")


class ParticipantScore(Base, TimestampMixin):
    """Actual score given by a judge for a criterion."""
    __tablename__ = "participant_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    participant_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_participants.id", ondelete="CASCADE"), nullable=False, index=True)
    judge_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_judges.id", ondelete="CASCADE"), nullable=False, index=True)
    criterion_id = Column(UUID(as_uuid=True), ForeignKey("scoring_criteria.id", ondelete="CASCADE"), nullable=False, index=True)
    # Optional: link score to a judge group/session for session-based leaderboards
    judge_group_id = Column(UUID(as_uuid=True), ForeignKey("judge_groups.id", ondelete="SET NULL"), nullable=True, index=True)
    score = Column(Float, nullable=False)
    comment = Column(Text, nullable=True)
    is_draft = Column(Boolean, default=True, server_default="true")

    __table_args__ = (
        Index("ix_participant_scores_unique", "participant_id", "judge_id", "criterion_id", unique=True),
    )

    participant = relationship("HackathonParticipant", back_populates="scores")
    judge = relationship("HackathonJudge", back_populates="scores")
    criterion = relationship("ScoringCriterion", back_populates="scores")
    judge_group = relationship("JudgeGroup")


# ==================== Hackathon Categories & Judge Groups ====================

class HackathonCategory(Base, TimestampMixin):
    """
    Flexible categories for grouping participants/judges.
    Examples: Timezone Group – GMT+1, Morning Session, Judge Panel A, Track: AI/ML
    """
    __tablename__ = "hackathon_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hackathon_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category_type = Column(String, nullable=True, index=True)  # e.g., "timezone", "session", "track", "panel"
    metadata_ = Column(JSONB, default=dict)  # For meeting_link, schedule info, etc.

    __table_args__ = (
        Index("ix_hackathon_categories_unique_name", "hackathon_id", "name", unique=True),
    )

    hackathon = relationship("HackathonConfig", back_populates="categories")
    participant_memberships = relationship("CategoryParticipantMembership", back_populates="category", cascade="all, delete-orphan")
    judge_memberships = relationship("CategoryJudgeMembership", back_populates="category", cascade="all, delete-orphan")


class CategoryParticipantMembership(Base, TimestampMixin):
    """Links participants to categories. A participant can belong to multiple categories."""
    __tablename__ = "category_participant_memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_categories.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_participants.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_via_email_log_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_email_logs.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        Index("ix_category_participant_unique", "category_id", "participant_id", unique=True),
    )

    category = relationship("HackathonCategory", back_populates="participant_memberships")
    participant = relationship("HackathonParticipant", back_populates="category_memberships")
    assigned_via_email = relationship("HackathonEmailLog")


class CategoryJudgeMembership(Base, TimestampMixin):
    """Links judges to categories. A judge can belong to multiple categories."""
    __tablename__ = "category_judge_memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_categories.id", ondelete="CASCADE"), nullable=False, index=True)
    judge_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_judges.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_via_email_log_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_email_logs.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        Index("ix_category_judge_unique", "category_id", "judge_id", unique=True),
    )

    category = relationship("HackathonCategory", back_populates="judge_memberships")
    judge = relationship("HackathonJudge", back_populates="category_memberships")
    assigned_via_email = relationship("HackathonEmailLog")


class JudgeGroup(Base, TimestampMixin):
    """
    Judge groups/sessions/panels for organizing scoring.
    Each judge can belong to multiple groups.
    Scores are tagged with judge_group for session-based leaderboards.
    """
    __tablename__ = "judge_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hackathon_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    __table_args__ = (
        Index("ix_judge_groups_unique_name", "hackathon_id", "name", unique=True),
    )

    hackathon = relationship("HackathonConfig", back_populates="judge_groups")
    memberships = relationship("JudgeGroupMembership", back_populates="group", cascade="all, delete-orphan")


class JudgeGroupMembership(Base, TimestampMixin):
    """Links judges to judge groups."""
    __tablename__ = "judge_group_memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("judge_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    judge_id = Column(UUID(as_uuid=True), ForeignKey("hackathon_judges.id", ondelete="CASCADE"), nullable=False, index=True)

    __table_args__ = (
        Index("ix_judge_group_membership_unique", "group_id", "judge_id", unique=True),
    )

    group = relationship("JudgeGroup", back_populates="memberships")
    judge = relationship("HackathonJudge", back_populates="group_memberships")
