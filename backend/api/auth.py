import logging
import os
import uuid
import bcrypt
import logging
import json
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Form, Response, status
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from api.schemas import ProfileResponse
from models.db_models import User, Profile, PasswordReset
from utils.database import get_db, create_default_profile, get_user_profiles, get_default_profile
from api.dependencies import get_current_user, create_access_token

logger = logging.getLogger(__name__)
router = APIRouter(tags=["auth"])


# Environment variables (configure these in .env)
GOOGLE_CLIENT_ID = None
GOOGLE_CLIENT_SECRET = None
GOOGLE_REDIRECT_URI = None
LINKEDIN_CLIENT_ID = None
LINKEDIN_CLIENT_SECRET = None
LINKEDIN_REDIRECT_URI = None


def load_oauth_config():
    """Load OAuth configuration from environment variables."""
    global GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
    global LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
    LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID", "")
    LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "")
    LINKEDIN_REDIRECT_URI = os.getenv("LINKEDIN_REDIRECT_URI", "http://localhost:8000/api/auth/linkedin/callback")


class GoogleTokenResponse(BaseModel):
    access_token: str


class InvitationSetupRequest(BaseModel):
    token: str
    password: str
    accept: bool  # True to accept, False to decline


class InvitationStatusResponse(BaseModel):
    valid: bool
    expired: bool = False
    used: bool = False
    user_email: Optional[str] = None
    profile_type: Optional[str] = None
    refresh_token: Optional[str]
    expires_in: int
    token_type: str
    scope: str
    id_token: Optional[str]


class LinkedInTokenResponse(BaseModel):
    access_token: str
    expires_in: int
    token_type: str


class GoogleUserInfo(BaseModel):
    sub: str
    email: Optional[str]
    name: str
    given_name: str
    family_name: str
    picture: Optional[str]


class LinkedInUserInfo(BaseModel):
    sub: str
    name: str
    given_name: str
    family_name: str
    picture: Optional[str] = None
    email: Optional[str] = None
    email_verified: Optional[bool] = None


@router.get("/google/login")
async def google_login():
    """
    Redirect user to Google OAuth login page.
    """
    load_oauth_config()

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope=openid email profile"
    )

    return {
        "auth_url": google_auth_url,
        "provider": "google"
    }


@router.get("/google/callback")
async def google_callback(
    code: str,
    state: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Google OAuth callback.
    Redirects to frontend with authentication info.
    """
    load_oauth_config()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        error_url = f"{frontend_url}/auth/callback?error=google_config_error"
        return RedirectResponse(url=error_url)

    try:
        # Exchange authorization code for access token
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code"
        }

        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data=token_data)

        if token_response.status_code != 200:
            logger.error(f"Google token exchange failed: {token_response.status_code}")
            error_url = f"{frontend_url}/auth/callback?error=token_exchange_failed"
            return RedirectResponse(url=error_url)

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            logger.error("No access token in Google response")
            error_url = f"{frontend_url}/auth/callback?error=invalid_token_response"
            return RedirectResponse(url=error_url)

        # Get user info from Google
        user_info_url = "https://www.googleapis.com/oauth2/v3/userinfo"
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient() as client:
            user_info_response = await client.get(user_info_url, headers=headers)

        if user_info_response.status_code != 200:
            logger.error(f"Failed to get Google user info: {user_info_response.status_code}")
            error_url = f"{frontend_url}/auth/callback?error=user_info_failed"
            return RedirectResponse(url=error_url)

        user_info_json = user_info_response.json()
        user_info = GoogleUserInfo(**user_info_json)

        # Check if user exists by email
        result = await db.execute(
            select(User).where(User.email == user_info.email)
        )
        existing_user = result.scalar_one_or_none()

        if existing_user:
            # Log in existing user
            app_access_token = create_access_token(data={"sub": str(existing_user.id)}, expires_delta=timedelta(days=1))

            # Get user's profiles
            profiles = await get_user_profiles(db, str(existing_user.id))

            # Get default profile
            default_profile = await get_default_profile(db, str(existing_user.id))

            # Build profile JSON
            profiles_json = [
                {
                    "id": str(p.id),
                    "user_id": str(p.user_id),
                    "is_default": p.is_default,
                    "type": p.type,
                    "display_name": p.display_name,
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "bio": p.bio,
                    "title": p.title,
                    "organization": p.organization,
                    "profile_image": p.profile_image,
                    "created_at": p.created_at.isoformat() if p.created_at else None
                } for p in profiles
            ]

            redirect_url = (
                f"{frontend_url}/auth/callback?"
                f"access_token={app_access_token}&"
                f"user_id={existing_user.id}&"
                f"existing_user=true&"
                f"profiles_json={json.dumps(profiles_json)}&"
                f"default_profile_id={default_profile.id if default_profile else ''}"
            )
            return RedirectResponse(url=redirect_url)

        # Create new user and profile
        username = user_info.email.split('@')[0]
        oauth_password = bcrypt.hashpw(f"oauth_{uuid.uuid4().hex}".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        try:
            new_user = User(
                username=username,
                email=user_info.email,
                password=oauth_password,
                is_admin=False
            )

            db.add(new_user)
            await db.commit()
            await db.refresh(new_user)

            # Create default profile
            default_profile = await create_default_profile(
                db, new_user.id, new_user.username,
                new_user.email, user_info.picture
            )

            if not default_profile:
                logger.error(f"Failed to create default profile for user {new_user.id}")
                error_url = f"{frontend_url}/auth/callback?error=profile_creation_failed"
                return RedirectResponse(url=error_url)

            # Generate access token
            app_access_token = create_access_token(data={"sub": str(new_user.id)}, expires_delta=timedelta(days=1))

            logger.info(f"Created new user via Google OAuth: {new_user.id}")

            # Build profile JSON
            profiles_json = [{
                "id": str(default_profile.id),
                "user_id": str(default_profile.user_id),
                "is_default": default_profile.is_default,
                "type": default_profile.type,
                "display_name": default_profile.display_name,
                "first_name": default_profile.first_name,
                "last_name": default_profile.last_name,
                "bio": default_profile.bio,
                "title": default_profile.title,
                "organization": default_profile.organization,
                "profile_image": default_profile.profile_image,
                "created_at": default_profile.created_at.isoformat() if default_profile.created_at else None
            }]

            redirect_url = (
                f"{frontend_url}/auth/callback?"
                f"access_token={app_access_token}&"
                f"user_id={new_user.id}&"
                f"existing_user=false&"
                f"profiles_json={json.dumps(profiles_json)}&"
                f"default_profile_id={default_profile.id}"
            )
            return RedirectResponse(url=redirect_url)
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create user or profile in Google OAuth: {str(e)}")
            error_url = f"{frontend_url}/auth/callback?error=user_creation_failed"
            return RedirectResponse(url=error_url)

    except Exception as e:
        logger.exception(f"Google OAuth callback error: {str(e)}")
        error_url = f"{frontend_url}/auth/callback?error=authentication_failed"
        return RedirectResponse(url=error_url)


@router.get("/linkedin/login")
async def linkedin_login():
    """
    Redirect user to LinkedIn OAuth login page.
    """
    load_oauth_config()

    if not LINKEDIN_CLIENT_ID or not LINKEDIN_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="LinkedIn OAuth not configured")

    # Generate state parameter for CSRF protection
    state = str(uuid.uuid4())

    linkedin_auth_url = (
        f"https://www.linkedin.com/oauth/v2/authorization?"
        f"response_type=code&"
        f"client_id={LINKEDIN_CLIENT_ID}&"
        f"redirect_uri={LINKEDIN_REDIRECT_URI}&"
        f"state={state}&"
        f"scope=openid%20profile%20email"
    )

    return {
        "auth_url": linkedin_auth_url,
        "provider": "linkedin",
        "state": state
    }


@router.get("/linkedin/callback")
async def linkedin_callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    state: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle LinkedIn OAuth callback.
    Redirects to frontend with authentication info.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    if error:
        logger.error(f"LinkedIn OAuth error: {error} - {error_description}")
        error_url = f"{frontend_url}/auth/callback?error=linkedin_oauth_error&message={error_description or error}"
        return RedirectResponse(url=error_url)

    if not code:
        error_url = f"{frontend_url}/auth/callback?error=code_missing"
        return RedirectResponse(url=error_url)

    load_oauth_config()

    if not LINKEDIN_CLIENT_ID or not LINKEDIN_CLIENT_SECRET:
        error_url = f"{frontend_url}/auth/callback?error=linkedin_config_error"
        return RedirectResponse(url=error_url)

    try:
        # Exchange authorization code for access token
        token_url = "https://www.linkedin.com/oauth/v2/accessToken"
        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": LINKEDIN_REDIRECT_URI,
            "client_id": LINKEDIN_CLIENT_ID,
            "client_secret": LINKEDIN_CLIENT_SECRET,
        }

        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data=token_data)

        if token_response.status_code != 200:
            logger.error(f"LinkedIn token exchange failed: {token_response.status_code}")
            error_url = f"{frontend_url}/auth/callback?error=token_exchange_failed"
            return RedirectResponse(url=error_url)

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            logger.error("No access token in LinkedIn response")
            error_url = f"{frontend_url}/auth/callback?error=invalid_token_response"
            return RedirectResponse(url=error_url)

        # Get user info from LinkedIn using the new OpenID Connect userinfo endpoint
        headers = {
            "Authorization": f"Bearer {access_token}"
        }

        # Use the new userinfo endpoint
        userinfo_url = "https://api.linkedin.com/v2/userinfo"
        async with httpx.AsyncClient() as client:
            userinfo_response = await client.get(userinfo_url, headers=headers)

        if userinfo_response.status_code != 200:
            logger.error(f"Failed to get LinkedIn user info: {userinfo_response.status_code}")
            error_url = f"{frontend_url}/auth/callback?error=userinfo_failed"
            return RedirectResponse(url=error_url)

        user_info_json = userinfo_response.json()

        try:
            user_info = LinkedInUserInfo(**user_info_json)
        except Exception as e:
            logger.error(f"Failed to parse LinkedIn user info: {str(e)}")
            error_url = f"{frontend_url}/auth/callback?error=parse_failed"
            return RedirectResponse(url=error_url)

        # Check if user exists by email
        email = user_info.email
        if email:
            result = await db.execute(
                select(User).where(User.email == email)
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                # Log in existing user
                app_access_token = create_access_token(data={"sub": str(existing_user.id)}, expires_delta=timedelta(days=1))

                # Get user's profiles
                profiles = await get_user_profiles(db, str(existing_user.id))

                # Get default profile
                default_profile = await get_default_profile(db, str(existing_user.id))

                # Build profile JSON
                profiles_json = [
                    {
                        "id": str(p.id),
                        "user_id": str(p.user_id),
                        "is_default": p.is_default,
                        "type": p.type,
                        "display_name": p.display_name,
                        "first_name": p.first_name,
                        "last_name": p.last_name,
                        "bio": p.bio,
                        "title": p.title,
                        "organization": p.organization,
                        "profile_image": p.profile_image,
                        "created_at": p.created_at.isoformat() if p.created_at else None
                    } for p in profiles
                ]

                redirect_url = (
                    f"{frontend_url}/auth/callback?"
                    f"access_token={app_access_token}&"
                    f"user_id={existing_user.id}&"
                    f"existing_user=true&"
                    f"profiles_json={json.dumps(profiles_json)}&"
                    f"default_profile_id={default_profile.id if default_profile else ''}"
                )
                return RedirectResponse(url=redirect_url)

        # Create new user and profile
        # LinkedIn doesn't provide username, use email as username
        username = email.split('@')[0] if email else f"linkedin_{uuid.uuid4().hex[:8]}"
        oauth_password = bcrypt.hashpw(f"oauth_{uuid.uuid4().hex}".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        try:
            new_user = User(
                username=username,
                email=email,
                password=oauth_password,
                is_admin=False
            )

            db.add(new_user)
            await db.commit()
            await db.refresh(new_user)

            # Create default profile
            name = user_info.name if user_info.name else f"{user_info.given_name or ''} {user_info.family_name or ''}".strip()
            picture_url = user_info.picture

            default_profile = await create_default_profile(
                db, new_user.id, new_user.username,
                email, picture_url
            )

            if not default_profile:
                logger.error(f"Failed to create default profile for user {new_user.id}")
                error_url = f"{frontend_url}/auth/callback?error=profile_creation_failed"
                return RedirectResponse(url=error_url)

            # Generate access token
            app_access_token = create_access_token(data={"sub": str(new_user.id)}, expires_delta=timedelta(days=1))

            logger.info(f"Created new user via LinkedIn OAuth: {new_user.id}")

            # Build profile JSON
            profiles_json = [{
                "id": str(default_profile.id),
                "user_id": str(default_profile.user_id),
                "is_default": default_profile.is_default,
                "type": default_profile.type,
                "display_name": default_profile.display_name,
                "first_name": default_profile.first_name,
                "last_name": default_profile.last_name,
                "bio": default_profile.bio,
                "title": default_profile.title,
                "organization": default_profile.organization,
                "profile_image": default_profile.profile_image,
                "created_at": default_profile.created_at.isoformat() if default_profile.created_at else None
            }]

            redirect_url = (
                f"{frontend_url}/auth/callback?"
                f"access_token={app_access_token}&"
                f"user_id={new_user.id}&"
                f"existing_user=false&"
                f"profiles_json={json.dumps(profiles_json)}&"
                f"default_profile_id={default_profile.id}"
            )
            return RedirectResponse(url=redirect_url)
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create user or profile in LinkedIn OAuth: {str(e)}")
            error_url = f"{frontend_url}/auth/callback?error=user_creation_failed"
            return RedirectResponse(url=error_url)

    except Exception as e:
        logger.exception(f"LinkedIn OAuth callback error: {str(e)}")
        error_url = f"{frontend_url}/auth/callback?error=authentication_failed"
        return RedirectResponse(url=error_url)


@router.post("/oauth/set-password")
async def set_oauth_password(
    password: str = Form(...),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Set password for OAuth-created accounts (password set during registration).
    """
    try:
        result = await db.execute(
            select(User).where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if len(password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user.password = hashed_password
        user.updated_at = datetime.utcnow()
        await db.commit()

        logger.info(f"Password set for user {user_id}")
        return {"message": "Password updated successfully"}

    except Exception as e:
        logger.exception(f"Error setting OAuth password: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update password")


@router.post("/jwt/login")
async def jwt_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    OAuth2 compatible token login for Swagger UI.
    Bypasses reCAPTCHA for easier testing.
    """
    from utils.database import authenticate_user
    
    user = await authenticate_user(
        db, 
        username=form_data.username, 
        password=form_data.password,
        email=form_data.username if "@" in form_data.username else None
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": str(user.id)}, 
        expires_delta=timedelta(days=1)
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.get("/providers")
async def get_auth_providers():
    """
    Get available OAuth providers.
    """
    load_oauth_config()

    providers = []

    if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
        providers.append({
            "name": "google",
            "display_name": "Google",
            "login_url": "/google/login",
            "auth_url": "/google/callback"
        })

    if LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET:
        providers.append({
            "name": "linkedin",
            "display_name": "LinkedIn",
            "login_url": "/linkedin/login",
            "auth_url": "/linkedin/callback"
        })

    return {"providers": providers}


@router.get("/invitation-status", response_model=InvitationStatusResponse)
async def check_invitation_status(token: str, db: AsyncSession = Depends(get_db)):
    """
    Check if an invitation token is valid.
    """
    try:
        result = await db.execute(
            select(PasswordReset).where(
                PasswordReset.token == token,
                PasswordReset.is_used == False
            )
        )
        reset_entry = result.scalar_one_or_none()

        if not reset_entry:
            return InvitationStatusResponse(valid=False)

        if reset_entry.expires_at < datetime.utcnow():
            return InvitationStatusResponse(valid=False, expired=True)

        # Get user and profile info
        user_result = await db.execute(
            select(User).where(User.id == reset_entry.user_id)
        )
        user = user_result.scalar_one_or_none()

        profile_result = await db.execute(
            select(Profile).where(
                Profile.user_id == reset_entry.user_id,
                Profile.is_default == True
            )
        )
        profile = profile_result.scalar_one_or_none()

        return InvitationStatusResponse(
            valid=True,
            user_email=user.email if user else None,
            profile_type=profile.type if profile else None
        )

    except Exception as e:
        logger.error(f"Error checking invitation status: {str(e)}")
        return InvitationStatusResponse(valid=False)


@router.post("/invitation-setup")
async def setup_invitation(
    request: InvitationSetupRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Accept or decline invitation, and set password if accepting.
    """
    try:
        result = await db.execute(
            select(PasswordReset).where(
                PasswordReset.token == request.token,
                PasswordReset.is_used == False
            )
        )
        reset_entry = result.scalar_one_or_none()

        if not reset_entry:
            raise HTTPException(status_code=400, detail="Invalid or used token")

        if reset_entry.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Token expired")

        user_result = await db.execute(
            select(User).where(User.id == reset_entry.user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if request.accept:
            # Set password and activate account
            if len(request.password) < 8:
                raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

            hashed_password = bcrypt.hashpw(request.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            user.password = hashed_password
            user.updated_at = datetime.utcnow()

            # Update profile invitation status
            profile_result = await db.execute(
                select(Profile).where(
                    Profile.user_id == reset_entry.user_id,
                    Profile.import_batch_id.isnot(None)
                )
            )
            profile = profile_result.scalar_one_or_none()
            
            if profile:
                profile.invitation_status = 'accepted'
                profile.invitation_responded_at = datetime.utcnow()

            # Mark token as used
            reset_entry.is_used = True
            reset_entry.updated_at = datetime.utcnow()

            await db.commit()

            logger.info(f"User {user.id} accepted invitation and set password")
            return {"message": "Account activated successfully. You can now log in."}
        else:
            # Update profile status and delete user
            profile_result = await db.execute(
                select(Profile).where(
                    Profile.user_id == reset_entry.user_id,
                    Profile.import_batch_id.isnot(None)
                )
            )
            profile = profile_result.scalar_one_or_none()
            
            if profile:
                profile.invitation_status = 'declined'
                profile.invitation_responded_at = datetime.utcnow()

            await db.delete(user)  # Cascades to profiles and password resets
            await db.commit()

            logger.info(f"User {user.id} declined invitation, account deleted")
            return {"message": "Invitation declined. Your information has been removed."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting up invitation: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to process invitation")
