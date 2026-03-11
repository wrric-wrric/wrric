import logging
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from uuid import uuid4
import csv
import io
import secrets
import uuid
import bcrypt
import os

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_
from pydantic import BaseModel, Field

from models.db_models import User, Profile, Session, PasswordReset, ImportBatch
from utils.database import get_db
from api.dependencies import get_current_user, verify_admin
from api.manager_email_service import send_bulk_import_invitation_email
from utils.csv_validator import create_csv_validation_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-users"])


class UserSummary(BaseModel):
    id: str
    username: str
    email: str
    is_admin: bool
    created_at: datetime
    updated_at: datetime
    profile_count: int
    session_count: int
    last_activity: Optional[datetime] = None


class UserDetail(BaseModel):
    id: str
    username: str
    email: str
    is_admin: bool
    profile_image_url: Optional[str]
    created_at: datetime
    updated_at: datetime
    profiles: List[dict]
    recent_sessions: List[dict]
    password_reset_count: int
    last_password_reset: Optional[datetime]


class UserUpdate(BaseModel):
    is_admin: Optional[bool] = None
    username: Optional[str] = None
    is_suspended: Optional[bool] = None


class SuspendRequest(BaseModel):
    reason: Optional[str] = None

class AdminCreateUserRequest(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_type: str = "Standard User"
    is_admin: bool = False


class BulkImportResult(BaseModel):
    success: bool
    message: str
    created_users: int
    skipped_users: int
    errors: List[str]
    field_mapping: Optional[Dict[str, Dict]] = None
    template_info: Optional[Dict] = None
    details: Optional[Dict] = None  # Additional breakdown for frontend


class BulkImportRequest(BaseModel):
    selected_rows: Optional[List[int]] = None  # Row indices to import (0-based)


class CSVValidationResult(BaseModel):
    is_valid: bool
    field_mapping: Dict[str, Dict]
    missing_required: List[str]
    template_info: Dict
    sample_rows: List[Dict]


class BulkUserSummary(BaseModel):
    id: str
    email: str
    full_name: str
    profile_type: str
    invitation_status: str
    invitation_sent_at: Optional[datetime]
    invitation_responded_at: Optional[datetime]
    import_batch_id: Optional[str]


class BulkUsersResponse(BaseModel):
    users: List[BulkUserSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class BulkActionRequest(BaseModel):
    user_ids: List[str]
    action: str  # 'delete', 'retry', 'accept', 'decline'


class ImportStatsResponse(BaseModel):
    total_imported: int
    pending: int
    accepted: int
    declined: int
    expired: int
    acceptance_rate: float
    recent_batches: List[dict]


class UserListResponse(BaseModel):
    users: List[UserSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    admin_only: Optional[bool] = None,
    sort_by: str = Query("created_at", regex="^(username|email|created_at|last_activity)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    List all users with pagination, search, and filtering.
    Only accessible by admin users.
    """
    try:
        offset = (page - 1) * page_size
        
        query = select(
            User.id,
            User.username,
            User.email,
            User.is_admin,
            User.created_at,
            User.updated_at,
            func.count(Profile.id).label("profile_count"),
            func.count(Session.id).label("session_count"),
            func.max(Session.start_time).label("last_activity")
        ).outerjoin(Profile).outerjoin(Session).group_by(User.id)
        
        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    User.username.ilike(search_term),
                    User.email.ilike(search_term)
                )
            )
        
        if admin_only is not None:
            query = query.where(User.is_admin == admin_only)
        
        sort_column = {
            "username": User.username,
            "email": User.email,
            "created_at": User.created_at,
            "last_activity": func.max(Session.start_time)
        }.get(sort_by, User.created_at)
        
        if sort_order == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
        
        total_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(total_query)
        total = total_result.scalar()
        
        result = await db.execute(query.offset(offset).limit(page_size))
        rows = result.all()
        
        users = [
            UserSummary(
                id=str(row.id),
                username=row.username,
                email=row.email,
                is_admin=row.is_admin,
                created_at=row.created_at,
                updated_at=row.updated_at,
                profile_count=row.profile_count,
                session_count=row.session_count,
                last_activity=row.last_activity
            )
            for row in rows
        ]
        
        total_pages = (total + page_size - 1) // page_size
        
        logger.info(f"Admin {admin_user} listed {len(users)} users (page {page})")
        
        return UserListResponse(
            users=users,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    except Exception as e:
        logger.error(f"Error listing users: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list users")

@router.post("")
async def create_user(
    request: AdminCreateUserRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Manually create a new user (admin only) and send an invitation link.
    """
    try:
        # Check if user exists
        existing_result = await db.execute(select(User).where(User.email == request.email))
        if existing_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="User with this email already exists")

        # Generate temp data
        username = request.email.split('@')[0] + str(uuid4().hex[:4])
        temp_password = bcrypt.hashpw(uuid4().hex.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        token = secrets.token_urlsafe(32)

        # Create user
        new_user = User(
            username=username,
            email=request.email,
            password=temp_password,
            is_admin=request.is_admin
        )
        db.add(new_user)
        await db.flush()

        # Create Profile
        display_name = f"{request.first_name or ''} {request.last_name or ''}".strip()
        profile = Profile(
            user_id=new_user.id,
            is_default=True,
            type=request.profile_type,
            first_name=request.first_name,
            last_name=request.last_name,
            display_name=display_name if display_name else username,
            invitation_status='pending',
            invitation_token=token,
            invitation_sent_at=datetime.utcnow(),
            # Make sure it tracks standalone admin imports easily if needed
            import_batch_id="manual_admin_creation"
        )
        db.add(profile)

        # Create password reset token for invitation link
        password_reset = PasswordReset(
            user_id=new_user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(days=7),
            is_used=False
        )
        db.add(password_reset)

        # Send email (same helper as bulk import)
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        invitation_link = f"{frontend_url}/invitation-setup?token={token}"
        full_name = display_name if display_name else request.email

        email_sent = await send_bulk_import_invitation_email(
            email=request.email,
            invitation_link=invitation_link,
            full_name=full_name,
            profile_type=request.profile_type
        )
        if not email_sent:
            logger.error(f"Failed to send invitation email to {request.email}")

        await db.commit()

        return {
            "success": True, 
            "message": "User created successfully", 
            "user_id": str(new_user.id),
            "email_sent": email_sent
        }

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        logger.error(f"Error creating user manually: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create user")

@router.get("/stats/overview")
async def get_user_stats(
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get user statistics for admin dashboard.
    """
    try:
        total_users = await db.execute(select(func.count()).select_from(User))
        total_users = total_users.scalar()
        
        admin_users = await db.execute(
            select(func.count()).where(User.is_admin == True)
        )
        admin_users = admin_users.scalar()
        
        new_users_7d = await db.execute(
            select(func.count()).where(
                User.created_at >= datetime.utcnow() - timedelta(days=7)
            )
        )
        new_users_7d = new_users_7d.scalar()
        
        new_users_30d = await db.execute(
            select(func.count()).where(
                User.created_at >= datetime.utcnow() - timedelta(days=30)
            )
        )
        new_users_30d = new_users_30d.scalar()
        
        total_profiles = await db.execute(select(func.count()).select_from(Profile))
        total_profiles = total_profiles.scalar()
        
        active_sessions = await db.execute(
            select(func.count()).where(Session.is_active == True)
        )
        active_sessions = active_sessions.scalar()
        
        return {
            "total_users": total_users,
            "admin_users": admin_users,
            "regular_users": total_users - admin_users,
            "new_users_7d": new_users_7d,
            "new_users_30d": new_users_30d,
            "total_profiles": total_profiles,
            "active_sessions": active_sessions
        }
    except Exception as e:
        logger.error(f"Error getting user stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get user statistics")


@router.post("/validate-csv", response_model=CSVValidationResult)
async def validate_csv_file(
    file: UploadFile = File(...),
    admin_user: str = Depends(verify_admin)
):
    """
    Validate CSV file and return field mapping without creating users.
    """
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are supported")

        # Read CSV content
        content = await file.read()
        csv_content = io.StringIO(content.decode('utf-8'))
        
        # Try to detect CSV dialect
        sample = csv_content.read(1024)
        csv_content.seek(0)
        
        try:
            dialect = csv.Sniffer().sniff(sample)
        except Exception:
            dialect = csv.excel

        reader = csv.DictReader(csv_content, dialect=dialect)

        # Get headers
        csv_headers = reader.fieldnames or []
        
        # Validate headers and create field mapping
        validator = create_csv_validation_service()
        is_valid, field_mapping, missing_required = validator.validate_csv_headers(csv_headers)
        
        # Get sample rows (first 3 non-empty rows)
        sample_rows = []
        for i, row in enumerate(reader):
            if any(value.strip() for value in row.values()):
                sample_rows.append(dict(row))
                if len(sample_rows) >= 3:
                    break
        
        template_info = validator.get_template_info()
        
        return CSVValidationResult(
            is_valid=is_valid,
            field_mapping=field_mapping,
            missing_required=missing_required,
            template_info=template_info,
            sample_rows=sample_rows
        )
        
    except Exception as e:
        logger.error(f"Error validating CSV: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to validate CSV file")


@router.post("/bulk-import", response_model=BulkImportResult)
async def bulk_import_users(
    file: UploadFile = File(...),
    selected_rows: Optional[str] = None,  # JSON string of list of int indices
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Bulk import users from CSV file and send invitation emails.
    """
    try:
        # Parse selected rows if provided
        selected_indices = None
        if selected_rows:
            try:
                import json
                selected_indices = set(json.loads(selected_rows))
                logger.info(f"Importing selected rows: {selected_indices}")
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid selected_rows format")

        # Read CSV content
        content = await file.read()
        csv_content = io.StringIO(content.decode('utf-8'))
        
        logger.info(f"Processing CSV file: {file.filename}")
        
        # Try to detect CSV dialect
        sample = csv_content.read(1024)
        csv_content.seek(0)
        
        try:
            dialect = csv.Sniffer().sniff(sample)
        except Exception:
            dialect = csv.excel

        reader = csv.DictReader(csv_content, dialect=dialect)
        
        # Validate and create field mapping
        validator = create_csv_validation_service()
        csv_headers = reader.fieldnames or []
        logger.info(f"CSV Headers: {csv_headers}")
        
        is_valid, field_mapping, missing_required = validator.validate_csv_headers(csv_headers)
        logger.info(f"Field mapping valid: {is_valid}, Mapping: {field_mapping}")
        
        if not is_valid:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid CSV format. Missing required fields: {', '.join(missing_required)}"
            )

        created_count = 0
        skipped_count = 0
        errors = []
        total_rows = 0
        
        # Generate batch ID for tracking this import
        import_batch_id = str(uuid.uuid4())

        for row_idx, row in enumerate(reader):
            total_rows = row_idx + 1  # Track total rows processed
            
            logger.debug(f"Processing row {row_idx + 2}: {dict(row)}")
            
            # Skip if not in selected rows
            if selected_indices is not None and row_idx not in selected_indices:
                skipped_count += 1
                logger.info(f"Row {row_idx + 2}: Skipped (not in selected rows)")
                continue

            # Extract user and profile data using field mapping
            user_data = validator.extract_user_data(row, field_mapping)
            profile_data = validator.extract_profile_data(row, field_mapping)
            
            logger.debug(f"Row {row_idx + 2}: Extracted user_data={user_data}, profile_data={profile_data}")
            
            # Validate extracted data
            is_row_valid, row_errors = validator.validate_row_data(user_data, profile_data)
            if not is_row_valid:
                for error in row_errors:
                    errors.append(f"Row {row_idx + 2}: {error}")
                logger.warning(f"Row {row_idx + 2}: Validation failed - {row_errors}")
                skipped_count += 1
                continue

            # Check if user already exists
            email = user_data.get('email', '')
            if not email:
                error_msg = "Email is required but was empty after extraction"
                errors.append(f"Row {row_idx + 2}: {error_msg}")
                logger.warning(f"Row {row_idx + 2}: {error_msg}")
                skipped_count += 1
                continue
                
            existing_user_result = await db.execute(
                select(User).where(User.email == email)
            )
            existing_user = existing_user_result.scalar_one_or_none()
            if existing_user:
                skipped_count += 1
                logger.info(f"Row {row_idx + 2}: User with email {email} already exists, skipping")
                errors.append(f"Row {row_idx + 2}: User with email {email} already exists")
                continue

            # Infer profile type from occupation
            profile_type = validator.infer_profile_type(row, field_mapping)

            # Create invitation token
            token = secrets.token_urlsafe(32)
            
            # Create User with temporary hashed password (same pattern as OAuth)
            # Password will be set by user during invitation acceptance
            username = email.split('@')[0] + str(uuid4().hex[:4])  # Generate unique username
            temp_password_raw = f"temp_import_{uuid4().hex}"  # Temporary password
            temp_password_hashed = bcrypt.hashpw(temp_password_raw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            user = User(
                username=username,
                email=email,
                password=temp_password_hashed,  # Temporary hashed password
                is_admin=False
            )
            db.add(user)
            await db.flush()  # Get user.id

            # Prepare profile data
            profile_kwargs = {
                'user_id': user.id,
                'type': profile_type,
                'is_default': True,
                'invitation_status': 'pending',
                'invitation_token': token,
                'invitation_sent_at': datetime.utcnow(),
                'import_batch_id': import_batch_id
            }
            
            # Add extracted profile data
            for key, value in profile_data.items():
                if key not in profile_kwargs:
                    profile_kwargs[key] = value
            
            # Create Profile
            profile = Profile(**profile_kwargs)
            db.add(profile)

            # Create password reset token for invitation
            expires_at = datetime.utcnow() + timedelta(hours=24)
            password_reset = PasswordReset(
                user_id=user.id,
                token=token,
                expires_at=expires_at,
                is_used=False
            )
            db.add(password_reset)

            # Extract full name for email
            full_name = profile_data.get('display_name') or profile_data.get('first_name', '')
            if profile_data.get('last_name'):
                full_name = f"{full_name} {profile_data.get('last_name')}".strip()

            # Send invitation email with frontend URL
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            invitation_link = f"{frontend_url}/invitation-setup?token={token}"
            
            email_sent = await send_bulk_import_invitation_email(
                email=email,
                invitation_link=invitation_link,
                full_name=full_name or email,
                profile_type=profile_type
            )
            if not email_sent:
                errors.append(f"Row {row_idx + 2}: Failed to send email to {email}")

            created_count += 1

        # Create import batch record
        batch = ImportBatch(
            id=import_batch_id,
            admin_user_id=uuid.UUID(admin_user),
            filename=file.filename,
            total_rows=total_rows,
            successful_imports=created_count,
            failed_imports=len(errors),
            skipped_imports=skipped_count,
            status="completed"
        )
        db.add(batch)

        await db.commit()

        message = f"Imported {created_count} users, skipped {skipped_count}"
        if errors:
            message += f", {len(errors)} errors"
        
        logger.info(f"Admin {admin_user} bulk imported {created_count} users from {file.filename}")
        logger.info(f"Summary: {created_count} created, {skipped_count} skipped, {len(errors)} errors")
        
        if errors:
            logger.warning(f"Import errors: {errors}")

        # Create detailed breakdown for frontend
        error_breakdown = {
            'validation_errors': [e for e in errors if 'Validation failed' in e or 'Invalid' in e or 'required' in e],
            'duplicate_users': [e for e in errors if 'already exists' in e],
            'other_errors': [e for e in errors if 'already exists' not in e and 'Validation' not in e and 'Invalid' not in e and 'required' not in e]
        }
        
        details = {
            'total_rows_processed': total_rows,
            'batch_id': import_batch_id,
            'has_errors': len(errors) > 0,
            'error_count': len(errors),
            'error_breakdown': error_breakdown,
            'summary': {
                'success_rate': (created_count / total_rows * 100) if total_rows > 0 else 0,
                'skip_rate': (skipped_count / total_rows * 100) if total_rows > 0 else 0
            }
        }

        return BulkImportResult(
            success=True,
            message=message,
            created_users=created_count,
            skipped_users=skipped_count,
            errors=errors,  # This will show why users were skipped
            field_mapping=field_mapping,
            template_info=validator.get_template_info(),
            details=details
        )

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        logger.error(f"Error in bulk import: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to import users: {str(e)}")


@router.get("/bulk-imported", response_model=BulkUsersResponse)
async def get_bulk_imported_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, regex="^(pending|accepted|declined|expired)$"),
    batch_id: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get list of bulk imported users with their invitation status.
    """
    try:
        offset = (page - 1) * page_size
        
        query = select(Profile).where(Profile.import_batch_id.isnot(None))
        
        if status_filter:
            query = query.where(Profile.invitation_status == status_filter)
        
        if batch_id:
            query = query.where(Profile.import_batch_id == batch_id)
        
        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Profile.display_name.ilike(search_term),
                    Profile.first_name.ilike(search_term),
                    Profile.last_name.ilike(search_term)
                )
            )
        
        # Get total count
        total_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(total_query)
        total = total_result.scalar()
        
        # Get profiles with user data
        query = query.order_by(Profile.created_at.desc()).offset(offset).limit(page_size)
        result = await db.execute(query)
        profiles = result.scalars().all()
        
        users = []
        for profile in profiles:
            user_result = await db.execute(
                select(User).where(User.id == profile.user_id)
            )
            user = user_result.scalar_one_or_none()
            
            users.append(BulkUserSummary(
                id=str(profile.id),
                email=user.email if user else "Unknown",
                full_name=profile.display_name or f"{profile.first_name or ''} {profile.last_name or ''}".strip(),
                profile_type=profile.type,
                invitation_status=profile.invitation_status,
                invitation_sent_at=profile.invitation_sent_at,
                invitation_responded_at=profile.invitation_responded_at,
                import_batch_id=profile.import_batch_id
            ))
        
        total_pages = (total + page_size - 1) // page_size
        
        return BulkUsersResponse(
            users=users,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
        
    except Exception as e:
        logger.error(f"Error getting bulk imported users: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get imported users")


@router.post("/bulk-action")
async def bulk_action_on_users(
    request: BulkActionRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Perform bulk actions on imported users (delete, retry, accept, decline).
    """
    try:
        updated_count = 0
        errors = []
        
        for user_id in request.user_ids:
            try:
                if request.action == "delete":
                    # Delete the profile and associated user
                    profile_result = await db.execute(
                        select(Profile).where(Profile.id == user_id)
                    )
                    profile = profile_result.scalar_one_or_none()
                    
                    if profile:
                        # Delete user (cascades to profile)
                        await db.delete(profile.user)
                        updated_count += 1
                
                elif request.action == "retry":
                    # Retry invitation by generating new token and email
                    profile_result = await db.execute(
                        select(Profile).where(Profile.id == user_id)
                    )
                    profile = profile_result.scalar_one_or_none()
                    
                    if profile and profile.invitation_status in ['expired', 'declined']:
                        # Generate new token
                        token = secrets.token_urlsafe(32)
                        expires_at = datetime.utcnow() + timedelta(hours=24)
                        
                        # Update existing password reset or create new
                        pr_result = await db.execute(
                            select(PasswordReset).where(
                                PasswordReset.user_id == profile.user_id
                            )
                        )
                        password_reset = pr_result.scalar_one_or_none()
                        
                        if password_reset:
                            password_reset.token = token
                            password_reset.expires_at = expires_at
                            password_reset.is_used = False
                            password_reset.updated_at = datetime.utcnow()
                        else:
                            password_reset = PasswordReset(
                                user_id=profile.user_id,
                                token=token,
                                expires_at=expires_at,
                                is_used=False
                            )
                            db.add(password_reset)
                        
                        # Update profile
                        profile.invitation_status = 'pending'
                        profile.invitation_token = token
                        profile.invitation_sent_at = datetime.utcnow()
                        profile.invitation_responded_at = None
                        
                        # Send email
                        user_result = await db.execute(
                            select(User).where(User.id == profile.user_id)
                        )
                        user = user_result.scalar_one_or_none()
                        
                        if user:
                            invitation_link = f"http://localhost:8000/invitation-setup?token={token}"
                            email_sent = await send_bulk_import_invitation_email(
                                email=user.email,
                                invitation_link=invitation_link,
                                full_name=profile.display_name or user.email,
                                profile_type=profile.type
                            )
                            
                            if not email_sent:
                                errors.append(f"Failed to send retry email to {user.email}")
                            else:
                                updated_count += 1
                
                elif request.action == "accept":
                    # Force accept status
                    profile_result = await db.execute(
                        select(Profile).where(Profile.id == user_id)
                    )
                    profile = profile_result.scalar_one_or_none()
                    
                    if profile:
                        profile.invitation_status = 'accepted'
                        profile.invitation_responded_at = datetime.utcnow()
                        updated_count += 1
                
                elif request.action == "decline":
                    # Force decline and delete user
                    profile_result = await db.execute(
                        select(Profile).where(Profile.id == user_id)
                    )
                    profile = profile_result.scalar_one_or_none()
                    
                    if profile:
                        profile.invitation_status = 'declined'
                        profile.invitation_responded_at = datetime.utcnow()
                        # Delete user (cascades to profile)
                        await db.delete(profile.user)
                        updated_count += 1
                        
            except Exception as e:
                errors.append(f"Error processing user {user_id}: {str(e)}")
                continue
        
        await db.commit()
        
        return {
            "success": True,
            "message": f"Successfully processed {updated_count} users",
            "updated_count": updated_count,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error in bulk action: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to process bulk action")


@router.get("/import-stats", response_model=ImportStatsResponse)
async def get_import_statistics(
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get comprehensive import statistics and analytics.
    """
    try:
        # Get profile status counts
        total_result = await db.execute(
            select(func.count()).where(Profile.import_batch_id.isnot(None))
        )
        total_imported = total_result.scalar()
        
        pending_result = await db.execute(
            select(func.count()).where(
                Profile.import_batch_id.isnot(None),
                Profile.invitation_status == 'pending'
            )
        )
        pending = pending_result.scalar()
        
        accepted_result = await db.execute(
            select(func.count()).where(
                Profile.import_batch_id.isnot(None),
                Profile.invitation_status == 'accepted'
            )
        )
        accepted = accepted_result.scalar()
        
        declined_result = await db.execute(
            select(func.count()).where(
                Profile.import_batch_id.isnot(None),
                Profile.invitation_status == 'declined'
            )
        )
        declined = declined_result.scalar()
        
        expired_result = await db.execute(
            select(func.count()).where(
                Profile.import_batch_id.isnot(None),
                Profile.invitation_status == 'expired'
            )
        )
        expired = expired_result.scalar()
        
        # Calculate acceptance rate
        responded = accepted + declined
        acceptance_rate = (accepted / responded * 100) if responded > 0 else 0
        
        # Get recent batches
        recent_batches_result = await db.execute(
            select(ImportBatch)
            .order_by(ImportBatch.created_at.desc())
            .limit(10)
        )
        recent_batches = recent_batches_result.scalars().all()
        
        recent_batches_data = [
            {
                "id": batch.id,
                "filename": batch.filename,
                "created_at": batch.created_at,
                "total_rows": batch.total_rows,
                "successful_imports": batch.successful_imports,
                "failed_imports": batch.failed_imports,
                "status": batch.status
            }
            for batch in recent_batches
        ]
        
        return ImportStatsResponse(
            total_imported=total_imported,
            pending=pending,
            accepted=accepted,
            declined=declined,
            expired=expired,
            acceptance_rate=round(acceptance_rate, 2),
            recent_batches=recent_batches_data
        )
        
    except Exception as e:
        logger.error(f"Error getting import statistics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get import statistics")


@router.post("/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    data: SuspendRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin),
):
    """Suspend a user (disables all social actions)."""
    try:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if str(user.id) == admin_user:
            raise HTTPException(status_code=400, detail="Cannot suspend yourself")
        user.is_suspended = True
        user.suspended_at = datetime.utcnow()
        user.suspension_reason = data.reason
        await db.commit()
        logger.info(f"Admin {admin_user} suspended user {user_id}")
        return {"message": "User suspended", "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error suspending user: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to suspend user")


@router.post("/{user_id}/unsuspend")
async def unsuspend_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin),
):
    """Unsuspend a user."""
    try:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.is_suspended = False
        user.suspended_at = None
        user.suspension_reason = None
        await db.commit()
        logger.info(f"Admin {admin_user} unsuspended user {user_id}")
        return {"message": "User unsuspended", "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unsuspending user: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to unsuspend user")


@router.get("/{user_id}", response_model=UserDetail)
async def get_user_detail(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get detailed information about a specific user.
    """
    try:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        profiles_result = await db.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        profiles = profiles_result.scalars().all()
        
        sessions_result = await db.execute(
            select(Session).where(Session.user_id == user_id)
            .order_by(Session.start_time.desc()).limit(10)
        )
        sessions = sessions_result.scalars().all()
        
        password_reset_result = await db.execute(
            select(PasswordReset).where(PasswordReset.user_id == user_id)
        )
        password_resets = password_reset_result.scalars().all()
        
        user_detail = UserDetail(
            id=str(user.id),
            username=user.username,
            email=user.email,
            is_admin=user.is_admin,
            profile_image_url=user.profile_image_url,
            created_at=user.created_at,
            updated_at=user.updated_at,
            profiles=[
                {
                    "id": str(p.id),
                    "display_name": p.display_name,
                    "type": p.type,
                    "organization": p.organization,
                    "created_at": p.created_at
                }
                for p in profiles
            ],
            recent_sessions=[
                {
                    "id": str(s.id),
                    "title": s.title,
                    "status": s.status,
                    "start_time": s.start_time,
                    "query_count": len(s.queries)
                }
                for s in sessions
            ],
            password_reset_count=len(password_resets),
            last_password_reset=max([pr.created_at for pr in password_resets]) if password_resets else None
        )
        
        logger.info(f"Admin {admin_user} viewed user {user_id}")
        
        return user_detail
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user detail: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get user detail")


@router.put("/{user_id}")
async def update_user(
    user_id: str,
    update_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Update user information (admin status, username).
    """
    try:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if update_data.is_admin is not None:
            user.is_admin = update_data.is_admin
        
        if update_data.is_suspended is not None:
            user.is_suspended = update_data.is_suspended
            if update_data.is_suspended:
                user.suspended_at = datetime.utcnow()
            else:
                user.suspended_at = None
                user.suspension_reason = None

        if update_data.username is not None:
            existing_user_result = await db.execute(
                select(User).where(
                    and_(
                        User.username == update_data.username,
                        User.id != user_id
                    )
                )
            )
            existing_user = existing_user_result.scalar_one_or_none()
            if existing_user:
                raise HTTPException(status_code=400, detail="Username already exists")
            user.username = update_data.username
        
        user.updated_at = datetime.utcnow()
        await db.commit()
        
        logger.info(f"Admin {admin_user} updated user {user_id}")
        
        return {"message": "User updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update user")


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Delete a user and all associated data.
    """
    try:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if str(user.id) == admin_user:
            raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
        await db.delete(user)
        await db.commit()
        
        logger.info(f"Admin {admin_user} deleted user {user_id}")
        
        return {"message": "User deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete user")


