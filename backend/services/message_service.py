# service/ message_service.py

import logging
import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, update
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import selectinload

from models.db_models import Message, MessageAttachment, Profile
from schemas.messages import MessageCreate, MessageType
from media.storage import CustomB2Storage
from security.message_security import MessageEncryption, MessageValidator
from ws_module.messages.connection_manager import manager
from services.notification_service import NotificationService

logger = logging.getLogger(__name__)

class MessageService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.storage = CustomB2Storage()
        self.encryption = MessageEncryption()
        self.validator = MessageValidator()
        self.notification_service = NotificationService(db)

    async def send_message(
        self, 
        message_data: MessageCreate, 
        sender_profile_id: str,
        files: Optional[List[UploadFile]] = None
    ) -> Message:
        # Validate sender and receiver with selectinload
        sender = await self._get_profile_with_relationships(sender_profile_id)
        receiver = await self._get_profile_with_relationships(message_data.receiver_profile_id)
        
        if not sender or not receiver:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Validate message content
        self.validator.validate_message_content(
            message_data.content, 
            message_data.message_type
        )

        # Encrypt sensitive content if needed
        content = message_data.content
        encrypted = False
        if content and message_data.message_type == MessageType.TEXT:
            content = self.encryption.encrypt_message(content)
            encrypted = True

        # Create message
        message = Message(
            sender_profile_id=sender_profile_id,
            receiver_profile_id=message_data.receiver_profile_id,
            content=content,
            message_type=message_data.message_type,
            metadata_=message_data.metadata or {},
            encrypted=encrypted
        )

        self.db.add(message)
        await self.db.flush()  # Get message ID for attachments

        # Handle file attachments
        if files:
            await self._handle_attachments(message.id, files)

        await self.db.commit()
        
        # Refresh message with all relationships loaded
        refreshed_message = await self._get_message_with_relationships(message.id)
        if not refreshed_message:
            raise HTTPException(status_code=500, detail="Failed to retrieve created message")
        
        logger.info(f"Message {refreshed_message.id} sent from {sender_profile_id} to {message_data.receiver_profile_id}")
        
        # Send WebSocket notification
        await self._send_websocket_notification(refreshed_message, sender_profile_id)
        
        return refreshed_message

    async def get_message_by_id(self, message_id: str) -> Optional[Message]:
        """Get a message by ID with all relationships loaded"""
        try:
            result = await self.db.execute(
                select(Message)
                .options(
                    selectinload(Message.attachments),
                    selectinload(Message.sender),
                    selectinload(Message.receiver)
                )
                .where(Message.id == message_id)
            )
            message = result.scalar_one_or_none()
            
            if message:
                logger.debug(f"Retrieved message {message_id} with sender: {message.sender_profile_id}, receiver: {message.receiver_profile_id}")
            else:
                logger.warning(f"Message {message_id} not found")
                
            return message
            
        except Exception as e:
            logger.error(f"Error retrieving message {message_id}: {e}")
            return None

    async def _send_websocket_notification(self, message: Message, sender_profile_id: str):
        """Send WebSocket notification for new message"""
        try:
            # Convert message to response format for WebSocket
            message_response = await self._message_to_websocket_format(message)
            
            # Send to receiver via WebSocket
            await manager.send_new_message(
                message_response,
                str(message.receiver_profile_id),
                sender_profile_id
            )
            
            # Send notification
            content_preview = message.content
            if content_preview and message.encrypted:
                content_preview = self.encryption.decrypt_message(content_preview)
            
            content_preview = content_preview[:100] + "..." if content_preview and len(content_preview) > 100 else content_preview
            
            await self.notification_service.send_message_notification(
                str(message.id),
                sender_profile_id,
                str(message.receiver_profile_id),
                content_preview or "Media message"
            )
            
            logger.info(f"WebSocket notification sent for message {message.id}")
            
        except Exception as e:
            logger.error(f"Failed to send WebSocket notification: {e}")
            # Don't raise exception as message was already saved

    async def _message_to_websocket_format(self, message: Message) -> dict:
        """Convert Message to WebSocket-friendly format"""
        # Decrypt content if needed
        content = message.content
        if message.encrypted and content:
            content = self.encryption.decrypt_message(content)
        
        # Format attachments
        attachments = []
        for attachment in getattr(message, 'attachments', []):
            download_url = await self._get_presigned_url(attachment.file_key)
            thumbnail_url = await self._get_presigned_url(attachment.thumbnail_key) if attachment.thumbnail_key else None
            
            attachments.append({
                "id": str(attachment.id),
                "file_name": attachment.file_name,
                "file_size": attachment.file_size,
                "mime_type": attachment.mime_type,
                "download_url": download_url,
                "thumbnail_url": thumbnail_url
            })
        
        return {
            "id": str(message.id),
            "sender_profile_id": str(message.sender_profile_id),
            "receiver_profile_id": str(message.receiver_profile_id),
            "content": content,
            "message_type": message.message_type,
            "metadata": message.metadata_ or {},
            "is_read": message.is_read,
            "is_delivered": message.is_delivered,
            "encrypted": message.encrypted,
            "created_at": message.created_at.isoformat(),
            "attachments": attachments
        }

    async def _get_presigned_url(self, key: str) -> str:
        """Get presigned URL for file"""
        if not key:
            return None
        return await self.storage.url(key)

    async def _handle_attachments(self, message_id: str, files: List[UploadFile]):
        for file in files:
            # Validate file
            file_content = await file.read()
            file_size = len(file_content)
            await file.seek(0)  # Reset file pointer
            self.validator.validate_file_upload(file_size, file.content_type)

            # Generate secure file key
            file_extension = file.filename.split('.')[-1] if '.' in file.filename else ''
            file_key = f"messages/{message_id}/{uuid.uuid4()}.{file_extension}"

            # Upload to Backblaze B2
            try:
                self.storage.s3_client.upload_fileobj(
                    file.file,
                    self.storage.bucket_name,
                    file_key,
                    ExtraArgs={
                        'ContentType': file.content_type,
                        'Metadata': {
                            'original-filename': file.filename
                        }
                    }
                )
            except Exception as e:
                logger.error(f"Failed to upload attachment: {e}")
                raise HTTPException(status_code=500, detail="Failed to upload file")

            # Create attachment record
            attachment = MessageAttachment(
                message_id=message_id,
                file_key=file_key,
                file_name=file.filename,
                file_size=file_size,
                mime_type=file.content_type
            )
            self.db.add(attachment)

    async def _get_profile_with_relationships(self, profile_id: str) -> Optional[Profile]:
        """Get profile with all necessary relationships loaded"""
        result = await self.db.execute(
            select(Profile)
            .options(
                selectinload(Profile.sent_messages),
                selectinload(Profile.received_messages)
            )
            .where(Profile.id == profile_id)
        )
        return result.scalar_one_or_none()

    async def _get_message_with_relationships(self, message_id: str) -> Optional[Message]:
        """Get message with all relationships loaded using selectinload"""
        result = await self.db.execute(
            select(Message)
            .options(
                selectinload(Message.attachments),
                selectinload(Message.sender),
                selectinload(Message.receiver)
            )
            .where(Message.id == message_id)
        )
        return result.scalar_one_or_none()

    async def get_conversation(
        self, 
        profile_id: str, 
        other_profile_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Message]:
        """Get conversation with all relationships loaded"""
        result = await self.db.execute(
            select(Message)
            .options(
                selectinload(Message.attachments),
                selectinload(Message.sender),
                selectinload(Message.receiver)
            )
            .where(
                or_(
                    and_(
                        Message.sender_profile_id == profile_id,
                        Message.receiver_profile_id == other_profile_id
                    ),
                    and_(
                        Message.sender_profile_id == other_profile_id,
                        Message.receiver_profile_id == profile_id
                    )
                )
            )
            .order_by(Message.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def get_message_attachments(self, message_id: str) -> List[MessageAttachment]:
        """Get message attachments - ensure message is loaded with relationships first"""
        # First get the message with attachments loaded
        result = await self.db.execute(
            select(Message)
            .options(selectinload(Message.attachments))
            .where(Message.id == message_id)
        )
        message = result.scalar_one_or_none()
        
        if message:
            return message.attachments
        return []

    async def mark_as_read(self, message_id: str, profile_id: str):
        """Mark a message as read and send WebSocket notification"""
        result = await self.db.execute(
            select(Message)
            .options(
                selectinload(Message.attachments),
                selectinload(Message.sender),
                selectinload(Message.receiver)
            )
            .where(
                and_(
                    Message.id == message_id,
                    Message.receiver_profile_id == profile_id
                )
            )
        )
        message = result.scalar_one_or_none()
        
        if message:
            message.is_read = True
            await self.db.commit()
            
            # Send WebSocket read receipt
            await self._send_read_receipt(message, profile_id)

    async def _send_read_receipt(self, message: Message, reader_profile_id: str):
        """Send WebSocket read receipt to message sender"""
        try:
            if str(message.sender_profile_id) != reader_profile_id:
                await manager.send_message_read(
                    str(message.id),
                    reader_profile_id,
                    str(message.sender_profile_id)
                )
                logger.info(f"Read receipt sent for message {message.id}")
        except Exception as e:
            logger.error(f"Failed to send read receipt: {e}")

    async def mark_conversation_as_read(self, profile_id: str, other_profile_id: str):
        """Mark all messages in a conversation as read and send WebSocket notifications"""
        # Get all unread messages first
        result = await self.db.execute(
            select(Message)
            .options(
                selectinload(Message.attachments),
                selectinload(Message.sender),
                selectinload(Message.receiver)
            )
            .where(
                and_(
                    Message.receiver_profile_id == profile_id,
                    Message.sender_profile_id == other_profile_id,
                    Message.is_read == False
                )
            )
        )
        unread_messages = result.scalars().all()
        
        # Update all unread messages
        await self.db.execute(
            update(Message)
            .where(
                and_(
                    Message.receiver_profile_id == profile_id,
                    Message.sender_profile_id == other_profile_id,
                    Message.is_read == False
                )
            )
            .values(is_read=True)
        )
        await self.db.commit()
        
        # Send WebSocket read receipts for all messages
        for message in unread_messages:
            await self._send_read_receipt(message, profile_id)

    async def get_conversation_partners(self, profile_id: str) -> List[Profile]:
        """Get all conversation partners for a profile"""
        # Get distinct conversation partners
        result = await self.db.execute(
            select(Profile)
            .options(
                selectinload(Profile.sent_messages),
                selectinload(Profile.received_messages)
            )
            .where(
                or_(
                    Profile.id.in_(
                        select(Message.sender_profile_id)
                        .where(Message.receiver_profile_id == profile_id)
                    ),
                    Profile.id.in_(
                        select(Message.receiver_profile_id)
                        .where(Message.sender_profile_id == profile_id)
                    )
                )
            )
            .distinct()
        )
        return result.scalars().all()

    async def get_last_message_in_conversation(
        self, 
        profile_id: str, 
        other_profile_id: str
    ) -> Optional[Message]:
        """Get the last message in a conversation with all relationships"""
        result = await self.db.execute(
            select(Message)
            .options(
                selectinload(Message.attachments),
                selectinload(Message.sender),
                selectinload(Message.receiver)
            )
            .where(
                or_(
                    and_(
                        Message.sender_profile_id == profile_id,
                        Message.receiver_profile_id == other_profile_id
                    ),
                    and_(
                        Message.sender_profile_id == other_profile_id,
                        Message.receiver_profile_id == profile_id
                    )
                )
            )
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_unread_count(self, profile_id: str, other_profile_id: str) -> int:
        """Get count of unread messages in a conversation"""
        result = await self.db.execute(
            select(Message)
            .where(
                and_(
                    Message.receiver_profile_id == profile_id,
                    Message.sender_profile_id == other_profile_id,
                    Message.is_read == False
                )
            )
        )
        messages = result.scalars().all()
        return len(messages)