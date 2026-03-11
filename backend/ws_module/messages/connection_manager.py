# websocket/connection_manager.py
import json
import logging
from typing import Dict, Set, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, Set[str]] = {}  # user_id -> set of profile_ids

    async def connect(self, websocket: WebSocket, profile_id: str, user_id: str):
        await websocket.accept()
        self.active_connections[profile_id] = websocket
        
        # Track user connections for broadcasting to all user profiles
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(profile_id)
        
        logger.info(f"WebSocket connected for profile {profile_id}, user {user_id}")

    def disconnect(self, profile_id: str, user_id: str):
        if profile_id in self.active_connections:
            del self.active_connections[profile_id]
            logger.info(f"WebSocket disconnected for profile {profile_id}")
        
        # Clean up user connections
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(profile_id)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def send_personal_message(self, message: str, profile_id: str):
        if profile_id in self.active_connections:
            try:
                await self.active_connections[profile_id].send_text(message)
            except Exception as e:
                logger.error(f"Error sending message to {profile_id}: {e}")
                # Don't disconnect here, let the WebSocket handler manage disconnections

    async def broadcast_to_profile(self, message_data: dict, profile_id: str):
        """Send message to specific profile"""
        message_json = json.dumps(message_data)
        await self.send_personal_message(message_json, profile_id)

    async def broadcast_to_user(self, message_data: dict, user_id: str):
        """Send message to all profiles of a user"""
        message_json = json.dumps(message_data)
        if user_id in self.user_connections:
            for profile_id in self.user_connections[user_id]:
                await self.send_personal_message(message_json, profile_id)

    async def send_new_message(self, message_data: dict, receiver_profile_id: str, sender_profile_id: str):
        """Send new message notification to receiver"""
        websocket_message = {
            "type": "new_message",
            "data": message_data
        }
        await self.broadcast_to_profile(websocket_message, receiver_profile_id)
        
        # Also send to sender for real-time sync (optional)
        confirmation_message = {
            "type": "message_sent",
            "data": {**message_data, "status": "sent"}
        }
        await self.broadcast_to_profile(confirmation_message, sender_profile_id)

    async def send_message_read(self, message_id: str, reader_profile_id: str, sender_profile_id: str):
        """Notify sender that their message was read"""
        read_data = {
            "type": "message_read",
            "data": {
                "message_id": message_id,
                "reader_profile_id": reader_profile_id
            }
        }
        await self.broadcast_to_profile(read_data, sender_profile_id)

    async def send_typing_indicator(self, sender_profile_id: str, receiver_profile_id: str, is_typing: bool):
        """Send typing indicator to receiver"""
        typing_data = {
            "type": "typing",
            "data": {
                "sender_profile_id": sender_profile_id,
                "is_typing": is_typing
            }
        }
        await self.broadcast_to_profile(typing_data, receiver_profile_id)

    async def send_notification(self, user_id: str, notification_data: dict):
        """Send notification to user across all their profiles"""
        websocket_message = {
            "type": "notification",
            "data": notification_data
        }
        await self.broadcast_to_user(websocket_message, user_id)

manager = ConnectionManager()