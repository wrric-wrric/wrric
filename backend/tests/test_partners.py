"""
Tests for partner CRUD and admin endpoints.
Run with: pytest tests/test_partners.py -v
"""
import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession

from services.partner_service import PartnerService, _slugify
from models.db_models import Partner, PartnerMember, PartnerInvitation, PartnerEntity, User, Entity


# ---------------------------------------------------------------------------
# Unit tests for _slugify
# ---------------------------------------------------------------------------
class TestSlugify:
    def test_basic(self):
        assert _slugify("My Partner") == "my-partner"

    def test_special_chars(self):
        assert _slugify("Hello & World!") == "hello-world"

    def test_extra_spaces(self):
        assert _slugify("  lots   of   spaces  ") == "lots-of-spaces"

    def test_truncation(self):
        long = "a" * 300
        assert len(_slugify(long)) <= 180


# ---------------------------------------------------------------------------
# Service-layer tests using mocked DB
# ---------------------------------------------------------------------------
class TestPartnerService:
    """Tests for PartnerService methods using mocked async session."""

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.delete = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        return PartnerService(mock_db)

    @pytest.mark.asyncio
    async def test_create_partner_generates_slug(self, service, mock_db):
        """create_partner should generate a slug and create a member."""
        # Mock: no existing slug
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        # Mock refresh to set created_at
        async def fake_refresh(obj):
            if isinstance(obj, Partner):
                obj.created_at = datetime.utcnow()
                obj.slug = "test-org"

        mock_db.refresh = AsyncMock(side_effect=fake_refresh)

        user_id = str(uuid.uuid4())
        partner = await service.create_partner({"name": "Test Org", "description": "desc"}, user_id)

        # add() should have been called for Partner and PartnerMember
        assert mock_db.add.call_count == 2
        assert mock_db.commit.called

    @pytest.mark.asyncio
    async def test_check_permission_owner(self, service, mock_db):
        """Owner should pass any permission check."""
        member = MagicMock()
        member.role = "owner"
        result = MagicMock()
        result.scalars.return_value.first.return_value = member
        mock_db.execute = AsyncMock(return_value=result)

        assert await service.check_permission("pid", "uid", "owner") is True
        assert await service.check_permission("pid", "uid", "editor") is True
        assert await service.check_permission("pid", "uid", "viewer") is True

    @pytest.mark.asyncio
    async def test_check_permission_viewer_cant_edit(self, service, mock_db):
        """Viewer should not pass editor or owner checks."""
        member = MagicMock()
        member.role = "viewer"
        result = MagicMock()
        result.scalars.return_value.first.return_value = member
        mock_db.execute = AsyncMock(return_value=result)

        assert await service.check_permission("pid", "uid", "viewer") is True
        assert await service.check_permission("pid", "uid", "editor") is False
        assert await service.check_permission("pid", "uid", "owner") is False

    @pytest.mark.asyncio
    async def test_check_permission_non_member(self, service, mock_db):
        """Non-member should fail all checks."""
        result = MagicMock()
        result.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result)

        assert await service.check_permission("pid", "uid", "viewer") is False

    @pytest.mark.asyncio
    async def test_approve_partner(self, service, mock_db):
        """approve_partner should set status to approved."""
        partner = MagicMock(spec=Partner)
        partner.status = "pending"

        # get_partner_by_id mock
        result = MagicMock()
        result.scalars.return_value.first.return_value = partner
        mock_db.execute = AsyncMock(return_value=result)

        approved = await service.approve_partner("some-id")
        assert partner.status == "approved"
        assert mock_db.commit.called

    @pytest.mark.asyncio
    async def test_reject_partner(self, service, mock_db):
        """reject_partner should set status to rejected."""
        partner = MagicMock(spec=Partner)
        partner.status = "pending"

        result = MagicMock()
        result.scalars.return_value.first.return_value = partner
        mock_db.execute = AsyncMock(return_value=result)

        rejected = await service.reject_partner("some-id")
        assert partner.status == "rejected"

    @pytest.mark.asyncio
    async def test_accept_expired_invitation(self, service, mock_db):
        """Expired invitation should return None."""
        invitation = MagicMock(spec=PartnerInvitation)
        invitation.accepted_at = None
        invitation.expires_at = datetime.utcnow() - timedelta(days=1)

        result = MagicMock()
        result.scalars.return_value.first.return_value = invitation
        mock_db.execute = AsyncMock(return_value=result)

        member = await service.accept_invitation("token123", str(uuid.uuid4()))
        assert member is None


# ---------------------------------------------------------------------------
# Partner Lab Management tests
# ---------------------------------------------------------------------------
class TestPartnerLabManagement:
    """Tests for partner entity/lab assignment methods."""

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.delete = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        return PartnerService(mock_db)

    @pytest.mark.asyncio
    async def test_assign_entity_success(self, service, mock_db):
        """assign_entity should create a PartnerEntity record."""
        partner_id = str(uuid.uuid4())
        entity_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # check_permission: return owner member
                member = MagicMock()
                member.role = "owner"
                result.scalars.return_value.first.return_value = member
            elif call_count == 2:
                # entity exists
                entity = MagicMock(spec=Entity)
                result.scalars.return_value.first.return_value = entity
            elif call_count == 3:
                # no existing assignment
                result.scalars.return_value.first.return_value = None
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        pe = await service.assign_entity(partner_id, entity_id, user_id)
        assert mock_db.add.called
        assert mock_db.commit.called

    @pytest.mark.asyncio
    async def test_assign_entity_not_authorized(self, service, mock_db):
        """assign_entity should return None if user is not editor+."""
        result = MagicMock()
        result.scalars.return_value.first.return_value = None  # non-member
        mock_db.execute = AsyncMock(return_value=result)

        pe = await service.assign_entity("pid", "eid", "uid")
        assert pe is None
        assert not mock_db.commit.called

    @pytest.mark.asyncio
    async def test_assign_entity_already_assigned(self, service, mock_db):
        """assign_entity should return None for duplicate assignment."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                member = MagicMock(); member.role = "owner"
                result.scalars.return_value.first.return_value = member
            elif call_count == 2:
                result.scalars.return_value.first.return_value = MagicMock(spec=Entity)
            elif call_count == 3:
                # already assigned
                result.scalars.return_value.first.return_value = MagicMock(spec=PartnerEntity)
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)
        pe = await service.assign_entity("pid", "eid", "uid")
        assert pe is None

    @pytest.mark.asyncio
    async def test_assign_entity_not_found(self, service, mock_db):
        """assign_entity should return None if entity doesn't exist."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                member = MagicMock(); member.role = "owner"
                result.scalars.return_value.first.return_value = member
            elif call_count == 2:
                result.scalars.return_value.first.return_value = None  # entity not found
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)
        pe = await service.assign_entity("pid", "eid", "uid")
        assert pe is None

    @pytest.mark.asyncio
    async def test_unassign_entity_success(self, service, mock_db):
        """unassign_entity should delete the record."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                member = MagicMock(); member.role = "editor"
                result.scalars.return_value.first.return_value = member
            elif call_count == 2:
                pe = MagicMock(spec=PartnerEntity)
                result.scalars.return_value.first.return_value = pe
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)
        success = await service.unassign_entity("pid", "eid", "uid")
        assert success is True
        assert mock_db.delete.called

    @pytest.mark.asyncio
    async def test_unassign_entity_not_authorized(self, service, mock_db):
        """unassign_entity should fail for viewer role."""
        member = MagicMock(); member.role = "viewer"
        result = MagicMock()
        result.scalars.return_value.first.return_value = member
        mock_db.execute = AsyncMock(return_value=result)

        success = await service.unassign_entity("pid", "eid", "uid")
        assert success is False

    @pytest.mark.asyncio
    async def test_unassign_entity_not_found(self, service, mock_db):
        """unassign_entity should return False if link doesn't exist."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                member = MagicMock(); member.role = "owner"
                result.scalars.return_value.first.return_value = member
            elif call_count == 2:
                result.scalars.return_value.first.return_value = None
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)
        success = await service.unassign_entity("pid", "eid", "uid")
        assert success is False

    @pytest.mark.asyncio
    async def test_get_partner_entity_count(self, service, mock_db):
        """get_partner_entity_count should return count."""
        result = MagicMock()
        result.scalar.return_value = 5
        mock_db.execute = AsyncMock(return_value=result)

        count = await service.get_partner_entity_count("pid")
        assert count == 5

    @pytest.mark.asyncio
    async def test_bulk_assign_not_authorized(self, service, mock_db):
        """bulk_assign_entities should return error if not authorized."""
        result = MagicMock()
        result.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result)

        stats = await service.bulk_assign_entities("pid", ["e1", "e2"], "uid")
        assert stats["assigned"] == 0
        assert "error" in stats


# ---------------------------------------------------------------------------
# Partner Discovery & Public Profile tests
# ---------------------------------------------------------------------------
class TestPartnerDiscovery:
    """Tests for discovery, filtering, sorting, and featured partners."""

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.delete = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        return PartnerService(mock_db)

    @pytest.mark.asyncio
    async def test_list_partners_default_sort(self, service, mock_db):
        """list_partners with default sort should call execute and return results."""
        # Mock count query
        count_result = MagicMock()
        count_result.scalar.return_value = 2

        # Mock data query
        data_result = MagicMock()
        data_result.scalars.return_value.unique.return_value.all.return_value = [MagicMock(spec=Partner), MagicMock(spec=Partner)]

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return count_result
            return data_result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        partners, total = await service.list_partners(page=1, limit=20, sort="newest")
        assert total == 2
        assert len(partners) == 2

    @pytest.mark.asyncio
    async def test_list_partners_with_region_filter(self, service, mock_db):
        """list_partners should accept region filter."""
        count_result = MagicMock()
        count_result.scalar.return_value = 0
        data_result = MagicMock()
        data_result.scalars.return_value.unique.return_value.all.return_value = []

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return count_result
            return data_result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        partners, total = await service.list_partners(region="Europe")
        assert total == 0
        assert len(partners) == 0

    @pytest.mark.asyncio
    async def test_list_partners_with_verified_filter(self, service, mock_db):
        """list_partners should accept verified filter."""
        count_result = MagicMock()
        count_result.scalar.return_value = 1
        data_result = MagicMock()
        data_result.scalars.return_value.unique.return_value.all.return_value = [MagicMock(spec=Partner)]

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return count_result
            return data_result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        partners, total = await service.list_partners(verified=True)
        assert total == 1

    @pytest.mark.asyncio
    async def test_list_partners_with_org_type_filter(self, service, mock_db):
        """list_partners should accept organization_type filter."""
        count_result = MagicMock()
        count_result.scalar.return_value = 3
        data_result = MagicMock()
        data_result.scalars.return_value.unique.return_value.all.return_value = [MagicMock(spec=Partner)] * 3

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return count_result
            return data_result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        partners, total = await service.list_partners(organization_type="university")
        assert total == 3

    @pytest.mark.asyncio
    async def test_list_partners_sort_name_asc(self, service, mock_db):
        """list_partners should support name_asc sort."""
        count_result = MagicMock()
        count_result.scalar.return_value = 0
        data_result = MagicMock()
        data_result.scalars.return_value.unique.return_value.all.return_value = []

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return count_result
            return data_result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        partners, total = await service.list_partners(sort="name_asc")
        assert mock_db.execute.call_count == 2  # count + data

    @pytest.mark.asyncio
    async def test_list_featured_partners(self, service, mock_db):
        """list_featured_partners should return featured partners."""
        result = MagicMock()
        result.scalars.return_value.unique.return_value.all.return_value = [MagicMock(spec=Partner)]
        mock_db.execute = AsyncMock(return_value=result)

        partners = await service.list_featured_partners(limit=6)
        assert len(partners) == 1
        assert mock_db.execute.called

    @pytest.mark.asyncio
    async def test_list_featured_partners_empty(self, service, mock_db):
        """list_featured_partners should return empty list when none featured."""
        result = MagicMock()
        result.scalars.return_value.unique.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        partners = await service.list_featured_partners()
        assert len(partners) == 0

    @pytest.mark.asyncio
    async def test_create_partner_with_org_type(self, service, mock_db):
        """create_partner should accept organization_type field."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        async def fake_refresh(obj):
            if isinstance(obj, Partner):
                obj.created_at = datetime.utcnow()
                obj.slug = "test-uni"

        mock_db.refresh = AsyncMock(side_effect=fake_refresh)

        user_id = str(uuid.uuid4())
        partner = await service.create_partner(
            {"name": "Test Uni", "description": "desc", "organization_type": "university"},
            user_id,
        )
        assert mock_db.add.call_count == 2
