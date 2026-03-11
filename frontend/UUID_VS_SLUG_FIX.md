# UUID vs Slug Issue - Fixed! ✅

## Problem

When admins clicked "View Registrations" for an event, the backend returned:
```
404: Event not found
GET /api/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1 HTTP/1.1
```

## Root Cause

**Two different API patterns were being mixed:**

| Endpoint Type | Pattern | Identifier | Usage |
|---------------|---------|------------|-------|
| **Public** | `/api/events/{slug}` | Slug (e.g., "test") | Public event access |
| **Admin** | `/api/admin/events/{id}` | UUID | Admin operations |

The admin pages were incorrectly using `/api/events/{id}` (public endpoint) with a UUID instead of `/api/admin/events/{id}` (admin endpoint).

## What Was Fixed

### 1. Admin Event Registrations Page
**File:** `/app/admin/events/[id]/registrations/page.tsx`

**Before (Line 93):**
```typescript
const response = await fetch(`/api/events/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

**After:**
```typescript
const response = await fetch(`/api/admin/events/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 2. Admin Import Attendees Page
**File:** `/app/admin/events/[id]/import-attendees/page.tsx`

**Before (Line 54):**
```typescript
const response = await fetch(`/api/events/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

**After:**
```typescript
const response = await fetch(`/api/admin/events/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

## Why This Matters

### Public Endpoint (`/api/events/{slug}`)
- ✅ Uses human-readable slug: `test`, `climate-summit-2026`
- ✅ SEO-friendly URLs
- ✅ Only shows **published** events
- ✅ No authentication required
- ❌ Will return 404 if given a UUID

### Admin Endpoint (`/api/admin/events/{id}`)
- ✅ Uses UUID: `3af1fb47-c15f-4bd6-b34e-3d123e568ec1`
- ✅ Shows **all** events (published & draft)
- ✅ Requires admin authentication
- ✅ Supports all CRUD operations
- ✅ Works with event IDs directly from database

## How To Use Correctly

### ✅ Correct Usage

```javascript
// Public access - use slug
const event = await fetch('/api/events/test');

// Admin access - use UUID
const event = await fetch('/api/admin/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1', {
  headers: { Authorization: `Bearer ${adminToken}` }
});

// Admin registrations - use UUID
const registrations = await fetch('/api/admin/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1/registrations', {
  headers: { Authorization: `Bearer ${adminToken}` }
});
```

### ❌ Incorrect Usage

```javascript
// DON'T use UUID with public endpoint
const event = await fetch('/api/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1');
// Returns 404

// DON'T use slug with admin endpoint
const event = await fetch('/api/admin/events/test');
// May work but inconsistent
```

## Current Status

✅ **All Fixed!** Admin pages now correctly use:
- `/api/admin/events/${id}` for fetching event details
- `/api/admin/events/${id}/registrations` for fetching registrations
- Proper authentication headers included

## Testing

To verify the fix works:

1. **Navigate to:** `/admin/events`
2. **Click:** Green Users icon (👥) for any event
3. **Expected:** Registrations page loads successfully
4. **Backend:** Should show `200 OK` for both:
   - `GET /api/admin/events/{id}`
   - `GET /api/admin/events/{id}/registrations`

## Related Files

- ✅ `/app/admin/events/[id]/registrations/page.tsx` - Fixed
- ✅ `/app/admin/events/[id]/import-attendees/page.tsx` - Fixed
- ✅ `/app/api/admin/events/[id]/route.ts` - Already correct
- ✅ `/app/api/admin/events/[id]/registrations/route.ts` - Already correct

## Key Takeaway

**Rule of thumb:**
- **Admin operations (CRUD, management)** → Use `/api/admin/events/{UUID}`
- **Public viewing (users browsing events)** → Use `/api/events/{slug}`

