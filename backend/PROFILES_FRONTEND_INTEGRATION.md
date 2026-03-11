# Profile & Entity Association - Frontend Integration Guide

## Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [Profile Management](#profile-management)
4. [Entity Creation & Association](#entity-creation--association)
5. [Public Profile Viewing](#public-profile-viewing)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [Data Models](#data-models)
8. [Error Handling](#error-handling)
9. [Best Practices](#best-practices)

---

## Overview

This guide describes how the frontend should handle profile and entity association features. The key concepts are:

- **User Account**: The authentication and authorization layer (username, email, password)
- **Profile**: Role-specific identities associated with a user (max 2 per user)
- **Default Profile**: The primary profile, automatically created and cannot be deleted
- **Entity**: Labs, startups, or academic groups
- **Profile-Entity Association**: Each entity is linked to exactly one profile

### Key Principles

1. **Separation of Concerns**: User account details are never exposed publicly; only profile information is visible
2. **Default Profile Fallback**: When profile data is incomplete, fall back to the user table data
3. **Profile Ownership**: Only the profile owner can modify or delete profiles and associated entities
4. **Public Identity**: The associated profile is the public-facing identity of an entity

---

## Authentication Flow

### Login Response

When a user logs in successfully, the API returns comprehensive profile information, based on it a rounded image on the sidebar which will rather point to profiles as it is done in standard or professional softwares.
hence organize the sidebar appropriately as it supposed to be professinal 

#### Endpoint
```http
POST /login
Content-Type: application/json
```

#### Request
```json
{
  "username": "user@example.com",
  "password": "securepassword123",
  "recaptchaResponse": "reCAPTCHA_token_here"
}
```

#### Response
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "johndoe",
  "email": "user@example.com",
  "profile_image_url": "https://s3.amazonaws.com/bucket/path/to/avatar.jpg",
  "profiles": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "user_id": "550e8400-e29b-41d4-a716-4466554400000",
      "is_default": true,
      "type": "lab",
      "display_name": "Dr. John Doe",
      "first_name": "John",
      "last_name": "Doe",
      "date_of_birth": "1990-01-15",
      "gender": "male",
      "phone": "+1-555-123-4567",
      "website": "https://example.com",
      "title": "Principal Investigator",
      "organization": "MIT",
      "bio": "Researching climate change and renewable energy.",
      "location": {
        "city": "Boston",
        "state": "MA",
        "country": "USA"
      },
      "social_links": {
        "linkedin": "https://linkedin.com/in/johndoe",
        "twitter": "@johndoe"
      },
      "expertise": ["climate_change", "renewable_energy"],
      "profile_image": "https://s3.amazonaws.com/bucket/path/to/avatar.jpg",
      "metadata": {},
      "created_at": "2026-01-19T10:30:00Z"
    }
  ],
  "default_profile_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

### OAuth Login (Google/LinkedIn)

OAuth logins follow the same pattern and return profile data via URL parameters in the redirect.

#### Example Redirect URL
```
https://your-frontend.com/auth/callback?access_token=eyJhbGc...&user_id=550e8400-e29b-41d4-a716-4466554400000&existing_user=true&profiles_json=[{...}]&default_profile_id=550e8400-e29b-41d4-a716-446655440001
```

### Frontend Implementation

```typescript
interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  username: string;
  email: string;
  profile_image_url: string | null;
  profiles: Profile[];
  default_profile_id: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  is_default: boolean;
  type: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  website: string | null;
  title: string | null;
  organization: string | null;
  bio: string;
  location: Record<string, any>;
  social_links: Record<string, any>;
  expertise: string[];
  profile_image: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

// Store login response
async function handleLogin(credentials: LoginCredentials): Promise<void> {
  const response = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data: LoginResponse = await response.json();

  // Store authentication data
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('user_id', data.user_id);
  localStorage.setItem('profiles', JSON.stringify(data.profiles));
  localStorage.setItem('default_profile_id', data.default_profile_id || '');

  // Determine active profile
  const activeProfileId = data.default_profile_id || data.profiles[0]?.id;
  setActiveProfile(activeProfileId);
}
```

---

## Profile Management

### Get User's Profiles

Retrieve all profiles for the current user.

#### Endpoint
```http
GET /profiles
Authorization: Bearer {access_token}
```

#### Response
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "user_id": "550e8400-e29b-41d4-a716-4466554400000",
    "is_default": true,
    "type": "lab",
    "display_name": "Dr. John Doe",
    ...
  }
]
```

### Create New Profile

Create an additional profile (max 2 total per user).

#### Endpoint
```http
POST /profiles
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

#### Request Fields
| Field | Type | Required | Description |
|--------|------|----------|-------------|
| `profile_type` | string | Yes | Profile type: 'lab', 'entrepreneur', 'academic', 'funder' |
| `display_name` | string | No | Public display name |
| `first_name` | string | No | First name |
| `last_name` | string | No | Last name |
| `date_of_birth` | string | No | ISO 8601 date format: YYYY-MM-DD |
| `gender` | string | No | Gender |
| `phone` | string | No | Phone number |
| `website` | string | No | Website URL |
| `title` | string | No | Professional title |
| `organization` | string | No | Organization name |
| `bio` | string | No | Biography |
| `location` | string (JSON) | No | Location object as JSON string |
| `social_links` | string (JSON) | No | Social links object as JSON string |
| `expertise` | string (JSON) | No | Expertise array as JSON string |
| `profile_image` | file | No | Profile image file |

#### Frontend Implementation
```typescript
interface CreateProfileRequest {
  profile_type: 'lab' | 'entrepreneur' | 'academic' | 'funder';
  display_name?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  website?: string;
  title?: string;
  organization?: string;
  bio?: string;
  location?: Record<string, any>;
  social_links?: Record<string, any>;
  expertise?: string[];
  profile_image?: File;
}

async function createProfile(formData: CreateProfileRequest): Promise<void> {
  // Check profile count
  const currentProfiles = getProfilesFromStorage();
  if (currentProfiles.length >= 2) {
    alert('Maximum of 2 profiles allowed.');
    return;
  }

  const form = new FormData();
  form.append('profile_type', formData.profile_type);
  if (formData.display_name) form.append('display_name', formData.display_name);
  if (formData.first_name) form.append('first_name', formData.first_name);
  if (formData.last_name) form.append('last_name', formData.last_name);
  if (formData.bio) form.append('bio', formData.bio);
  if (formData.location) form.append('location', JSON.stringify(formData.location));
  if (formData.social_links) form.append('social_links', JSON.stringify(formData.social_links));
  if (formData.expertise) form.append('expertise', JSON.stringify(formData.expertise));
  if (formData.profile_image) form.append('profile_image', formData.profile_image);

  const response = await fetch('/profiles', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getAccessToken()}` },
    body: form,
  });

  if (!response.ok) {
    const error = await response.json();
    if (error.detail?.includes('Maximum of 2 profiles')) {
      alert('You have reached the maximum of 2 profiles.');
    }
    return;
  }

  const newProfile: Profile = await response.json();

  // Update local storage
  const updatedProfiles = [...currentProfiles, newProfile];
  localStorage.setItem('profiles', JSON.stringify(updatedProfiles));

  // Refresh UI
  renderProfilesList();
}
```

#### Error Responses
| Status | Detail |
|--------|---------|
| 400 | Maximum of 2 profiles allowed (currently have 2) |

### Update Profile

Update an existing profile's information.

#### Endpoint
```http
PUT /profiles/{profile_id}
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

#### Frontend Implementation
```typescript
async function updateProfile(profileId: string, updates: Partial<CreateProfileRequest>): Promise<void> {
  const form = new FormData();

  // Add all provided fields
  Object.entries(updates).forEach(([key, value]) => {
    if (key === 'location' || key === 'social_links' || key === 'expertise') {
      form.append(key, JSON.stringify(value));
    } else if (key === 'profile_image' && value instanceof File) {
      form.append(key, value);
    } else if (value !== undefined) {
      form.append(key, String(value));
    }
  });

  const response = await fetch(`/profiles/${profileId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${getAccessToken()}` },
    body: form,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail);
  }

  const updatedProfile: Profile = await response.json();

  // Update local storage
  const currentProfiles = getProfilesFromStorage();
  const updatedProfiles = currentProfiles.map(p =>
    p.id === profileId ? updatedProfile : p
  );
  localStorage.setItem('profiles', JSON.stringify(updatedProfiles));

  // Refresh UI
  renderProfilesList();
}
```

### Set Default Profile

Mark a profile as the default profile.

#### Endpoint
```http
POST /profiles/{profile_id}/set-default
Authorization: Bearer {access_token}
```

#### Response
```json
{
  "message": "Profile set as default",
  "profile_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

#### Frontend Implementation
```typescript
async function setDefaultProfile(profileId: string): Promise<void> {
  const response = await fetch(`/profiles/${profileId}/set-default`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getAccessToken()}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail);
  }

  // Update local storage
  const currentProfiles = getProfilesFromStorage();
  const updatedProfiles = currentProfiles.map(p => ({
    ...p,
    is_default: p.id === profileId
  }));
  localStorage.setItem('profiles', JSON.stringify(updatedProfiles));
  localStorage.setItem('default_profile_id', profileId);

  // Refresh UI
  renderProfilesList();
}
```

### Delete Profile

Delete a profile (default profile cannot be deleted).

#### Endpoint
```http
DELETE /profiles/{profile_id}
Authorization: Bearer {access_token}
```

#### Error Responses
| Status | Detail |
|--------|---------|
| 400 | Cannot delete default profile |
| 400 | Cannot delete only profile |

#### Frontend Implementation
```typescript
async function deleteProfile(profileId: string): Promise<void> {
  const response = await fetch(`/profiles/${profileId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${getAccessToken()}` },
  });

  if (!response.ok) {
    const error = await response.json();
    if (error.detail?.includes('Cannot delete default profile')) {
      alert('You cannot delete your default profile.');
    } else if (error.detail?.includes('Cannot delete only profile')) {
      alert('You must have at least one profile.');
    }
    return;
  }

  // Update local storage
  const currentProfiles = getProfilesFromStorage();
  const updatedProfiles = currentProfiles.filter(p => p.id !== profileId);
  localStorage.setItem('profiles', JSON.stringify(updatedProfiles));

  // If deleted profile was default, set first remaining as default
  const deletedWasDefault = localStorage.getItem('default_profile_id') === profileId;
  if (deletedWasDefault && updatedProfiles.length > 0) {
    localStorage.setItem('default_profile_id', updatedProfiles[0].id);
  }

  // Refresh UI
  renderProfilesList();
}
```

---

## Entity Creation & Association

### Create Entity with Profile Selection

When creating a lab or entity, the user must select which profile to associate with it.

#### Endpoint
```http
POST /entities/
Authorization: Bearer {access_token}
Content-Type: application/json
```

#### Request
```json
{
  "university": "MIT",
  "research_abstract": "Research in renewable energy.",
  "profile_id": "550e8400-e29b-41d4-a716-446655440001",
  "location": {
    "city": "Boston",
    "state": "MA",
    "country": "USA"
  },
  "website": "https://example.com",
  "climate_tech_focus": ["renewable_energy", "solar"],
  ...
}
```

#### Response
```json
{
  "id": "550e8400-e29b-41d4-a716-4466554440002",
  "url": null,
  "source": "user",
  "created_by_user_id": "550e8400-e29b-41d4-a716-4466554400000",
  "profile_id": "550e8400-e29b-41d4-a716-446655440001",
  "profile": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "user_id": "550e8400-e29b-41d4-a716-4466554400000",
    "is_default": true,
    "type": "lab",
    "display_name": "Dr. John Doe",
    "first_name": "John",
    "last_name": "Doe",
    "bio": "Researching climate change and renewable energy.",
    "title": "Principal Investigator",
    "organization": "MIT",
    "profile_image": "https://s3.amazonaws.com/bucket/path/to/avatar.jpg",
    "created_at": "2026-01-19T10:30:00Z"
  },
  "university": "MIT",
  "research_abstract": "Research in renewable energy.",
  "timestamp": "2026-01-19T10:30:00Z",
  ...
}
```

#### Frontend Implementation

```typescript
interface CreateEntityRequest {
  university: string;
  research_abstract: string;
  profile_id?: string;
  location?: Record<string, any>;
  website?: string;
  climate_tech_focus?: string[];
  // ... other entity fields
}

async function createEntity(entityData: CreateEntityRequest): Promise<void> {
  const response = await fetch('/entities/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(entityData),
  });

  if (!response.ok) {
    const error = await response.json();
    if (error.detail?.includes('Profile not found or not owned by user')) {
      alert('Please select a valid profile.');
    }
    return;
  }

  const entity: Entity = await response.json();

  // Navigate to entity detail page
  navigateToEntity(entity.id);
}
```

### Profile Selection UI

```typescript
function ProfileSelector({ onSelect }: { onSelect: (profileId: string) => void }) {
  const profiles = getProfilesFromStorage();
  const defaultProfileId = localStorage.getItem('default_profile_id');

  return (
    <div className="profile-selector">
      <h3>Select Profile for Entity</h3>
      <select
        defaultValue={defaultProfileId || profiles[0]?.id}
        onChange={(e) => onSelect(e.target.value)}
      >
        {profiles.map(profile => (
          <option key={profile.id} value={profile.id}>
            {profile.display_name || `${profile.first_name} ${profile.last_name}`}
            {profile.is_default && ' (Default)'}
          </option>
        ))}
      </select>
    </div>
  );
}

// Use in entity creation form
function CreateEntityForm() {
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  return (
    <form onSubmit={handleCreateEntity}>
      <ProfileSelector onSelect={setSelectedProfileId} />

      {/* Other entity fields */}
      <input name="university" required />
      <textarea name="research_abstract" required />

      {/* Include selected profile_id in request */}
      <input type="hidden" name="profile_id" value={selectedProfileId} />
    </form>
  );
}
```

---

## Public Profile Viewing

### Entity Public View

When viewing an entity publicly, only the associated profile information should be displayed. User account details are never exposed.

#### Endpoint
```http
GET /entities/{entity_id}
Authorization: Bearer {access_token} (optional)
```

#### Response
```json
{
  "id": "550e8400-e29b-41d4-a716-4466554440002",
  "profile_id": "550e8400-e29b-41d4-a716-446655440001",
  "profile": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "user_id": "550e8400-e29b-41d4-a716-4466554400000",
    "is_default": true,
    "type": "lab",
    "display_name": "Dr. John Doe",
    "first_name": "John",
    "last_name": "Doe",
    "bio": "Researching climate change and renewable energy.",
    "title": "Principal Investigator",
    "organization": "MIT",
    "profile_image": "https://s3.amazonaws.com/bucket/path/to/avatar.jpg",
    "created_at": "2026-01-19T10:30:00Z"
  },
  "university": "MIT",
  "research_abstract": "Research in renewable energy.",
  "note": "No user account details (email, username) are included"
}
```

### Frontend Implementation

```typescript
function EntityPublicView({ entityId }: { entityId: string }) {
  const [entity, setEntity] = useState<Entity | null>(null);

  useEffect(() => {
    async function loadEntity() {
      const response = await fetch(`/entities/${entityId}`);
      const data: Entity = await response.json();
      setEntity(data);
    }
    loadEntity();
  }, [entityId]);

  if (!entity) return <div>Loading...</div>;

  // Display profile information as public identity
  return (
    <div className="entity-public-view">
      {/* Profile Card */}
      {entity.profile && (
        <ProfileCard profile={entity.profile} />
      )}

      {/* Entity Details */}
      <div className="entity-details">
        <h1>{entity.university}</h1>
        <p>{entity.research_abstract}</p>
        {/* Other entity fields */}
      </div>

      {/* Note: User account details are NEVER displayed */}
    </div>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <div className="profile-card">
      <img src={profile.profile_image} alt={profile.display_name} />
      <h2>{profile.display_name || `${profile.first_name} ${profile.last_name}`}</h2>
      <p className="title">{profile.title}</p>
      <p className="organization">{profile.organization}</p>
      <p className="bio">{profile.bio}</p>

      {/* Expertise tags */}
      <div className="expertise">
        {profile.expertise.map(tag => (
          <span key={tag} className="tag">{tag}</span>
        ))}
      </div>

      {/* Social links */}
      <div className="social-links">
        {profile.social_links.linkedin && (
          <a href={profile.social_links.linkedin} target="_blank">
            LinkedIn
          </a>
        )}
        {profile.social_links.twitter && (
          <a href={profile.social_links.twitter} target="_blank">
            Twitter
          </a>
        )}
      </div>
    </div>
  );
}
```

---

## API Endpoints Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Login with username/email and password |
| POST | `/signup` | Create new user account with default profile |
| GET | `/auth/providers` | Get available OAuth providers |
| GET | `/auth/google/login` | Get Google OAuth login URL |
| GET | `/auth/google/callback` | Handle Google OAuth callback |
| GET | `/auth/linkedin/login` | Get LinkedIn OAuth login URL |
| GET | `/auth/linkedin/callback` | Handle LinkedIn OAuth callback |

### Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profiles` | Get user's profiles (or search all profiles) |
| POST | `/profiles` | Create new profile (max 2 total) |
| GET | `/profiles/{profile_id}` | Get specific profile |
| PUT | `/profiles/{profile_id}` | Update profile |
| POST | `/profiles/{profile_id}/set-default` | Set profile as default |
| DELETE | `/profiles/{profile_id}` | Delete profile (default cannot be deleted) |

### Entities

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/entities/` | Create entity with profile association |
| GET | `/entities/` | Get user's entities |
| GET | `/entities/{entity_id}` | Get specific entity with profile |
| PUT | `/entities/{entity_id}` | Update entity |
| DELETE | `/entities/{entity_id}` | Delete entity |
| POST | `/entities/{entity_id}/images` | Upload entity images |
| PATCH | `/entities/{entity_id}/images/{image_id}` | Update image metadata |
| DELETE | `/entities/{entity_id}/images/{image_id}` | Delete image |

---

## Data Models

### Profile Model

```typescript
interface Profile {
  id: string;                    // UUID
  user_id: string;                 // UUID (user owner)
  is_default: boolean;             // true if default profile
  type: string;                    // 'lab', 'entrepreneur', 'academic', 'funder'
  display_name?: string;             // Public display name
  first_name?: string;              // First name
  last_name?: string;               // Last name
  date_of_birth?: string;           // ISO 8601 date
  gender?: string;                  // Gender
  phone?: string;                   // Phone number
  website?: string;                 // Website URL
  title?: string;                   // Professional title
  organization?: string;             // Organization name
  bio: string;                     // Biography (empty string default)
  location: Record<string, any>;    // Location object
  social_links: Record<string, any>;  // Social media links
  expertise: string[];              // Array of expertise tags
  profile_image?: string;           // Profile image URL
  metadata: Record<string, any>;    // Additional metadata
  created_at: string;               // ISO 8601 timestamp
}
```

### Entity Model

```typescript
interface Entity {
  id: string;                           // UUID
  url?: string;                        // Entity URL
  source: string;                       // 'scraped', 'user'
  created_by_user_id?: string;           // UUID (user creator)
  profile_id?: string;                   // UUID (associated profile)
  profile?: Profile;                     // Associated profile object (when fetched with profile data)
  university: string;                   // University name
  location: Record<string, any>;          // Location object
  website?: string;                     // Website URL
  edurank: Record<string, any>;         // EduRank data
  department: Record<string, any>;        // Department data
  publications_meta: Record<string, any>; // Publications metadata
  related: string;                      // Related entities
  point_of_contact: Record<string, any>; // Contact information
  scopes: string[];                     // Research scopes
  research_abstract: string;              // Research abstract
  lab_equipment: Record<string, any>;     // Lab equipment
  climate_tech_focus: string[];          // Climate tech focus areas
  climate_impact_metrics: Record<string, any>; // Impact metrics
  embeddings: Record<string, any> | string[] | null; // Embeddings
  timestamp: string;                     // ISO 8601 timestamp
  last_updated: string;                  // ISO 8601 timestamp
  images: EntityImage[];                 // Entity images
  user_interactions: UserEntityLink[];    // User interactions
  proposals: Proposal[];                 // Proposals
  match_records: MatchRecord[];          // Match records
  verifications: Verification[];           // Verifications
  embeddings_records: EntityEmbedding[];   // Embedding records
  publications_list: Publication[];        // Publications
}
```

---

## Error Handling

### Common Error Codes

| Status | Type | Description |
|--------|------|-------------|
| 400 | Bad Request | Invalid request data or validation error |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Not authorized to access resource |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource (e.g., duplicate username) |
| 500 | Internal Server Error | Server error |

### Profile-Specific Errors

| Error Detail | Resolution |
|-------------|------------|
| "Maximum of 2 profiles allowed" | User has reached the profile limit. Display message and prevent creation. |
| "Cannot delete default profile" | Attempting to delete default profile. Display message and prevent deletion. |
| "Cannot delete only profile" | Attempting to delete the only profile. Display message and prevent deletion. |
| "Profile not found or not owned by user" | Invalid profile selection for entity creation. Display profile selection UI. |

### Entity-Specific Errors

| Error Detail | Resolution |
|-------------|------------|
| "Profile not found or not owned by user" | Invalid profile_id in entity creation. Prompt user to select a valid profile. |
| "Entity not found" | Entity does not exist or user doesn't have access. Redirect or show error. |

### Frontend Error Handling Pattern

```typescript
async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`,
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json();

    // Handle specific error types
    switch (response.status) {
      case 400:
        handleBadRequest(error);
        break;
      case 401:
        handleUnauthorized();
        break;
      case 404:
        handleNotFound(error);
        break;
      default:
        handleGenericError(error);
    }

    throw new Error(error.detail || 'Request failed');
  }

  return await response.json();
}

function handleBadRequest(error: { detail: string }) {
  if (error.detail?.includes('Maximum of 2 profiles')) {
    alert('You have reached the maximum of 2 profiles. Please delete a profile before creating a new one.');
  } else if (error.detail?.includes('Cannot delete default profile')) {
    alert('You cannot delete your default profile. Please set another profile as default first.');
  } else {
    alert(error.detail || 'Invalid request');
  }
}

function handleUnauthorized() {
  // Clear authentication and redirect to login
  localStorage.clear();
  window.location.href = '/login';
}

function handleNotFound(error: { detail: string }) {
  alert(error.detail || 'Resource not found');
  // Optionally redirect back
  window.history.back();
}
```

---

## Best Practices

### Profile Management

1. **Always Display Profile Count**
   - Show the number of profiles (e.g., "1/2 profiles used")
   - Disable "Create Profile" button when at max (2)

2. **Indicate Default Profile Clearly**
   - Use visual indicators (badge, star, icon)
   - Highlight default profile in profile lists
   - Provide easy "Set as Default" option for non-default profiles

3. **Profile Selection for Actions**
   - When creating entities or performing actions, prompt user to select a profile
   - Default to the user's default profile
   - Allow changing the selected profile

4. **Prevent Accidental Deletions**
   - Add confirmation dialogs before profile deletion
   - Show warning when attempting to delete the last profile
   - Show warning when attempting to delete default profile

### Entity Creation

1. **Require Profile Selection**
   - Always include profile selector in entity creation form
   - Validate that selected profile belongs to the user
   - Store the profile_id with the entity

2. **Display Public Profile**
   - Always display the associated profile when showing an entity
   - Never display user account details (email, username)
   - Use profile information for all public-facing UI

3. **Profile-Entity Consistency**
   - Ensure entities maintain their profile association
   - When updating entities, allow profile changes only with proper authorization
   - Respect profile ownership when displaying entity actions

### Data Storage

1. **Store Profile Information Locally**
   - Cache profiles from login response
   - Store default_profile_id for quick access
   - Update local storage on profile CRUD operations

2. **Handle Missing Data Gracefully**
   - If profile fields are missing, display appropriate fallbacks
   - Use user table data as ultimate fallback
   - Show placeholders for missing images

3. **Refresh Strategy**
   - Refresh profiles on login and profile updates
   - Consider implementing a refresh mechanism for stale data
   - Implement optimistic updates for better UX

### Security

1. **Never Expose User Account Data**
   - User email, username, and password are only for authentication
   - Only profile information should be displayed publicly
   - Use profile_id for all associations, not user_id

2. **Validate Profile Ownership**
   - Verify user owns profile before allowing actions
   - Check ownership on the server side
   - Don't rely solely on client-side validation

3. **Profile-Based Authorization**
   - Use profile ownership for entity authorization checks
   - Implement role-based access based on profile type
   - Respect profile ownership when allowing modifications

---

## Testing Checklist

### Authentication Flow

- [ ] Verify login returns profiles array
- [ ] Verify login returns default_profile_id
- [ ] Verify default_profile_id matches a profile with is_default=true
- [ ] Test with user who has 1 profile
- [ ] Test with user who has 2 profiles
- [ ] Test OAuth login (Google/LinkedIn)

### Profile Management

- [ ] Create profile successfully when user has 0-1 profiles
- [ ] Prevent creation when user has 2 profiles
- [ ] Update profile information
- [ ] Set a profile as default
- [ ] Delete non-default profile successfully
- [ ] Prevent deletion of default profile
- [ ] Prevent deletion of only profile

### Entity Creation

- [ ] Create entity with profile_id
- [ ] Verify profile_id is associated profile in response
- [ ] Test with invalid profile_id (should fail)
- [ ] Test without profile_id (should succeed, profile_id null)

### Public Viewing

- [ ] View entity displays associated profile
- [ ] Verify no user account details (email, username) are visible
- [ ] Display profile information correctly
- [ ] Handle entities without associated profile (profile_id null)

### Error Handling

- [ ] 400 errors display appropriate messages
- [ ] 401 errors redirect to login
- [ ] 404 errors handle gracefully
- [ ] Profile limit errors prevent creation
- [ ] Profile deletion errors prevent deletion

---

## Quick Reference

### Common Profile Operations

```typescript
// Get profiles from login response
const profiles: Profile[] = loginResponse.profiles;

// Get default profile
const defaultProfileId: string = loginResponse.default_profile_id;
const defaultProfile: Profile = profiles.find(p => p.id === defaultProfileId);

// Check if user can create more profiles
const canCreateProfile = profiles.length < 2;

// Check if profile is default
const isDefault = (profileId: string): boolean => {
  const profiles = getProfilesFromStorage();
  const profile = profiles.find(p => p.id === profileId);
  return profile?.is_default || false;
};

// Get profile fallback name
const getProfileDisplayName = (profile: Profile): string => {
  if (profile.display_name) return profile.display_name;
  if (profile.first_name || profile.last_name) {
    return `${profile.first_name} ${profile.last_name}`.trim();
  }
  return 'Anonymous';
};
```

### Common Entity Operations

```typescript
// Create entity with profile
const createEntity = (entityData: CreateEntityRequest, profileId: string) => {
  return apiRequest('/entities/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...entityData, profile_id })
  });
};

// Display profile on entity page
const displayProfileInfo = (entity: Entity) => {
  if (!entity.profile) return null;

  return (
    <div className="entity-profile">
      <img src={entity.profile.profile_image} />
      <h3>{getProfileDisplayName(entity.profile)}</h3>
      <p>{entity.profile.title}</p>
      <p>{entity.profile.organization}</p>
    </div>
  );
};
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-19 | Initial documentation for Profile & Entity Association features |

---

## Support

For questions or issues with this integration guide, please contact the backend team or refer to the API documentation.
