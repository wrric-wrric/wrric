# websocket/router.py
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ws_module.messages.dependencies import get_current_user_websocket, get_user_profile
from ws_module.messages.connection_manager import manager
from ws_module.messages.message_handler import WebSocketMessageHandler
from utils.database import get_db
from models.db_models import User, Profile

logger = logging.getLogger(__name__)
websocket_router = APIRouter()

@websocket_router.websocket("/messages")
async def websocket_endpoint(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db)
):
    """WebSocket endpoint for real-time messaging and notifications"""
    user = None
    profile = None
    
    try:
        # Authenticate user
        user = await get_current_user_websocket(websocket, db)
        if not user:
            return

        # Get user's profile
        profile = await get_user_profile(user, db)
        profile_id = str(profile.id)
        user_id = str(user.id)

        # Connect to manager
        await manager.connect(websocket, profile_id, user_id)
        
        # Initialize message handler
        message_handler = WebSocketMessageHandler(db)
        
        logger.info(f"WebSocket connection established for user {user_id}, profile {profile_id}")
        
        # Listen for incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                await _handle_incoming_message(data, message_handler, profile_id, user_id)
                
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for profile {profile_id}")
                break
            except Exception as e:
                logger.error(f"Error receiving WebSocket message: {e}")
                # Continue listening for messages despite errors
                continue
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected during setup for user {user.id if user else 'unknown'}")
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
    finally:
        # Clean up connection
        if user and profile:
            manager.disconnect(str(profile.id), str(user.id))

async def _handle_incoming_message(data: str, message_handler: WebSocketMessageHandler, profile_id: str, user_id: str):
    """Handle incoming WebSocket message"""
    try:
        message_data = json.loads(data)
        await message_handler.handle_message(message_data, profile_id, user_id)
        
    except json.JSONDecodeError:
        logger.error("Invalid JSON received via WebSocket")
    except Exception as e:
        logger.error(f"Error handling WebSocket message: {e}")