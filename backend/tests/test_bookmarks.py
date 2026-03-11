"""
Tests for the Bookmark / Save Collections system (Feature 2.6).
Run with: pytest tests/test_bookmarks.py -v
"""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession

from services.bookmark_service import BookmarkService
from models.db_models import Bookmark, BookmarkCollection, BookmarkCollectionItem, Entity


class TestBookmarkService:
    """Tests for BookmarkService methods."""

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
        return BookmarkService(mock_db)

    # --- add_bookmark ---

    @pytest.mark.asyncio
    async def test_add_bookmark(self, service, mock_db):
        """Bookmarking a lab should succeed."""
        user_id = str(uuid.uuid4())
        entity_id = str(uuid.uuid4())

        # Mock default collection
        default_col = MagicMock(spec=BookmarkCollection)
        default_col.id = uuid.uuid4()

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # entity exists
                result.scalar.return_value = uuid.UUID(entity_id)
            elif call_count == 2:
                # no duplicate
                result.scalar.return_value = None
            elif call_count == 3:
                # _ensure_default_collection: check existing
                result.scalars.return_value.first.return_value = default_col
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.add_bookmark(user_id, entity_id)
        assert result["bookmarked"] is True
        assert result["entity_id"] == entity_id
        assert mock_db.add.called

    @pytest.mark.asyncio
    async def test_add_bookmark_duplicate(self, service, mock_db):
        """Bookmarking already bookmarked lab returns 409."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = uuid.uuid4()  # entity exists
            elif call_count == 2:
                result.scalar.return_value = uuid.uuid4()  # already bookmarked
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.add_bookmark(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["status"] == 409

    @pytest.mark.asyncio
    async def test_add_bookmark_nonexistent_lab(self, service, mock_db):
        """Bookmarking nonexistent lab returns 404."""
        result_mock = MagicMock()
        result_mock.scalar.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.add_bookmark(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["status"] == 404

    # --- remove_bookmark ---

    @pytest.mark.asyncio
    async def test_remove_bookmark(self, service, mock_db):
        """Removing a bookmark should succeed."""
        existing = MagicMock(spec=Bookmark)
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = existing
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.remove_bookmark(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["bookmarked"] is False
        assert mock_db.delete.called

    @pytest.mark.asyncio
    async def test_remove_bookmark_not_found(self, service, mock_db):
        """Removing nonexistent bookmark returns 404."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.remove_bookmark(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["status"] == 404

    # --- get_bookmark_status ---

    @pytest.mark.asyncio
    async def test_get_bookmark_status_true(self, service, mock_db):
        """Should return bookmarked=True when bookmarked."""
        result_mock = MagicMock()
        result_mock.scalar.return_value = uuid.uuid4()
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.get_bookmark_status(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["bookmarked"] is True

    @pytest.mark.asyncio
    async def test_get_bookmark_status_false(self, service, mock_db):
        """Should return bookmarked=False when not bookmarked."""
        result_mock = MagicMock()
        result_mock.scalar.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.get_bookmark_status(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["bookmarked"] is False

    # --- check_bookmarks_batch ---

    @pytest.mark.asyncio
    async def test_check_bookmarks_batch(self, service, mock_db):
        """Batch check should return dict of entity_id -> bool."""
        eid1 = str(uuid.uuid4())
        eid2 = str(uuid.uuid4())

        result_mock = MagicMock()
        result_mock.all.return_value = [(uuid.UUID(eid1),)]
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.check_bookmarks_batch(str(uuid.uuid4()), [eid1, eid2])
        assert result[eid1] is True
        assert result[eid2] is False

    @pytest.mark.asyncio
    async def test_check_bookmarks_batch_empty(self, service, mock_db):
        """Empty list returns empty dict."""
        result = await service.check_bookmarks_batch(str(uuid.uuid4()), [])
        assert result == {}

    # --- create_collection ---

    @pytest.mark.asyncio
    async def test_create_collection(self, service, mock_db):
        """Creating a collection should succeed."""
        mock_db.refresh = AsyncMock()
        result = await service.create_collection(str(uuid.uuid4()), "AI Labs")
        assert result["name"] == "AI Labs"
        assert result["is_default"] is False
        assert mock_db.add.called

    @pytest.mark.asyncio
    async def test_create_collection_empty_name(self, service, mock_db):
        """Empty name returns 400."""
        result = await service.create_collection(str(uuid.uuid4()), "")
        assert result["status"] == 400

    # --- update_collection ---

    @pytest.mark.asyncio
    async def test_update_collection_make_public(self, service, mock_db):
        """Making a collection public should succeed."""
        col = MagicMock(spec=BookmarkCollection)
        col.id = uuid.uuid4()
        col.name = "My Collection"
        col.is_default = False
        col.is_public = False

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = col
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.update_collection(str(col.id), str(uuid.uuid4()), is_public=True)
        assert col.is_public is True

    @pytest.mark.asyncio
    async def test_update_collection_rename_default_rejected(self, service, mock_db):
        """Cannot rename default collection."""
        col = MagicMock(spec=BookmarkCollection)
        col.is_default = True

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = col
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.update_collection(str(uuid.uuid4()), str(uuid.uuid4()), name="New Name")
        assert result["status"] == 400

    # --- delete_collection ---

    @pytest.mark.asyncio
    async def test_delete_collection(self, service, mock_db):
        """Deleting a non-default collection should succeed."""
        col = MagicMock(spec=BookmarkCollection)
        col.is_default = False

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = col
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.delete_collection(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["deleted"] is True
        assert mock_db.delete.called

    @pytest.mark.asyncio
    async def test_delete_default_collection_rejected(self, service, mock_db):
        """Cannot delete default collection."""
        col = MagicMock(spec=BookmarkCollection)
        col.is_default = True

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = col
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.delete_collection(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["status"] == 400

    @pytest.mark.asyncio
    async def test_delete_collection_not_found(self, service, mock_db):
        """Deleting nonexistent collection returns 404."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        result = await service.delete_collection(str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["status"] == 404

    # --- add_to_collection ---

    @pytest.mark.asyncio
    async def test_add_to_collection(self, service, mock_db):
        """Adding bookmark to collection should succeed."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = uuid.uuid4()  # collection exists
            elif call_count == 2:
                result.scalar.return_value = uuid.uuid4()  # bookmark exists
            elif call_count == 3:
                result.scalar.return_value = None  # not duplicate
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.add_to_collection(str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["added"] is True

    @pytest.mark.asyncio
    async def test_add_to_collection_duplicate(self, service, mock_db):
        """Adding duplicate returns 409."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = uuid.uuid4()
            elif call_count == 2:
                result.scalar.return_value = uuid.uuid4()
            elif call_count == 3:
                result.scalar.return_value = uuid.uuid4()  # already exists
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.add_to_collection(str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["status"] == 409

    # --- remove_from_collection ---

    @pytest.mark.asyncio
    async def test_remove_from_collection(self, service, mock_db):
        """Removing item from collection should succeed."""
        item = MagicMock(spec=BookmarkCollectionItem)

        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = uuid.uuid4()  # collection exists
            elif call_count == 2:
                result.scalars.return_value.first.return_value = item
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.remove_from_collection(str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["removed"] is True

    @pytest.mark.asyncio
    async def test_remove_from_collection_not_found(self, service, mock_db):
        """Removing nonexistent item returns 404."""
        call_count = 0
        async def mock_execute(query, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = uuid.uuid4()
            elif call_count == 2:
                result.scalars.return_value.first.return_value = None
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        result = await service.remove_from_collection(str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()))
        assert result["status"] == 404

    # --- _ensure_default_collection ---

    @pytest.mark.asyncio
    async def test_ensure_default_collection_creates_new(self, service, mock_db):
        """Should create default collection if none exists."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        col = await service._ensure_default_collection(str(uuid.uuid4()))
        assert col.name == "Saved"
        assert col.is_default is True
        assert mock_db.add.called

    @pytest.mark.asyncio
    async def test_ensure_default_collection_returns_existing(self, service, mock_db):
        """Should return existing default collection."""
        existing = MagicMock(spec=BookmarkCollection)
        existing.name = "Saved"

        result_mock = MagicMock()
        result_mock.scalars.return_value.first.return_value = existing
        mock_db.execute = AsyncMock(return_value=result_mock)

        col = await service._ensure_default_collection(str(uuid.uuid4()))
        assert col is existing
        assert not mock_db.add.called
