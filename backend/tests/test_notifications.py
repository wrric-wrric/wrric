"""
Tests for the Notification Center Improvements (Feature 3.3).
"""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from services.social_notification_service import SocialNotificationService


class TestSocialNotificationService:

    @pytest.fixture
    def mock_db(self):
        return AsyncMock(spec=AsyncSession)

    @pytest.fixture
    def svc(self, mock_db):
        return SocialNotificationService(mock_db)

    def _notif(self, **kw):
        n = MagicMock()
        defaults = dict(
            id=uuid.uuid4(), user_id=uuid.uuid4(), type="lab_liked",
            content="Someone liked your lab", related_id=uuid.uuid4(),
            is_read=False, actor_user_id=uuid.uuid4(),
            group_key="lab_liked:123", created_at=datetime.utcnow(),
        )
        defaults.update(kw)
        for k, v in defaults.items():
            setattr(n, k, v)
        return n

    # --- create_notification ---

    @pytest.mark.asyncio
    async def test_create_notification_adds_to_db(self, svc, mock_db):
        # No preferences row → defaults to True
        pref_result = MagicMock()
        pref_result.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=pref_result)

        result = await svc.create_notification(
            user_id=str(uuid.uuid4()), type="lab_liked",
            content="Test", actor_user_id=str(uuid.uuid4()),
        )
        assert result is not None
        mock_db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_notification_respects_disabled_pref(self, svc, mock_db):
        pref = MagicMock()
        pref.like_in_app = False
        pref_result = MagicMock()
        pref_result.scalars.return_value.first.return_value = pref
        mock_db.execute = AsyncMock(return_value=pref_result)

        result = await svc.create_notification(
            user_id=str(uuid.uuid4()), type="lab_liked", content="Test",
        )
        assert result is None
        mock_db.add.assert_not_called()

    # --- get_unread_count ---

    @pytest.mark.asyncio
    async def test_get_unread_count(self, svc, mock_db):
        result = MagicMock()
        result.scalar.return_value = 5
        mock_db.execute = AsyncMock(return_value=result)

        count = await svc.get_unread_count(str(uuid.uuid4()))
        assert count == 5

    @pytest.mark.asyncio
    async def test_get_unread_count_zero(self, svc, mock_db):
        result = MagicMock()
        result.scalar.return_value = 0
        mock_db.execute = AsyncMock(return_value=result)

        count = await svc.get_unread_count(str(uuid.uuid4()))
        assert count == 0

    # --- get_grouped_notifications ---

    @pytest.mark.asyncio
    async def test_grouped_single_notification(self, svc, mock_db):
        n = self._notif(group_key=None)
        result = MagicMock()
        result.scalars.return_value.all.return_value = [n]
        mock_db.execute = AsyncMock(return_value=result)

        items = await svc.get_grouped_notifications(str(uuid.uuid4()))
        assert len(items) == 1
        assert items[0]["count"] == 1

    @pytest.mark.asyncio
    async def test_grouped_multiple_same_key(self, svc, mock_db):
        gk = "lab_liked:abc"
        actor1 = uuid.uuid4()
        actor2 = uuid.uuid4()
        n1 = self._notif(group_key=gk, actor_user_id=actor1)
        n2 = self._notif(group_key=gk, actor_user_id=actor2)

        notif_result = MagicMock()
        notif_result.scalars.return_value.all.return_value = [n1, n2]

        user_row1 = MagicMock()
        user_row1.id = actor1
        user_row1.username = "Alice"
        user_row2 = MagicMock()
        user_row2.id = actor2
        user_row2.username = "Bob"
        user_result = MagicMock()
        user_result.all.return_value = [user_row1, user_row2]

        call_count = 0
        async def mock_exec(q, *a, **kw):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return notif_result
            return user_result

        mock_db.execute = AsyncMock(side_effect=mock_exec)

        items = await svc.get_grouped_notifications(str(uuid.uuid4()))
        assert len(items) == 1
        assert items[0]["count"] == 2
        assert "Alice" in items[0]["content"]
        assert "Bob" in items[0]["content"]

    @pytest.mark.asyncio
    async def test_grouped_three_actors_shows_others(self, svc, mock_db):
        gk = "lab_liked:xyz"
        actors = [uuid.uuid4() for _ in range(3)]
        notifs = [self._notif(group_key=gk, actor_user_id=a) for a in actors]

        notif_result = MagicMock()
        notif_result.scalars.return_value.all.return_value = notifs

        user_row = MagicMock()
        user_row.id = actors[0]
        user_row.username = "Alice"
        user_result = MagicMock()
        user_result.all.return_value = [user_row]

        call_count = 0
        async def mock_exec(q, *a, **kw):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return notif_result
            return user_result

        mock_db.execute = AsyncMock(side_effect=mock_exec)

        items = await svc.get_grouped_notifications(str(uuid.uuid4()))
        assert "2 others" in items[0]["content"]

    # --- preferences ---

    @pytest.mark.asyncio
    async def test_get_preferences_creates_default(self, svc, mock_db):
        result = MagicMock()
        result.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result)
        mock_db.flush = AsyncMock()

        prefs = await svc.get_preferences(str(uuid.uuid4()))
        assert prefs["like"]["in_app"] is True
        assert prefs["like"]["email"] is False
        mock_db.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_preferences_returns_existing(self, svc, mock_db):
        pref = MagicMock()
        pref.like_in_app = False
        pref.like_email = True
        pref.comment_in_app = True
        pref.comment_email = False
        pref.reply_in_app = True
        pref.reply_email = False
        pref.follow_in_app = True
        pref.follow_email = False
        pref.share_in_app = True
        pref.share_email = False
        pref.partner_in_app = True
        pref.partner_email = True
        pref.new_lab_in_app = True
        pref.new_lab_email = False

        result = MagicMock()
        result.scalars.return_value.first.return_value = pref
        mock_db.execute = AsyncMock(return_value=result)

        prefs = await svc.get_preferences(str(uuid.uuid4()))
        assert prefs["like"]["in_app"] is False
        assert prefs["like"]["email"] is True

    @pytest.mark.asyncio
    async def test_update_preferences(self, svc, mock_db):
        pref = MagicMock()
        pref.like_in_app = True
        pref.like_email = False
        pref.comment_in_app = True
        pref.comment_email = False
        pref.reply_in_app = True
        pref.reply_email = False
        pref.follow_in_app = True
        pref.follow_email = False
        pref.share_in_app = True
        pref.share_email = False
        pref.partner_in_app = True
        pref.partner_email = True
        pref.new_lab_in_app = True
        pref.new_lab_email = False

        result = MagicMock()
        result.scalars.return_value.first.return_value = pref
        mock_db.execute = AsyncMock(return_value=result)
        mock_db.commit = AsyncMock()

        updated = await svc.update_preferences(str(uuid.uuid4()), {"like": {"email": True}})
        # setattr should have been called on the mock
        assert pref.like_email == True

    # --- delete ---

    @pytest.mark.asyncio
    async def test_delete_notification_found(self, svc, mock_db):
        notif = self._notif()
        result = MagicMock()
        result.scalars.return_value.first.return_value = notif
        mock_db.execute = AsyncMock(return_value=result)
        mock_db.delete = AsyncMock()
        mock_db.commit = AsyncMock()

        deleted = await svc.delete_notification(str(uuid.uuid4()), str(uuid.uuid4()))
        assert deleted is True
        mock_db.delete.assert_called_once_with(notif)

    @pytest.mark.asyncio
    async def test_delete_notification_not_found(self, svc, mock_db):
        result = MagicMock()
        result.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result)

        deleted = await svc.delete_notification(str(uuid.uuid4()), str(uuid.uuid4()))
        assert deleted is False

    # --- clear_all ---

    @pytest.mark.asyncio
    async def test_clear_all(self, svc, mock_db):
        result = MagicMock()
        result.rowcount = 7
        mock_db.execute = AsyncMock(return_value=result)
        mock_db.commit = AsyncMock()

        count = await svc.clear_all(str(uuid.uuid4()))
        assert count == 7

    # --- type_to_verb ---

    def test_type_to_verb(self):
        assert "liked" in SocialNotificationService._type_to_verb("lab_liked")
        assert "commented" in SocialNotificationService._type_to_verb("lab_comment")
        assert "replied" in SocialNotificationService._type_to_verb("comment_reply")
        assert "following" in SocialNotificationService._type_to_verb("new_follower")
        assert "shared" in SocialNotificationService._type_to_verb("lab_shared")
        assert "interacted" in SocialNotificationService._type_to_verb("unknown_type")
