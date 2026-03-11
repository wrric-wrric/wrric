import logging
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import verify_admin
from media.storage import CustomB2Storage
from utils.database import get_db
from sqlalchemy import select
from models.db_models import Event

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-upload"])
storage = CustomB2Storage()


@router.post("/events/image")
async def upload_event_image(
    image_type: str = Form(...),  # "featured" or "banner"
    event_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload an image for an event (featured or banner) with FormData support.
    Returns the uploaded image URL that can be used in event creation/update.
    Admins can upload images for any event.
    """
    try:
        # Validate image type
        if image_type not in ["featured", "banner"]:
            raise HTTPException(status_code=400, detail="Invalid image type. Must be 'featured' or 'banner'")

        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.content_type}. Allowed: JPEG, PNG, WebP, GIF"
            )

        # Validate file size (max 10MB)
        content = await file.read()
        file_size = len(content)
        if file_size > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Max size: 10MB")

        # Generate unique filename
        file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"

        # Determine storage path
        if event_id:
            # Validate event exists
            try:
                event_uuid = uuid.UUID(event_id)
                result = await db.execute(
                    select(Event).where(Event.id == event_uuid)
                )
                event = result.scalars().first()

                if not event:
                    raise HTTPException(status_code=404, detail="Event not found")

                # Admins can upload images for any event
                # For existing event
                key = f"events/{event_id}/{image_type}/{unique_filename}"
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid event ID format")
        else:
            # For new event (temporary storage)
            key = f"events/temp/{admin_user}/{image_type}/{unique_filename}"
        
        # Upload to storage
        await file.seek(0)  # Reset file pointer
        await storage.upload_file(key, file.file, file.content_type)
        
        # Generate presigned URL (valid for 7 days)
        presigned_url = storage.url(key, expires_in=604800)  # 7 days in seconds
        
        return {
            "key": key,
            "url": presigned_url,
            "content_type": file.content_type,
            "size": file_size,
            "filename": file.filename,
            "image_type": image_type,
            "event_id": event_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload event image: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload image")


@router.delete("/events/image")
async def delete_event_image(
    image_key: str = Form(...),
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete an uploaded event image.
    Admins can delete any event image.
    """
    try:
        # Check if it's a temp image
        if image_key.startswith("events/temp/"):
            # Delete temp image
            await storage.delete_file(image_key)
            return {"message": "Image deleted successfully"}

        # Check if it's an event image
        if image_key.startswith("events/"):
            parts = image_key.split('/')
            if len(parts) >= 2:
                event_id = parts[1]
                try:
                    event_uuid = uuid.UUID(event_id)
                    result = await db.execute(
                        select(Event).where(Event.id == event_uuid)
                    )
                    event = result.scalars().first()

                    if event:
                        # Admin can delete any event image
                        await storage.delete_file(image_key)

                        # Update the event record if needed
                        if "featured" in image_key:
                            event.featured_image_url = None
                        elif "banner" in image_key:
                            event.banner_image_url = None

                        await db.commit()
                        return {"message": "Image deleted successfully"}

                except ValueError:
                    pass

        raise HTTPException(status_code=404, detail="Image not found or invalid key")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete event image: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete image")