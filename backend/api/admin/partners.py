import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import verify_admin
from api.schemas import PartnerResponse, PartnerOwnerInfo
from api.manager_email_service import send_admin_partner_invite_email
from services.partner_service import PartnerService
from utils.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


class PartnerInviteRequest(BaseModel):
    email: EmailStr
    organization_name: Optional[str] = None
    message: Optional[str] = None


def _partner_to_response(partner) -> PartnerResponse:
    return PartnerResponse(
        id=partner.id,
        name=partner.name,
        slug=partner.slug,
        description=partner.description or "",
        website=partner.website,
        logo_url=partner.logo_url,
        banner_url=partner.banner_url,
        contact_email=partner.contact_email,
        sector_focus=partner.sector_focus or [],
        country=partner.country,
        region=partner.region,
        social_links=partner.social_links or {},
        status=partner.status,
        is_verified=partner.is_verified,
        is_featured=partner.is_featured if hasattr(partner, 'is_featured') else False,
        organization_type=partner.organization_type if hasattr(partner, 'organization_type') else None,
        member_count=len(partner.members) if partner.members else 0,
        lab_count=len(partner.partner_entities) if hasattr(partner, 'partner_entities') and partner.partner_entities else 0,
        created_at=partner.created_at,
        owner=PartnerOwnerInfo(id=partner.owner.id, username=partner.owner.username) if partner.owner else None,
    )


@router.get("/", response_model=list[PartnerResponse])
async def admin_list_partners(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all partners (any status)."""
    service = PartnerService(db)
    partners, total = await service.list_partners(page, limit, search, status=status)
    return [_partner_to_response(p) for p in partners]


@router.get("/pending", response_model=list[PartnerResponse])
async def admin_list_pending(
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """List pending partner applications."""
    service = PartnerService(db)
    partners, _ = await service.list_partners(status="pending")
    return [_partner_to_response(p) for p in partners]


@router.post("/{partner_id}/approve", response_model=PartnerResponse)
async def admin_approve_partner(
    partner_id: str,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a partner application."""
    service = PartnerService(db)
    partner = await service.approve_partner(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return _partner_to_response(partner)


@router.post("/{partner_id}/reject", response_model=PartnerResponse)
async def admin_reject_partner(
    partner_id: str,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a partner application."""
    service = PartnerService(db)
    partner = await service.reject_partner(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return _partner_to_response(partner)


@router.delete("/{partner_id}")
async def admin_delete_partner(
    partner_id: str,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Suspend/delete a partner."""
    service = PartnerService(db)
    partner = await service.get_partner_by_id(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    partner.status = "suspended"
    await db.commit()
    return {"message": "Partner suspended"}


@router.post("/{partner_id}/feature")
async def admin_feature_partner(
    partner_id: str,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Toggle featured status of a partner."""
    service = PartnerService(db)
    partner = await service.get_partner_by_id(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    partner.is_featured = not partner.is_featured
    partner.featured_at = datetime.utcnow() if partner.is_featured else None
    await db.commit()
    await db.refresh(partner)
    return {"message": f"Partner {'featured' if partner.is_featured else 'unfeatured'}", "is_featured": partner.is_featured}


@router.post("/invite")
async def admin_invite_partner(
    body: PartnerInviteRequest,
    admin_user: str = Depends(verify_admin),
):
    """Send an email invitation to an external organization to register as a partner."""
    logger.info(f"Admin sending partner invite to {body.email} (org: {body.organization_name or 'N/A'})")

    success = await send_admin_partner_invite_email(
        email=body.email,
        organization_name=body.organization_name,
        message=body.message,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send invitation email")

    return {"message": f"Invitation sent to {body.email}"}
