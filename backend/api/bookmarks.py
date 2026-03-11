"""
Bookmark & Collection API endpoints (Feature 2.6).
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from utils.database import get_db
from api.dependencies import get_current_user
from services.bookmark_service import BookmarkService

router = APIRouter()


class BookmarkRequest(BaseModel):
    entity_id: str


class CollectionCreate(BaseModel):
    name: str


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    is_public: Optional[bool] = None


class CollectionItemRequest(BaseModel):
    bookmark_id: str


# --- Bookmarks ---


@router.post("", status_code=201)
async def add_bookmark(
    body: BookmarkRequest,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bookmark a lab."""
    service = BookmarkService(db)
    result = await service.add_bookmark(current_user, body.entity_id)
    if "error" in result:
        return JSONResponse(status_code=result["status"], content={"detail": result["error"]})
    return result


@router.delete("/{entity_id}")
async def remove_bookmark(
    entity_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a bookmark."""
    service = BookmarkService(db)
    result = await service.remove_bookmark(current_user, entity_id)
    if "error" in result:
        return JSONResponse(status_code=result["status"], content={"detail": result["error"]})
    return result


@router.get("/status/{entity_id}")
async def bookmark_status(
    entity_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if lab is bookmarked."""
    service = BookmarkService(db)
    return await service.get_bookmark_status(current_user, entity_id)


@router.get("/me")
async def list_my_bookmarks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's bookmarked labs."""
    service = BookmarkService(db)
    items, total = await service.list_bookmarks(current_user, page=page, limit=limit)
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post("/batch-check")
async def batch_check_bookmarks(
    body: dict,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check bookmark status for multiple entities."""
    entity_ids = body.get("entity_ids", [])
    service = BookmarkService(db)
    return await service.check_bookmarks_batch(current_user, entity_ids)


# --- Collections ---


@router.post("/collections", status_code=201)
async def create_collection(
    body: CollectionCreate,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a named collection."""
    service = BookmarkService(db)
    result = await service.create_collection(current_user, body.name)
    if "error" in result:
        return JSONResponse(status_code=result["status"], content={"detail": result["error"]})
    return result


@router.get("/collections")
async def list_collections(
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's collections."""
    service = BookmarkService(db)
    return await service.list_collections(current_user)


@router.patch("/collections/{collection_id}")
async def update_collection(
    collection_id: str,
    body: CollectionUpdate,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update collection name or visibility."""
    service = BookmarkService(db)
    result = await service.update_collection(collection_id, current_user, name=body.name, is_public=body.is_public)
    if "error" in result:
        return JSONResponse(status_code=result["status"], content={"detail": result["error"]})
    return result


@router.delete("/collections/{collection_id}")
async def delete_collection(
    collection_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a collection."""
    service = BookmarkService(db)
    result = await service.delete_collection(collection_id, current_user)
    if "error" in result:
        return JSONResponse(status_code=result["status"], content={"detail": result["error"]})
    return result


@router.post("/collections/{collection_id}/items")
async def add_to_collection(
    collection_id: str,
    body: CollectionItemRequest,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a bookmark to a collection."""
    service = BookmarkService(db)
    result = await service.add_to_collection(collection_id, body.bookmark_id, current_user)
    if "error" in result:
        return JSONResponse(status_code=result["status"], content={"detail": result["error"]})
    return result


@router.delete("/collections/{collection_id}/items/{bookmark_id}")
async def remove_from_collection(
    collection_id: str,
    bookmark_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a bookmark from a collection."""
    service = BookmarkService(db)
    result = await service.remove_from_collection(collection_id, bookmark_id, current_user)
    if "error" in result:
        return JSONResponse(status_code=result["status"], content={"detail": result["error"]})
    return result


@router.get("/collections/{collection_id}/items")
async def get_collection_items(
    collection_id: str,
    current_user: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get items in a collection."""
    service = BookmarkService(db)
    items = await service.get_collection_items(collection_id, current_user)
    if items is None:
        return JSONResponse(status_code=404, content={"detail": "Collection not found or not accessible"})
    return {"items": items}


@router.get("/collections/{collection_id}/public")
async def get_public_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get items in a public collection (no auth required)."""
    service = BookmarkService(db)
    items = await service.get_collection_items(collection_id, "", is_public_access=True)
    if items is None:
        return JSONResponse(status_code=404, content={"detail": "Collection not found or not public"})
    return {"items": items}
