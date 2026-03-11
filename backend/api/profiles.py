import json
import os
import logging
import asyncio
from typing import List, Optional
import uuid
from fastapi import APIRouter, HTTPException, Depends, status, Form, File, UploadFile
from fastapi import Query as FastAPIQuery
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select, or_, func as sa_func
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession
from api.schemas import ProfileResponse  # <-- Ensure this is updated to new schema
from models.db_models import Profile, Follow, Entity
from utils.database import (
    get_db,
    create_profile,
    get_user_profiles,
    get_default_profile,
    can_create_profile,
    update_profile,
)
from api.dependencies import (
    get_current_user,
)
from media.storage import CustomB2Storage

logger = logging.getLogger(__name__)
router = APIRouter(tags=["profiles"])
load_dotenv()
storage = CustomB2Storage()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

# helper to get presigned url without blocking event loop
async def _get_presigned_url(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    return await asyncio.to_thread(storage.url, key)

@router.post("", response_model=ProfileResponse)
async def create_user_profile(
    profile_type: str = Form(...),
    display_name: Optional[str] = Form(None),
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    date_of_birth: Optional[str] = Form(None),  # Send as "YYYY-MM-DD" string
    gender: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    website: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    organization: Optional[str] = Form(None),
    bio: str = Form(""),
    location: Optional[str] = Form("{}"),  # JSON string
    social_links: Optional[str] = Form("{}"),  # JSON string
    expertise: Optional[str] = Form("[]"),  # JSON string
    profile_image: Optional[UploadFile] = File(None),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new profile with the updated schema. Accepts optional profile_image file.
    location, social_links and expertise are JSON strings.
    date_of_birth is expected as a string in 'YYYY-MM-DD' format.
    """
    logger.info("==== Incoming create_user_profile request ====")
    logger.info(f"profile_type: {profile_type}")
    logger.info(f"display_name: {display_name}")
    logger.info(f"first_name: {first_name}")
    logger.info(f"last_name: {last_name}")
    logger.info(f"date_of_birth: {date_of_birth}")
    logger.info(f"gender: {gender}")
    logger.info(f"phone: {phone}")
    logger.info(f"website: {website}")
    logger.info(f"title: {title}")
    logger.info(f"organization: {organization}")
    logger.info(f"bio: {bio}")
    logger.info(f"location(raw): {location}")
    logger.info(f"social_links(raw): {social_links}")
    logger.info(f"expertise(raw): {expertise}")
    logger.info(f"profile_image: {profile_image.filename if profile_image else None}")
    logger.info(f"current_user: {current_user}")

    # Check if user can create additional profile (max 2)
    can_create, reason = await can_create_profile(db, current_user)
    if not can_create:
        raise HTTPException(status_code=400, detail=reason)

    try:
        # Parse JSON-like fields
        location_obj = json.loads(location or "{}")
        social_links_obj = json.loads(social_links or "{}")
        expertise_list = json.loads(expertise or "[]")

        # Parse date_of_birth if provided
        dob_obj = None
        if date_of_birth:
            from datetime import date
            try:
                dob_obj = date.fromisoformat(date_of_birth)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_of_birth format. Use YYYY-MM-DD.")

        # Handle file upload
        profile_key = None
        if profile_image:
            key = f"profiles/{current_user}/{uuid.uuid4().hex}_{profile_image.filename}"
            content = await profile_image.read()
            logger.info(f"Uploading profile image to key: {key}, size={len(content)} bytes")
            await asyncio.to_thread(
                storage.s3_client.put_object,
                Bucket=storage.bucket_name,
                Key=key,
                Body=content,
                ContentType=profile_image.content_type
            )
            profile_key = key

        # Create DB record
        profile = await create_profile(
            db=db,
            user_id=current_user,
            profile_type=profile_type,
            display_name=display_name,
            first_name=first_name,
            last_name=last_name,
            date_of_birth=dob_obj,
            gender=gender,
            phone=phone,
            website=website,
            title=title,
            organization=organization,
            bio=bio,
            location=location_obj,
            social_links=social_links_obj,
            expertise=expertise_list,
            profile_image=profile_key,
            metadata_={}
        )
        if not profile:
            raise HTTPException(status_code=500, detail="Failed to create profile")

        presigned = await _get_presigned_url(profile.profile_image)

        return ProfileResponse(
                id=profile.id,
                user_id=profile.user_id,
                is_default=profile.is_default,
                type=profile.type,
                display_name=profile.display_name,
                first_name=profile.first_name,
                last_name=profile.last_name,
                date_of_birth=profile.date_of_birth,
                gender=profile.gender,
                phone=profile.phone,
                website=profile.website,
                title=profile.title,
                organization=profile.organization,
                bio=profile.bio,
                location=profile.location,
                social_links=profile.social_links,
                expertise=profile.expertise,
                profile_image=presigned,
                metadata=profile.metadata_,
                created_at=profile.created_at,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in create_user_profile")
        raise HTTPException(status_code=500, detail=f"Failed to create profile: {str(e)}")




@router.get("/browse")
async def browse_profiles(
    search: Optional[str] = FastAPIQuery(None),
    type: Optional[str] = FastAPIQuery(None),
    page: int = FastAPIQuery(1, ge=1),
    limit: int = FastAPIQuery(12, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — browse all profiles (no auth required)."""
    try:
        offset = (page - 1) * limit

        query = select(Profile)

        if search:
            term = f"%{search}%"
            query = query.where(
                or_(
                    Profile.display_name.ilike(term),
                    Profile.first_name.ilike(term),
                    Profile.last_name.ilike(term),
                    Profile.title.ilike(term),
                    Profile.organization.ilike(term),
                    Profile.bio.ilike(term),
                )
            )

        if type:
            query = query.where(Profile.type == type)

        # Count total
        count_q = select(sa_func.count()).select_from(query.subquery())
        total = (await db.execute(count_q)).scalar() or 0

        # Fetch page
        query = query.order_by(Profile.created_at.desc()).offset(offset).limit(limit)
        result = await db.execute(query)
        profiles = result.scalars().all()

        items = []
        for p in profiles:
            presigned = await _get_presigned_url(p.profile_image)

            # Stats: labs created by this user
            labs_count_q = select(sa_func.count()).where(Entity.created_by_user_id == p.user_id)
            labs_created = (await db.execute(labs_count_q)).scalar() or 0

            # Stats: followers (people following this user)
            followers_q = select(sa_func.count()).where(
                Follow.target_type == "user", Follow.target_id == p.user_id
            )
            follower_count = (await db.execute(followers_q)).scalar() or 0

            bio_truncated = (p.bio or "")[:200]

            items.append({
                "id": str(p.id),
                "type": p.type,
                "title": p.title,
                "display_name": p.display_name,
                "organization": p.organization,
                "bio": bio_truncated,
                "location": p.location,
                "expertise": p.expertise or [],
                "profile_image": presigned,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "labs_created": labs_created,
                "follower_count": follower_count,
            })

        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit if total else 0,
        }

    except Exception as e:
        logger.exception("Failed to browse profiles")
        raise HTTPException(status_code=500, detail=f"Failed to browse profiles: {str(e)}")


@router.get("", response_model=List[ProfileResponse])
async def get_profiles(
    search: Optional[str] = FastAPIQuery(None),
    type: Optional[str] = FastAPIQuery(None),
    limit: int = FastAPIQuery(20, ge=1, le=100),
    offset: int = FastAPIQuery(0, ge=0),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get profiles with search and filtering. If no search parameters provided, returns current user's profiles."""
    try:
        logger.info(f"Incoming request - search={search}, type={type}, limit={limit}, offset={offset}")
        logger.info(f"Current user: {current_user}")

        # If no search parameters provided, return current user's profiles
        if search is None and type is None:
            logger.info("No search or type provided → fetching user’s own profiles")
            profiles = await get_user_profiles(db, current_user)
        else:
            # Search all profiles excluding current user's profiles
            query = select(Profile).where(Profile.user_id != current_user)
            logger.info("Base query built: filtering out current user’s profiles")

            if search:
                search_terms = f"%{search}%"
                logger.info(f"Applying search filter for term: {search_terms}")
                query = query.where(
                    or_(
                        Profile.display_name.ilike(search_terms),
                        Profile.first_name.ilike(search_terms),
                        Profile.last_name.ilike(search_terms),
                        Profile.title.ilike(search_terms),
                        Profile.organization.ilike(search_terms),
                        Profile.bio.ilike(search_terms),
                        Profile.expertise.contains([search])
                    )
                )

            if type:
                logger.info(f"Applying type filter: {type}")
                query = query.where(Profile.type == type)

            query = query.offset(offset).limit(limit)
            logger.info(f"Final query (SQL): {str(query)}")

            result = await db.execute(query)
            profiles = result.scalars().all()
            logger.info(f"Retrieved {len(profiles)} profiles")

        # Generate response with presigned URLs
        out = []
        for p in profiles:
            presigned = await _get_presigned_url(p.profile_image)
            out.append(ProfileResponse(
                id=p.id,
                user_id=p.user_id,
                is_default=p.is_default,
                type=p.type,
                display_name=p.display_name,
                first_name=p.first_name,
                last_name=p.last_name,
                date_of_birth=p.date_of_birth,
                gender=p.gender,
                phone=p.phone,
                website=p.website,
                title=p.title,
                organization=p.organization,
                bio=p.bio,
                location=p.location,
                social_links=p.social_links,
                expertise=p.expertise,
                profile_image=presigned,
                metadata_=p.metadata_,
                created_at=p.created_at
            ))

        logger.info(f"Returning {len(out)} profiles to client")
        return out

    except Exception as e:
        logger.exception("Failed to retrieve profiles")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve profiles: {str(e)}")




@router.get("/{profile_id}", response_model=ProfileResponse)
async def get_profile(
    profile_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(select(Profile).where(Profile.id == profile_id))
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        presigned = await _get_presigned_url(profile.profile_image)

        return ProfileResponse(
            id=profile.id,
            user_id=profile.user_id,
            is_default=profile.is_default,
            type=profile.type,
            display_name=profile.display_name,
            first_name=profile.first_name,
            last_name=profile.last_name,
            date_of_birth=profile.date_of_birth,
            gender=profile.gender,
            phone=profile.phone,
            website=profile.website,
            title=profile.title,
            organization=profile.organization,
            bio=profile.bio,
            location=profile.location,
            social_links=profile.social_links,
            expertise=profile.expertise,
            profile_image=presigned,
            metadata=profile.metadata_,
            created_at=profile.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get profile {profile_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get profile: {str(e)}")

@router.put("/{profile_id}", response_model=ProfileResponse)
async def update_user_profile(
    profile_id: str,
    display_name: Optional[str] = Form(None),
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    date_of_birth: Optional[str] = Form(None),  # "YYYY-MM-DD" or None
    gender: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    website: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    organization: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    location: Optional[str] = Form(None),
    social_links: Optional[str] = Form(None),
    expertise: Optional[str] = Form(None),
    profile_image: Optional[UploadFile] = File(None),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        patch = {}
        if display_name is not None: patch['display_name'] = display_name
        if first_name is not None: patch['first_name'] = first_name
        if last_name is not None: patch['last_name'] = last_name
        if gender is not None: patch['gender'] = gender
        if phone is not None: patch['phone'] = phone
        if website is not None: patch['website'] = website
        if title is not None: patch['title'] = title
        if organization is not None: patch['organization'] = organization
        if bio is not None: patch['bio'] = bio

        if date_of_birth is not None:
            from datetime import date
            try:
                patch['date_of_birth'] = date.fromisoformat(date_of_birth) if date_of_birth else None
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date_of_birth format.")

        if location is not None: patch['location'] = json.loads(location or "{}")
        if social_links is not None: patch['social_links'] = json.loads(social_links or "{}")
        if expertise is not None: patch['expertise'] = json.loads(expertise or "[]")

        if profile_image:
            result = await db.execute(select(Profile).where(Profile.id == profile_id, Profile.user_id == uuid.UUID(current_user)))
            existing = result.scalars().first()
            old_key = existing.profile_image if existing else None

            new_key = f"profiles/{current_user}/{uuid.uuid4().hex}_{profile_image.filename}"
            content = await profile_image.read()
            await asyncio.to_thread(
                storage.s3_client.put_object,
                Bucket=storage.bucket_name,
                Key=new_key,
                Body=content,
                ContentType=profile_image.content_type
            )
            patch['profile_image'] = new_key

            if old_key:
                try:
                    await asyncio.to_thread(
                        storage.s3_client.delete_object,
                        Bucket=storage.bucket_name,
                        Key=old_key
                    )
                except Exception:
                    logger.exception("Failed to delete old profile image %s", old_key)

        profile = await update_profile(db, profile_id, current_user, **patch)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found or not authorized")

        presigned = await _get_presigned_url(profile.profile_image)
        return ProfileResponse(
            id=profile.id,
            user_id=profile.user_id,
            is_default=profile.is_default,
            type=profile.type,
            display_name=profile.display_name,
            first_name=profile.first_name,
            last_name=profile.last_name,
            date_of_birth=profile.date_of_birth,
            gender=profile.gender,
            phone=profile.phone,
            website=profile.website,
            title=profile.title,
            organization=profile.organization,
            bio=profile.bio,
            location=profile.location,
            social_links=profile.social_links,
            expertise=profile.expertise,
            profile_image=presigned,
            metadata=profile.metadata_,
            created_at=profile.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")


@router.post("/{profile_id}/set-default")
async def set_default_profile(
    profile_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Set a profile as the default profile for the current user."""
    try:
        # Verify ownership
        result = await db.execute(
            select(Profile).where(Profile.id == profile_id, Profile.user_id == uuid.UUID(current_user))
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Unset default for all user's profiles
        from sqlalchemy import update as sa_update
        await db.execute(
            sa_update(Profile)
            .where(Profile.user_id == uuid.UUID(current_user))
            .values(is_default=False)
        )

        # Set selected profile as default
        profile.is_default = True
        await db.commit()

        return {"message": "Profile set as default", "profile_id": profile_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set default profile {profile_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to set default profile")


@router.delete("/{profile_id}")
async def delete_user_profile(
    profile_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a profile (cannot delete default profile)."""
    try:
        # Verify ownership
        result = await db.execute(
            select(Profile).where(Profile.id == profile_id, Profile.user_id == uuid.UUID(current_user))
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Prevent deletion of default profile
        if profile.is_default:
            raise HTTPException(status_code=400, detail="Cannot delete default profile")

        # Check if user would have at least 1 profile left
        from sqlalchemy import func
        count_result = await db.execute(
            select(func.count(Profile.id))
            .where(Profile.user_id == uuid.UUID(current_user))
        )
        profile_count = count_result.scalar() or 0
        if profile_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the only profile")

        # Delete profile
        from sqlalchemy import delete as sa_delete
        await db.execute(sa_delete(Profile).where(Profile.id == profile_id))
        await db.commit()

        return {"message": "Profile deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete profile {profile_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete profile")
