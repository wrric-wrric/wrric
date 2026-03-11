"""
Tests for the Share system (Feature 2.3).
Run with: pytest tests/test_shares.py -v
"""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession

from services.share_service import ShareService
from models.db_models import LabShare, Entity, Profile


class TestShareService:
    """Tests for ShareService methods."""

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ShareService(mock_db)

    # --- record_share ---

    @pytest.mark.asyncio
    async def test_record_share_link(self, service, mock_db):
        """Recording a link share should succeed and increment count."""
        entity = MagicMock(spec=Entity)
        entity.share_count = 0
        entity.created_by_user_id = uuid.uuid4()

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = entity
        mock_db.execute = AsyncMock(return_value=result_mock)

        user_id = str(uuid.uuid4())
        entity_id = str(uuid.uuid4())
        result = await service.record_share(entity_id, "link", user_id)

        assert "error" not in result
        assert result["platform"] == "link"
        assert result["share_count"] == 1
        assert mock_db.add.called
        assert mock_db.commit.called

    @pytest.mark.asyncio
    async def test_record_share_twitter(self, service, mock_db):
        """Recording a twitter share should succeed."""
        entity = MagicMock(spec=Entity)
        entity.share_count = 5

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = entity
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.record_share(str(uuid.uuid4()), "twitter", str(uuid.uuid4()))
        assert result["share_count"] == 6

    @pytest.mark.asyncio
    async def test_record_share_invalid_platform(self, service, mock_db):
        """Invalid platform should return 400."""
        result = await service.record_share(str(uuid.uuid4()), "tiktok", str(uuid.uuid4()))
        assert result["status"] == 400

    @pytest.mark.asyncio
    async def test_record_share_nonexistent_lab(self, service, mock_db):
        """Sharing nonexistent lab should return 404."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.record_share(str(uuid.uuid4()), "link", str(uuid.uuid4()))
        assert result["status"] == 404

    @pytest.mark.asyncio
    async def test_record_share_anonymous(self, service, mock_db):
        """Anonymous share (no user_id) should succeed."""
        entity = MagicMock(spec=Entity)
        entity.share_count = 0
        entity.created_by_user_id = None

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = entity
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.record_share(str(uuid.uuid4()), "link", None)
        assert "error" not in result
        assert result["share_count"] == 1

    @pytest.mark.asyncio
    async def test_record_internal_share_creates_message(self, service, mock_db):
        """Internal share should create message and notifications."""
        entity = MagicMock(spec=Entity)
        entity.share_count = 0
        entity.id = uuid.uuid4()
        entity.university = "Test Lab"
        entity.created_by_user_id = uuid.uuid4()

        sender_prof = MagicMock(spec=Profile)
        sender_prof.id = uuid.uuid4()
        recipient_prof = MagicMock(spec=Profile)
        recipient_prof.id = uuid.uuid4()

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # Entity lookup
                result.scalars.return_value.first.return_value = entity
            elif call_count == 2:
                # Sender profile
                result.scalars.return_value.first.return_value = sender_prof
            elif call_count == 3:
                # Recipient profile
                result.scalars.return_value.first.return_value = recipient_prof
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        sender_id = str(uuid.uuid4())
        recipient_id = str(uuid.uuid4())
        result = await service.record_share(
            str(uuid.uuid4()), "internal", sender_id, recipient_id
        )

        assert "error" not in result
        # LabShare + Message + recipient notification + owner notification + share notification + ActivityEvent = 6 adds
        assert mock_db.add.call_count == 6

    @pytest.mark.asyncio
    async def test_record_internal_share_self_no_owner_notification(self, service, mock_db):
        """Internal share by lab owner should not notify themselves as owner."""
        sender_id = str(uuid.uuid4())
        entity = MagicMock(spec=Entity)
        entity.share_count = 0
        entity.id = uuid.uuid4()
        entity.university = "My Lab"
        entity.created_by_user_id = uuid.UUID(sender_id)

        sender_prof = MagicMock(spec=Profile)
        sender_prof.id = uuid.uuid4()
        recipient_prof = MagicMock(spec=Profile)
        recipient_prof.id = uuid.uuid4()

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = entity
            elif call_count == 2:
                result.scalars.return_value.first.return_value = sender_prof
            elif call_count == 3:
                result.scalars.return_value.first.return_value = recipient_prof
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.record_share(
            str(uuid.uuid4()), "internal", sender_id, str(uuid.uuid4())
        )

        assert "error" not in result
        # LabShare + Message + recipient notification + ActivityEvent = 4 adds (no owner notification)
        assert mock_db.add.call_count == 4

    # --- get_share_count ---

    @pytest.mark.asyncio
    async def test_get_share_count(self, service, mock_db):
        """Should return share count for existing entity."""
        result_mock = MagicMock()
        result_mock.scalar.return_value = 42
        mock_db.execute = AsyncMock(return_value=result_mock)

        count = await service.get_share_count(str(uuid.uuid4()))
        assert count == 42

    @pytest.mark.asyncio
    async def test_get_share_count_nonexistent(self, service, mock_db):
        """Should return None for nonexistent entity."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = None
            elif call_count == 2:
                result.scalar.return_value = None  # entity doesn't exist
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        count = await service.get_share_count(str(uuid.uuid4()))
        assert count is None

    @pytest.mark.asyncio
    async def test_get_share_count_zero(self, service, mock_db):
        """Should return 0 when entity exists but no shares."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = None  # share_count is None
            elif call_count == 2:
                result.scalar.return_value = uuid.uuid4()  # entity exists
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        count = await service.get_share_count(str(uuid.uuid4()))
        assert count == 0

    @pytest.mark.asyncio
    async def test_record_all_valid_platforms(self, service, mock_db):
        """All valid platforms should be accepted."""
        entity = MagicMock(spec=Entity)
        entity.share_count = 0
        entity.created_by_user_id = None

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = entity
        mock_db.execute = AsyncMock(return_value=result_mock)

        for platform in ["link", "twitter", "linkedin", "whatsapp", "email", "qr"]:
            entity.share_count = 0
            result = await service.record_share(str(uuid.uuid4()), platform, str(uuid.uuid4()))
            assert "error" not in result, f"Platform {platform} should be valid"
