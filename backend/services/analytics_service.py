import logging
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models.db_models import (
    Entity, LabView, LabLike, LabComment, LabShare,
    Follow, PartnerEntity
)

logger = logging.getLogger(__name__)


async def get_lab_analytics(db: AsyncSession, entity_id, days: int = 30):
    """Get daily views/likes/comments/shares for a lab."""
    since = datetime.utcnow() - timedelta(days=days)

    # Daily views from LabView
    views_q = await db.execute(
        select(
            LabView.view_date.label("date"),
            func.count().label("count")
        ).where(LabView.entity_id == entity_id, LabView.view_date >= since.date())
        .group_by(LabView.view_date)
        .order_by(LabView.view_date)
    )
    daily_views = [{"date": str(r.date), "count": r.count} for r in views_q.all()]

    # Daily likes
    likes_q = await db.execute(
        select(
            func.date(LabLike.created_at).label("date"),
            func.count().label("count")
        ).where(LabLike.entity_id == entity_id, LabLike.created_at >= since)
        .group_by(func.date(LabLike.created_at))
        .order_by(func.date(LabLike.created_at))
    )
    daily_likes = [{"date": str(r.date), "count": r.count} for r in likes_q.all()]

    # Daily comments
    comments_q = await db.execute(
        select(
            func.date(LabComment.created_at).label("date"),
            func.count().label("count")
        ).where(LabComment.entity_id == entity_id, LabComment.created_at >= since, LabComment.deleted_at.is_(None))
        .group_by(func.date(LabComment.created_at))
        .order_by(func.date(LabComment.created_at))
    )
    daily_comments = [{"date": str(r.date), "count": r.count} for r in comments_q.all()]

    # Daily shares
    shares_q = await db.execute(
        select(
            func.date(LabShare.created_at).label("date"),
            func.count().label("count")
        ).where(LabShare.entity_id == entity_id, LabShare.created_at >= since)
        .group_by(func.date(LabShare.created_at))
        .order_by(func.date(LabShare.created_at))
    )
    daily_shares = [{"date": str(r.date), "count": r.count} for r in shares_q.all()]

    return {
        "daily_views": daily_views,
        "daily_likes": daily_likes,
        "daily_comments": daily_comments,
        "daily_shares": daily_shares,
    }


async def get_lab_summary(db: AsyncSession, entity_id):
    """Get total engagement counts from entity columns."""
    result = await db.execute(select(Entity).where(Entity.id == entity_id))
    entity = result.scalars().first()
    if not entity:
        return None
    return {
        "view_count": entity.view_count or 0,
        "like_count": entity.like_count or 0,
        "comment_count": entity.comment_count or 0,
        "share_count": entity.share_count or 0,
    }


async def get_partner_analytics(db: AsyncSession, partner_id, days: int = 30):
    """Get partner-level analytics: total views, top labs, follower growth."""
    since = datetime.utcnow() - timedelta(days=days)

    # Get all entity IDs for this partner
    pe_result = await db.execute(
        select(PartnerEntity.entity_id).where(PartnerEntity.partner_id == partner_id)
    )
    entity_ids = [r[0] for r in pe_result.all()]

    if not entity_ids:
        return {
            "total_views": 0,
            "total_likes": 0,
            "total_comments": 0,
            "total_shares": 0,
            "top_labs": [],
            "daily_followers": [],
        }

    # Total engagement across partner labs
    totals_q = await db.execute(
        select(
            func.coalesce(func.sum(Entity.view_count), 0).label("views"),
            func.coalesce(func.sum(Entity.like_count), 0).label("likes"),
            func.coalesce(func.sum(Entity.comment_count), 0).label("comments"),
            func.coalesce(func.sum(Entity.share_count), 0).label("shares"),
        ).where(Entity.id.in_(entity_ids))
    )
    totals = totals_q.one()

    # Top 10 labs by total engagement
    top_labs_q = await db.execute(
        select(
            Entity.id,
            Entity.university,
            Entity.view_count,
            Entity.like_count,
            Entity.comment_count,
            Entity.share_count,
            (
                func.coalesce(Entity.view_count, 0) +
                func.coalesce(Entity.like_count, 0) +
                func.coalesce(Entity.comment_count, 0) +
                func.coalesce(Entity.share_count, 0)
            ).label("total_engagement")
        ).where(Entity.id.in_(entity_ids))
        .order_by(
            (
                func.coalesce(Entity.view_count, 0) +
                func.coalesce(Entity.like_count, 0) +
                func.coalesce(Entity.comment_count, 0) +
                func.coalesce(Entity.share_count, 0)
            ).desc()
        ).limit(10)
    )
    top_labs = [
        {
            "id": str(r.id),
            "name": r.university or "Unnamed Lab",
            "views": r.view_count or 0,
            "likes": r.like_count or 0,
            "comments": r.comment_count or 0,
            "shares": r.share_count or 0,
            "total_engagement": r.total_engagement or 0,
        }
        for r in top_labs_q.all()
    ]

    # Daily follower growth
    followers_q = await db.execute(
        select(
            func.date(Follow.created_at).label("date"),
            func.count().label("count")
        ).where(
            Follow.target_type == "partner",
            Follow.target_id == partner_id,
            Follow.created_at >= since,
        )
        .group_by(func.date(Follow.created_at))
        .order_by(func.date(Follow.created_at))
    )
    daily_followers = [{"date": str(r.date), "count": r.count} for r in followers_q.all()]

    return {
        "total_views": int(totals.views),
        "total_likes": int(totals.likes),
        "total_comments": int(totals.comments),
        "total_shares": int(totals.shares),
        "top_labs": top_labs,
        "daily_followers": daily_followers,
    }


async def get_platform_engagement(db: AsyncSession, days: int = 30):
    """Get platform-wide engagement metrics for admin dashboard."""
    since = datetime.utcnow() - timedelta(days=days)

    # Daily views
    views_q = await db.execute(
        select(
            LabView.view_date.label("date"),
            func.count().label("count")
        ).where(LabView.view_date >= since.date())
        .group_by(LabView.view_date)
        .order_by(LabView.view_date)
    )
    daily_views = [{"date": str(r.date), "count": r.count} for r in views_q.all()]

    # Daily likes
    likes_q = await db.execute(
        select(
            func.date(LabLike.created_at).label("date"),
            func.count().label("count")
        ).where(LabLike.created_at >= since)
        .group_by(func.date(LabLike.created_at))
        .order_by(func.date(LabLike.created_at))
    )
    daily_likes = [{"date": str(r.date), "count": r.count} for r in likes_q.all()]

    # Daily comments
    comments_q = await db.execute(
        select(
            func.date(LabComment.created_at).label("date"),
            func.count().label("count")
        ).where(LabComment.created_at >= since, LabComment.deleted_at.is_(None))
        .group_by(func.date(LabComment.created_at))
        .order_by(func.date(LabComment.created_at))
    )
    daily_comments = [{"date": str(r.date), "count": r.count} for r in comments_q.all()]

    # Daily shares
    shares_q = await db.execute(
        select(
            func.date(LabShare.created_at).label("date"),
            func.count().label("count")
        ).where(LabShare.created_at >= since)
        .group_by(func.date(LabShare.created_at))
        .order_by(func.date(LabShare.created_at))
    )
    daily_shares = [{"date": str(r.date), "count": r.count} for r in shares_q.all()]

    # Totals
    total_views = await db.execute(select(func.coalesce(func.sum(Entity.view_count), 0)))
    total_likes = await db.execute(select(func.coalesce(func.sum(Entity.like_count), 0)))
    total_comments = await db.execute(select(func.coalesce(func.sum(Entity.comment_count), 0)))
    total_shares = await db.execute(select(func.coalesce(func.sum(Entity.share_count), 0)))

    # Top 10 most-engaged labs
    top_labs_q = await db.execute(
        select(
            Entity.id,
            Entity.university,
            Entity.view_count,
            Entity.like_count,
            Entity.comment_count,
            Entity.share_count,
            (
                func.coalesce(Entity.view_count, 0) +
                func.coalesce(Entity.like_count, 0) +
                func.coalesce(Entity.comment_count, 0) +
                func.coalesce(Entity.share_count, 0)
            ).label("total_engagement")
        ).order_by(
            (
                func.coalesce(Entity.view_count, 0) +
                func.coalesce(Entity.like_count, 0) +
                func.coalesce(Entity.comment_count, 0) +
                func.coalesce(Entity.share_count, 0)
            ).desc()
        ).limit(10)
    )
    top_labs = [
        {
            "id": str(r.id),
            "name": r.university or "Unnamed Lab",
            "views": r.view_count or 0,
            "likes": r.like_count or 0,
            "comments": r.comment_count or 0,
            "shares": r.share_count or 0,
            "total_engagement": r.total_engagement or 0,
        }
        for r in top_labs_q.all()
    ]

    return {
        "daily_views": daily_views,
        "daily_likes": daily_likes,
        "daily_comments": daily_comments,
        "daily_shares": daily_shares,
        "totals": {
            "views": int(total_views.scalar()),
            "likes": int(total_likes.scalar()),
            "comments": int(total_comments.scalar()),
            "shares": int(total_shares.scalar()),
        },
        "top_labs": top_labs,
    }
