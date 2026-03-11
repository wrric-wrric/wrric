# websocket/message_handler.py
import json
import logging
from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from ws_module.messages.connection_manager import manager
from services.message_service import MessageService
from utils.database import create_notification

logger = logging.getLogger(__name__)

class WebSocketMessageHandler:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.message_service = MessageService(db)

    async def handle_message(self, message_data: Dict[str, Any], profile_id: str, user_id: str):
        """Handle incoming WebSocket messages"""
        message_type = message_data.get('type')
        
        handler_map = {
            'typing': self._handle_typing,
            'message_read': self._handle_message_read,
            'call_offer': self._handle_call_offer,
            'call_answer': self._handle_call_answer,
            'ice_candidate': self._handle_ice_candidate,
            'call_end': self._handle_call_end,
        }
        
        handler = handler_map.get(message_type)
        if handler:
            await handler(message_data, profile_id, user_id)
        else:
            logger.warning(f"Unknown WebSocket message type: {message_type}")

    async def _handle_typing(self, message_data: Dict[str, Any], profile_id: str, user_id: str):
        """Handle typing indicators"""
        data = message_data.get('data', {})
        recipient_profile_id = data.get('recipient_profile_id')
        is_typing = data.get('is_typing', False)
        
        if recipient_profile_id:
            await manager.send_typing_indicator(profile_id, recipient_profile_id, is_typing)
            logger.debug(f"Typing indicator: {profile_id} -> {recipient_profile_id} ({is_typing})")

    async def _handle_message_read(self, message_data: Dict[str, Any], profile_id: str, user_id: str):
        """Handle message read receipts"""
        data = message_data.get('data', {})
        message_id = data.get('message_id')
        
        if message_id:
            try:
                # Update message as read in database
                await self.message_service.mark_as_read(message_id, profile_id)
                
                # Get the message to find the sender
                message = await self.message_service.get_message_by_id(message_id)
                if message and str(message.sender_profile_id) != profile_id:
                    # Notify the original sender
                    await manager.send_message_read(
                        message_id, 
                        profile_id, 
                        str(message.sender_profile_id)
                    )
                    logger.info(f"Message {message_id} marked as read by {profile_id}")
                    
            except Exception as e:
                logger.error(f"Error handling message read receipt: {e}")

    async def _handle_call_offer(self, message_data: Dict[str, Any], profile_id: str, user_id: str):
        """Handle WebRTC call offers"""
        data = message_data.get('data', {})
        recipient_profile_id = data.get('recipient_profile_id')
        offer = data.get('offer')
        call_id = data.get('call_id')
        
        if recipient_profile_id and offer:
            call_offer = {
                "type": "call_offer",
                "data": {
                    "call_id": call_id,
                    "offer": offer,
                    "caller_profile_id": profile_id
                }
            }
            await manager.broadcast_to_profile(call_offer, recipient_profile_id)
            
            # Create notification for the call
            await create_notification(
                self.db,
                user_id=user_id,  # This should be the recipient's user_id - you'll need to fetch it
                type="incoming_call",
                content=f"Incoming call from user",
                related_id=call_id
            )

    async def _handle_call_answer(self, message_data: Dict[str, Any], profile_id: str, user_id: str):
        """Handle WebRTC call answers"""
        data = message_data.get('data', {})
        recipient_profile_id = data.get('recipient_profile_id')
        answer = data.get('answer')
        call_id = data.get('call_id')
        
        if recipient_profile_id and answer:
            call_answer = {
                "type": "call_answer",
                "data": {
                    "call_id": call_id,
                    "answer": answer,
                    "answerer_profile_id": profile_id
                }
            }
            await manager.broadcast_to_profile(call_answer, recipient_profile_id)

    async def _handle_ice_candidate(self, message_data: Dict[str, Any], profile_id: str, user_id: str):
        """Handle WebRTC ICE candidates"""
        data = message_data.get('data', {})
        recipient_profile_id = data.get('recipient_profile_id')
        candidate = data.get('candidate')
        call_id = data.get('call_id')
        
        if recipient_profile_id and candidate:
            ice_candidate = {
                "type": "ice_candidate",
                "data": {
                    "call_id": call_id,
                    "candidate": candidate,
                    "sender_profile_id": profile_id
                }
            }
            await manager.broadcast_to_profile(ice_candidate, recipient_profile_id)

    async def _handle_call_end(self, message_data: Dict[str, Any], profile_id: str, user_id: str):
        """Handle call end notifications"""
        data = message_data.get('data', {})
        recipient_profile_id = data.get('recipient_profile_id')
        call_id = data.get('call_id')
        reason = data.get('reason', 'call_ended')
        
        if recipient_profile_id:
            call_end = {
                "type": "call_end",
                "data": {
                    "call_id": call_id,
                    "reason": reason,
                    "ended_by": profile_id
                }
            }
            await manager.broadcast_to_profile(call_end, recipient_profile_id)