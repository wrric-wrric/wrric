"""
Tests for the Follow system (Feature 2.4).
Run with: pytest tests/test_follows.py -v
"""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from services.follow_service import FollowService
from models.db_models import Follow, User, Partner, Entity


class TestFollowService:
    """Tests for FollowService methods."""

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
        with patch("services.follow_service.BlockService") as MockBlock:
            MockBlock.return_value.is_blocked = AsyncMock(return_value=False)
            yield MockBlock

    @pytest.fixture
    def service(self, mock_db):
        return FollowService(mock_db)

    # --- follow ---

    @pytest.mark.asyncio
    async def test_follow_user(self, service, mock_db):
        """Following a user should succeed."""
        follower_id = str(uuid.uuid4())
        target_id = str(uuid.uuid4())

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # _target_exists: user exists
                result.scalar.return_value = uuid.UUID(target_id)
            elif call_count == 2:
                # duplicate check: not following
                result.scalars.return_value.first.return_value = None
            elif call_count == 3:
                # _send_follow_notifications: get follower username
                result.scalar.return_value = "testuser"
            elif call_count == 4:
                # _get_follower_count
                result.scalar.return_value = 1
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.follow(follower_id, "user", target_id)
        assert result["followed"] is True
        assert result["follower_count"] == 1
        assert mock_db.add.called

    @pytest.mark.asyncio
    async def test_follow_self_rejected(self, service, mock_db):
        """Cannot follow yourself."""
        user_id = str(uuid.uuid4())
        result = await service.follow(user_id, "user", user_id)
        assert result["status"] == 400
        assert "yourself" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_follow_already_following(self, service, mock_db):
        """Following someone already followed returns 409."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = uuid.uuid4()  # target exists
            elif call_count == 2:
                result.scalars.return_value.first.return_value = MagicMock(spec=Follow)  # already exists
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.follow(str(uuid.uuid4()), "user", str(uuid.uuid4()))
        assert result["status"] == 409

    @pytest.mark.asyncio
    async def test_follow_nonexistent_target(self, service, mock_db):
        """Following nonexistent target returns 404."""
        result_mock = MagicMock()
        result_mock.scalar.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.follow(str(uuid.uuid4()), "user", str(uuid.uuid4()))
        assert result["status"] == 404

    @pytest.mark.asyncio
    async def test_follow_invalid_target_type(self, service, mock_db):
        """Invalid target_type returns 400."""
        result = await service.follow(str(uuid.uuid4()), "planet", str(uuid.uuid4()))
        assert result["status"] == 400

    @pytest.mark.asyncio
    async def test_follow_partner_notifies_owner(self, service, mock_db):
        """Following a partner should notify the partner owner."""
        follower_id = str(uuid.uuid4())
        target_id = str(uuid.uuid4())
        owner_id = uuid.uuid4()

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = uuid.UUID(target_id)  # partner exists
            elif call_count == 2:
                result.scalars.return_value.first.return_value = None  # not following
            elif call_count == 3:
                result.scalar.return_value = "follower_user"  # follower username
            elif call_count == 4:
                result.scalar.return_value = owner_id  # partner owner_id
            elif call_count == 5:
                result.scalar.return_value = 1  # follower count
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.follow(follower_id, "partner", target_id)
        assert result["followed"] is True
        # Follow + Notification + ActivityEvent = 3 adds
        assert mock_db.add.call_count == 3

    @pytest.mark.asyncio
    async def test_follow_lab(self, service, mock_db):
        """Following a lab should succeed."""
        follower_id = str(uuid.uuid4())
        target_id = str(uuid.uuid4())
        owner_id = uuid.uuid4()

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = uuid.UUID(target_id)  # lab exists
            elif call_count == 2:
                result.scalars.return_value.first.return_value = None
            elif call_count == 3:
                result.scalar.return_value = "follower_user"
            elif call_count == 4:
                result.scalar.return_value = owner_id  # lab owner
            elif call_count == 5:
                result.scalar.return_value = 1
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.follow(follower_id, "lab", target_id)
        assert result["followed"] is True

    # --- unfollow ---

    @pytest.mark.asyncio
    async def test_unfollow(self, service, mock_db):
        """Unfollowing should succeed."""
        existing = MagicMock(spec=Follow)

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = existing
            elif call_count == 2:
                result.scalar.return_value = 0  # follower count
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.unfollow(str(uuid.uuid4()), "user", str(uuid.uuid4()))
        assert result["followed"] is False
        assert mock_db.delete.called

    @pytest.mark.asyncio
    async def test_unfollow_not_following(self, service, mock_db):
        """Unfollowing when not following returns 404."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.unfollow(str(uuid.uuid4()), "user", str(uuid.uuid4()))
        assert result["status"] == 404

    # --- get_follow_status ---

    @pytest.mark.asyncio
    async def test_get_follow_status_unauthenticated(self, service, mock_db):
        """Unauthenticated check should return count and is_following=False."""
        result_mock = MagicMock()
        result_mock.scalar.return_value = 5
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.get_follow_status(None, "user", str(uuid.uuid4()))
        assert result["follower_count"] == 5
        assert result["is_following"] is False

    @pytest.mark.asyncio
    async def test_get_follow_status_following(self, service, mock_db):
        """Authenticated user who follows should get is_following=True."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = 10  # follower count
            elif call_count == 2:
                result.scalar.return_value = uuid.uuid4()  # follow exists
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.get_follow_status(str(uuid.uuid4()), "user", str(uuid.uuid4()))
        assert result["follower_count"] == 10
        assert result["is_following"] is True

    # --- check_following_batch ---

    @pytest.mark.asyncio
    async def test_check_following_batch(self, service, mock_db):
        """Batch check should return dict of key -> bool."""
        uid1 = str(uuid.uuid4())
        uid2 = str(uuid.uuid4())

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = uuid.uuid4()  # following first
            elif call_count == 2:
                result.scalar.return_value = None  # not following second
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        targets = [
            {"target_type": "user", "target_id": uid1},
            {"target_type": "lab", "target_id": uid2},
        ]
        result = await service.check_following_batch(str(uuid.uuid4()), targets)
        assert result[f"user:{uid1}"] is True
        assert result[f"lab:{uid2}"] is False

    @pytest.mark.asyncio
    async def test_check_following_batch_empty(self, service, mock_db):
        """Empty batch should return empty dict."""
        result = await service.check_following_batch(str(uuid.uuid4()), [])
        assert result == {}

    # --- get_followers ---

    @pytest.mark.asyncio
    async def test_get_followers(self, service, mock_db):
        """Should return paginated follower list."""
        user = MagicMock(spec=User)
        user.id = uuid.uuid4()
        user.username = "follower1"
        user.profile_image_url = None

        follow = MagicMock(spec=Follow)
        follow.created_at = MagicMock()
        follow.created_at.isoformat.return_value = "2025-01-01T00:00:00"

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = 1  # total count
            elif call_count == 2:
                result.all.return_value = [(follow, user)]
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        followers, total = await service.get_followers("user", str(uuid.uuid4()))
        assert total == 1
        assert len(followers) == 1
        assert followers[0]["username"] == "follower1"
