import asyncio
import os
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from models.db_models import Entity
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from utils.database import check_and_reconnect, get_db
from utils.favicon_extraction.favicon_fetch import fetch_favicons
from media.storage import CustomB2Storage
import re
import json
import uuid
from dotenv import load_dotenv
from typing import Dict, List, Any
from models.db_models import User


logger = logging.getLogger(__name__)

load_dotenv(override=True)

JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
JWT_ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/jwt/login")
storage = CustomB2Storage()

class UUIDEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle UUID objects."""
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return int(obj.timestamp())  # Convert datetime to Unix timestamp integer
        return super().default(obj)

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Create a JWT access token with proper UUID and exp serialization."""
    to_encode = data.copy()
    # Convert UUID to string in the payload
    if "sub" in to_encode and isinstance(to_encode["sub"], uuid.UUID):
        to_encode["sub"] = str(to_encode["sub"])
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": int(expire.timestamp())})  # Ensure exp is an integer Unix timestamp
    # Pre-serialize to handle any remaining non-serializable objects
    serialized_payload = json.dumps(to_encode, cls=UUIDEncoder)
    encoded_jwt = jwt.encode(json.loads(serialized_payload), JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    """Validate JWT token and return user_id, or None for guest."""
    from models.db_models import User

    logger.debug(f"Received token for verify-token: {token}")
    if not token or token == "null":
        logger.warning("No token provided")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        if token.startswith("Bearer "):
            token = token[len("Bearer "):]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        logger.debug(f"Decoded user_id: {user_id}")
        if user_id is None:
            logger.warning("No sub claim in token")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        try:
            uuid_obj = uuid.UUID(user_id)
        except ValueError:
            logger.warning(f"Invalid UUID format: {user_id}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user ID format")
        result = await db.execute(
            select(User).where(User.id == uuid_obj)
        )
        user = result.scalars().first()
        if user is None:
            logger.warning(f"User not found: {user_id}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        if user.is_suspended:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")
        logger.debug(f"Authenticated user: {user_id}")
        return user_id
    except JWTError as e:
        logger.error(f"JWT decode error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except ValueError as e:
        logger.error(f"Invalid UUID in token: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid UUID: {str(e)}")


async def verify_admin(current_user: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user_uuid = current_user
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user or not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return str(user.id)  # Return user ID string, not User object


def sanitize_filename(title: str) -> str:
    """Sanitize a string to be safe for use as a filename."""
    if not title:
        return "session_export"
    sanitized = re.sub(r'[\/:*?"<>|]', '_', title)
    sanitized = sanitized.replace(' ', '_')
    sanitized = sanitized.strip('_')
    return sanitized if sanitized else "session_export"



async def validate_entities(db: AsyncSession, entity_ids: List[int], entity_urls: List[str]) -> List[dict]:
    """Validate entity IDs and URLs, returning a list of valid entity details."""
    await check_and_reconnect(db)
    valid_entities = []
    seen_urls = set()

    # Validate entity IDs
    for entity_id in set(entity_ids):  # Remove duplicates
        try:
            result = await db.execute(select(Entity).where(Entity.id == entity_id))
            entity = result.scalars().first()
            if entity:
                if entity.url and entity.url not in seen_urls:
                    valid_entities.append({
                        "id": entity_id,
                        "url": entity.url,
                        "university": entity.university or "Unknown Institution"
                    })
                    seen_urls.add(entity.url)
                else:
                    logger.warning(f"Entity ID {entity_id} has no URL or URL is duplicate")
            else:
                logger.warning(f"Entity ID {entity_id} not found")
        except Exception as e:
            logger.error(f"Error validating entity ID {entity_id}: {str(e)}")

    # Validate entity URLs
    for url in set(entity_urls):  # Remove duplicates
        if url not in seen_urls:
            try:
                result = await db.execute(select(Entity).where(Entity.url == url))
                entity = result.scalars().first()
                valid_entities.append({
                    "id": entity.id if entity else None,
                    "url": url,
                    "university": entity.university if entity else "Unknown Institution"
                })
                seen_urls.add(url)
            except Exception as e:
                logger.error(f"Error validating entity URL {url}: {str(e)}")

    return valid_entities


# helper to get presigned url without blocking event loop
async def _get_presigned_url(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    return await asyncio.to_thread(storage.url, key)

