# websocket/dependencies.py
import logging
from fastapi import WebSocket, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.dependencies import get_current_user
from models.db_models import User, Profile

logger = logging.getLogger(__name__)


async def get_current_user_websocket(websocket: WebSocket, db: AsyncSession):
    """Authenticate user via WebSocket connection."""
    try:
        # Get token from query parameters
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None

        # Call the existing token validator (returns user_id)
        user_id = await get_current_user(token, db)
        if not user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None

        # Fetch full user object
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()

        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None

        return user

    except HTTPException as e:
        logger.warning(f"WebSocket authentication failed: {e.detail}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None
    except Exception as e:
        logger.error(f"WebSocket authentication error: {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return None


async def get_user_profile(user: User, db: AsyncSession) -> Profile:
    """Get user's primary profile"""
    try:
        result = await db.execute(
            select(Profile).where(Profile.user_id == user.id).limit(1)
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
            
        return profile
        
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving user profile"
        )