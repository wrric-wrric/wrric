import logging
import psutil
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from models.db_models import (
    User, Entity, Profile, Session, MatchRecord,
    Event, EventRegistration, Message, Notification,
    EntityImage, Publication, Funder, Proposal
)
from utils.database import get_db
from api.dependencies import get_current_user, verify_admin

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-analytics"])


class DashboardOverview(BaseModel):
    users: dict
    entities: dict
    events: dict
    matches: dict
    system: dict
    recent_activity: List[dict]


class SystemHealth(BaseModel):
    cpu_usage: float
    memory_usage: float
    disk_usage: float
    database_status: str
    uptime: str


@router.get("/dashboard/overview", response_model=DashboardOverview)
async def get_dashboard_overview(
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get comprehensive dashboard overview with key metrics.
    """
    try:
        current_time = datetime.utcnow()
        time_7d_ago = current_time - timedelta(days=7)
        time_30d_ago = current_time - timedelta(days=30)
        
        total_users = await db.execute(select(func.count()).select_from(User))
        total_users = total_users.scalar()
        
        new_users_7d = await db.execute(
            select(func.count()).where(User.created_at >= time_7d_ago)
        )
        new_users_7d = new_users_7d.scalar()
        
        new_users_30d = await db.execute(
            select(func.count()).where(User.created_at >= time_30d_ago)
        )
        new_users_30d = new_users_30d.scalar()
        
        total_entities = await db.execute(select(func.count()).select_from(Entity))
        total_entities = total_entities.scalar()
        
        new_entities_7d = await db.execute(
            select(func.count()).where(Entity.created_at >= time_7d_ago)
        )
        new_entities_7d = new_entities_7d.scalar()
        
        total_events = await db.execute(select(func.count()).select_from(Event))
        total_events = total_events.scalar()
        
        published_events = await db.execute(
            select(func.count()).where(Event.is_published == True)
        )
        published_events = published_events.scalar()
        
        total_registrations = await db.execute(
            select(func.count()).select_from(EventRegistration)
        )
        total_registrations = total_registrations.scalar()
        
        total_matches = await db.execute(
            select(func.count()).select_from(MatchRecord)
        )
        total_matches = total_matches.scalar()
        
        avg_score_result = await db.execute(
            select(func.avg(MatchRecord.score))
        )
        avg_score = avg_score_result.scalar() or 0
        
        total_messages = await db.execute(
            select(func.count()).select_from(Message)
        )
        total_messages = total_messages.scalar()
        
        total_notifications = await db.execute(
            select(func.count()).select_from(Notification)
        )
        total_notifications = total_notifications.scalar()
        
        active_sessions = await db.execute(
            select(func.count()).where(Session.is_active == True)
        )
        active_sessions = active_sessions.scalar()
        
        total_profiles = await db.execute(
            select(func.count()).select_from(Profile)
        )
        total_profiles = total_profiles.scalar()
        
        total_images = await db.execute(
            select(func.count()).select_from(EntityImage)
        )
        total_images = total_images.scalar()
        
        total_publications = await db.execute(
            select(func.count()).select_from(Publication)
        )
        total_publications = total_publications.scalar()
        
        recent_users_result = await db.execute(
            select(User).order_by(User.created_at.desc()).limit(5)
        )
        recent_users = recent_users_result.scalars().all()
        
        recent_entities_result = await db.execute(
            select(Entity).order_by(Entity.created_at.desc()).limit(5)
        )
        recent_entities = recent_entities_result.scalars().all()
        
        recent_messages_result = await db.execute(
            select(Message).order_by(Message.created_at.desc()).limit(5)
        )
        recent_messages = recent_messages_result.scalars().all()
        
        recent_activity = []
        
        for user in recent_users:
            recent_activity.append({
                "type": "user_created",
                "message": f"New user registered: {user.username}",
                "timestamp": user.created_at
            })
        
        for entity in recent_entities:
            recent_activity.append({
                "type": "entity_created",
                "message": f"New entity added: {entity.university}",
                "timestamp": entity.created_at
            })
        
        for message in recent_messages:
            recent_activity.append({
                "type": "message_sent",
                "message": f"Message sent",
                "timestamp": message.created_at
            })
        
        recent_activity.sort(key=lambda x: x["timestamp"], reverse=True)
        recent_activity = recent_activity[:10]
        
        # Engagement totals
        total_views = await db.execute(select(func.coalesce(func.sum(Entity.view_count), 0)))
        total_views = total_views.scalar()
        total_likes = await db.execute(select(func.coalesce(func.sum(Entity.like_count), 0)))
        total_likes = total_likes.scalar()
        total_comments_count = await db.execute(select(func.coalesce(func.sum(Entity.comment_count), 0)))
        total_comments_count = total_comments_count.scalar()
        total_shares = await db.execute(select(func.coalesce(func.sum(Entity.share_count), 0)))
        total_shares = total_shares.scalar()

        system_info = await get_system_info()

        return DashboardOverview(
            users={
                "total": total_users,
                "new_7d": new_users_7d,
                "new_30d": new_users_30d,
                "total_profiles": total_profiles
            },
            entities={
                "total": total_entities,
                "new_7d": new_entities_7d,
                "total_images": total_images,
                "total_publications": total_publications
            },
            events={
                "total": total_events,
                "published": published_events,
                "registrations": total_registrations
            },
            matches={
                "total": total_matches,
                "average_score": round(avg_score, 4)
            },
            system={
                "active_sessions": active_sessions,
                "total_messages": total_messages,
                "total_notifications": total_notifications,
                "engagement": {
                    "total_views": int(total_views),
                    "total_likes": int(total_likes),
                    "total_comments": int(total_comments_count),
                    "total_shares": int(total_shares),
                }
            },
            recent_activity=recent_activity
        )
    except Exception as e:
        logger.error(f"Error getting dashboard overview: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get dashboard overview")


@router.get("/system/health", response_model=SystemHealth)
async def get_system_health(
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get system health and resource usage.
    """
    try:
        system_info = await get_system_info()
        
        db_status = "healthy"
        try:
            await db.execute(select(func.count()).select_from(User))
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            db_status = "unhealthy"
        
        return SystemHealth(
            cpu_usage=system_info["cpu"],
            memory_usage=system_info["memory"],
            disk_usage=system_info["disk"],
            database_status=db_status,
            uptime=system_info["uptime"]
        )
    except Exception as e:
        logger.error(f"Error getting system health: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get system health")


async def get_system_info():
    """Get system resource information."""
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "cpu": cpu_percent,
            "memory": memory.percent,
            "disk": disk.percent,
            "uptime": str(datetime.now() - datetime.fromtimestamp(psutil.boot_time()))
        }
    except Exception as e:
        logger.error(f"Error getting system info: {str(e)}")
        return {
            "cpu": 0,
            "memory": 0,
            "disk": 0,
            "uptime": "Unknown"
        }


@router.get("/users")
async def get_user_analytics(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get user registration analytics over time.
    """
    try:
        time_ago = datetime.utcnow() - timedelta(days=days)
        
        daily_registrations = await db.execute(
            select(
                func.date(User.created_at).label("date"),
                func.count().label("count")
            ).where(User.created_at >= time_ago)
            .group_by(func.date(User.created_at))
            .order_by(func.date(User.created_at))
        )
        
        data = [
            {"date": str(row.date), "count": row.count}
            for row in daily_registrations.all()
        ]
        
        return {
            "period_days": days,
            "daily_registrations": data,
            "total_registrations": sum(item["count"] for item in data)
        }
    except Exception as e:
        logger.error(f"Error getting user analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get user analytics")


@router.get("/entities")
async def get_entity_analytics(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get entity creation analytics over time.
    """
    try:
        time_ago = datetime.utcnow() - timedelta(days=days)
        
        daily_creations = await db.execute(
            select(
                func.date(Entity.created_at).label("date"),
                func.count().label("count")
            ).where(Entity.created_at >= time_ago)
            .group_by(func.date(Entity.created_at))
            .order_by(func.date(Entity.created_at))
        )
        
        entity_types = await db.execute(
            select(Entity.entity_type, func.count().label("count"))
            .group_by(Entity.entity_type)
        )
        
        data = [
            {"date": str(row.date), "count": row.count}
            for row in daily_creations.all()
        ]
        
        type_distribution = {
            row.entity_type: row.count
            for row in entity_types.all()
        }
        
        return {
            "period_days": days,
            "daily_creations": data,
            "type_distribution": type_distribution,
            "total_created": sum(item["count"] for item in data)
        }
    except Exception as e:
        logger.error(f"Error getting entity analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get entity analytics")


@router.get("/matches")
async def get_match_analytics(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get match generation analytics over time.
    """
    try:
        time_ago = datetime.utcnow() - timedelta(days=days)
        
        daily_matches = await db.execute(
            select(
                func.date(MatchRecord.created_at).label("date"),
                func.count().label("count"),
                func.avg(MatchRecord.score).label("avg_score")
            ).where(MatchRecord.created_at >= time_ago)
            .group_by(func.date(MatchRecord.created_at))
            .order_by(func.date(MatchRecord.created_at))
        )
        
        status_distribution = await db.execute(
            select(MatchRecord.status, func.count().label("count"))
            .group_by(MatchRecord.status)
        )
        
        data = [
            {
                "date": str(row.date),
                "count": row.count,
                "avg_score": round(row.avg_score, 4) if row.avg_score else 0
            }
            for row in daily_matches.all()
        ]
        
        status_data = {
            row.status: row.count
            for row in status_distribution.all()
        }
        
        return {
            "period_days": days,
            "daily_matches": data,
            "status_distribution": status_data,
            "total_matches": sum(item["count"] for item in data)
        }
    except Exception as e:
        logger.error(f"Error getting match analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get match analytics")


@router.post("/matchmaking/trigger")
async def trigger_matchmaking(
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Manually trigger the matchmaking algorithm.
    Returns statistics about the matchmaking run.
    """
    try:
        from algorithms.matchmaking_optimized import get_matchmaker
        
        matchmaker = get_matchmaker()
        stats = await matchmaker.run_matchmaking(db)
        
        logger.info(f"Admin {admin_user} triggered matchmaking: {stats}")
        
        return {
            "status": "completed",
            "triggered_by": admin_user,
            "timestamp": datetime.utcnow().isoformat(),
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Error triggering matchmaking: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to trigger matchmaking")

@router.get("/engagement")
async def get_engagement_analytics(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get platform-wide engagement metrics: views, likes, comments, shares over time.
    """
    try:
        from services.analytics_service import get_platform_engagement
        data = await get_platform_engagement(db, days)
        return {
            "period_days": days,
            **data,
        }
    except Exception as e:
        logger.error(f"Error getting engagement analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get engagement analytics")


@router.get("/events")
async def get_event_analytics(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    admin_user: str = Depends(verify_admin)
):
    """
    Get event analytics over time.
    """
    try:
        time_ago = datetime.utcnow() - timedelta(days=days)
        
        daily_registrations = await db.execute(
            select(
                func.date(EventRegistration.registration_date).label("date"),
                func.count().label("count")
            ).where(EventRegistration.registration_date >= time_ago)
            .group_by(func.date(EventRegistration.registration_date))
            .order_by(func.date(EventRegistration.registration_date))
        )
        
        registration_types = await db.execute(
            select(EventRegistration.participation_type, func.count().label("count"))
            .group_by(EventRegistration.participation_type)
        )
        
        data = [
            {"date": str(row.date), "count": row.count}
            for row in daily_registrations.all()
        ]
        
        type_data = {
            row.participation_type: row.count
            for row in registration_types.all()
        }
        
        return {
            "period_days": days,
            "daily_registrations": data,
            "participation_types": type_data,
            "total_registrations": sum(item["count"] for item in data)
        }
    except Exception as e:
        logger.error(f"Error getting event analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get event analytics")
