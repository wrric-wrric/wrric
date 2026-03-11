import logging
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import verify_admin
from schemas.events import EventCategoryCreate, EventCategoryResponse
from services.category_service import CategoryService
from utils.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-categories"])


@router.post("", response_model=EventCategoryResponse)
async def create_category(
    category_data: EventCategoryCreate,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new event category (admin only).
    """
    try:
        category_service = CategoryService(db)
        category = await category_service.create_category(category_data)
        
        return EventCategoryResponse.from_orm(category)
        
    except Exception as e:
        logger.error(f"Failed to create category: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create category")


@router.get("", response_model=List[EventCategoryResponse])
async def get_categories(
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all event categories (admin only).
    """
    try:
        category_service = CategoryService(db)
        categories = await category_service.get_all_categories()
        
        return [EventCategoryResponse.from_orm(cat) for cat in categories]
        
    except Exception as e:
        logger.error(f"Failed to get categories: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve categories")


@router.get("/with-counts")
async def get_categories_with_counts(
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all categories with event counts (admin only).
    """
    try:
        category_service = CategoryService(db)
        categories = await category_service.get_categories_with_counts()
        
        return categories
        
    except Exception as e:
        logger.error(f"Failed to get categories with counts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve categories")


@router.put("/{category_id}", response_model=EventCategoryResponse)
async def update_category(
    category_id: uuid.UUID,
    category_data: EventCategoryCreate,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an event category (admin only).
    """
    try:
        category_service = CategoryService(db)
        category = await category_service.update_category(category_id, category_data)
        
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        return EventCategoryResponse.from_orm(category)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update category {category_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update category")


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    admin_user: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete an event category (admin only).
    """
    try:
        category_service = CategoryService(db)
        
        success = await category_service.delete_category(category_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Category not found")
        
        return None
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete category {category_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete category")