import uuid
from typing import Optional, List, Tuple

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.db_models import Bookmark, BookmarkCollection, BookmarkCollectionItem, Entity


class BookmarkService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # --- Bookmarks ---

    async def add_bookmark(self, user_id: str, entity_id: str) -> dict:
        """Bookmark a lab. Creates default collection if needed."""
        # Verify entity exists
        ent = await self.db.execute(select(Entity.id).where(Entity.id == entity_id))
        if not ent.scalar():
            return {"error": "Lab not found", "status": 404}

        # Check duplicate
        existing = await self.db.execute(
            select(Bookmark.id).where(
                and_(Bookmark.user_id == user_id, Bookmark.entity_id == entity_id)
            )
        )
        if existing.scalar():
            return {"error": "Already bookmarked", "status": 409}

        bookmark = Bookmark(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            entity_id=uuid.UUID(entity_id),
        )
        self.db.add(bookmark)

        # Ensure default collection exists, add bookmark to it
        default_col = await self._ensure_default_collection(user_id)
        item = BookmarkCollectionItem(
            id=uuid.uuid4(),
            collection_id=default_col.id,
            bookmark_id=bookmark.id,
        )
        self.db.add(item)

        await self.db.commit()
        return {
            "id": str(bookmark.id),
            "entity_id": entity_id,
            "bookmarked": True,
        }

    async def remove_bookmark(self, user_id: str, entity_id: str) -> dict:
        """Remove a bookmark (and all collection items referencing it)."""
        result = await self.db.execute(
            select(Bookmark).where(
                and_(Bookmark.user_id == user_id, Bookmark.entity_id == entity_id)
            )
        )
        bookmark = result.scalars().first()
        if not bookmark:
            return {"error": "Bookmark not found", "status": 404}

        await self.db.delete(bookmark)  # cascade deletes collection items
        await self.db.commit()
        return {"bookmarked": False, "entity_id": entity_id}

    async def get_bookmark_status(self, user_id: str, entity_id: str) -> dict:
        """Check if user has bookmarked a lab."""
        result = await self.db.execute(
            select(Bookmark.id).where(
                and_(Bookmark.user_id == user_id, Bookmark.entity_id == entity_id)
            )
        )
        return {"bookmarked": result.scalar() is not None}

    async def list_bookmarks(
        self, user_id: str, page: int = 1, limit: int = 20
    ) -> Tuple[List[dict], int]:
        """List user's bookmarked labs, paginated."""
        base = (
            select(Bookmark)
            .where(Bookmark.user_id == user_id)
        )

        count_q = select(func.count()).select_from(base.subquery())
        total = (await self.db.execute(count_q)).scalar() or 0

        query = (
            base
            .options(selectinload(Bookmark.entity))
            .order_by(Bookmark.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        result = await self.db.execute(query)
        bookmarks = list(result.scalars().unique().all())

        items = []
        for b in bookmarks:
            items.append({
                "id": str(b.id),
                "entity_id": str(b.entity_id),
                "lab_name": b.entity.university if b.entity else "Unknown",
                "created_at": b.created_at.isoformat() if b.created_at else "",
            })

        return items, total

    async def check_bookmarks_batch(self, user_id: str, entity_ids: List[str]) -> dict:
        """Check bookmark status for multiple entities."""
        if not entity_ids:
            return {}
        result = await self.db.execute(
            select(Bookmark.entity_id).where(
                and_(
                    Bookmark.user_id == user_id,
                    Bookmark.entity_id.in_(entity_ids),
                )
            )
        )
        bookmarked_ids = {str(row[0]) for row in result.all()}
        return {eid: eid in bookmarked_ids for eid in entity_ids}

    # --- Collections ---

    async def create_collection(self, user_id: str, name: str) -> dict:
        """Create a named collection."""
        if not name or not name.strip():
            return {"error": "Collection name is required", "status": 400}

        collection = BookmarkCollection(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            name=name.strip(),
            is_default=False,
        )
        self.db.add(collection)
        await self.db.commit()
        await self.db.refresh(collection)
        return {
            "id": str(collection.id),
            "name": collection.name,
            "is_default": False,
            "is_public": False,
        }

    async def list_collections(self, user_id: str) -> List[dict]:
        """List user's collections with item counts."""
        # Ensure default exists
        await self._ensure_default_collection(user_id)

        result = await self.db.execute(
            select(BookmarkCollection)
            .where(BookmarkCollection.user_id == user_id)
            .order_by(BookmarkCollection.is_default.desc(), BookmarkCollection.created_at.asc())
        )
        collections = result.scalars().all()

        items = []
        for c in collections:
            count_q = select(func.count()).select_from(BookmarkCollectionItem).where(
                BookmarkCollectionItem.collection_id == c.id
            )
            count = (await self.db.execute(count_q)).scalar() or 0
            items.append({
                "id": str(c.id),
                "name": c.name,
                "is_default": c.is_default,
                "is_public": c.is_public,
                "item_count": count,
                "created_at": c.created_at.isoformat() if c.created_at else "",
            })

        return items

    async def update_collection(self, collection_id: str, user_id: str, name: Optional[str] = None, is_public: Optional[bool] = None) -> dict:
        """Update collection name or visibility."""
        result = await self.db.execute(
            select(BookmarkCollection).where(
                and_(BookmarkCollection.id == collection_id, BookmarkCollection.user_id == user_id)
            )
        )
        col = result.scalars().first()
        if not col:
            return {"error": "Collection not found", "status": 404}

        if name is not None:
            if col.is_default:
                return {"error": "Cannot rename default collection", "status": 400}
            col.name = name.strip()
        if is_public is not None:
            col.is_public = is_public

        await self.db.commit()
        await self.db.refresh(col)
        return {
            "id": str(col.id),
            "name": col.name,
            "is_public": col.is_public,
        }

    async def delete_collection(self, collection_id: str, user_id: str) -> dict:
        """Delete a collection (not default). Bookmarks remain."""
        result = await self.db.execute(
            select(BookmarkCollection).where(
                and_(BookmarkCollection.id == collection_id, BookmarkCollection.user_id == user_id)
            )
        )
        col = result.scalars().first()
        if not col:
            return {"error": "Collection not found", "status": 404}
        if col.is_default:
            return {"error": "Cannot delete default collection", "status": 400}

        await self.db.delete(col)  # cascade deletes items
        await self.db.commit()
        return {"deleted": True}

    async def add_to_collection(self, collection_id: str, bookmark_id: str, user_id: str) -> dict:
        """Add a bookmark to a collection."""
        # Verify collection belongs to user
        col = await self.db.execute(
            select(BookmarkCollection.id).where(
                and_(BookmarkCollection.id == collection_id, BookmarkCollection.user_id == user_id)
            )
        )
        if not col.scalar():
            return {"error": "Collection not found", "status": 404}

        # Verify bookmark belongs to user
        bm = await self.db.execute(
            select(Bookmark.id).where(
                and_(Bookmark.id == bookmark_id, Bookmark.user_id == user_id)
            )
        )
        if not bm.scalar():
            return {"error": "Bookmark not found", "status": 404}

        # Check duplicate
        existing = await self.db.execute(
            select(BookmarkCollectionItem.id).where(
                and_(
                    BookmarkCollectionItem.collection_id == collection_id,
                    BookmarkCollectionItem.bookmark_id == bookmark_id,
                )
            )
        )
        if existing.scalar():
            return {"error": "Already in collection", "status": 409}

        item = BookmarkCollectionItem(
            id=uuid.uuid4(),
            collection_id=uuid.UUID(collection_id),
            bookmark_id=uuid.UUID(bookmark_id),
        )
        self.db.add(item)
        await self.db.commit()
        return {"added": True}

    async def remove_from_collection(self, collection_id: str, bookmark_id: str, user_id: str) -> dict:
        """Remove a bookmark from a collection."""
        # Verify collection belongs to user
        col = await self.db.execute(
            select(BookmarkCollection.id).where(
                and_(BookmarkCollection.id == collection_id, BookmarkCollection.user_id == user_id)
            )
        )
        if not col.scalar():
            return {"error": "Collection not found", "status": 404}

        result = await self.db.execute(
            select(BookmarkCollectionItem).where(
                and_(
                    BookmarkCollectionItem.collection_id == collection_id,
                    BookmarkCollectionItem.bookmark_id == bookmark_id,
                )
            )
        )
        item = result.scalars().first()
        if not item:
            return {"error": "Item not in collection", "status": 404}

        await self.db.delete(item)
        await self.db.commit()
        return {"removed": True}

    async def get_collection_items(self, collection_id: str, user_id: str, is_public_access: bool = False) -> Optional[List[dict]]:
        """Get items in a collection."""
        result = await self.db.execute(
            select(BookmarkCollection).where(BookmarkCollection.id == collection_id)
        )
        col = result.scalars().first()
        if not col:
            return None

        # Access check: owner or public
        if str(col.user_id) != user_id and not (is_public_access and col.is_public):
            return None

        items_result = await self.db.execute(
            select(BookmarkCollectionItem)
            .where(BookmarkCollectionItem.collection_id == collection_id)
            .options(selectinload(BookmarkCollectionItem.bookmark).selectinload(Bookmark.entity))
            .order_by(BookmarkCollectionItem.added_at.desc())
        )
        items = items_result.scalars().unique().all()

        return [
            {
                "bookmark_id": str(item.bookmark_id),
                "entity_id": str(item.bookmark.entity_id) if item.bookmark else "",
                "lab_name": item.bookmark.entity.university if item.bookmark and item.bookmark.entity else "Unknown",
                "added_at": item.added_at.isoformat() if item.added_at else "",
            }
            for item in items
        ]

    # --- Helpers ---

    async def _ensure_default_collection(self, user_id: str) -> BookmarkCollection:
        """Get or create the default 'Saved' collection for a user."""
        result = await self.db.execute(
            select(BookmarkCollection).where(
                and_(
                    BookmarkCollection.user_id == user_id,
                    BookmarkCollection.is_default == True,
                )
            )
        )
        col = result.scalars().first()
        if col:
            return col

        col = BookmarkCollection(
            id=uuid.uuid4(),
            user_id=uuid.UUID(user_id),
            name="Saved",
            is_default=True,
        )
        self.db.add(col)
        await self.db.flush()
        return col
