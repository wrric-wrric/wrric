import logging
import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from sqlalchemy.orm import selectinload
from datetime import datetime

from services.message_service import MessageService
from schemas.messages import MessageResponse, MessageCreate, ConversationResponse, MessageAttachmentResponse
from utils.database import get_db
from api.dependencies import get_current_user
from models.db_models import Message, Profile, User, MessageAttachment
from security.message_security import MessageEncryption
from media.storage import CustomB2Storage
import asyncio

logger = logging.getLogger(__name__)

storage = CustomB2Storage()

router = APIRouter(tags=["messages"])


async def get_sender_profile(
    profile_id: Optional[str] = Query(None, description="Profile ID to use as sender"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Profile:
    """Get the sender profile for messaging operations"""
    if profile_id:
        # Use the specified profile if provided
        result = await db.execute(
            select(Profile).where(
                and_(
                    Profile.id == profile_id,
                    Profile.user_id == current_user
                )
            )
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found or access denied")
        return profile
    else:
        # Fall back to user's primary profile
        result = await db.execute(
            select(Profile).where(Profile.user_id == current_user).limit(1)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="User profile not found")
        return profile


async def send_message_notification(message_id: str):
    """Background task to send push notifications"""
    logger.info(f"Sending notification for message {message_id}")
    pass


@router.post("", response_model=MessageResponse)
async def send_message(
    background_tasks: BackgroundTasks,
    receiver_profile_id: str = Form(...),
    content: Optional[str] = Form(None),
    message_type: str = Form("text"),
    metadata: str = Form("{}"),
    files: List[UploadFile] = File(None),
    sender_profile: Profile = Depends(get_sender_profile),  # Use profile dependency
    db: AsyncSession = Depends(get_db),
):
    """Send a message with optional file attachments using specified profile"""
    try:
        # Guard against self-messaging
        receiver_result = await db.execute(
            select(Profile.user_id).where(Profile.id == receiver_profile_id)
        )
        receiver_user_id = receiver_result.scalar_one_or_none()
        if receiver_user_id and str(receiver_user_id) == str(sender_profile.user_id):
            raise HTTPException(status_code=400, detail="Cannot send messages to your own profiles")

        # ✅ Parse metadata safely
        try:
            metadata_dict = json.loads(metadata)
        except json.JSONDecodeError:
            metadata_dict = {}

        # ✅ Create message schema
        message_data = MessageCreate(
            receiver_profile_id=receiver_profile_id,
            content=content,
            message_type=message_type,
            metadata=metadata_dict,
        )

        # ✅ Send message via service
        service = MessageService(db)
        message = await service.send_message(
            message_data,
            str(sender_profile.id),  # Use the specified sender profile
            files
        )

        # ✅ Re-fetch message with correct relationship loading
        result = await db.execute(
            select(Message)
            .options(
                selectinload(Message.sender),
                selectinload(Message.receiver),
                selectinload(Message.attachments),
            )
            .where(Message.id == message.id)
        )
        message = result.scalar_one_or_none()

        if not message:
            raise HTTPException(status_code=404, detail="Message not found after creation")

        # ✅ Background task for notifications
        background_tasks.add_task(send_message_notification, str(message.id))

        # ✅ Convert to response
        response = await _message_to_response(message, db)
        return response

    except Exception as e:
        logger.exception(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversation/{other_profile_id}", response_model=ConversationResponse)
async def get_conversation(
    other_profile_id: str,
    limit: int = 50,
    offset: int = 0,
    sender_profile: Profile = Depends(get_sender_profile),  # Use profile dependency
    db: AsyncSession = Depends(get_db)
):
    """Get conversation between specified profile and another profile"""
    logger.info(f"🔹 [get_conversation] Called with profile_id={sender_profile.id}, other_profile_id={other_profile_id}, limit={limit}, offset={offset}")

    try:
        # Initialize message service
        logger.debug("🔹 [get_conversation] Initializing MessageService...")
        service = MessageService(db)

        # Fetch messages
        logger.debug(f"🔹 [get_conversation] Fetching conversation between profile={sender_profile.id} and other={other_profile_id}")
        messages = await service.get_conversation(
            str(sender_profile.id),  # Use the specified sender profile
            other_profile_id,
            limit,
            offset
        )
        logger.debug(f"✅ [get_conversation] Retrieved {len(messages)} messages from DB")

        # Convert messages to response format
        message_responses = []
        for idx, message in enumerate(messages):
            logger.debug(f"🔹 [get_conversation] Converting message {idx+1}/{len(messages)} - ID={getattr(message, 'id', None)}")
            try:
                message_responses.append(await _message_to_response(message, db))
            except Exception as inner_e:
                logger.exception(f"⚠️ [get_conversation] Failed to convert message ID={getattr(message, 'id', None)}: {inner_e}")

        response = ConversationResponse(
            messages=message_responses,
            total_count=len(message_responses),
            has_more=len(messages) == limit
        )

        logger.info(
            f"✅ [get_conversation] Conversation successfully built | "
            f"Messages returned: {len(message_responses)} | has_more={response.has_more}"
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ [get_conversation] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations", response_model=List[dict])
async def get_conversations(
    sender_profile: Profile = Depends(get_sender_profile),  # Use profile dependency
    db: AsyncSession = Depends(get_db)
):
    """Get list of conversations for specified profile"""
    try:
        # Get distinct conversations with selectinload for messages and profiles
        result = await db.execute(
            select(Message)
            .options(
                selectinload(Message.attachments),
                selectinload(Message.sender),
                selectinload(Message.receiver)
            )
            .where(
                or_(
                    Message.sender_profile_id == sender_profile.id,  # Use specified profile
                    Message.receiver_profile_id == sender_profile.id  # Use specified profile
                )
            )
            .order_by(Message.created_at.desc())
        )
        
        all_messages = result.scalars().all()
        
        # Group messages by conversation partner
        conversations_map = {}
        
        for message in all_messages:
            # Determine the other profile in the conversation
            if message.sender_profile_id == sender_profile.id:  # Use specified profile
                other_profile_id = message.receiver_profile_id
                other_profile = message.receiver
            else:
                other_profile_id = message.sender_profile_id
                other_profile = message.sender
            
            if other_profile_id not in conversations_map:
                # Get profile image URL for the other profile
                profile_image_url = await _get_presigned_url(other_profile.profile_image) if other_profile.profile_image else None
                
                conversations_map[other_profile_id] = {
                    'profile_id': str(other_profile_id),
                    'profile_name': getattr(other_profile, 'title', None) or 
                                  getattr(other_profile, 'organization', None) or 
                                  "Unknown",
                    'profile_type': getattr(other_profile, 'type', 'unknown'),
                    'profile_image': profile_image_url,
                    'last_message': None,
                    'unread_count': 0,
                    'last_activity': None,
                    'messages': []
                }
            
            conversations_map[other_profile_id]['messages'].append(message)
        
        # Process each conversation
        conversations = []
        for conv_data in conversations_map.values():
            if conv_data['messages']:
                # Sort messages by date and get the latest
                conv_data['messages'].sort(key=lambda x: x.created_at, reverse=True)
                last_message = conv_data['messages'][0]
                conv_data['last_message'] = await _message_to_response(last_message, db)
                conv_data['last_activity'] = last_message.created_at
                
                # Count unread messages
                conv_data['unread_count'] = sum(
                    1 for msg in conv_data['messages'] 
                    if (msg.receiver_profile_id == sender_profile.id and  # Use specified profile
                        not msg.is_read)
                )
            
            # Remove messages list from final output
            conv_data.pop('messages', None)
            conversations.append(conv_data)
        
        # Sort by last activity
        conversations.sort(key=lambda x: x["last_activity"] or datetime.min, reverse=True)
        return conversations
        
    except Exception as e:
        logger.exception(f"Error getting conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# THESE ENDPOINTS DON'T NEED PROFILE_ID - THEY WORK WITH SPECIFIC MESSAGE IDs
@router.post("/{message_id}/read")
async def mark_message_read(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a message as read"""
    try:
        # Get user's primary profile (message ID is unique, so no need for profile_id)
        result = await db.execute(
            select(Profile).where(Profile.user_id == current_user).limit(1)
        )
        current_profile = result.scalar_one_or_none()
        
        if not current_profile:
            raise HTTPException(status_code=404, detail="User profile not found")

        service = MessageService(db)
        await service.mark_as_read(message_id, str(current_profile.id))
        return {"status": "success"}
        
    except Exception as e:
        logger.exception(f"Error marking message as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversation/{other_profile_id}/read")
async def mark_conversation_read(
    other_profile_id: str,
    sender_profile: Profile = Depends(get_sender_profile),  # This one needs profile_id for perspective
    db: AsyncSession = Depends(get_db)
):
    """Mark all messages in a conversation as read for specified profile"""
    try:
        service = MessageService(db)
        await service.mark_conversation_as_read(str(sender_profile.id), other_profile_id)
        return {"status": "success"}
        
    except Exception as e:
        logger.exception(f"Error marking conversation as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _message_to_response(message: Message, db: AsyncSession) -> MessageResponse:
    """Convert Message ORM object to MessageResponse with presigned URLs and profile images"""
    if not message:
        return None
        
    # Ensure attachments are loaded (they should be via selectinload)
    attachments = []
    for attachment in getattr(message, 'attachments', []):
        download_url = await _get_presigned_url(attachment.file_key)
        thumbnail_url = await _get_presigned_url(attachment.thumbnail_key) if attachment.thumbnail_key else None
        
        attachments.append(MessageAttachmentResponse(
            id=str(attachment.id),
            file_name=attachment.file_name,
            file_size=attachment.file_size,
            mime_type=attachment.mime_type,
            download_url=download_url,
            thumbnail_url=thumbnail_url
        ))
    
    # Decrypt content if needed
    content = message.content
    if message.encrypted and content:
        encryption = MessageEncryption()
        content = encryption.decrypt_message(content)
    
    return MessageResponse(
        id=str(message.id),
        sender_profile_id=str(message.sender_profile_id),
        receiver_profile_id=str(message.receiver_profile_id),
        content=content,
        message_type=message.message_type,
        metadata=message.metadata_ or {},
        is_read=message.is_read,
        is_delivered=message.is_delivered,
        encrypted=message.encrypted,
        created_at=message.created_at,
        attachments=attachments
    )


async def _get_presigned_url(key: str) -> Optional[str]:
    """Get presigned URL for file"""
    if not key:
        return None
    return await asyncio.to_thread(storage.url, key)