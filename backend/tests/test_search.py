"""
Tests for the Search & Discovery system (Feature 3.2).
"""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from services.search_service import global_search, search_labs


class TestGlobalSearch:

    @pytest.fixture
    def mock_db(self):
        return AsyncMock(spec=AsyncSession)

    def _lab_row(self, **kw):
        row = MagicMock()
        defaults = dict(
            id=uuid.uuid4(), university="MIT Solar Lab",
            location={"country": "US"}, department={"focus": "Solar"},
            research_abstract="Solar energy research",
            like_count=5, comment_count=2, share_count=1, view_count=100,
        )
        defaults.update(kw)
        for k, v in defaults.items():
            setattr(row, k, v)
        return row

    def _partner_row(self, **kw):
        row = MagicMock()
        defaults = dict(
            id=uuid.uuid4(), name="Solar Corp", slug="solar-corp",
            description="Solar partner", logo_url=None,
            sector_focus=["solar"], country="US", is_verified=True,
        )
        defaults.update(kw)
        for k, v in defaults.items():
            setattr(row, k, v)
        return row

    def _user_row(self, **kw):
        row = MagicMock()
        defaults = dict(id=uuid.uuid4(), username="solaruser", profile_image_url=None)
        defaults.update(kw)
        for k, v in defaults.items():
            setattr(row, k, v)
        return row

    @pytest.mark.asyncio
    async def test_returns_grouped(self, mock_db):
        call_count = 0
        async def mock_exec(q, *a, **kw):
            nonlocal call_count
            call_count += 1
            r = MagicMock()
            if call_count == 1: r.all.return_value = [self._lab_row()]
            elif call_count == 2: r.all.return_value = [self._partner_row()]
            else: r.all.return_value = [self._user_row()]
            return r
        mock_db.execute = AsyncMock(side_effect=mock_exec)

        result = await global_search(mock_db, "solar", 10)
        assert result["query"] == "solar"
        assert len(result["labs"]) == 1
        assert len(result["partners"]) == 1
        assert len(result["users"]) == 1
        assert result["counts"] == {"labs": 1, "partners": 1, "users": 1}

    @pytest.mark.asyncio
    async def test_empty(self, mock_db):
        r = MagicMock()
        r.all.return_value = []
        mock_db.execute = AsyncMock(return_value=r)

        result = await global_search(mock_db, "xyznonexistent", 10)
        assert result["labs"] == []
        assert result["partners"] == []
        assert result["users"] == []

    @pytest.mark.asyncio
    async def test_truncates_abstract(self, mock_db):
        call_count = 0
        async def mock_exec(q, *a, **kw):
            nonlocal call_count
            call_count += 1
            r = MagicMock()
            if call_count == 1:
                r.all.return_value = [self._lab_row(research_abstract="A" * 300)]
            else:
                r.all.return_value = []
            return r
        mock_db.execute = AsyncMock(side_effect=mock_exec)

        result = await global_search(mock_db, "test", 10)
        assert len(result["labs"][0]["research_abstract"]) == 200

    @pytest.mark.asyncio
    async def test_lab_id_is_string(self, mock_db):
        call_count = 0
        async def mock_exec(q, *a, **kw):
            nonlocal call_count
            call_count += 1
            r = MagicMock()
            if call_count == 1:
                r.all.return_value = [self._lab_row()]
            else:
                r.all.return_value = []
            return r
        mock_db.execute = AsyncMock(side_effect=mock_exec)

        result = await global_search(mock_db, "test", 10)
        assert isinstance(result["labs"][0]["id"], str)


class TestSearchLabs:

    @pytest.fixture
    def mock_db(self):
        return AsyncMock(spec=AsyncSession)

    def _row(self, **kw):
        row = MagicMock()
        defaults = dict(
            id=uuid.uuid4(), university="Test Lab", location={},
            department={}, like_count=5, comment_count=2, share_count=1,
            view_count=10, source="scraped", url="https://test.edu",
            climate_tech_focus=["solar"], timestamp=datetime.utcnow(),
        )
        defaults.update(kw)
        for k, v in defaults.items():
            setattr(row, k, v)
        return row

    def _setup_db(self, mock_db, total, rows):
        count_r = MagicMock()
        count_r.scalar.return_value = total
        data_r = MagicMock()
        data_r.all.return_value = rows
        call_count = 0
        async def mock_exec(q, *a, **kw):
            nonlocal call_count
            call_count += 1
            return count_r if call_count == 1 else data_r
        mock_db.execute = AsyncMock(side_effect=mock_exec)

    @pytest.mark.asyncio
    async def test_default_sort(self, mock_db):
        self._setup_db(mock_db, 1, [self._row()])
        result = await search_labs(mock_db)
        assert result["total"] == 1
        assert result["page"] == 1
        assert len(result["items"]) == 1

    @pytest.mark.asyncio
    async def test_trending_recent(self, mock_db):
        self._setup_db(mock_db, 1, [
            self._row(like_count=8, comment_count=3, share_count=2, timestamp=datetime.utcnow())
        ])
        result = await search_labs(mock_db)
        assert result["items"][0]["is_trending"] is True

    @pytest.mark.asyncio
    async def test_not_trending_old(self, mock_db):
        self._setup_db(mock_db, 1, [
            self._row(like_count=20, comment_count=10, share_count=5,
                      timestamp=datetime.utcnow() - timedelta(days=30))
        ])
        result = await search_labs(mock_db)
        assert result["items"][0]["is_trending"] is False

    @pytest.mark.asyncio
    async def test_not_trending_low_engagement(self, mock_db):
        self._setup_db(mock_db, 1, [
            self._row(like_count=1, comment_count=0, share_count=0, timestamp=datetime.utcnow())
        ])
        result = await search_labs(mock_db)
        assert result["items"][0]["is_trending"] is False

    @pytest.mark.asyncio
    async def test_pagination(self, mock_db):
        self._setup_db(mock_db, 50, [])
        result = await search_labs(mock_db, page=2, limit=10)
        assert result["total"] == 50
        assert result["page"] == 2
        assert result["pages"] == 5

    @pytest.mark.asyncio
    async def test_empty_query(self, mock_db):
        self._setup_db(mock_db, 0, [])
        result = await search_labs(mock_db, q="nonexistent")
        assert result["items"] == []
        assert result["total"] == 0

    @pytest.mark.asyncio
    async def test_sort_options(self, mock_db):
        for sort_val in ["newest", "most_liked", "most_commented", "most_viewed"]:
            self._setup_db(mock_db, 0, [])
            result = await search_labs(mock_db, sort=sort_val)
            assert result["total"] == 0

    @pytest.mark.asyncio
    async def test_timestamp_iso_format(self, mock_db):
        now = datetime.utcnow()
        self._setup_db(mock_db, 1, [self._row(timestamp=now)])
        result = await search_labs(mock_db)
        assert result["items"][0]["timestamp"] == now.isoformat()

    @pytest.mark.asyncio
    async def test_ceil_pages(self, mock_db):
        self._setup_db(mock_db, 21, [])
        result = await search_labs(mock_db, page=1, limit=10)
        assert result["pages"] == 3
