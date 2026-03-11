"""
Tests for the User Profile system (Feature 3.4).
Run with: pytest tests/test_user_profile.py -v
"""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from services.user_profile_service import UserProfileService
from models.db_models import User, Entity, UserEntityLink, LabLike, LabComment, Follow, Partner


class TestUserProfileService:
    """Tests for UserProfileService methods."""

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
        return UserProfileService(mock_db)

    # --- get_user_summary ---

    @pytest.mark.asyncio
    async def test_get_user_summary_with_partner_badge(self, service, mock_db):
        """Summary should include partner badge if user owns an approved partner."""
        user_id = str(uuid.uuid4())
        user = MagicMock(spec=User)
        user.id = uuid.UUID(user_id)
        user.username = "testuser"
        user.profile_image_url = "https://example.com/img.png"

        call_count = 0

        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # User lookup
                result.scalars.return_value.first.return_value = user
            elif call_count == 2:
                # Partner lookup — approved partner exists
                row = MagicMock()
                row.name = "Test Partner"
                row.slug = "test-partner"
                result.first.return_value = row
            else:
                # All counts return 0
                result.scalar.return_value = 0
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        summary = await service.get_user_summary(user_id)

        assert summary is not None
        assert summary["user_id"] == user_id
        assert summary["username"] == "testuser"
        assert summary["partner_badge"] == {"name": "Test Partner", "slug": "test-partner"}

    @pytest.mark.asyncio
    async def test_get_user_summary_no_partner(self, service, mock_db):
        """Summary should have partner_badge=None if user has no approved partner."""
        user_id = str(uuid.uuid4())
        user = MagicMock(spec=User)
        user.id = uuid.UUID(user_id)
        user.username = "testuser2"
        user.profile_image_url = None

        call_count = 0

        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = user
            elif call_count == 2:
                # No partner
                result.first.return_value = None
            else:
                result.scalar.return_value = 0
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        summary = await service.get_user_summary(user_id)

        assert summary is not None
        assert summary["partner_badge"] is None

    @pytest.mark.asyncio
    async def test_get_user_summary_stats_counts(self, service, mock_db):
        """Summary should return correct stat counts."""
        user_id = str(uuid.uuid4())
        user = MagicMock(spec=User)
        user.id = uuid.UUID(user_id)
        user.username = "countuser"
        user.profile_image_url = None

        counts = [5, 12, 3, 8, 15]  # labs, comments, likes, followers, following
        call_count = 0

        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = user
            elif call_count == 2:
                result.first.return_value = None  # no partner
            else:
                idx = call_count - 3
                result.scalar.return_value = counts[idx] if idx < len(counts) else 0
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        summary = await service.get_user_summary(user_id)

        assert summary["stats"]["labs_created"] == 5
        assert summary["stats"]["comments"] == 12
        assert summary["stats"]["likes_given"] == 3
        assert summary["follower_count"] == 8
        assert summary["following_count"] == 15

    @pytest.mark.asyncio
    async def test_get_user_summary_user_not_found(self, service, mock_db):
        """Should return None if user doesn't exist."""
        result = MagicMock()
        result.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result)

        summary = await service.get_user_summary(str(uuid.uuid4()))
        assert summary is None

    # --- get_user_labs ---

    @pytest.mark.asyncio
    async def test_get_user_labs_paginated(self, service, mock_db):
        """Should return paginated lab items."""
        entity = MagicMock(spec=Entity)
        entity.id = uuid.uuid4()
        entity.university = "MIT"
        entity.research_abstract = "Some research"
        entity.website = "https://mit.edu"
        entity.location = {"city": "Cambridge"}
        entity.scopes = ["AI"]
        entity.entity_type = "lab"
        entity.like_count = 10
        entity.comment_count = 2
        entity.images = []
        entity.get_json_field = MagicMock(side_effect=lambda f: {"location": {"city": "Cambridge"}, "scopes": ["AI"]}.get(f, {}))

        call_count = 0

        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # Count
                result.scalar.return_value = 1
            else:
                # Entities
                result.scalars.return_value.unique.return_value.all.return_value = [entity]
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        items, total = await service.get_user_labs(str(uuid.uuid4()), page=1, limit=20)

        assert total == 1
        assert len(items) == 1
        assert items[0]["university"] == "MIT"

    @pytest.mark.asyncio
    async def test_get_user_labs_empty(self, service, mock_db):
        """Should return empty list when user has no labs."""
        call_count = 0

        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = 0
            else:
                result.scalars.return_value.unique.return_value.all.return_value = []
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        items, total = await service.get_user_labs(str(uuid.uuid4()), page=1, limit=20)

        assert total == 0
        assert len(items) == 0

    # --- get_user_liked_labs ---

    @pytest.mark.asyncio
    async def test_get_user_liked_labs_paginated(self, service, mock_db):
        """Should return paginated liked lab items."""
        entity = MagicMock(spec=Entity)
        entity.id = uuid.uuid4()
        entity.university = "Stanford"
        entity.research_abstract = "Research"
        entity.website = None
        entity.location = {}
        entity.scopes = []
        entity.entity_type = "lab"
        entity.like_count = 5
        entity.comment_count = 0
        entity.images = []
        entity.get_json_field = MagicMock(return_value={})

        call_count = 0

        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = 1
            else:
                result.scalars.return_value.unique.return_value.all.return_value = [entity]
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        items, total = await service.get_user_liked_labs(str(uuid.uuid4()), page=1, limit=20)

        assert total == 1
        assert len(items) == 1
        assert items[0]["university"] == "Stanford"
