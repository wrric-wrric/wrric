===================================================================================
ADMIN EVENT REGISTRATIONS ENDPOINT - QUICK REFERENCE
===================================================================================

✅ YES! There is an endpoint for admins to view ALL event registrations for an event.

## Endpoint
GET /api/admin/events/{event_id}/registrations

## Parameters
- page (default: 1)
- limit (default: 50, max: 100)
- search (optional - searches name, email, organization)

## Example Request
```
GET /api/admin/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1/registrations?page=1&limit=50&search=john
Authorization: Bearer <admin-token>
```

## Response
```json
{
  "items": [
    {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "organization": "Tech Corp",
      "participation_type": "attendee",
      "attendance_type": "on_site",
      "status": "pending",
      "registration_date": "2026-01-24T16:01:41",
      "checked_in_at": null,
      "is_anonymous": false
    }
  ],
  "total": 45,
  "page": 1,
  "page_size": 50,
  "pages": 1
}
```

## Key Features
- Shows ALL registrations (including anonymous)
- Search by name, email, or organization
- Pagination support
- Returns full registration details

## Status Values
- pending - Awaiting approval
- approved - Approved by admin
- rejected - Rejected
- cancelled - Cancelled by user

## Complete Documentation
See: ADMIN_VIEW_EVENT_REGISTRATIONS_GUIDE.md

This file contains:
- Full API documentation
- Complete JavaScript implementation example
- UI component suggestions
- Error handling
- Export to CSV functionality
- Testing checklist

===================================================================================



# Event Access - UUID vs Slug - IMPORTANT!

## The Issue

You're getting 404 when trying to access an event by UUID on the public endpoint.

## Root Cause

**Public and Admin endpoints use DIFFERENT identifiers:**

| Endpoint Type | Path | Identifier | Filter |
|---------------|------|------------|--------|
| **Public** | `/api/events/{slug}` | Slug (e.g., "test") | Only published events |
| **Admin** | `/api/admin/events/{event_id}` | UUID | All events |

## Example Event

For event with:
- **ID:** `3af1fb47-c15f-4bd6-b34e-3d123e568ec1`
- **Slug:** `test`
- **Published:** `true`

### ❌ WRONG (404 Error)
```bash
GET /api/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1
# Returns 404 because it expects slug, not UUID
```

### ✅ CORRECT
```bash
# Public access (uses slug)
GET /api/events/test

# Admin access (uses UUID)
GET /api/admin/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1
```

## Why This Design?

1. **SEO-Friendly URLs** - `/events/climate-summit-2026` is better than `/events/3af1fb47-...`
2. **User-Friendly** - Easier to read and share
3. **Security** - UUIDs not exposed in public URLs
4. **Published Filter** - Public endpoint only shows published events

## How to Get the Slug

### Option 1: From Admin Endpoint
```javascript
const response = await fetch(
  `http://192.168.238.236:8000/api/admin/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);

const event = await response.json();
console.log(event.slug); // "test"
```

### Option 2: From Database
```sql
SELECT id, title, slug, is_published 
FROM events 
WHERE id = '3af1fb47-c15f-4bd6-b34e-3d123e568ec1';
```

### Option 3: From Events List
```javascript
const response = await fetch('http://192.168.238.236:8000/api/events/upcoming');
const { items } = await response.json();

items.forEach(event => {
  console.log(`ID: ${event.id}, Slug: ${event.slug}`);
});
```

## Frontend Implementation Guide

### 1. Event List Page
When showing list of events, store BOTH id and slug:

```javascript
const events = await fetchEvents();

events.forEach(event => {
  // Store both for different purposes
  const eventCard = {
    id: event.id,      // For admin operations
    slug: event.slug,  // For public URLs
    title: event.title
  };
  
  // Use slug for public link
  const publicUrl = `/events/${event.slug}`;
});
```

### 2. Event Detail Page
Use slug in the URL:

```javascript
// URL: /events/test (not /events/3af1fb47-...)

function EventDetailPage({ slug }) {
  const [event, setEvent] = useState(null);
  
  useEffect(() => {
    fetch(`http://192.168.238.236:8000/api/events/${slug}`)
      .then(r => r.json())
      .then(data => setEvent(data));
  }, [slug]);
  
  return <div>{event?.title}</div>;
}
```

### 3. Admin Dashboard
Use UUID for admin operations:

```javascript
function AdminEventManager({ eventId }) {
  // Use UUID for admin endpoints
  const response = await fetch(
    `http://192.168.238.236:8000/api/admin/events/${eventId}`,
    { headers: { 'Authorization': `Bearer ${adminToken}` } }
  );
  
  const event = await response.json();
  
  // Now you have both
  console.log('UUID:', event.id);
  console.log('Slug:', event.slug);
  console.log('Public URL:', `/events/${event.slug}`);
}
```

### 4. Registration Page
Use slug to fetch event, but event object contains id for registration:

```javascript
async function EventRegistrationPage({ slug }) {
  // 1. Fetch event by slug
  const event = await fetch(`/api/events/${slug}`).then(r => r.json());
  
  // 2. Use event.id for registration
  async function handleRegister(formData) {
    await fetch(`/api/admin/events/${event.id}/register`, {
      method: 'POST',
      body: JSON.stringify({
        ...formData,
        event_id: event.id  // Use UUID here
      })
    });
  }
}
```

## Common Mistakes

### ❌ Mistake 1: Using UUID in public URL
```javascript
// WRONG
<Link to={`/events/${event.id}`}>View Event</Link>
```

```javascript
// CORRECT
<Link to={`/events/${event.slug}`}>View Event</Link>
```

### ❌ Mistake 2: Using slug for admin operations
```javascript
// WRONG
fetch(`/api/admin/events/${event.slug}/registrations`)
```

```javascript
// CORRECT
fetch(`/api/admin/events/${event.id}/registrations`)
```

### ❌ Mistake 3: Not checking if published
Public endpoint only returns published events. If you need unpublished events, use admin endpoint.

## URL Structure Reference

### Public URLs (use slug)
```
/events                          → List all published events
/events/{slug}                   → Event detail page
/events/{slug}/register          → Registration page
```

### Admin URLs (use UUID)
```
/admin/events                    → List all events
/admin/events/{uuid}             → Admin event detail
/admin/events/{uuid}/edit        → Edit event
/admin/events/{uuid}/registrations → View registrations
```

### API Endpoints

**Public (slug-based):**
```
GET  /api/events/upcoming
GET  /api/events/{slug}
GET  /api/events/{slug}/participants
POST /api/admin/events/{uuid}/register  ← Note: registration uses UUID!
```

**Admin (UUID-based):**
```
GET    /api/admin/events
POST   /api/admin/events
GET    /api/admin/events/{uuid}
PUT    /api/admin/events/{uuid}
DELETE /api/admin/events/{uuid}
GET    /api/admin/events/{uuid}/registrations
```

## Quick Fix for Your Current Issue

If you're getting 404 for event `3af1fb47-c15f-4bd6-b34e-3d123e568ec1`:

**Step 1:** Get the slug
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://192.168.238.236:8000/api/admin/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1
```

Look for the `"slug"` field in the response.

**Step 2:** Use the slug
```bash
curl http://192.168.238.236:8000/api/events/THE_SLUG_YOU_FOUND
```

**Step 3:** Update frontend to use slug for public pages
```javascript
// If slug is "test"
const event = await fetch('http://192.168.238.236:8000/api/events/test')
  .then(r => r.json());
```

## Testing Checklist

- [ ] Public event page uses slug in URL: `/events/test`
- [ ] API call uses slug: `GET /api/events/test`
- [ ] Admin pages use UUID: `/admin/events/3af1fb47-...`
- [ ] Registration uses event.id from fetched event
- [ ] Event cards link to `/events/${event.slug}`
- [ ] Unpublished events only accessible via admin endpoints
- [ ] Share URLs use slug (SEO-friendly)

## Summary

**Remember:**
- 🌐 **Public = Slug** (user-friendly, SEO-friendly, published only)
- 🔐 **Admin = UUID** (internal, all events, full access)

**Your Case:**
- Event ID: `3af1fb47-c15f-4bd6-b34e-3d123e568ec1`
- Event Slug: Check with admin endpoint
- Public URL: Use `/api/events/{slug}` not `/api/events/{uuid}`

---

**Need help?** Check what slug your event has and update your frontend to use it for public pages!

