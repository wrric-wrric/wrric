import logging
import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from models.db_models import EventCategory
from schemas.events import EventCategoryCreate
from utils.database import check_and_reconnect

logger = logging.getLogger(__name__)


class CategoryService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_category(self, category_data: EventCategoryCreate) -> EventCategory:
        """Create a new event category."""
        await check_and_reconnect(self.db)
        
        try:
            # Generate slug from name
            slug = await self._generate_slug(category_data.name)
            
            category = EventCategory(
                **category_data.dict(),
                slug=slug
            )
            
            self.db.add(category)
            await self.db.commit()
            await self.db.refresh(category)
            
            logger.info(f"Category created: {category.id}")
            return category
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create category: {str(e)}")
            raise
    
    async def update_category(self, category_id: uuid.UUID, category_data: EventCategoryCreate) -> Optional[EventCategory]:
        """Update an existing category."""
        await check_and_reconnect(self.db)
        
        try:
            category = await self.get_category(category_id)
            if not category:
                return None
            
            # Update fields
            for field, value in category_data.dict().items():
                if field == "name" and value != category.name:
                    # Update slug if name changed
                    setattr(category, "slug", await self._generate_slug(value))
                setattr(category, field, value)
            
            await self.db.commit()
            await self.db.refresh(category)
            
            logger.info(f"Category updated: {category.id}")
            return category
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to update category {category_id}: {str(e)}")
            raise
    
    async def delete_category(self, category_id: uuid.UUID) -> bool:
        """Delete a category (only if no events are using it)."""
        await check_and_reconnect(self.db)
        
        try:
            # Check if category is in use
            from models.events import EventCategoryMapping
            query = select(func.count()).select_from(EventCategoryMapping).where(
                EventCategoryMapping.category_id == category_id
            )
            result = await self.db.execute(query)
            count = result.scalar()
            
            if count > 0:
                raise ValueError("Cannot delete category that is in use by events")
            
            # Delete category
            category = await self.get_category(category_id)
            if not category:
                return False
            
            await self.db.delete(category)
            await self.db.commit()
            
            logger.info(f"Category deleted: {category_id}")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to delete category {category_id}: {str(e)}")
            raise
    
    async def get_category(self, category_id: uuid.UUID) -> Optional[EventCategory]:
        """Get a single category."""
        await check_and_reconnect(self.db)
        
        try:
            query = select(EventCategory).where(EventCategory.id == category_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
            
        except Exception as e:
            logger.error(f"Failed to get category {category_id}: {str(e)}")
            raise
    
    async def get_all_categories(self) -> List[EventCategory]:
        """Get all categories."""
        await check_and_reconnect(self.db)
        
        try:
            query = select(EventCategory).order_by(EventCategory.name)
            result = await self.db.execute(query)
            return result.scalars().all()
            
        except Exception as e:
            logger.error(f"Failed to get all categories: {str(e)}")
            raise
    
    async def get_categories_with_counts(self) -> List[dict]:
        """Get all categories with event counts."""
        await check_and_reconnect(self.db)
        
        try:
            from models.events import EventCategoryMapping, Event
            from sqlalchemy import func
            
            query = (
                select(
                    EventCategory,
                    func.count(EventCategoryMapping.event_id).label("event_count")
                )
                .outerjoin(EventCategoryMapping, EventCategory.id == EventCategoryMapping.category_id)
                .outerjoin(Event, and_(
                    Event.id == EventCategoryMapping.event_id,
                    Event.is_published == True
                ))
                .group_by(EventCategory.id)
                .order_by(EventCategory.name)
            )
            
            result = await self.db.execute(query)
            rows = result.all()
            
            return [
                {
                    "id": category.id,
                    "name": category.name,
                    "slug": category.slug,
                    "color_code": category.color_code,
                    "description": category.description,
                    "event_count": event_count or 0,
                    "created_at": category.created_at,
                    "updated_at": category.updated_at
                }
                for category, event_count in rows
            ]
            
        except Exception as e:
            logger.error(f"Failed to get categories with counts: {str(e)}")
            raise
    
    async def _generate_slug(self, name: str) -> str:
        """Generate a URL-friendly slug from category name."""
        import re
        import unicodedata
        
        # Normalize and lowercase
        slug = unicodedata.normalize('NFKD', name)
        slug = slug.encode('ascii', 'ignore').decode('ascii')
        slug = slug.lower()
        
        # Replace non-alphanumeric with hyphens
        slug = re.sub(r'[^a-z0-9]+', '-', slug)
        slug = slug.strip('-')
        
        # Ensure uniqueness
        base_slug = slug
        counter = 1
        
        while True:
            query = select(EventCategory).where(EventCategory.slug == slug)
            result = await self.db.execute(query)
            existing = result.scalar_one_or_none()
            
            if not existing:
                return slug
            
            slug = f"{base_slug}-{counter}"
            counter += 1