# PaginatedResponse Field Name Fix

## Issue

After updating `PaginatedResponse` schema to use generic TypeVar and standardize field names, existing code was still using the old field name `size` instead of the new `page_size`, causing validation errors.

## Error

```
ValidationError: 1 validation error for PaginatedResponse
page_size
  Field required [type=missing, input_value={'items': [...], 'size': 12, 'pages': 1}, input_type=dict]
```

## Root Cause

The schema was updated to use `page_size` for consistency:

```python
class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int  # Changed from 'size'
    pages: int
```

But three locations were still using the old field name when instantiating `PaginatedResponse`.

## Fix

Updated all `PaginatedResponse` instantiations to use `page_size` instead of `size`:

### Files Modified

1. **api/events.py** (line 77)
   ```python
   # Before
   return PaginatedResponse(
       items=processed_events,
       total=total,
       page=page,
       size=limit,  # OLD
       pages=pages
   )
   
   # After
   return PaginatedResponse(
       items=processed_events,
       total=total,
       page=page,
       page_size=limit,  # NEW
       pages=pages
   )
   ```

2. **api/admin/events.py** (line 493)
   ```python
   # Fixed in get_events endpoint
   page_size=limit,  # Changed from size=limit
   ```

3. **api/admin/events.py** (line 781)
   ```python
   # Fixed in get_event_registrations endpoint
   page_size=limit,  # Changed from size=limit
   ```

## Verification

✅ All `PaginatedResponse` instantiations now use `page_size`  
✅ Schema validation passes  
✅ API endpoints return correct response format  

## Response Format

Clients now receive:

```json
{
  "items": [...],
  "total": 45,
  "page": 1,
  "page_size": 12,
  "pages": 4
}
```

## Impact

- **Breaking Change**: Frontend clients expecting `size` field must update to use `page_size`
- **Benefits**: Consistent naming across all paginated endpoints
- **Affected Endpoints**:
  - `GET /api/events/upcoming`
  - `GET /api/admin/events`
  - `GET /api/admin/events/{id}/registrations`
  - `GET /api/events/{id}/participants`

## Migration Guide for Frontend

Update any code that reads pagination data:

```javascript
// Before
const { items, total, page, size, pages } = response.data;

// After
const { items, total, page, page_size, pages } = response.data;
```

## Status

✅ **FIXED** - All endpoints now use consistent `page_size` field name
