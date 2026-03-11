"""
Tests for the Like system (Feature 2.1).
Run with: pytest tests/test_likes.py -v
"""
import uuid
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from services.like_service import LikeService
from models.db_models import LabLike, Entity, Notification


class TestLikeService:
    """Tests for LikeService methods."""

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.delete = AsyncMock()
        return db

    @pytest.fixture(autouse=True)
    def mock_block_service(self):
        with patch("services.like_service.BlockService") as MockBlock:
            MockBlock.return_value.is_blocked = AsyncMock(return_value=False)
            yield MockBlock

    @pytest.fixture
    def service(self, mock_db):
        return LikeService(mock_db)

    # --- toggle_like ---

    @pytest.mark.asyncio
    async def test_toggle_like_first_time(self, service, mock_db):
        """Liking a lab for the first time should create a like and increment count."""
        entity = MagicMock(spec=Entity)
        entity.like_count = 0
        entity.created_by_user_id = uuid.uuid4()

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # Entity exists
                result.scalars.return_value.first.return_value = entity
            elif call_count == 2:
                # No existing like
                result.scalars.return_value.first.return_value = None
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        user_id = str(uuid.uuid4())
        entity_id = str(uuid.uuid4())
        result = await service.toggle_like(entity_id, user_id)

        assert result["liked"] is True
        assert result["like_count"] == 1
        assert mock_db.add.call_count == 3  # LabLike + Notification + ActivityEvent
        assert mock_db.commit.called

    @pytest.mark.asyncio
    async def test_toggle_like_unlike(self, service, mock_db):
        """Unliking a lab should remove the like and decrement count."""
        entity = MagicMock(spec=Entity)
        entity.like_count = 5

        existing_like = MagicMock(spec=LabLike)

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = entity
            elif call_count == 2:
                result.scalars.return_value.first.return_value = existing_like
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.toggle_like(str(uuid.uuid4()), str(uuid.uuid4()))

        assert result["liked"] is False
        assert result["like_count"] == 4
        assert mock_db.delete.called

    @pytest.mark.asyncio
    async def test_toggle_like_nonexistent_lab(self, service, mock_db):
        """Liking a nonexistent lab should return error."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.toggle_like(str(uuid.uuid4()), str(uuid.uuid4()))
        assert "error" in result

    @pytest.mark.asyncio
    async def test_toggle_like_no_self_notification(self, service, mock_db):
        """Liking own lab should not create notification."""
        user_id = str(uuid.uuid4())
        entity = MagicMock(spec=Entity)
        entity.like_count = 0
        entity.created_by_user_id = uuid.UUID(user_id)  # Same user

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = entity
            elif call_count == 2:
                result.scalars.return_value.first.return_value = None
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.toggle_like(str(uuid.uuid4()), user_id)
        assert result["liked"] is True
        # LabLike + ActivityEvent (no Notification)
        assert mock_db.add.call_count == 2

    @pytest.mark.asyncio
    async def test_toggle_like_no_owner_no_notification(self, service, mock_db):
        """Liking a lab with no owner should not create notification."""
        entity = MagicMock(spec=Entity)
        entity.like_count = 0
        entity.created_by_user_id = None

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = entity
            elif call_count == 2:
                result.scalars.return_value.first.return_value = None
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.toggle_like(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["liked"] is True
        assert mock_db.add.call_count == 2  # LabLike + ActivityEvent (no notification)

    @pytest.mark.asyncio
    async def test_unlike_count_doesnt_go_negative(self, service, mock_db):
        """Unlike when count is 0 should stay at 0."""
        entity = MagicMock(spec=Entity)
        entity.like_count = 0
        existing_like = MagicMock(spec=LabLike)

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = entity
            elif call_count == 2:
                result.scalars.return_value.first.return_value = existing_like
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.toggle_like(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["liked"] is False
        assert result["like_count"] == 0

    # --- get_like_status ---

    @pytest.mark.asyncio
    async def test_get_like_status_unauthenticated(self, service, mock_db):
        """Unauthenticated user should get count but liked=false."""
        result_mock = MagicMock()
        result_mock.scalar.return_value = 10
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.get_like_status(str(uuid.uuid4()))
        assert result["count"] == 10
        assert result["liked"] is False

    @pytest.mark.asyncio
    async def test_get_like_status_authenticated_liked(self, service, mock_db):
        """Authenticated user who liked should get liked=true."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = 5
            elif call_count == 2:
                result.scalars.return_value.first.return_value = MagicMock(spec=LabLike)
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.get_like_status(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["count"] == 5
        assert result["liked"] is True

    @pytest.mark.asyncio
    async def test_get_like_status_authenticated_not_liked(self, service, mock_db):
        """Authenticated user who hasn't liked should get liked=false."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = 3
            elif call_count == 2:
                result.scalars.return_value.first.return_value = None
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.get_like_status(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["count"] == 3
        assert result["liked"] is False

    @pytest.mark.asyncio
    async def test_get_like_status_nonexistent_lab(self, service, mock_db):
        """Nonexistent lab should return error."""
        result_mock = MagicMock()
        result_mock.scalar.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.get_like_status(str(uuid.uuid4()))
        assert "error" in result

    # --- get_user_liked_labs ---

    @pytest.mark.asyncio
    async def test_get_user_liked_labs(self, service, mock_db):
        """Should return paginated liked labs."""
        count_result = MagicMock()
        count_result.scalar.return_value = 2
        data_result = MagicMock()
        data_result.scalars.return_value.unique.return_value.all.return_value = [
            MagicMock(spec=Entity), MagicMock(spec=Entity)
        ]

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return count_result
            return data_result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        entities, total = await service.get_user_liked_labs(str(uuid.uuid4()))
        assert total == 2
        assert len(entities) == 2

    @pytest.mark.asyncio
    async def test_get_user_liked_labs_empty(self, service, mock_db):
        """User with no liked labs should return empty."""
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

        entities, total = await service.get_user_liked_labs(str(uuid.uuid4()))
        assert total == 0
        assert len(entities) == 0

    # --- check_likes_batch ---

    @pytest.mark.asyncio
    async def test_check_likes_batch(self, service, mock_db):
        """Batch check should return dict of entity_id -> bool."""
        eid1 = str(uuid.uuid4())
        eid2 = str(uuid.uuid4())
        eid3 = str(uuid.uuid4())

        result_mock = MagicMock()
        result_mock.all.return_value = [(uuid.UUID(eid1),), (uuid.UUID(eid3),)]
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.check_likes_batch([eid1, eid2, eid3], str(uuid.uuid4()))
        assert result[eid1] is True
        assert result[eid2] is False
        assert result[eid3] is True

    @pytest.mark.asyncio
    async def test_check_likes_batch_empty(self, service, mock_db):
        """Empty entity list should return empty dict."""
        result = await service.check_likes_batch([], str(uuid.uuid4()))
        assert result == {}
