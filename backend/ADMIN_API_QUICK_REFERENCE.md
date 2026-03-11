# Quick Reference - Admin Dashboard API Endpoints

## Base URL
```
http://localhost:8000/api
```

## Authentication Headers
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

---

## Dashboard Overview

### Get Dashboard Overview
```
GET /admin/analytics/dashboard/overview
```

### Get System Health
```
GET /admin/analytics/system/health
```

### Get User Analytics
```
GET /admin/analytics/users?days=30
```

### Get Entity Analytics
```
GET /admin/analytics/entities?days=30
```

### Get Match Analytics
```
GET /admin/analytics/matches?days=30
```

### Get Event Analytics
```
GET /admin/analytics/events?days=30
```

---

## User Management

### List Users
```
GET /admin/users?page=1&page_size=20&search=daniel&admin_only=false&sort_by=created_at&sort_order=desc
```

**Parameters:**
- `page`: integer (default=1)
- `page_size`: integer (1-100, default=20)
- `search`: string (optional)
- `admin_only`: boolean (optional)
- `sort_by`: string [username, email, created_at, last_activity]
- `sort_order`: string [asc, desc]

### Get User Stats
```
GET /admin/users/stats/overview
```

### Get User Detail
```
GET /admin/users/{user_id}
```

### Update User
```
PUT /admin/users/{user_id}
Content-Type: application/json

{
  "is_admin": true,
  "username": "new_username"
}
```

### Delete User
```
DELETE /admin/users/{user_id}
```

---

## Entity Management

### List Entities
```
GET /admin/entities?page=1&page_size=20&search=climate&entity_type=startup&source=scraped&sort_by=created_at&sort_order=desc
```

**Parameters:**
- `page`: integer (default=1)
- `page_size`: integer (1-100, default=20)
- `search`: string (optional)
- `entity_type`: string [lab, startup, organization, university]
- `source`: string [scraped, user]
- `sort_by`: string [name, created_at, last_updated, view_count]
- `sort_order`: string [asc, desc]

### Get Entity Stats
```
GET /admin/entities/stats/overview
```

### Get Entity Detail
```
GET /admin/entities/{entity_id}
```

### Update Entity
```
PUT /admin/entities/{entity_id}
Content-Type: application/json

{
  "name": "New Entity Name",
  "entity_type": "lab",
  "university": "MIT",
  "website": "https://example.com"
}
```

### Delete Entity
```
DELETE /admin/entities/{entity_id}
```

---

## Match Management

### List Matches
```
GET /admin/matches?page=1&page_size=20&status=suggested&min_score=0.8&sort_by=score&sort_order=desc
```

**Parameters:**
- `page`: integer (default=1)
- `page_size`: integer (1-100, default=20)
- `status`: string [suggested, contacted, interested, declined, funded]
- `min_score`: float (optional)
- `sort_by`: string [score, created_at, status]
- `sort_order`: string [asc, desc]

### Get Match Stats
```
GET /admin/matches/stats/overview
```

### Get Match Detail
```
GET /admin/matches/{match_id}
```

### Update Match
```
PUT /admin/matches/{match_id}
Content-Type: application/json

{
  "status": "funded",
  "reason": "Successful funding"
}
```

### Delete Match
```
DELETE /admin/matches/{match_id}
```

---

## Response Codes

- `200 OK`: Success
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Not authenticated or not admin
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Error Response Format

```json
{
  "detail": "Error message description"
}
```

---

## Pagination Response Format

```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

---

## Date Format

All dates are in ISO 8601 format:
```
2026-01-18T10:30:00
```

---

## ID Formats

- User IDs: UUID strings
- Entity IDs: UUID strings
- Match IDs: Integers

Example:
```
user_id: "f44608f9-c7d2-4388-a869-9fdbf1fabd05"
entity_id: "f44608f9-c7d2-4388-a869-9fdbf1fabd06"
match_id: 1
```

---

## Rate Limiting

All admin endpoints respect rate limiting. Implement exponential backoff on retries.

```javascript
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function apiCallWithRetry(fn) {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retries)));
        retries++;
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Testing Locally

### Using curl

```bash
# Login to get token
curl -X POST "http://localhost:8000/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username_or_email":"admin@example.com","password":"password123"}'

# Use token to access admin endpoint
curl -X GET "http://localhost:8000/api/admin/analytics/dashboard/overview" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Postman

1. Import collection from API docs
2. Set base URL to `http://localhost:8000/api`
3. Add auth token to headers
4. Test endpoints

---

## Common Issues

### 401 Unauthorized
- Check if token is valid
- Verify user has admin privileges
- Check token format: `Bearer <token>`

### 400 Bad Request
- Validate all required fields
- Check field formats (email, UUID, etc.)
- Verify enum values match allowed values

### 404 Not Found
- Check if resource ID is correct
- Verify resource still exists
- Check if you have permissions

### 500 Internal Server Error
- Check server logs
- Report to backend team
- Try again later

---

## Swagger UI

Access interactive API documentation at:
```
http://localhost:8000/docs
```

This provides:
- Try-it-out functionality
- Request/response schemas
- Authentication interface
- Real-time testing

---

## Support

For issues:
1. Check `ADMIN_API_DOCUMENTATION.md` for detailed docs
2. Check Swagger UI at `/docs`
3. Review console errors
4. Contact backend team

---

## Quick Start Example

```javascript
// 1. Login
const loginResponse = await fetch('http://localhost:8000/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username_or_email: 'admin@example.com',
    password: 'password123'
  })
});

const { access_token } = await loginResponse.json();
localStorage.setItem('token', access_token);

// 2. Get dashboard overview
const overviewResponse = await fetch('http://localhost:8000/api/admin/analytics/dashboard/overview', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});

const overview = await overviewResponse.json();
console.log(overview);

// 3. List users
const usersResponse = await fetch('http://localhost:8000/api/admin/users?page=1&page_size=20', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});

const { users, total, page } = await usersResponse.json();
console.log(`Found ${total} users on page ${page}`);
```
