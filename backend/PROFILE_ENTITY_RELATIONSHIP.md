# Entity-Profile Relationship Guide

This document explains how entities/labs are associated with user profiles in the UaiAgent API, including endpoint details and frontend implementation guidelines.

## Overview

Entities (labs, research groups, etc.) can be associated with a **Profile** through a `profile_id` field. This allows:
- Each entity to be linked to a user profile (e.g., a researcher's profile)
- Frontend to display entity ownership and attribution
- Users to associate their created entities with their professional profile

## Database Relationship

```
Profile (1) ----< (N) Entity
    |                 |
    | profile_id      | profile_id
    v                 v
  User            Entity/Lab
```

- **Profile**: Contains user details (name, title, organization, bio, etc.)
- **Entity**: Has optional `profile_id` field that references a Profile
- **Relationship**: Optional one-to-many (one profile can have many entities)

## API Endpoints

### 1. Get All User Entities (Multiple Results)
**Endpoint:** `GET /api/entities/user_entities/`

**Use Case:** Display list of user's entities/labs in dashboard or profile page

**Response Fields:**
```json
{
  "id": "uuid-string",
  "profile_id": "uuid-string-or-null",  // ✅ INCLUDED - use to fetch profile
  "source": "scraped | user",
  "created_by_user_id": "uuid-string",
  "university": "string",
  "website": "url-string-or-null",
  "research_abstract": "string",
  // ... other entity fields ...
  "images": [...],
  "user_interactions": [...]
}
```

**Frontend Implementation:**
```javascript
// Display entity with profile link
entities.map(entity => (
  <div key={entity.id}>
    <h3>{entity.university}</h3>
    {entity.profile_id && (
      <Link to={`/profiles/${entity.profile_id}`}>
        View Associated Profile
      </Link>
    )}
  </div>
))
```

---

### 2. Get Single Entity (Detailed View)
**Endpoint:** `GET /api/entities/user_entities/{entity_id}`

**Use Case:** Display full details of a single entity with associated profile

**Response Fields:**
```json
{
  "id": "uuid-string",
  "profile_id": "uuid-string-or-null",  // ✅ INCLUDED
  "profile": {                          // ✅ FULL PROFILE INCLUDED
    "id": "uuid-string",
    "user_id": "uuid-string",
    "is_default": true,
    "type": "researcher | student | professor | industry | other",
    "display_name": "Dr. John Smith",
    "first_name": "John",
    "last_name": "Smith",
    "bio": "Researcher specializing in AI...",
    "title": "Senior Research Scientist",
    "organization": "MIT",
    "profile_image": "url-string-or-null",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "source": "scraped | user",
  "created_by_user_id": "uuid-string",
  "university": "Massachusetts Institute of Technology",
  "website": "https://csail.mit.edu",
  "location": {"city": "Cambridge", "country": "USA"},
  "research_abstract": "Research on artificial intelligence...",
  "department": {"name": "Computer Science"},
  "lab_equipment": {...},
  "climate_tech_focus": ["AI", "Machine Learning"],
  // ... other entity fields ...
  "images": [...],
  "user_interactions": [...]
}
```

**Frontend Implementation:**
```javascript
// Display entity with full profile card
const EntityDetail = ({ entity }) => (
  <div>
    <h1>{entity.university}</h1>

    {entity.profile && (
      <ProfileCard profile={entity.profile} />
    )}

    {entity.profile_id && !entity.profile && (
      <ProfileLink
        profileId={entity.profile_id}
        text="View Associated Profile"
      />
    )}
  </div>
)
```

---

### 3. Get User Labs (Authenticated User's Labs)
**Endpoint:** `GET /api/user_labs`

**Use Case:** Display labs associated with logged-in user

**Response Fields:**
```json
[
  {
    "id": "uuid-string",
    "profile_id": "uuid-string-or-null",  // ✅ INCLUDED
    "source": "user",
    "university": "Stanford University",
    // ... other entity fields ...
  },
  {
    "id": "uuid-string",
    "profile_id": "uuid-string-or-null",
    "source": "user",
    "university": "UC Berkeley",
    // ... other entity fields ...
  }
]
```

---

### 4. Get Single User Lab
**Endpoint:** `GET /api/user_labs/{id}`

**Use Case:** View single lab with profile association

**Response Fields:**
```json
{
  "id": "uuid-string",
  "profile_id": "uuid-string-or-null",  // ✅ INCLUDED
  "source": "user",
  "university": "Stanford University",
  // ... other entity fields ...
}
```

---

### 5. Get All Public Labs
**Endpoint:** `GET /api/labs`

**Use Case:** Browse all public labs with pagination

**Response Fields:**
```json
[
  {
    "id": "uuid-string",
    "profile_id": "uuid-string-or-null",  // ✅ INCLUDED
    "source": "scraped | user",
    "university": "Harvard University",
    // ... other entity fields ...
  }
]
```

---

### 6. Get Single Public Lab
**Endpoint:** `GET /api/labs/{id}`

**Use Case:** View single public lab

**Response Fields:**
```json
{
  "id": "uuid-string",
  "profile_id": "uuid-string-or-null",  // ✅ INCLUDED
  "source": "scraped | user",
  "university": "Harvard University",
  // ... other entity fields ...
}
```

---

### 7. Create Entity with Profile Association
**Endpoint:** `POST /api/entities/user_entities/`

**Request Body:**
```json
{
  "university": "New University",
  "research_abstract": "Research description...",
  "profile_id": "uuid-string-or-null",  // Optional: associate with existing profile
  "images": [{"url": "object-key"}],
  // ... other entity fields ...
}
```

**Response:** Returns full entity with profile dict included (same as Get Single Entity)

---

### 8. Update Entity Profile Association
**Endpoint:** `PUT /api/entities/user_entities/{entity_id}`

**Request Body:**
```json
{
  "profile_id": "uuid-string-or-null",  // Update profile association
  "university": "Updated University Name"
}
```

**Response:** Returns updated entity with full profile dict included

---

## Frontend Implementation Patterns

### Pattern 1: Display Profile from Single Entity Response
Since single entity endpoints include the full profile, display it directly:

```javascript
const EntityDetail = ({ entity }) => {
  if (!entity) return null;

  return (
    <div className="entity-detail">
      <h1>{entity.university}</h1>

      {entity.profile && (
        <div className="profile-section">
          <h2>Associated Profile</h2>
          <ProfileCard profile={entity.profile} />
        </div>
      )}
    </div>
  );
};
```

### Pattern 2: Fetch Profile for Multiple Entities
For multiple entity endpoints, use `profile_id` to fetch profiles on demand:

```javascript
const EntityList = ({ entities }) => {
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState({});

  // Fetch profiles for entities that have profile_id
  useEffect(() => {
    entities.forEach(async (entity) => {
      if (entity.profile_id && !profiles[entity.profile_id]) {
        setLoading(prev => ({ ...prev, [entity.profile_id]: true }));
        const profile = await fetchProfile(entity.profile_id);
        setProfiles(prev => ({ ...prev, [entity.profile_id]: profile }));
        setLoading(prev => ({ ...prev, [entity.profile_id]: false }));
      }
    });
  }, [entities]);

  return (
    <div>
      {entities.map(entity => (
        <EntityCard
          key={entity.id}
          entity={entity}
          profile={profiles[entity.profile_id]}
          profileLoading={loading[entity.profile_id]}
        />
      ))}
    </div>
  );
};
```

### Pattern 3: Lazy Load Profiles
Load profile only when user clicks "View Profile":

```javascript
const EntityCard = ({ entity }) => {
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState(null);

  const handleViewProfile = async () => {
    if (!showProfile && entity.profile_id && !profile) {
      const data = await fetchProfile(entity.profile_id);
      setProfile(data);
    }
    setShowProfile(!showProfile);
  };

  return (
    <div className="entity-card">
      <h3>{entity.university}</h3>

      {entity.profile_id && (
        <button onClick={handleViewProfile}>
          {showProfile ? 'Hide' : 'View'} Associated Profile
        </button>
      )}

      {showProfile && profile && (
        <ProfileCard profile={profile} />
      )}

      {showProfile && !profile && entity.profile_id && (
        <LoadingSpinner />
      )}
    </div>
  );
};
```

---

## Profile Fetching Endpoint

**Endpoint:** `GET /api/profiles/{profile_id}`

**Response:**
```json
{
  "id": "uuid-string",
  "user_id": "uuid-string",
  "is_default": true,
  "type": "researcher",
  "display_name": "Dr. John Smith",
  "first_name": "John",
  "last_name": "Smith",
  "bio": "Researcher specializing in AI and machine learning",
  "title": "Senior Research Scientist",
  "organization": "MIT",
  "profile_image": "https://storage.example.com/profiles/photo.jpg",
  "location": {"city": "Cambridge", "country": "USA"},
  "social_links": {"linkedin": "...", "twitter": "..."},
  "expertise": ["AI", "Machine Learning", "Deep Learning"],
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## Important Notes

### 1. When profile_id is null
- Entity was created without associating a profile
- User can update entity to add profile association via `PUT /api/entities/user_entities/{id}`
- Display entity without profile information

### 2. Performance Considerations
- **Multiple entities endpoint**: Returns only `profile_id` (lightweight)
- **Single entity endpoint**: Returns full `profile` object (more data)
- This design prevents N+1 queries when loading entity lists
- Frontend should cache profile data to avoid redundant fetches

### 3. Profile Ownership
- Users can only associate entities with their own profiles
- Validation happens on backend during create/update
- Frontend should verify profile ownership before displaying edit options

### 4. Profile Types
The `type` field in Profile indicates the profile category:
- `"researcher"`: Academic researcher
- `"student"`: Student researcher
- `"professor"`: Professor
- `"industry"`: Industry professional
- `"other"`: Other category

---

## Error Handling

### Profile Not Found
```json
{
  "detail": "Profile not found or not owned by user"
}
```
**Action:** Entity update rejected - user can only associate with their own profiles

### Entity Not Found
```json
{
  "detail": "Entity not found"
}
```
**Action:** Handle 404 gracefully in UI

---

## Quick Reference Table

| Endpoint | Returns `profile_id`? | Returns full `profile`? |
|----------|----------------------|------------------------|
| `GET /api/entities/user_entities/` | ✅ Yes | ❌ No |
| `GET /api/entities/user_entities/{id}` | ✅ Yes | ✅ Yes |
| `GET /api/user_labs` | ✅ Yes | ❌ No |
| `GET /api/user_labs/{id}` | ✅ Yes | ❌ No |
| `GET /api/labs` | ✅ Yes | ❌ No |
| `GET /api/labs/{id}` | ✅ Yes | ❌ No |
| `POST /api/entities/user_entities/` | ✅ Yes | ✅ Yes |
| `PUT /api/entities/user_entities/{id}` | ✅ Yes | ✅ Yes |

---

## Summary for Frontend Developers

1. **For entity lists**: Display `profile_id` as a link, fetch profile on demand
2. **For single entity view**: Profile is already included, display directly
3. **Profile association**: Users can link entities to their profiles during create/update
4. **Performance**: Multiple entity endpoints are optimized by not including full profiles
5. **Caching**: Cache profile responses to avoid redundant API calls
