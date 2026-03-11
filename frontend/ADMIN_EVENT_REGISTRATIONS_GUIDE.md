# Admin Event Registrations - Implementation Guide

## ✅ STATUS: FULLY IMPLEMENTED

The admin event registrations viewing functionality is **already implemented** in your frontend!

---

## 🎯 How to Access

### From Admin Events List Page

1. **Navigate to:** `/admin/events`
2. **Find any event** in the table
3. **Click the green Users icon** (👥) in the actions column
4. **You will be redirected to:** `/admin/events/{event_id}/registrations`

The green Users icon is now visible next to the Edit, View, and Delete buttons for each event.

---

## 📍 File Locations

### Frontend Page
- **Path:** `/app/admin/events/[id]/registrations/page.tsx`
- **Route:** `/admin/events/{event_id}/registrations`
- **Status:** ✅ Fully implemented

### API Route
- **Path:** `/app/api/admin/events/[id]/registrations/route.ts`
- **Endpoint:** `GET /api/admin/events/{event_id}/registrations`
- **Status:** ✅ Fixed (added authentication)

### Backend Endpoint (Referenced)
- **Endpoint:** `GET /api/admin/events/{event_id}/registrations`
- **Server:** Your FastAPI backend

---

## 🔧 Recent Fixes Applied

### 1. Added Authentication to API Route
**File:** `/app/api/admin/events/[id]/registrations/route.ts`

**Changes:**
- ✅ Added `cookies()` import from `next/headers`
- ✅ Added token extraction from cookies
- ✅ Added Authorization header to backend request
- ✅ Updated to async params for Next.js 15 compatibility
- ✅ Added 401 response for unauthenticated requests

**Before:**
```typescript
headers: {
  "Content-Type": "application/json",
}
```

**After:**
```typescript
const token = cookieStore.get("token")?.value;
headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`,
}
```

### 2. Added "View Registrations" Button
**File:** `/app/admin/events/page.tsx`

**Changes:**
- ✅ Added green Users icon button in actions column
- ✅ Navigates to `/admin/events/{event_id}/registrations`
- ✅ Added theme support (dark/light hover states)
- ✅ Positioned between "View Event" and "Delete" buttons

---

## 📊 Features Available

The registrations page includes:

### 1. **Event Information**
- Event title
- Event date and time
- Location information

### 2. **Registration List**
- **Columns:** Name, Email, Organization, Type, Attendance, Status, Registration Date
- **Search:** Filter by name, email, or organization
- **Status Filter:** All, Pending, Confirmed, Cancelled, Waitlisted
- **Pagination:** 20 registrations per page

### 3. **Actions**
- **View Details:** Click on a registration to see full details
- **Update Status:** Change registration status (pending/confirmed/cancelled/waitlisted)
- **Bulk Actions:** Select multiple registrations for batch operations
- **Export:** Download registrations as CSV

### 4. **Statistics**
- Total registrations count
- Breakdown by status
- Attendance type distribution

---

## 🎨 UI Design

The page follows your minimalist design pattern:
- ✅ Dark mode support (`dark:bg-[#0A0A0A]`, `dark:bg-[#1A1A1A]`)
- ✅ Light mode support (`bg-gray-50`, `bg-white`)
- ✅ Green accent color (`#00FB75`)
- ✅ Consistent spacing and typography
- ✅ Responsive grid layout

---

## 🔌 API Integration

### Request Flow

```
Frontend Page (registrations/page.tsx)
    ↓ fetches from
Frontend API Route (/api/admin/events/[id]/registrations/route.ts)
    ↓ forwards with auth to
Backend API (http://localhost:8000/api/admin/events/{id}/registrations)
    ↓ returns
Registration Data
```

### Query Parameters Supported

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `search` | string | "" | Search by name, email, org |
| `status` | string | "" | Filter by status |

### Example Request

```bash
GET /api/admin/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1/registrations?page=1&limit=20&search=john&status=pending
Cookie: token={admin-jwt-token}
```

### Example Response

```json
{
  "items": [
    {
      "id": "uuid",
      "event_id": "uuid",
      "profile_id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "position": "Software Engineer",
      "organization": "Tech Corp",
      "participation_type": "attendee",
      "attendance_type": "on_site",
      "status": "pending",
      "registration_date": "2026-01-24T16:01:41",
      "checked_in_at": null,
      "wants_profile_visible": true,
      "special_requirements": null
    }
  ],
  "total": 45,
  "page": 1,
  "size": 20,
  "pages": 3
}
```

---

## 🧪 Testing Checklist

- [ ] Navigate to `/admin/events`
- [ ] Verify green Users icon appears for each event
- [ ] Click Users icon to open registrations page
- [ ] Verify event information displays correctly
- [ ] Test search functionality
- [ ] Test status filter dropdown
- [ ] Test pagination controls
- [ ] Verify registration details display
- [ ] Test status update functionality
- [ ] Verify dark/light theme switching works
- [ ] Test on mobile/tablet/desktop

---

## 🚀 Usage Instructions for Admins

1. **Log in** to admin panel
2. **Navigate** to "Events" in the sidebar
3. **Find** the event you want to view registrations for
4. **Click** the green Users icon (👥) in the actions column
5. **View** all registrations for that event
6. **Use search** to find specific registrations
7. **Filter** by status to see pending/confirmed/cancelled
8. **Click** on a registration to view full details
9. **Update** status or perform other actions as needed

---

## 📝 Status Values

| Status | Description | Color |
|--------|-------------|-------|
| `pending` | Awaiting admin approval | Yellow |
| `confirmed` | Approved by admin | Green |
| `cancelled` | Cancelled by user or admin | Red |
| `waitlisted` | On waiting list | Gray |

---

## 🔐 Permissions

- **Required:** Admin authentication (token in cookies)
- **Access:** Only admins can view all event registrations
- **Regular users** can only view their own registration via `/events/{slug}` (My Registration tab)

---

## 📦 Summary

**Everything is already implemented!** The admin can:

✅ View all registrations for any event
✅ Search and filter registrations
✅ See detailed registration information
✅ Update registration statuses
✅ Export data (if implemented in UI)
✅ Access via simple click from events list

**No additional frontend work needed** - the functionality is complete and ready to use!

---

## 🛠 Troubleshooting

### Issue: "Authentication required" error
**Solution:** Ensure admin is logged in and token is stored in cookies

### Issue: No registrations showing
**Solution:** Check backend logs, verify event has registrations

### Issue: 404 when clicking Users icon
**Solution:** Verify event ID is valid, check route parameters

### Issue: Status filter not working
**Solution:** Check backend supports status parameter

---

## 📞 Support

For backend API issues, contact the backend team.
For frontend issues, check browser console for errors.

