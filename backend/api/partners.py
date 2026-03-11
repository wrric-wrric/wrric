import logging
import asyncio
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_current_user
from api.schemas import (
    PartnerCreate, PartnerUpdate, PartnerResponse, PaginatedPartnerResponse,
    PartnerMemberResponse, PartnerInviteRequest, PartnerOwnerInfo,
    PartnerEntityAssign, PartnerEntityBulkAssign, PartnerEntityResponse,
    EntityResponse,
)
import math
from sqlalchemy import select
from models.db_models import Partner

from services.partner_service import PartnerService
from utils.database import get_db
from media.storage import CustomB2Storage

logger = logging.getLogger(__name__)
router = APIRouter()
storage = CustomB2Storage()


async def _get_presigned_url(key: Optional[str]) -> Optional[str]:
    """Get presigned URL for a storage key."""
    if not key:
        return None
    return await asyncio.to_thread(storage.url, key)


@router.get("/map")
async def get_partners_for_map(db: AsyncSession = Depends(get_db)):
    """Lightweight partner data for the map (public, no auth)."""
    from sqlalchemy.orm import selectinload
    stmt = select(Partner).options(selectinload(Partner.partner_entities)).where(
        Partner.status == "approved",
        Partner.latitude.isnot(None),
        Partner.longitude.isnot(None),
    )
    result = await db.execute(stmt)
    partners = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "slug": p.slug,
            "logo_url": p.logo_url,
            "country": p.country,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "sector_focus": p.sector_focus or [],
            "organization_type": p.organization_type,
            "lab_count": len(p.partner_entities) if p.partner_entities else 0,
            "is_verified": p.is_verified,
        }
        for p in partners
    ]


async def _partner_to_response(partner) -> PartnerResponse:
    """Convert partner model to response with presigned URLs."""
    logo_url = await _get_presigned_url(partner.logo_url) if partner.logo_url else None
    banner_url = await _get_presigned_url(partner.banner_url) if partner.banner_url else None
    
    return PartnerResponse(
        id=partner.id,
        name=partner.name,
        slug=partner.slug,
        description=partner.description or "",
        website=partner.website,
        logo_url=logo_url,
        banner_url=banner_url,
        contact_email=partner.contact_email,
        sector_focus=partner.sector_focus or [],
        country=partner.country,
        region=partner.region,
        social_links=partner.social_links or {},
        status=partner.status,
        is_verified=partner.is_verified,
        is_featured=partner.is_featured if hasattr(partner, 'is_featured') else False,
        organization_type=partner.organization_type if hasattr(partner, 'organization_type') else None,
        latitude=partner.latitude if hasattr(partner, 'latitude') else None,
        longitude=partner.longitude if hasattr(partner, 'longitude') else None,
        member_count=len(partner.members) if partner.members else 0,
        lab_count=len(partner.partner_entities) if hasattr(partner, 'partner_entities') and partner.partner_entities else 0,
        created_at=partner.created_at,
        owner=PartnerOwnerInfo(id=partner.owner.id, username=partner.owner.username) if partner.owner else None,
    )


@router.get("/", response_model=PaginatedPartnerResponse)
async def list_partners(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    sector: Optional[str] = None,
    country: Optional[str] = None,
    region: Optional[str] = None,
    verified: Optional[bool] = None,
    organization_type: Optional[str] = None,
    sort: str = Query("newest", regex="^(newest|oldest|name_asc|name_desc|featured)$"),
    db: AsyncSession = Depends(get_db),
):
    """List approved partners (public) with pagination and filtering."""
    service = PartnerService(db)
    partners, total = await service.list_partners(
        page, limit, search, sector, country, region,
        status="approved", verified=verified,
        organization_type=organization_type, sort=sort,
    )
    total_pages = math.ceil(total / limit) if total > 0 else 0
    items = [await _partner_to_response(p) for p in partners]
    return PaginatedPartnerResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )


@router.get("/featured", response_model=list[PartnerResponse])
async def list_featured_partners(
    limit: int = Query(6, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """List featured partners (public)."""
    service = PartnerService(db)
    partners = await service.list_featured_partners(limit)
    return [await _partner_to_response(p) for p in partners]


@router.get("/me", response_model=list[PartnerResponse])
async def list_my_partners(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List current user's partners."""
    service = PartnerService(db)
    partners = await service.get_user_partners(current_user)
    return [await _partner_to_response(p) for p in partners]


@router.post("/", response_model=PartnerResponse, status_code=status.HTTP_201_CREATED)
async def create_partner(
    data: PartnerCreate,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new partner application."""
    service = PartnerService(db)
    partner = await service.create_partner(data.model_dump(), current_user)
    # Reload with relationships
    partner = await service.get_partner_by_id(str(partner.id))
    return await _partner_to_response(partner)


@router.get("/{slug}", response_model=PartnerResponse)
async def get_partner(slug: str, db: AsyncSession = Depends(get_db)):
    """Get partner by slug (public storefront)."""
    service = PartnerService(db)
    partner = await service.get_partner_by_slug(slug)
    if not partner or partner.status != "approved":
        raise HTTPException(status_code=404, detail="Partner not found")
    return await _partner_to_response(partner)


@router.patch("/{partner_id}", response_model=PartnerResponse)
async def update_partner(
    partner_id: str,
    data: PartnerUpdate,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update partner (owner/editor only)."""
    service = PartnerService(db)
    update_data = data.model_dump(exclude_unset=True)
    partner = await service.update_partner(partner_id, update_data, current_user)
    if not partner:
        raise HTTPException(status_code=403, detail="Not authorized or partner not found")
    return await _partner_to_response(partner)


@router.post("/{partner_id}/logo", response_model=PartnerResponse)
async def upload_partner_logo(
    partner_id: str,
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload partner logo image (owner/editor only)."""
    service = PartnerService(db)
    
    # Check permission
    if not await service.check_permission(partner_id, current_user, "editor"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPEG, PNG, GIF, or WebP.")
    
    # Upload to storage
    key = f"partners/{partner_id}/logo/{uuid.uuid4().hex}_{file.filename}"
    content = await file.read()
    
    await asyncio.to_thread(
        storage.s3_client.put_object,
        Bucket=storage.bucket_name,
        Key=key,
        Body=content,
        ContentType=file.content_type
    )
    
    # Update partner record
    partner = await service.update_partner(partner_id, {"logo_url": key}, current_user)
    if not partner:
        raise HTTPException(status_code=500, detail="Failed to update partner logo")
    
    return await _partner_to_response(partner)


@router.delete("/{partner_id}/logo", response_model=PartnerResponse)
async def delete_partner_logo(
    partner_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete partner logo (owner/editor only)."""
    service = PartnerService(db)
    
    if not await service.check_permission(partner_id, current_user, "editor"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    partner = await service.update_partner(partner_id, {"logo_url": None}, current_user)
    if not partner:
        raise HTTPException(status_code=500, detail="Failed to delete partner logo")
    
    return await _partner_to_response(partner)


@router.post("/{partner_id}/banner", response_model=PartnerResponse)
async def upload_partner_banner(
    partner_id: str,
    file: UploadFile = File(...),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload partner banner image (owner/editor only)."""
    service = PartnerService(db)
    
    if not await service.check_permission(partner_id, current_user, "editor"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPEG, PNG, GIF, or WebP.")
    
    key = f"partners/{partner_id}/banner/{uuid.uuid4().hex}_{file.filename}"
    content = await file.read()
    
    await asyncio.to_thread(
        storage.s3_client.put_object,
        Bucket=storage.bucket_name,
        Key=key,
        Body=content,
        ContentType=file.content_type
    )
    
    partner = await service.update_partner(partner_id, {"banner_url": key}, current_user)
    if not partner:
        raise HTTPException(status_code=500, detail="Failed to update partner banner")
    
    return await _partner_to_response(partner)


@router.delete("/{partner_id}/banner", response_model=PartnerResponse)
async def delete_partner_banner(
    partner_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete partner banner (owner/editor only)."""
    service = PartnerService(db)
    
    if not await service.check_permission(partner_id, current_user, "editor"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    partner = await service.update_partner(partner_id, {"banner_url": None}, current_user)
    if not partner:
        raise HTTPException(status_code=500, detail="Failed to delete partner banner")
    
    return await _partner_to_response(partner)


@router.get("/{partner_id}/members", response_model=list[PartnerMemberResponse])
async def list_members(
    partner_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List partner members (member only)."""
    service = PartnerService(db)
    if not await service.check_permission(partner_id, current_user, "viewer"):
        raise HTTPException(status_code=403, detail="Not authorized")
    members = await service.list_members(partner_id)
    return [
        PartnerMemberResponse(
            id=m.id,
            user_id=m.user_id,
            username=m.user.username if m.user else "",
            email=m.user.email if m.user else "",
            role=m.role,
            joined_at=m.joined_at,
        )
        for m in members
    ]


@router.post("/{partner_id}/members/invite", status_code=status.HTTP_201_CREATED)
async def invite_member(
    partner_id: str,
    data: PartnerInviteRequest,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a member to partner (owner only)."""
    service = PartnerService(db)
    invitation = await service.invite_member(partner_id, data.email, data.role, current_user)
    if not invitation:
        raise HTTPException(status_code=409, detail="Invitation already exists or not authorized")
    return {"message": "Invitation sent", "invitation_id": str(invitation.id)}


@router.delete("/{partner_id}/members/{user_id}")
async def remove_member(
    partner_id: str,
    user_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from partner (owner only)."""
    service = PartnerService(db)
    success = await service.remove_member(partner_id, user_id, current_user)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot remove member or not authorized")
    return {"message": "Member removed"}


@router.post("/invitations/{token}/accept")
async def accept_invitation(
    token: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept a partner invitation."""
    service = PartnerService(db)
    member = await service.accept_invitation(token, current_user)
    if not member:
        raise HTTPException(status_code=410, detail="Invalid or expired invitation")
    return {"message": "Invitation accepted"}


# --- Partner Lab / Entity Management ---

@router.get("/{partner_id}/labs")
async def list_partner_labs(
    partner_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List labs assigned to a partner (public for approved partners)."""
    service = PartnerService(db)
    # Verify partner exists and is approved for public access
    partner = await service.get_partner_by_id(partner_id)
    if not partner or partner.status != "approved":
        raise HTTPException(status_code=404, detail="Partner not found")
    entities, total = await service.list_partner_entities(partner_id, skip, limit, search)
    return {
        "items": [
            {
                "id": str(e.id),
                "university": e.university or "",
                "research_abstract": e.research_abstract or "",
                "website": e.website or None,
                "location": e.get_json_field("location") if hasattr(e, "get_json_field") else (e.location or {}),
                "scopes": e.get_json_field("scopes") if hasattr(e, "get_json_field") else (e.scopes or []),
                "climate_tech_focus": e.get_json_field("climate_tech_focus") if hasattr(e, "get_json_field") else (e.climate_tech_focus or []),
                "entity_type": e.entity_type or "lab",
                "source": e.source or "scraped",
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "images": [
                    {"id": str(img.id), "url": img.url, "caption": img.caption, "is_primary": img.is_primary}
                    for img in (e.images or [])
                ],
            }
            for e in entities
        ],
        "total": total,
    }


@router.post("/{partner_id}/labs/{entity_id}", status_code=status.HTTP_201_CREATED)
async def assign_lab_to_partner(
    partner_id: str,
    entity_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign a lab/entity to a partner (editor+ only)."""
    service = PartnerService(db)
    pe = await service.assign_entity(partner_id, entity_id, current_user)
    if not pe:
        raise HTTPException(status_code=409, detail="Already assigned, entity not found, or not authorized")
    return {"message": "Lab assigned to partner", "id": str(pe.id)}


@router.delete("/{partner_id}/labs/{entity_id}")
async def unassign_lab_from_partner(
    partner_id: str,
    entity_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a lab from a partner (editor+ only)."""
    service = PartnerService(db)
    success = await service.unassign_entity(partner_id, entity_id, current_user)
    if not success:
        raise HTTPException(status_code=400, detail="Not found or not authorized")
    return {"message": "Lab removed from partner"}


@router.post("/{partner_id}/labs/bulk-assign")
async def bulk_assign_labs(
    partner_id: str,
    data: PartnerEntityBulkAssign,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk assign labs to a partner (editor+ only)."""
    service = PartnerService(db)
    result = await service.bulk_assign_entities(
        partner_id, [str(eid) for eid in data.entity_ids], current_user
    )
    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])
    return result
