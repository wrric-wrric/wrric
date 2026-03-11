import uuid
import re
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Tuple

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.db_models import Partner, PartnerMember, PartnerInvitation, PartnerEntity, User, Entity


def _slugify(text: str) -> str:
    """Generate a URL-friendly slug from text."""
    slug = text.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug[:180]


class PartnerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_partner(self, data: dict, user_id: str) -> Partner:
        """Create a partner and add the creator as owner member."""
        base_slug = _slugify(data["name"])
        slug = base_slug
        # Ensure unique slug
        counter = 1
        while True:
            result = await self.db.execute(
                select(Partner).where(Partner.slug == slug)
            )
            if not result.scalars().first():
                break
            slug = f"{base_slug}-{counter}"
            counter += 1

        partner = Partner(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            name=data["name"],
            slug=slug,
            description=data.get("description", ""),
            website=data.get("website"),
            contact_email=data.get("contact_email"),
            sector_focus=data.get("sector_focus", []),
            country=data.get("country"),
            region=data.get("region"),
            social_links=data.get("social_links", {}),
            status="pending",
        )
        self.db.add(partner)
        await self.db.flush()

        # Add creator as owner member
        member = PartnerMember(
            id=uuid.uuid4(),
            partner_id=partner.id,
            user_id=uuid.UUID(user_id),
            role="owner",
        )
        self.db.add(member)
        await self.db.commit()
        await self.db.refresh(partner)
        return partner

    async def get_partner_by_id(self, partner_id: str) -> Optional[Partner]:
        result = await self.db.execute(
            select(Partner)
            .where(Partner.id == partner_id)
            .options(selectinload(Partner.members), selectinload(Partner.owner), selectinload(Partner.partner_entities))
        )
        return result.scalars().first()

    async def get_partner_by_slug(self, slug: str) -> Optional[Partner]:
        result = await self.db.execute(
            select(Partner)
            .where(Partner.slug == slug)
            .options(selectinload(Partner.members), selectinload(Partner.owner), selectinload(Partner.partner_entities))
        )
        return result.scalars().first()

    async def list_partners(
        self,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        sector: Optional[str] = None,
        country: Optional[str] = None,
        region: Optional[str] = None,
        status: Optional[str] = "approved",
        verified: Optional[bool] = None,
        organization_type: Optional[str] = None,
        sort: str = "newest",
    ) -> Tuple[List[Partner], int]:
        query = select(Partner).options(selectinload(Partner.members), selectinload(Partner.owner), selectinload(Partner.partner_entities))

        if status:
            query = query.where(Partner.status == status)
        if search:
            query = query.where(
                or_(
                    Partner.name.ilike(f"%{search}%"),
                    Partner.description.ilike(f"%{search}%"),
                )
            )
        if sector:
            query = query.where(Partner.sector_focus.contains([sector]))
        if country:
            query = query.where(Partner.country == country)
        if region:
            query = query.where(Partner.region.ilike(f"%{region}%"))
        if verified is not None:
            query = query.where(Partner.is_verified == verified)
        if organization_type:
            query = query.where(Partner.organization_type == organization_type)

        # Count
        count_query = select(func.count()).select_from(query.subquery())
        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # Sorting
        if sort == "name_asc":
            query = query.order_by(Partner.name.asc())
        elif sort == "name_desc":
            query = query.order_by(Partner.name.desc())
        elif sort == "oldest":
            query = query.order_by(Partner.created_at.asc())
        elif sort == "featured":
            query = query.order_by(Partner.is_featured.desc(), Partner.featured_at.desc().nullslast(), Partner.created_at.desc())
        else:  # newest (default)
            query = query.order_by(Partner.created_at.desc())

        query = query.offset((page - 1) * limit).limit(limit)

        result = await self.db.execute(query)
        partners = result.scalars().unique().all()
        return list(partners), total

    async def list_featured_partners(self, limit: int = 6) -> List[Partner]:
        """Get featured partners for homepage/discovery."""
        query = (
            select(Partner)
            .options(selectinload(Partner.members), selectinload(Partner.owner), selectinload(Partner.partner_entities))
            .where(and_(Partner.status == "approved", Partner.is_featured == True))
            .order_by(Partner.featured_at.desc().nullslast())
            .limit(limit)
        )
        result = await self.db.execute(query)
        return list(result.scalars().unique().all())

    async def update_partner(self, partner_id: str, data: dict, user_id: str) -> Optional[Partner]:
        if not await self.check_permission(partner_id, user_id, "editor"):
            return None

        partner = await self.get_partner_by_id(partner_id)
        if not partner:
            return None

        for key, value in data.items():
            if value is not None and hasattr(partner, key):
                setattr(partner, key, value)

        await self.db.commit()
        await self.db.refresh(partner)
        return partner

    async def approve_partner(self, partner_id: str) -> Optional[Partner]:
        partner = await self.get_partner_by_id(partner_id)
        if not partner:
            return None
        partner.status = "approved"
        await self.db.commit()
        await self.db.refresh(partner)
        return partner

    async def reject_partner(self, partner_id: str) -> Optional[Partner]:
        partner = await self.get_partner_by_id(partner_id)
        if not partner:
            return None
        partner.status = "rejected"
        await self.db.commit()
        await self.db.refresh(partner)
        return partner

    async def invite_member(self, partner_id: str, email: str, role: str, invited_by: str) -> Optional[PartnerInvitation]:
        if not await self.check_permission(partner_id, invited_by, "owner"):
            return None

        # Check duplicate
        result = await self.db.execute(
            select(PartnerInvitation).where(
                and_(
                    PartnerInvitation.partner_id == partner_id,
                    PartnerInvitation.email == email,
                    PartnerInvitation.accepted_at.is_(None),
                )
            )
        )
        if result.scalars().first():
            return None  # duplicate

        invitation = PartnerInvitation(
            id=uuid.uuid4(),
            partner_id=uuid.UUID(partner_id),
            email=email,
            role=role,
            token=secrets.token_urlsafe(32),
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        self.db.add(invitation)
        await self.db.commit()
        await self.db.refresh(invitation)
        return invitation

    async def accept_invitation(self, token: str, user_id: str) -> Optional[PartnerMember]:
        result = await self.db.execute(
            select(PartnerInvitation).where(
                and_(
                    PartnerInvitation.token == token,
                    PartnerInvitation.accepted_at.is_(None),
                )
            )
        )
        invitation = result.scalars().first()
        if not invitation:
            return None
        if invitation.expires_at and invitation.expires_at < datetime.utcnow():
            return None  # expired

        # Check not already a member
        existing = await self.db.execute(
            select(PartnerMember).where(
                and_(
                    PartnerMember.partner_id == invitation.partner_id,
                    PartnerMember.user_id == user_id,
                )
            )
        )
        if existing.scalars().first():
            invitation.accepted_at = datetime.utcnow()
            await self.db.commit()
            return None

        member = PartnerMember(
            id=uuid.uuid4(),
            partner_id=invitation.partner_id,
            user_id=uuid.UUID(user_id),
            role=invitation.role,
        )
        self.db.add(member)
        invitation.accepted_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(member)
        return member

    async def remove_member(self, partner_id: str, target_user_id: str, requester_id: str) -> bool:
        if not await self.check_permission(partner_id, requester_id, "owner"):
            return False

        # Prevent removing last owner
        result = await self.db.execute(
            select(func.count()).where(
                and_(
                    PartnerMember.partner_id == partner_id,
                    PartnerMember.role == "owner",
                )
            )
        )
        owner_count = result.scalar() or 0

        # Check if target is an owner
        target_result = await self.db.execute(
            select(PartnerMember).where(
                and_(
                    PartnerMember.partner_id == partner_id,
                    PartnerMember.user_id == target_user_id,
                )
            )
        )
        target_member = target_result.scalars().first()
        if not target_member:
            return False

        if target_member.role == "owner" and owner_count <= 1:
            return False  # can't remove last owner

        await self.db.delete(target_member)
        await self.db.commit()
        return True

    async def list_members(self, partner_id: str) -> List[PartnerMember]:
        result = await self.db.execute(
            select(PartnerMember)
            .where(PartnerMember.partner_id == partner_id)
            .options(selectinload(PartnerMember.user))
        )
        return list(result.scalars().all())

    async def check_permission(self, partner_id: str, user_id: str, required_role: str = "viewer") -> bool:
        """Check if user has the required role or higher. owner > editor > viewer."""
        role_hierarchy = {"owner": 3, "editor": 2, "viewer": 1}
        required_level = role_hierarchy.get(required_role, 0)

        result = await self.db.execute(
            select(PartnerMember).where(
                and_(
                    PartnerMember.partner_id == partner_id,
                    PartnerMember.user_id == user_id,
                )
            )
        )
        member = result.scalars().first()
        if not member:
            return False

        member_level = role_hierarchy.get(member.role, 0)
        return member_level >= required_level

    async def get_user_partners(self, user_id: str) -> List[Partner]:
        result = await self.db.execute(
            select(Partner)
            .join(PartnerMember, PartnerMember.partner_id == Partner.id)
            .where(PartnerMember.user_id == user_id)
            .options(selectinload(Partner.members), selectinload(Partner.owner), selectinload(Partner.partner_entities))
        )
        return list(result.scalars().unique().all())

    # --- Lab / Entity Management ---

    async def assign_entity(self, partner_id: str, entity_id: str, assigned_by: str) -> Optional["PartnerEntity"]:
        """Assign an entity/lab to a partner. Requires owner/editor role."""
        if not await self.check_permission(partner_id, assigned_by, "editor"):
            return None

        # Check entity exists
        ent = await self.db.execute(select(Entity).where(Entity.id == entity_id))
        if not ent.scalars().first():
            return None

        # Check not already assigned
        existing = await self.db.execute(
            select(PartnerEntity).where(
                and_(
                    PartnerEntity.partner_id == partner_id,
                    PartnerEntity.entity_id == entity_id,
                )
            )
        )
        if existing.scalars().first():
            return None  # already assigned

        pe = PartnerEntity(
            id=uuid.uuid4(),
            partner_id=uuid.UUID(partner_id),
            entity_id=uuid.UUID(entity_id),
            assigned_by_user_id=uuid.UUID(assigned_by),
        )
        self.db.add(pe)
        await self.db.commit()
        await self.db.refresh(pe)
        return pe

    async def unassign_entity(self, partner_id: str, entity_id: str, user_id: str) -> bool:
        """Remove an entity from a partner. Requires owner/editor role."""
        if not await self.check_permission(partner_id, user_id, "editor"):
            return False

        result = await self.db.execute(
            select(PartnerEntity).where(
                and_(
                    PartnerEntity.partner_id == partner_id,
                    PartnerEntity.entity_id == entity_id,
                )
            )
        )
        pe = result.scalars().first()
        if not pe:
            return False

        await self.db.delete(pe)
        await self.db.commit()
        return True

    async def list_partner_entities(
        self, partner_id: str, skip: int = 0, limit: int = 50, search: Optional[str] = None
    ) -> Tuple[List[Entity], int]:
        """List entities assigned to a partner with pagination."""
        from sqlalchemy.orm import selectinload as sload

        base = (
            select(Entity)
            .join(PartnerEntity, PartnerEntity.entity_id == Entity.id)
            .where(PartnerEntity.partner_id == partner_id)
        )

        if search:
            base = base.where(
                or_(
                    Entity.university.ilike(f"%{search}%"),
                    Entity.research_abstract.ilike(f"%{search}%"),
                )
            )

        # Count
        count_q = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_q)).scalar() or 0

        # Fetch
        query = base.options(sload(Entity.images)).order_by(Entity.timestamp.desc()).offset(skip).limit(limit)
        result = await self.db.execute(query)
        entities = list(result.scalars().unique().all())
        return entities, total

    async def get_partner_entity_count(self, partner_id: str) -> int:
        """Get the number of entities assigned to a partner."""
        result = await self.db.execute(
            select(func.count()).where(PartnerEntity.partner_id == partner_id)
        )
        return result.scalar() or 0

    async def bulk_assign_entities(self, partner_id: str, entity_ids: List[str], assigned_by: str) -> dict:
        """Bulk assign multiple entities to a partner. Returns stats."""
        if not await self.check_permission(partner_id, assigned_by, "editor"):
            return {"assigned": 0, "skipped": 0, "error": "Not authorized"}

        assigned = 0
        skipped = 0
        for eid in entity_ids:
            # Check not already assigned
            existing = await self.db.execute(
                select(PartnerEntity).where(
                    and_(
                        PartnerEntity.partner_id == partner_id,
                        PartnerEntity.entity_id == eid,
                    )
                )
            )
            if existing.scalars().first():
                skipped += 1
                continue

            # Check entity exists
            ent = await self.db.execute(select(Entity).where(Entity.id == eid))
            if not ent.scalars().first():
                skipped += 1
                continue

            pe = PartnerEntity(
                id=uuid.uuid4(),
                partner_id=uuid.UUID(partner_id),
                entity_id=uuid.UUID(eid),
                assigned_by_user_id=uuid.UUID(assigned_by),
            )
            self.db.add(pe)
            assigned += 1

        await self.db.commit()
        return {"assigned": assigned, "skipped": skipped}
