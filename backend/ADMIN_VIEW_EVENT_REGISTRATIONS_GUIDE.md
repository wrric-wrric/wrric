===================================================================================
ADMIN EVENT REGISTRATIONS ENDPOINT - FRONTEND IMPLEMENTATION GUIDE
===================================================================================

## Overview
Endpoint for administrators to view ALL people who have registered for a specific event.
This shows ALL registrations including anonymous ones (unlike the public participants endpoint).

## Endpoint Details

**URL:** `GET /api/admin/events/{event_id}/registrations`

**Authentication:** Required (Admin users only)

**Method:** GET

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number (starts at 1) |
| limit | integer | No | 50 | Items per page (max 100) |
| search | string | No | null | Search term for filtering |

## Request Example

```javascript
// Without search
GET /api/admin/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1/registrations?page=1&limit=50

// With search (searches first name, last name, email, organization)
GET /api/admin/events/3af1fb47-c15f-4bd6-b34e-3d123e568ec1/registrations?page=1&limit=50&search=john

// Headers
Authorization: Bearer <admin-jwt-token>
```

## Response Format

```json
{
  "items": [
    {
      "id": "9731b46b-fb22-41ee-9f20-b0e610589725",
      "event_id": "3af1fb47-c15f-4bd6-b34e-3d123e568ec1",
      "profile_id": "e5b3a147-088a-439d-83a0-4a871adbca68",
      "first_name": "DOE",
      "last_name": "DANIEL",
      "email": "daniel.doe@a2sv.org",
      "position": "Student",
      "organization": "University of Ghana",
      "participation_type": "attendee",
      "attendance_type": "on_site",
      "ticket_type": null,
      "wants_profile_visible": true,
      "profile_visibility_types": [],
      "special_requirements": null,
      "status": "pending",
      "registration_date": "2026-01-24T16:01:41.071542",
      "checked_in_at": null,
      "is_anonymous": false,
      "created_at": "2026-01-24T16:01:41.075543",
      "updated_at": "2026-01-24T16:01:41.075543"
    }
  ],
  "total": 45,
  "page": 1,
  "page_size": 50,
  "pages": 1
}
```

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Unique registration ID |
| event_id | UUID | Event this registration is for |
| profile_id | UUID/null | User profile ID (null if no account) |
| first_name | string | Registrant's first name |
| last_name | string | Registrant's last name |
| email | string | Registrant's email address |
| position | string | Job position/role |
| organization | string | Organization name |
| participation_type | string | attendee, speaker, sponsor, organizer |
| attendance_type | string | on_site, virtual |
| ticket_type | string/null | Ticket type if applicable |
| wants_profile_visible | boolean | If they want to appear in public list |
| special_requirements | string/null | Any special needs |
| status | string | pending, approved, rejected, cancelled |
| registration_date | datetime | When they registered |
| checked_in_at | datetime/null | When they checked in (null if not yet) |
| is_anonymous | boolean | If this is anonymous registration |

## Registration Status Values

- `pending` - Awaiting admin approval
- `approved` - Approved by admin
- `rejected` - Rejected by admin
- `cancelled` - Cancelled by user

## Frontend Implementation Example

```javascript
class AdminEventRegistrations {
  constructor(apiBaseUrl, authToken) {
    this.apiBaseUrl = apiBaseUrl;
    this.authToken = authToken;
  }
  
  async getRegistrations(eventId, page = 1, limit = 50, search = null) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });
    
    if (search) {
      params.append('search', search);
    }
    
    const response = await fetch(
      `${this.apiBaseUrl}/admin/events/${eventId}/registrations?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch registrations: ${response.status}`);
    }
    
    return await response.json();
  }
  
  renderRegistrationsTable(data) {
    const { items, total, page, page_size, pages } = data;
    
    // Create table HTML
    let html = `
      <div class="registrations-header">
        <h2>Event Registrations</h2>
        <p>Total: ${total} registrations</p>
      </div>
      
      <table class="registrations-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Organization</th>
            <th>Type</th>
            <th>Attendance</th>
            <th>Status</th>
            <th>Registered</th>
            <th>Checked In</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    items.forEach(reg => {
      const statusClass = reg.status === 'approved' ? 'status-approved' : 
                         reg.status === 'rejected' ? 'status-rejected' : 
                         reg.status === 'cancelled' ? 'status-cancelled' : 
                         'status-pending';
      
      const checkedInBadge = reg.checked_in_at 
        ? `<span class="badge checked-in">✓ Checked In</span>`
        : `<span class="badge not-checked-in">Not Checked In</span>`;
      
      const anonymousBadge = reg.is_anonymous 
        ? `<span class="badge anonymous">Anonymous</span>` 
        : '';
      
      html += `
        <tr>
          <td>
            ${reg.first_name} ${reg.last_name}
            ${anonymousBadge}
          </td>
          <td>${reg.email}</td>
          <td>${reg.organization || '-'}</td>
          <td>${reg.participation_type}</td>
          <td>${reg.attendance_type}</td>
          <td><span class="status ${statusClass}">${reg.status}</span></td>
          <td>${new Date(reg.registration_date).toLocaleDateString()}</td>
          <td>${checkedInBadge}</td>
          <td>
            <button onclick="viewDetails('${reg.id}')">View</button>
            <button onclick="checkIn('${reg.id}')">Check In</button>
            ${reg.status === 'pending' ? `
              <button onclick="approve('${reg.id}')">Approve</button>
              <button onclick="reject('${reg.id}')">Reject</button>
            ` : ''}
          </td>
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
      
      <div class="pagination">
        Page ${page} of ${pages}
        ${page > 1 ? `<button onclick="loadPage(${page - 1})">Previous</button>` : ''}
        ${page < pages ? `<button onclick="loadPage(${page + 1})">Next</button>` : ''}
      </div>
    `;
    
    return html;
  }
  
  async searchRegistrations(eventId, searchTerm) {
    return await this.getRegistrations(eventId, 1, 50, searchTerm);
  }
  
  exportToCSV(data) {
    const headers = ['Name', 'Email', 'Organization', 'Type', 'Attendance', 'Status', 'Registered', 'Checked In'];
    const rows = data.items.map(reg => [
      `${reg.first_name} ${reg.last_name}`,
      reg.email,
      reg.organization || '',
      reg.participation_type,
      reg.attendance_type,
      reg.status,
      new Date(reg.registration_date).toLocaleDateString(),
      reg.checked_in_at ? 'Yes' : 'No'
    ]);
    
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(field => `"${field}"`).join(',') + '\n';
    });
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-registrations-${new Date().toISOString()}.csv`;
    a.click();
  }
}

// Usage
const registrations = new AdminEventRegistrations(
  'http://192.168.238.236:8000/api',
  getAuthToken()
);

// Load registrations
const data = await registrations.getRegistrations(eventId, 1, 50);
document.getElementById('registrations-container').innerHTML = 
  registrations.renderRegistrationsTable(data);

// Search
const searchResults = await registrations.searchRegistrations(eventId, 'john');

// Export
registrations.exportToCSV(data);
```

## UI Features to Implement

### 1. Registrations Table
- Display all registrations in a sortable table
- Show key information: name, email, organization, status
- Color-code status (pending=yellow, approved=green, rejected=red)
- Indicate checked-in status with badge

### 2. Search & Filter
- Search box that searches: first name, last name, email, organization
- Filter by status: All, Pending, Approved, Rejected, Cancelled
- Filter by attendance type: All, On-site, Virtual
- Filter by participation type: All, Attendee, Speaker, Sponsor

### 3. Pagination
- Show page number and total pages
- Previous/Next buttons
- Optional: Jump to specific page
- Optional: Items per page selector (25, 50, 100)

### 4. Actions
- **View Details** - Open modal with full registration info
- **Check In** - Mark as checked in (POST to check-in endpoint)
- **Approve** - Approve pending registration
- **Reject** - Reject pending registration
- **Export** - Download as CSV

### 5. Statistics Dashboard
- Total registrations
- Pending approvals count
- Checked in count
- Breakdown by attendance type (on-site vs virtual)
- Breakdown by participation type

## Error Handling

```javascript
try {
  const data = await registrations.getRegistrations(eventId);
} catch (error) {
  if (error.message.includes('401')) {
    // Not authenticated - redirect to login
    window.location.href = '/admin/login';
  } else if (error.message.includes('403')) {
    // Not authorized - show error
    showError('You do not have permission to view registrations');
  } else if (error.message.includes('404')) {
    // Event not found
    showError('Event not found');
  } else {
    // Generic error
    showError('Failed to load registrations. Please try again.');
  }
}
```

## Real-time Updates (Optional)

Consider implementing WebSocket connection for real-time updates:
- New registrations appear automatically
- Status changes update in real-time
- Check-ins update immediately

## Related Endpoints

You may also need these endpoints for full admin functionality:

1. **Approve Registration**
   - `PATCH /api/admin/events/registrations/{registration_id}/status`
   - Body: `{ "status": "approved" }`

2. **Check In Attendee**
   - `POST /api/admin/events/registrations/{registration_id}/check-in`

3. **Get Single Registration**
   - `GET /api/admin/events/registrations/{registration_id}`

4. **Export All**
   - Fetch all pages and combine, or request backend to add:
   - `GET /api/admin/events/{event_id}/registrations/export?format=csv`

## Testing Checklist

- [ ] Table displays all registrations correctly
- [ ] Pagination works (next/previous)
- [ ] Search filters results correctly
- [ ] Status badges show correct colors
- [ ] Anonymous registrations show badge
- [ ] Checked-in status displays correctly
- [ ] Export to CSV works
- [ ] Error handling for 401, 403, 404
- [ ] Mobile responsive design
- [ ] Loading states during API calls

## Notes

- This endpoint shows ALL registrations including anonymous ones
- Different from public `/api/events/{id}/participants` which only shows visible users
- Admin authentication required
- Search is case-insensitive
- Results ordered by registration date (newest first)

## Quick Start Summary

**Endpoint:** `GET /api/admin/events/{event_id}/registrations`

**Parameters:** `?page=1&limit=50&search=john`

**Headers:** `Authorization: Bearer <token>`

**Returns:** Paginated list of ALL event registrations

**Use for:** Admin dashboard to view, search, and manage event attendees

===================================================================================
