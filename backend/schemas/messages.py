# schemas/messages.py
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, validator, field_validator, model_validator
import uuid


class MessageType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    DOCUMENT = "document"
    VIDEO = "video"

class MessageBase(BaseModel):
    receiver_profile_id: str
    content: Optional[str] = None
    message_type: MessageType = MessageType.TEXT
    metadata: Optional[Dict[str, Any]] = None

class MessageCreate(MessageBase):
    @validator('content')
    def validate_content(cls, v, values):
        if values.get('message_type') == MessageType.TEXT and not v:
            raise ValueError('Content is required for text messages')
        return v

class MessageAttachmentResponse(BaseModel):
    id: str
    file_name: str
    file_size: int
    mime_type: str
    download_url: str
    thumbnail_url: Optional[str] = None

class MessageResponse(BaseModel):
    id: str
    sender_profile_id: str
    receiver_profile_id: str
    # sender_profile_image: Optional[str] = None  # Add sender profile image
    # receiver_profile_image: Optional[str] = None  # Add receiver profile image
    content: Optional[str] = None
    message_type: MessageType = MessageType.TEXT
    metadata: Dict[str, Any] = {}
    is_read: bool = False
    is_delivered: bool = False
    encrypted: bool = False
    created_at: datetime
    attachments: List[MessageAttachmentResponse] = []

    @field_validator("id", "sender_profile_id", "receiver_profile_id", mode="before")
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

    @field_validator("message_type", mode="before")
    def validate_message_type(cls, v):
        if v is None:
            return MessageType.TEXT
        if isinstance(v, str):
            try:
                return MessageType(v.lower())
            except ValueError:
                return MessageType.TEXT
        return v

    @field_validator("is_read", "is_delivered", "encrypted", mode="before")
    def validate_boolean_fields(cls, v):
        if v is None:
            return False
        return bool(v)

    @field_validator("metadata", mode="before")
    def handle_metadata(cls, v):
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        # Handle SQLAlchemy's MetaData() or JSONB proxy
        try:
            return dict(v)
        except Exception:
            return {}
    
    @field_validator("content", mode="before")
    def handle_content(cls, v):
        if v is None:
            return None
        return str(v)

    @field_validator("attachments", mode="before")
    def handle_attachments(cls, v):
        if v is None:
            return []
        return v

    # @field_validator("sender_profile_image", "receiver_profile_image", mode="before")
    # def handle_profile_images(cls, v):
    #     if v is None:
    #         return None
    #     return str(v)

    @model_validator(mode="before")
    def set_defaults(cls, values):
        # Ensure all required fields have defaults
        if 'message_type' not in values or values['message_type'] is None:
            values['message_type'] = MessageType.TEXT
        if 'is_read' not in values or values['is_read'] is None:
            values['is_read'] = False
        if 'is_delivered' not in values or values['is_delivered'] is None:
            values['is_delivered'] = False
        if 'encrypted' not in values or values['encrypted'] is None:
            values['encrypted'] = False
        if 'metadata' not in values or values['metadata'] is None:
            values['metadata'] = {}
        if 'attachments' not in values or values['attachments'] is None:
            values['attachments'] = []
        if 'sender_profile_image' not in values:
            values['sender_profile_image'] = None
        if 'receiver_profile_image' not in values:
            values['receiver_profile_image'] = None
        return values
    
    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    messages: List[MessageResponse]
    total_count: int
    has_more: bool