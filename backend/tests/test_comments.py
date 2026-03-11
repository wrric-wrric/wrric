"""
Tests for the Comment system (Feature 2.2).
Run with: pytest tests/test_comments.py -v
"""
import uuid
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from services.comment_service import CommentService, EDIT_WINDOW_MINUTES
from models.db_models import LabComment, CommentReport, Entity, Notification


class TestCommentService:
    """Tests for CommentService methods."""

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
        with patch("services.comment_service.BlockService") as MockBlock:
            MockBlock.return_value.is_blocked = AsyncMock(return_value=False)
            yield MockBlock

    @pytest.fixture
    def service(self, mock_db):
        return CommentService(mock_db)

    # --- create_comment ---

    @pytest.mark.asyncio
    async def test_create_comment(self, service, mock_db):
        """Creating a comment on existing lab should succeed."""
        entity = MagicMock(spec=Entity)
        entity.comment_count = 0
        entity.created_by_user_id = uuid.uuid4()
        entity.university = "Test Lab"

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = entity
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        user_id = str(uuid.uuid4())
        entity_id = str(uuid.uuid4())
        comment = await service.create_comment(entity_id, user_id, "Great lab!")

        assert comment is not None
        assert comment != "parent_not_found"
        assert mock_db.add.called
        assert mock_db.commit.called
        assert entity.comment_count == 1

    @pytest.mark.asyncio
    async def test_create_comment_nonexistent_lab(self, service, mock_db):
        """Creating comment on nonexistent lab returns None."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.create_comment(str(uuid.uuid4()), str(uuid.uuid4()), "text")
        assert result is None

    @pytest.mark.asyncio
    async def test_create_reply(self, service, mock_db):
        """Creating a reply to existing comment should succeed."""
        entity = MagicMock(spec=Entity)
        entity.comment_count = 1
        entity.created_by_user_id = uuid.uuid4()
        entity.university = "Test Lab"

        parent = MagicMock(spec=LabComment)
        parent.user_id = uuid.uuid4()

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = entity
            elif call_count == 2:
                result.scalars.return_value.first.return_value = parent
            elif call_count == 3:
                result.scalar.return_value = parent.user_id
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        user_id = str(uuid.uuid4())
        result = await service.create_comment(
            str(uuid.uuid4()), user_id, "Nice reply!", str(uuid.uuid4())
        )
        assert result is not None
        assert result != "parent_not_found"

    @pytest.mark.asyncio
    async def test_create_reply_parent_not_found(self, service, mock_db):
        """Replying to nonexistent parent returns 'parent_not_found'."""
        entity = MagicMock(spec=Entity)
        entity.comment_count = 0

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

        result = await service.create_comment(
            str(uuid.uuid4()), str(uuid.uuid4()), "reply", str(uuid.uuid4())
        )
        assert result == "parent_not_found"

    @pytest.mark.asyncio
    async def test_create_comment_no_self_notification(self, service, mock_db):
        """Commenting on own lab should not create notification."""
        user_id = str(uuid.uuid4())
        entity = MagicMock(spec=Entity)
        entity.comment_count = 0
        entity.created_by_user_id = uuid.UUID(user_id)
        entity.university = "My Lab"

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = entity
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        await service.create_comment(str(uuid.uuid4()), user_id, "My own comment")
        # LabComment + ActivityEvent (no Notification)
        assert mock_db.add.call_count == 2

    # --- edit_comment ---

    @pytest.mark.asyncio
    async def test_edit_comment_by_author(self, service, mock_db):
        """Author can edit within window."""
        user_id = str(uuid.uuid4())
        comment = MagicMock(spec=LabComment)
        comment.user_id = uuid.UUID(user_id)
        comment.deleted_at = None
        comment.created_at = datetime.utcnow()
        comment.content = "old"
        comment.is_edited = False

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = comment
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.edit_comment(str(uuid.uuid4()), user_id, "new content")
        assert "comment" in result
        assert comment.content == "new content"
        assert comment.is_edited is True

    @pytest.mark.asyncio
    async def test_edit_comment_not_author(self, service, mock_db):
        """Non-author cannot edit."""
        comment = MagicMock(spec=LabComment)
        comment.user_id = uuid.uuid4()
        comment.deleted_at = None
        comment.created_at = datetime.utcnow()

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = comment
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.edit_comment(str(uuid.uuid4()), str(uuid.uuid4()), "hack")
        assert result["status"] == 403

    @pytest.mark.asyncio
    async def test_edit_comment_expired_window(self, service, mock_db):
        """Cannot edit after 15 minutes."""
        user_id = str(uuid.uuid4())
        comment = MagicMock(spec=LabComment)
        comment.user_id = uuid.UUID(user_id)
        comment.deleted_at = None
        comment.created_at = datetime.utcnow() - timedelta(minutes=20)

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = comment
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.edit_comment(str(uuid.uuid4()), user_id, "too late")
        assert result["status"] == 403
        assert "expired" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_edit_comment_not_found(self, service, mock_db):
        """Editing nonexistent comment returns 404."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.edit_comment(str(uuid.uuid4()), str(uuid.uuid4()), "x")
        assert result["status"] == 404

    # --- delete_comment ---

    @pytest.mark.asyncio
    async def test_delete_comment_by_author(self, service, mock_db):
        """Author can soft-delete own comment."""
        user_id = str(uuid.uuid4())
        comment = MagicMock(spec=LabComment)
        comment.user_id = uuid.UUID(user_id)
        comment.deleted_at = None
        comment.entity_id = uuid.uuid4()

        entity = MagicMock(spec=Entity)
        entity.comment_count = 5

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # get_comment_by_id
                result.scalars.return_value.first.return_value = comment
            elif call_count == 2:
                # get entity for decrement
                result.scalars.return_value.first.return_value = entity
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.delete_comment(str(uuid.uuid4()), user_id)
        assert result["success"] is True
        assert comment.deleted_at is not None
        assert entity.comment_count == 4

    @pytest.mark.asyncio
    async def test_delete_comment_by_admin(self, service, mock_db):
        """Admin can delete any comment."""
        comment = MagicMock(spec=LabComment)
        comment.user_id = uuid.uuid4()
        comment.deleted_at = None
        comment.entity_id = uuid.uuid4()

        entity = MagicMock(spec=Entity)
        entity.comment_count = 3

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = comment
            elif call_count == 2:
                result.scalars.return_value.first.return_value = entity
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.delete_comment(str(uuid.uuid4()), str(uuid.uuid4()), is_admin=True)
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_delete_comment_unauthorized(self, service, mock_db):
        """Non-author non-admin non-owner cannot delete."""
        comment = MagicMock(spec=LabComment)
        comment.user_id = uuid.uuid4()
        comment.deleted_at = None
        comment.entity_id = uuid.uuid4()

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = comment
            elif call_count == 2:
                # lab owner check - different user
                result.scalar.return_value = uuid.uuid4()
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.delete_comment(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["status"] == 403

    @pytest.mark.asyncio
    async def test_delete_already_deleted(self, service, mock_db):
        """Deleting already-deleted comment returns 404."""
        comment = MagicMock(spec=LabComment)
        comment.deleted_at = datetime.utcnow()

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = comment
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.delete_comment(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["status"] == 404

    # --- report_comment ---

    @pytest.mark.asyncio
    async def test_report_comment(self, service, mock_db):
        """Reporting a comment should create a report."""
        comment = MagicMock(spec=LabComment)
        comment.deleted_at = None

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # get_comment_by_id
                result.scalars.return_value.first.return_value = comment
            elif call_count == 2:
                # duplicate check - none
                result.scalars.return_value.first.return_value = None
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.report_comment(str(uuid.uuid4()), str(uuid.uuid4()), "spam")
        assert "report" in result

    @pytest.mark.asyncio
    async def test_report_comment_duplicate(self, service, mock_db):
        """Duplicate report returns 409."""
        comment = MagicMock(spec=LabComment)
        comment.deleted_at = None

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.first.return_value = comment
            elif call_count == 2:
                result.scalars.return_value.first.return_value = MagicMock(spec=CommentReport)
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.report_comment(str(uuid.uuid4()), str(uuid.uuid4()), "spam")
        assert result["status"] == 409

    @pytest.mark.asyncio
    async def test_report_deleted_comment(self, service, mock_db):
        """Reporting deleted comment returns 404."""
        comment = MagicMock(spec=LabComment)
        comment.deleted_at = datetime.utcnow()

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = comment
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.report_comment(str(uuid.uuid4()), str(uuid.uuid4()), "spam")
        assert result["status"] == 404

    # --- review_report ---

    @pytest.mark.asyncio
    async def test_review_report(self, service, mock_db):
        """Admin can review a report."""
        report = MagicMock(spec=CommentReport)
        report.status = "pending"

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = report
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.review_report(str(uuid.uuid4()), "reviewed")
        assert result is not None
        assert report.status == "reviewed"

    @pytest.mark.asyncio
    async def test_review_report_not_found(self, service, mock_db):
        """Reviewing nonexistent report returns None."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.review_report(str(uuid.uuid4()), "reviewed")
        assert result is None

    # --- get_comment_count ---

    @pytest.mark.asyncio
    async def test_get_comment_count(self, service, mock_db):
        """Should return comment count for entity."""
        result_mock = MagicMock()
        result_mock.scalar.return_value = 42
        mock_db.execute = AsyncMock(return_value=result_mock)

        count = await service.get_comment_count(str(uuid.uuid4()))
        assert count == 42

    @pytest.mark.asyncio
    async def test_get_comment_count_zero(self, service, mock_db):
        """Should return 0 when no comments."""
        result_mock = MagicMock()
        result_mock.scalar.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        count = await service.get_comment_count(str(uuid.uuid4()))
        assert count == 0
