"""Tests for Feature 3.5 — Moderation & Safety."""
import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from services.block_service import BlockService
from services.spam_filter import check_spam
from services.rate_limiter import RateLimiter


# ---------------------------------------------------------------------------
# Spam Filter Tests
# ---------------------------------------------------------------------------

def test_spam_filter_rejects_spam_comment():
    assert check_spam("Click here to buy now!") is True
    assert check_spam("CASINO free money guaranteed profit") is True
    assert check_spam("Visit our casino for free money") is True


def test_spam_filter_allows_normal_comment():
    assert check_spam("Great research lab! I'd love to collaborate.") is False
    assert check_spam("Interesting findings on climate change.") is False
    assert check_spam("How can I apply to join this lab?") is False


# ---------------------------------------------------------------------------
# Rate Limiter Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rate_limit_likes_enforced():
    limiter = RateLimiter()
    key = f"like:test-user-{uuid.uuid4()}"

    # Should allow up to max
    for i in range(5):
        assert await limiter.check(key, 5, 3600) is True

    # Should reject after max
    assert await limiter.check(key, 5, 3600) is False


@pytest.mark.asyncio
async def test_rate_limit_comments_enforced():
    limiter = RateLimiter()
    key = f"comment:test-user-{uuid.uuid4()}"

    for i in range(3):
        assert await limiter.check(key, 3, 3600) is True

    assert await limiter.check(key, 3, 3600) is False


# ---------------------------------------------------------------------------
# Block Service Tests (mocked DB)
# ---------------------------------------------------------------------------

def _make_mock_db():
    db = AsyncMock()
    db.execute = AsyncMock()
    db.add = MagicMock()
    db.delete = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_block_self_rejected():
    db = _make_mock_db()
    service = BlockService(db)
    result = await service.block_user("user-1", "user-1")
    assert result["error"] == "Cannot block yourself"
    assert result["status"] == 400


@pytest.mark.asyncio
async def test_block_user_not_found():
    db = _make_mock_db()
    # Mock: user not found
    mock_result = MagicMock()
    mock_result.scalar.return_value = None
    db.execute.return_value = mock_result

    service = BlockService(db)
    result = await service.block_user("user-1", "user-2")
    assert result["error"] == "User not found"


@pytest.mark.asyncio
async def test_unblock_user_not_blocked():
    db = _make_mock_db()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = None
    mock_result = MagicMock()
    mock_result.scalars.return_value = mock_scalars
    db.execute.return_value = mock_result

    service = BlockService(db)
    result = await service.unblock_user("user-1", "user-2")
    assert result["error"] == "Not blocked"
