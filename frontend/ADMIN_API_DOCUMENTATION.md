# Admin Dashboard API Documentation

## Overview

This document describes all admin API endpoints available for comprehensive management of the Unlokinno Intelligence platform.

## Authentication

All admin endpoints require:
- Valid JWT token (authenticate via `/api/login`)
- User with `is_admin=True` in database

## Admin API Structure

```
/api/admin/
├── /events          # Event management (already exists)
├── /categories      # Category management (already exists)
├── /upload          # File uploads (already exists)
├── /users           # User management (NEW)
├── /entities        # Entity management (NEW)
├── /matches         # Match record management (NEW)
└── /analytics       # Dashboard analytics (NEW)
```

---

## NEW: User Management (`/api/admin/users`)

### Get User Statistics
```http
GET /api/admin/users/stats/overview
```

**Response:**
```json
{
  "total_users": 150,
  "admin_users": 5,
  "regular_users": 145,
  "new_users_7d": 12,
  "new_users_30d": 45,
  "total_profiles": 200,
  "active_sessions": 23
}
```

### List Users
```http
GET /api/admin/users?page=1&page_size=20&search=daniel&admin_only=false&sort_by=created_at&sort_order=desc
```

**Query Parameters:**
- `page` (int, default=1): Page number
- `page_size` (int, default=20, max=100): Items per page
- `search` (string, optional): Search by username or email
- `admin_only` (boolean, optional): Filter by admin status
- `sort_by` (string, default="created_at"): Sort field (username, email, created_at, last_activity)
- `sort_order` (string, default="desc"): Sort order (asc, desc)

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "is_admin": false,
      "created_at": "2026-01-15T10:30:00",
      "updated_at": "2026-01-18T14:20:00",
      "profile_count": 2,
      "session_count": 15,
      "last_activity": "2026-01-18T10:00:00"
    }
  ],
  "total": 150,
  "page": 1,
  "page_size": 20,
  "total_pages": 8
}
```

### Get User Details
```http
GET /api/admin/users/{user_id}
```

**Response:**
```json
{
  "id": "uuid",
  "username": "john_doe",
  "email": "john@example.com",
  "is_admin": false,
  "profile_image_url": "https://example.com/image.jpg",
  "created_at": "2026-01-15T10:30:00",
  "updated_at": "2026-01-18T14:20:00",
  "profiles": [
    {
      "id": "uuid",
      "display_name": "John Doe",
      "type": "entrepreneur",
      "organization": "Tech Startup",
      "created_at": "2026-01-15T10:35:00"
    }
  ],
  "recent_sessions": [
    {
      "id": "uuid",
      "title": "Climate Tech Research",
      "status": "running",
      "start_time": "2026-01-18T10:00:00",
      "query_count": 15
    }
  ],
  "password_reset_count": 2,
  "last_password_reset": "2026-01-10T08:00:00"
}
```

### Update User
```http
PUT /api/admin/users/{user_id}
Content-Type: application/json

{
  "is_admin": true,
  "username": "john_doe_new"
}
```

**Response:**
```json
{
  "message": "User updated successfully"
}
```

### Delete User
```http
DELETE /api/admin/users/{user_id}
```

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

---

## NEW: Entity Management (`/api/admin/entities`)

### Get Entity Statistics
```http
GET /api/admin/entities/stats/overview
```

**Response:**
```json
{
  "total_entities": 5000,
  "scraped_entities": 4500,
  "user_created_entities": 500,
  "entity_types": {
    "lab": 3500,
    "startup": 1200,
    "organization": 250,
    "university": 50
  },
  "verified_entities": 120,
  "total_images": 8000,
  "total_publications": 15000,
  "new_entities_7d": 35
}
```

### List Entities
```http
GET /api/admin/entities?page=1&page_size=20&search=climate&entity_type=startup&source=scraped&sort_by=created_at&sort_order=desc
```

**Query Parameters:**
- `page` (int, default=1): Page number
- `page_size` (int, default=20, max=100): Items per page
- `search` (string, optional): Search by name, website, or department
- `entity_type` (string, optional): Filter by type (lab, startup, organization, university)
- `source` (string, optional): Filter by source (scraped, user)
- `sort_by` (string, default="created_at"): Sort field (name, created_at, last_updated, view_count)
- `sort_order` (string, default="desc"): Sort order (asc, desc)

**Response:**
```json
{
  "entities": [
    {
      "id": "uuid",
      "name": "Climate Tech Lab",
      "entity_type": "lab",
      "university": "MIT",
      "source": "scraped",
      "created_at": "2026-01-15T10:30:00",
      "last_updated": "2026-01-18T14:20:00",
      "image_count": 5,
      "publication_count": 50,
      "verification_count": 2,
      "view_count": 150,
      "ecosystem_links_count": 3
    }
  ],
  "total": 5000,
  "page": 1,
  "page_size": 20,
  "total_pages": 250
}
```

### Get Entity Details
```http
GET /api/admin/entities/{entity_id}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Climate Tech Lab",
  "entity_type": "lab",
  "university": "MIT",
  "location": {
    "city": "Cambridge",
    "country": "USA",
    "lat": 42.3601,
    "lng": -71.0942
  },
  "website": "https://mit.edu/climate",
  "source": "scraped",
  "created_at": "2026-01-15T10:30:00",
  "last_updated": "2026-01-18T14:20:00",
  "created_by": "uuid",
  "images": [
    {
      "id": 1,
      "url": "https://example.com/image.jpg",
      "caption": "Lab building",
      "is_primary": true
    }
  ],
  "publications": [
    {
      "id": "uuid",
      "title": "Climate Innovation Paper",
      "journal": "Nature Climate Change",
      "publication_date": "2026-01-10",
      "citation_count": 45
    }
  ],
  "verifications": [
    {
      "id": 1,
      "verifier": "Climate Org",
      "verified_at": "2026-01-16T10:00:00",
      "level": "document",
      "notes": "Verified through documentation"
    }
  ],
  "ecosystem_links": [
    {
      "id": "uuid",
      "profile_id": "uuid",
      "role": "founder",
      "context": "Lab founder"
    }
  ],
  "view_count": 150,
  "interaction_count": 0
}
```

### Update Entity
```http
PUT /api/admin/entities/{entity_id}
Content-Type: application/json

{
  "name": "Climate Research Lab",
  "entity_type": "lab",
  "university": "MIT",
  "website": "https://mit.edu/climate-research"
}
```

**Response:**
```json
{
  "message": "Entity updated successfully"
}
```

### Delete Entity
```http
DELETE /api/admin/entities/{entity_id}
```

**Response:**
```json
{
  "message": "Entity deleted successfully"
}
```

---

## NEW: Match Management (`/api/admin/matches`)

### Get Match Statistics
```http
GET /api/admin/matches/stats/overview
```

**Response:**
```json
{
  "total_matches": 5000,
  "average_score": 0.75,
  "status_counts": {
    "suggested": 3500,
    "contacted": 800,
    "interested": 500,
    "declined": 150,
    "funded": 50
  },
  "recent_matches_7d": 350,
  "high_quality_matches": 2000
}
```

### List Matches
```http
GET /api/admin/matches?page=1&page_size=20&status=suggested&min_score=0.8&sort_by=score&sort_order=desc
```

**Query Parameters:**
- `page` (int, default=1): Page number
- `page_size` (int, default=20, max=100): Items per page
- `status` (string, optional): Filter by status (suggested, contacted, interested, declined, funded)
- `min_score` (float, optional): Filter by minimum score
- `sort_by` (string, default="created_at"): Sort field (score, created_at, status)
- `sort_order` (string, default="desc"): Sort order (asc, desc)

**Response:**
```json
{
  "matches": [
    {
      "id": 1,
      "funder_id": "uuid",
      "funder_name": "Climate Fund",
      "entity_id": "uuid",
      "entity_name": "Tech Startup",
      "score": 0.92,
      "status": "interested",
      "created_at": "2026-01-18T10:30:00"
    }
  ],
  "total": 5000,
  "page": 1,
  "page_size": 20,
  "total_pages": 250
}
```

### Get Match Details
```http
GET /api/admin/matches/{match_id}
```

**Response:**
```json
{
  "id": 1,
  "funder_id": "uuid",
  "funder_name": "Climate Fund",
  "entity_id": "uuid",
  "entity_name": "Tech Startup",
  "score": 0.92,
  "reason": "High semantic similarity and thematic overlap",
  "status": "interested",
  "created_at": "2026-01-18T10:30:00",
  "metadata_": {
    "semantic_score": 0.88,
    "thematic_score": 0.95,
    "regional_score": 0.90
  }
}
```

### Update Match
```http
PUT /api/admin/matches/{match_id}
Content-Type: application/json

{
  "status": "funded",
  "reason": "Successful funding round"
}
```

**Response:**
```json
{
  "message": "Match updated successfully"
}
```

### Delete Match
```http
DELETE /api/admin/matches/{match_id}
```

**Response:**
```json
{
  "message": "Match deleted successfully"
}
```

---

## NEW: Analytics (`/api/admin/analytics`)

### Dashboard Overview
```http
GET /api/admin/analytics/dashboard/overview
```

**Response:**
```json
{
  "users": {
    "total": 150,
    "new_7d": 12,
    "new_30d": 45,
    "total_profiles": 200
  },
  "entities": {
    "total": 5000,
    "new_7d": 35,
    "total_images": 8000,
    "total_publications": 15000
  },
  "events": {
    "total": 20,
    "published": 15,
    "registrations": 500
  },
  "matches": {
    "total": 5000,
    "average_score": 0.75
  },
  "system": {
    "active_sessions": 23,
    "total_messages": 2500,
    "total_notifications": 500
  },
  "recent_activity": [
    {
      "type": "user_created",
      "message": "New user registered: john_doe",
      "timestamp": "2026-01-18T10:30:00"
    },
    {
      "type": "entity_created",
      "message": "New entity added: Climate Tech Lab",
      "timestamp": "2026-01-18T10:25:00"
    }
  ]
}
```

### System Health
```http
GET /api/admin/analytics/system/health
```

**Response:**
```json
{
  "cpu_usage": 25.5,
  "memory_usage": 68.3,
  "disk_usage": 45.2,
  "database_status": "healthy",
  "uptime": "15 days, 3 hours, 20 minutes"
}
```

### User Analytics
```http
GET /api/admin/analytics/users?days=30
```

**Query Parameters:**
- `days` (int, default=30, range=1-365): Number of days to analyze

**Response:**
```json
{
  "period_days": 30,
  "daily_registrations": [
    {
      "date": "2026-01-01",
      "count": 5
    },
    {
      "date": "2026-01-02",
      "count": 8
    }
  ],
  "total_registrations": 150
}
```

### Entity Analytics
```http
GET /api/admin/analytics/entities?days=30
```

**Response:**
```json
{
  "period_days": 30,
  "daily_creations": [
    {
      "date": "2026-01-01",
      "count": 15
    },
    {
      "date": "2026-01-02",
      "count": 12
    }
  ],
  "type_distribution": {
    "lab": 70,
    "startup": 20,
    "organization": 8,
    "university": 2
  },
  "total_created": 100
}
```

### Match Analytics
```http
GET /api/admin/analytics/matches?days=30
```

**Response:**
```json
{
  "period_days": 30,
  "daily_matches": [
    {
      "date": "2026-01-01",
      "count": 50,
      "avg_score": 0.75
    }
  ],
  "status_distribution": {
    "suggested": 3500,
    "contacted": 800,
    "interested": 500,
    "declined": 150,
    "funded": 50
  },
  "total_matches": 5000
}
```

### Event Analytics
```http
GET /api/admin/analytics/events?days=30
```

**Response:**
```json
{
  "period_days": 30,
  "daily_registrations": [
    {
      "date": "2026-01-01",
      "count": 20
    }
  ],
  "participation_types": {
    "attendee": 400,
    "speaker": 50,
    "jury": 30,
    "idea_holder": 20
  },
  "total_registrations": 500
}
```

---

## Frontend Dashboard Components

### Dashboard Overview
- **Key Metrics Cards:**
  - Total users (new this week/month)
  - Total entities (new this week)
  - Published events
  - Total matches (avg quality score)
  - Active sessions
  - System status (healthy/unhealthy)

- **Recent Activity Feed:**
  - User registrations
  - New entities added
  - Messages sent
  - Events created

### Users Section
- **User List:**
  - Search by username/email
  - Filter by admin status
  - Sort by various fields
  - Pagination

- **User Detail View:**
  - Basic info (username, email, admin status)
  - Profile count and details
  - Recent sessions
  - Password reset history
  - Actions: Edit admin status, Delete user

### Entities Section
- **Entity List:**
  - Search by name, website, department
  - Filter by type and source
  - Sort by various fields
  - Pagination

- **Entity Detail View:**
  - Entity information
  - Images (with thumbnails)
  - Publications (top 10)
  - Verifications
  - Ecosystem links
  - View statistics
  - Actions: Edit, Delete

### Matches Section
- **Match List:**
  - Filter by status
  - Filter by minimum score
  - Sort by score or date
  - Pagination

- **Match Detail View:**
  - Funder and entity details
  - Match score and reason
  - Detailed scoring breakdown
  - Status management
  - Actions: Update status, Delete

### Analytics Section
- **System Health:**
  - CPU, Memory, Disk usage
  - Database status
  - System uptime

- **User Analytics:**
  - Daily registration chart
  - Growth trends
  - Date range selector (1-365 days)

- **Entity Analytics:**
  - Daily creation chart
  - Type distribution
  - Growth trends

- **Match Analytics:**
  - Daily generation chart
  - Status distribution
  - Average quality trends

- **Event Analytics:**
  - Daily registration chart
  - Participation type distribution

---

## Installation Requirements

Add to `requirements.txt`:
```
psutil==6.1.1
```

Install with:
```bash
pip install psutil==6.1.1
```

---

## Security Considerations

1. **Authentication:** All endpoints verify admin status via `verify_admin()` dependency
2. **Self-Protection:** Admins cannot delete their own accounts
3. **Audit Logging:** All admin actions are logged for audit trails
4. **Input Validation:** All inputs validated via Pydantic models
5. **SQL Injection Protection:** Parameterized queries used throughout

---

## Future Enhancements

1. **Bulk Operations:**
   - Bulk delete users/entities
   - Bulk export to CSV/JSON
   - Bulk import entities

2. **Advanced Analytics:**
   - Custom date ranges
   - Export reports
   - Compare periods

3. **Content Moderation:**
   - Reported content review
   - Flagged user management

4. **System Configuration:**
   - Match algorithm weights
   - System settings management
   - Email template management

5. **Audit Logs:**
   - View all admin actions
   - Filter by date/user/action
   - Export audit trails

---

## Testing Endpoints

### Using curl:
```bash
# Get dashboard overview
curl -X GET "http://localhost:8000/api/admin/analytics/dashboard/overview" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# List users
curl -X GET "http://localhost:8000/api/admin/users?page=1&page_size=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Update user admin status
curl -X PUT "http://localhost:8000/api/admin/users/USER_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_admin": true}'
```

### Using Swagger UI:
Navigate to `http://localhost:8000/docs` to test all endpoints interactively.

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "detail": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad request (validation error)
- `401`: Unauthorized (not authenticated or not admin)
- `404`: Resource not found
- `500`: Internal server error

---

## File Structure

```
api/admin/
├── events.py          # Event management (existing)
├── categories.py      # Category management (existing)
├── upload.py         # File uploads (existing)
├── users.py          # User management (NEW)
├── entities.py       # Entity management (NEW)
├── matches.py        # Match management (NEW)
└── analytics.py      # Analytics & health (NEW)
```

---

## Database Models Used

- **User**: Account management
- **Profile**: User profiles
- **Session**: User sessions
- **Entity**: Labs, startups, organizations
- **EntityImage**: Entity images
- **Publication**: Academic publications
- **Verification**: Entity verifications
- **EcosystemEntityLink**: Entity-profile links
- **MatchRecord**: Funding matches
- **Funder**: Funding organizations
- **Event**: Events
- **EventRegistration**: Event registrations
- **Message**: User messages
- **Notification**: System notifications
- **PasswordReset**: Password reset tokens

---

## Support

For issues or questions, refer to the main API documentation at `/docs` or contact the development team.
