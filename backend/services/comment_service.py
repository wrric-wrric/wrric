import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Tuple

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.db_models import LabComment, CommentReport, Entity, Notification, User
from services.activity_hooks import record_activity
from services.block_service import BlockService
from services.spam_filter import check_spam


EDIT_WINDOW_MINUTES = 15


class CommentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_comment(
        self, entity_id: str, user_id: str, content: str, parent_id: Optional[str] = None
    ) -> Optional[LabComment]:
        """Create a comment or reply on a lab."""
        # Verify entity exists
        ent_result = await self.db.execute(select(Entity).where(Entity.id == entity_id))
        entity = ent_result.scalars().first()
        if not entity:
            return None

        # Check if blocked by lab owner
        if entity.created_by_user_id and str(entity.created_by_user_id) != user_id:
            block_svc = BlockService(self.db)
            if await block_svc.is_blocked(user_id, str(entity.created_by_user_id)):
                return "blocked"

        # Spam detection
        if check_spam(content):
            return "spam_detected"

        # If reply, verify parent exists and belongs to same entity
        if parent_id:
            parent_result = await self.db.execute(
                select(LabComment).where(
                    and_(
                        LabComment.id == parent_id,
                        LabComment.entity_id == entity_id,
                        LabComment.deleted_at.is_(None),
                    )
                )
            )
            parent = parent_result.scalars().first()
            if not parent:
                return "parent_not_found"

        comment = LabComment(
            id=uuid.uuid4(),
            entity_id=uuid.UUID(entity_id),
            user_id=uuid.UUID(user_id),
            parent_id=uuid.UUID(parent_id) if parent_id else None,
            content=content,
        )
        self.db.add(comment)

        # Increment comment_count
        entity.comment_count = (entity.comment_count or 0) + 1

        # Notification for lab owner (if not self-comment)
        if entity.created_by_user_id and str(entity.created_by_user_id) != user_id:
            notif = Notification(
                id=uuid.uuid4(),
                user_id=entity.created_by_user_id,
                type="lab_comment",
                content=f"Someone commented on your lab \"{entity.university or 'Unnamed Lab'}\"",
                related_id=uuid.UUID(entity_id),
                actor_user_id=uuid.UUID(user_id),
                group_key=f"lab_comment:{entity_id}",
            )
            self.db.add(notif)

        # Notification for parent comment author (if reply and not self-reply)
        if parent_id:
            parent_result2 = await self.db.execute(
                select(LabComment.user_id).where(LabComment.id == parent_id)
            )
            parent_author_id = parent_result2.scalar()
            if parent_author_id and str(parent_author_id) != user_id:
                notif = Notification(
                    id=uuid.uuid4(),
                    user_id=parent_author_id,
                    type="comment_reply",
                    content="Someone replied to your comment",
                    related_id=uuid.UUID(entity_id),
                    actor_user_id=uuid.UUID(user_id),
                    group_key=f"comment_reply:{parent_id}",
                )
                self.db.add(notif)

        await record_activity(self.db, user_id, "commented", "lab", entity_id)
        await self.db.commit()

        # Re-fetch with user and replies relationships eagerly loaded for response serialization
        result = await self.db.execute(
            select(LabComment)
            .where(LabComment.id == comment.id)
            .options(selectinload(LabComment.user), selectinload(LabComment.replies).selectinload(LabComment.user))
        )
        comment = result.scalars().first()
        return comment

    async def list_comments(
        self, entity_id: str, cursor: Optional[str] = None, limit: int = 20
    ) -> Tuple[List[LabComment], Optional[str]]:
        """List top-level comments with replies for an entity. Cursor-based pagination."""
        query = (
            select(LabComment)
            .where(
                and_(
                    LabComment.entity_id == entity_id,
                    LabComment.parent_id.is_(None),
                )
            )
            .options(
                selectinload(LabComment.user),
                selectinload(LabComment.replies).selectinload(LabComment.user),
            )
            .order_by(LabComment.created_at.desc())
        )

        if cursor:
            # Cursor is the created_at of last item
            try:
                cursor_dt = datetime.fromisoformat(cursor)
                query = query.where(LabComment.created_at < cursor_dt)
            except ValueError:
                pass

        query = query.limit(limit + 1)  # Fetch one extra to detect next page
        result = await self.db.execute(query)
        comments = list(result.scalars().unique().all())

        next_cursor = None
        if len(comments) > limit:
            comments = comments[:limit]
            last = comments[-1]
            next_cursor = last.created_at.isoformat() if last.created_at else None

        return comments, next_cursor

    async def get_comment_by_id(self, comment_id: str) -> Optional[LabComment]:
        result = await self.db.execute(
            select(LabComment)
            .where(LabComment.id == comment_id)
            .options(selectinload(LabComment.user))
        )
        return result.scalars().first()

    async def edit_comment(self, comment_id: str, user_id: str, new_content: str) -> Optional[dict]:
        """Edit a comment. Only author, within 15 minutes."""
        comment = await self.get_comment_by_id(comment_id)
        if not comment:
            return {"error": "Comment not found", "status": 404}
        if comment.deleted_at:
            return {"error": "Comment has been deleted", "status": 404}
        if str(comment.user_id) != user_id:
            return {"error": "Not authorized", "status": 403}

        # Check edit window
        if comment.created_at:
            elapsed = datetime.utcnow() - comment.created_at
            if elapsed > timedelta(minutes=EDIT_WINDOW_MINUTES):
                return {"error": "Edit window expired (15 minutes)", "status": 403}

        comment.content = new_content
        comment.is_edited = True
        await self.db.commit()
        await self.db.refresh(comment)
        return {"comment": comment}

    async def delete_comment(self, comment_id: str, user_id: str, is_admin: bool = False) -> Optional[dict]:
        """Soft delete a comment. Author, lab owner, or admin."""
        comment = await self.get_comment_by_id(comment_id)
        if not comment:
            return {"error": "Comment not found", "status": 404}
        if comment.deleted_at:
            return {"error": "Already deleted", "status": 404}

        # Check authorization: author, lab owner, or admin
        is_author = str(comment.user_id) == user_id
        is_lab_owner = False
        if not is_author and not is_admin:
            # Check if user is the lab owner
            ent_result = await self.db.execute(
                select(Entity.created_by_user_id).where(Entity.id == comment.entity_id)
            )
            lab_owner_id = ent_result.scalar()
            is_lab_owner = lab_owner_id and str(lab_owner_id) == user_id

        if not is_author and not is_lab_owner and not is_admin:
            return {"error": "Not authorized", "status": 403}

        comment.deleted_at = datetime.utcnow()

        # Decrement comment_count
        ent_result = await self.db.execute(select(Entity).where(Entity.id == comment.entity_id))
        entity = ent_result.scalars().first()
        if entity:
            entity.comment_count = max(0, (entity.comment_count or 0) - 1)

        await self.db.commit()
        return {"success": True}

    async def report_comment(self, comment_id: str, user_id: str, reason: str) -> Optional[dict]:
        """Report a comment."""
        comment = await self.get_comment_by_id(comment_id)
        if not comment or comment.deleted_at:
            return {"error": "Comment not found", "status": 404}

        # Check duplicate
        existing = await self.db.execute(
            select(CommentReport).where(
                and_(
                    CommentReport.comment_id == comment_id,
                    CommentReport.reporter_user_id == user_id,
                )
            )
        )
        if existing.scalars().first():
            return {"error": "Already reported", "status": 409}

        report = CommentReport(
            id=uuid.uuid4(),
            comment_id=uuid.UUID(comment_id),
            reporter_user_id=uuid.UUID(user_id),
            reason=reason,
        )
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)
        return {"report": report}

    async def list_reports(
        self, status_filter: Optional[str] = "pending", page: int = 1, limit: int = 20
    ) -> Tuple[List[CommentReport], int]:
        """List comment reports (admin)."""
        query = (
            select(CommentReport)
            .options(
                selectinload(CommentReport.comment).selectinload(LabComment.user),
                selectinload(CommentReport.reporter),
            )
        )
        if status_filter:
            query = query.where(CommentReport.status == status_filter)

        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar() or 0

        query = query.order_by(CommentReport.created_at.desc()).offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        reports = list(result.scalars().unique().all())
        return reports, total

    async def review_report(self, report_id: str, new_status: str) -> Optional[CommentReport]:
        """Review a report (admin). Set status to reviewed or dismissed."""
        result = await self.db.execute(
            select(CommentReport).where(CommentReport.id == report_id)
        )
        report = result.scalars().first()
        if not report:
            return None
        report.status = new_status
        await self.db.commit()
        await self.db.refresh(report)
        return report

    async def get_comment_count(self, entity_id: str) -> int:
        """Get comment count for an entity."""
        result = await self.db.execute(
            select(Entity.comment_count).where(Entity.id == entity_id)
        )
        return result.scalar() or 0
