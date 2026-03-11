"""
Tests for the Activity Feed system (Feature 2.5).
Run with: pytest tests/test_activity.py -v
"""
import uuid
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from services.activity_service import ActivityService
from services.activity_hooks import record_activity
from models.db_models import ActivityEvent, Follow, User, Entity


class TestActivityService:
    """Tests for ActivityService methods."""

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
        return ActivityService(mock_db)

    # --- create_event ---

    @pytest.mark.asyncio
    async def test_create_event(self, service, mock_db):
        """Creating an event should add it to db and return it."""
        actor_id = str(uuid.uuid4())
        target_id = str(uuid.uuid4())

        mock_db.refresh = AsyncMock()
        result = await service.create_event(actor_id, "liked_lab", "lab", target_id)

        assert mock_db.add.called
        assert mock_db.commit.called
        assert isinstance(result, ActivityEvent)
        assert result.action == "liked_lab"

    @pytest.mark.asyncio
    async def test_create_event_with_metadata(self, service, mock_db):
        """Creating event with metadata should store it."""
        actor_id = str(uuid.uuid4())
        target_id = str(uuid.uuid4())

        result = await service.create_event(
            actor_id, "shared", "lab", target_id, metadata={"platform": "twitter"}
        )
        assert result.metadata_ == {"platform": "twitter"}

    # --- get_feed ---

    @pytest.mark.asyncio
    async def test_get_feed_no_follows(self, service, mock_db):
        """User with no follows should get empty feed."""
        user_id = str(uuid.uuid4())

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            result.all.return_value = []  # no follows
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        items, cursor = await service.get_feed(user_id)
        assert items == []
        assert cursor is None

    @pytest.mark.asyncio
    async def test_get_feed_with_follows(self, service, mock_db):
        """User with follows should get events from followed users."""
        user_id = str(uuid.uuid4())
        followed_user = uuid.uuid4()

        # Create a mock event
        mock_event = MagicMock(spec=ActivityEvent)
        mock_event.id = uuid.uuid4()
        mock_event.actor_user_id = followed_user
        mock_event.action = "created_lab"
        mock_event.target_type = "lab"
        mock_event.target_id = uuid.uuid4()
        mock_event.metadata_ = {}
        mock_event.created_at = datetime.utcnow()
        mock_actor = MagicMock()
        mock_actor.username = "testuser"
        mock_actor.profile_image_url = None
        mock_event.actor = mock_actor

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # followed users
                result.all.return_value = [(followed_user,)]
            elif call_count == 2:
                # followed partners
                result.all.return_value = []
            elif call_count == 3:
                # followed labs
                result.all.return_value = []
            elif call_count == 4:
                # activity events
                scalars = MagicMock()
                scalars.unique.return_value.all.return_value = [mock_event]
                result.scalars.return_value = scalars
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        items, cursor = await service.get_feed(user_id)
        assert len(items) == 1
        assert items[0]["action"] == "created_lab"
        assert items[0]["actor_username"] == "testuser"

    @pytest.mark.asyncio
    async def test_get_feed_pagination(self, service, mock_db):
        """Feed should return next_cursor when more items exist."""
        user_id = str(uuid.uuid4())
        followed_user = uuid.uuid4()

        # Create 3 mock events (limit will be 2)
        events = []
        for i in range(3):
            e = MagicMock(spec=ActivityEvent)
            e.id = uuid.uuid4()
            e.actor_user_id = followed_user
            e.action = "liked_lab"
            e.target_type = "lab"
            e.target_id = uuid.uuid4()
            e.metadata_ = {}
            e.created_at = datetime.utcnow() - timedelta(hours=i)
            actor = MagicMock()
            actor.username = f"user{i}"
            actor.profile_image_url = None
            e.actor = actor
            events.append(e)

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count <= 3:
                if call_count == 1:
                    result.all.return_value = [(followed_user,)]
                else:
                    result.all.return_value = []
            else:
                scalars = MagicMock()
                scalars.unique.return_value.all.return_value = events
                result.scalars.return_value = scalars
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        items, cursor = await service.get_feed(user_id, limit=2)
        assert len(items) == 2
        assert cursor is not None

    # --- get_discover_feed ---

    @pytest.mark.asyncio
    async def test_get_discover_feed_empty(self, service, mock_db):
        """Discover feed with no events returns empty."""
        result_mock = MagicMock()
        scalars = MagicMock()
        scalars.unique.return_value.all.return_value = []
        result_mock.scalars.return_value = scalars
        mock_db.execute = AsyncMock(return_value=result_mock)

        items, cursor = await service.get_discover_feed()
        assert items == []
        assert cursor is None

    @pytest.mark.asyncio
    async def test_get_discover_feed_with_events(self, service, mock_db):
        """Discover feed should return recent events."""
        mock_event = MagicMock(spec=ActivityEvent)
        mock_event.id = uuid.uuid4()
        mock_event.actor_user_id = uuid.uuid4()
        mock_event.action = "liked_lab"
        mock_event.target_type = "lab"
        mock_event.target_id = uuid.uuid4()
        mock_event.metadata_ = {}
        mock_event.created_at = datetime.utcnow()
        actor = MagicMock()
        actor.username = "discover_user"
        actor.profile_image_url = "http://img.jpg"
        mock_event.actor = actor

        result_mock = MagicMock()
        scalars = MagicMock()
        scalars.unique.return_value.all.return_value = [mock_event]
        result_mock.scalars.return_value = scalars
        mock_db.execute = AsyncMock(return_value=result_mock)

        items, cursor = await service.get_discover_feed()
        assert len(items) == 1
        assert items[0]["actor_username"] == "discover_user"
        assert items[0]["actor_profile_image"] == "http://img.jpg"

    # --- get_trending_labs ---

    @pytest.mark.asyncio
    async def test_get_trending_labs_empty(self, service, mock_db):
        """No trending data returns empty list."""
        result_mock = MagicMock()
        result_mock.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result_mock)

        trending = await service.get_trending_labs()
        assert trending == []

    @pytest.mark.asyncio
    async def test_get_trending_labs_with_data(self, service, mock_db):
        """Trending labs should return sorted by engagement."""
        lab_id = uuid.uuid4()
        mock_lab = MagicMock(spec=Entity)
        mock_lab.id = lab_id
        mock_lab.university = "MIT Lab"
        mock_lab.like_count = 10
        mock_lab.comment_count = 5
        mock_lab.share_count = 3

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.all.return_value = [(lab_id, 18)]
            else:
                result.scalars.return_value.first.return_value = mock_lab
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        trending = await service.get_trending_labs()
        assert len(trending) == 1
        assert trending[0]["university"] == "MIT Lab"
        assert trending[0]["engagement_score"] == 18

    # --- _event_to_dict ---

    def test_event_to_dict(self, service):
        """Event should serialize correctly."""
        event = MagicMock(spec=ActivityEvent)
        event.id = uuid.uuid4()
        event.actor_user_id = uuid.uuid4()
        event.action = "commented"
        event.target_type = "lab"
        event.target_id = uuid.uuid4()
        event.metadata_ = {"text": "great lab"}
        event.created_at = datetime(2025, 1, 15, 12, 0, 0)
        actor = MagicMock()
        actor.username = "john"
        actor.profile_image_url = None
        event.actor = actor

        result = service._event_to_dict(event)
        assert result["action"] == "commented"
        assert result["actor_username"] == "john"
        assert result["metadata"] == {"text": "great lab"}
        assert "2025-01-15" in result["created_at"]

    def test_event_to_dict_no_actor(self, service):
        """Event with no actor loaded should use empty strings."""
        event = MagicMock(spec=ActivityEvent)
        event.id = uuid.uuid4()
        event.actor_user_id = uuid.uuid4()
        event.action = "liked_lab"
        event.target_type = "lab"
        event.target_id = uuid.uuid4()
        event.metadata_ = None
        event.created_at = None
        event.actor = None

        result = service._event_to_dict(event)
        assert result["actor_username"] == ""
        assert result["actor_profile_image"] is None
        assert result["metadata"] == {}
        assert result["created_at"] == ""


class TestRecordActivity:
    """Tests for the record_activity hook."""

    @pytest.mark.asyncio
    async def test_record_activity_success(self):
        """Should add event to db session."""
        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()

        actor_id = str(uuid.uuid4())
        target_id = str(uuid.uuid4())

        await record_activity(db, actor_id, "liked_lab", "lab", target_id)
        assert db.add.called

    @pytest.mark.asyncio
    async def test_record_activity_with_metadata(self):
        """Should store metadata in event."""
        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock()

        actor_id = str(uuid.uuid4())
        target_id = str(uuid.uuid4())

        await record_activity(
            db, actor_id, "shared", "lab", target_id, {"platform": "twitter"}
        )
        added_event = db.add.call_args[0][0]
        assert added_event.metadata_ == {"platform": "twitter"}

    @pytest.mark.asyncio
    async def test_record_activity_failure_silent(self):
        """Should silently ignore failures."""
        db = AsyncMock(spec=AsyncSession)
        db.add = MagicMock(side_effect=Exception("DB error"))

        # Should not raise
        await record_activity(db, "bad-uuid", "liked_lab", "lab", "bad-uuid")
