# Next.js Frontend Integration Guide

## Overview

This guide provides comprehensive instructions for integrating a **Next.js frontend** with the Unlokinno Intelligence backend API.

---

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Authentication](#authentication)
3. [Event Registration](#event-registration)
4. [Social Login (OAuth)](#social-login-oauth)
5. [Password Reset](#password-reset)
6. [Entities & Research](#entities--research)
7. [Profiles](#profiles)
8. [Messaging](#messaging)
9. [Events](#events)
10. [WebSockets](#websockets)
11. [Environment Variables](#environment-variables)
12. [TypeScript Interfaces](#typescript-interfaces)
13. [Error Handling](#error-handling)
14. [Best Practices](#best-practices)

---

## API Endpoints

### Base URL
```
Development: http://localhost:8000/api
Production: https://your-domain.com/api
```

### Authentication Methods

All protected endpoints require:
- Bearer token in `Authorization` header
- OR `user_id` query parameter with valid token

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Using Bearer token
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// Using user_id query param
const url = `${API_BASE_URL}/protected-endpoint?user_id=${userId}`;
```

---

## Authentication

### 1. Login

**Endpoint:** `POST /api/login`

**Request:**
```typescript
interface LoginRequest {
  username?: string;
  email?: string;
  password: string;
  recaptchaResponse: string;
}

const loginData = {
  email: 'user@example.com',
  password: 'your-password',
  recaptchaResponse: 'recaptcha-token-from-google'
};
```

**Response:**
```typescript
interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
}
```

**Next.js Implementation:**
```typescript
// app/actions/auth.ts
'use server';

import { cookies } from 'next/headers';

export async function login(formData: FormData) {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password'),
        recaptchaResponse: formData.get('recaptchaResponse')
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Store token in cookies (httpOnly for security)
      const cookieStore = await cookies();
      cookieStore.set('access_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 // 24 hours
      });
      cookieStore.set('user_id', data.user_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24
      });

      return { success: true, user_id: data.user_id };
    }

    return { success: false, error: data.detail };
  } catch (error) {
    return { success: false, error: 'Login failed' };
  }
}
```

### 2. Signup (Optional Account Creation)

**Endpoint:** `POST /api/signup`

**Request:**
```typescript
interface SignupRequest {
  username: string;
  email: string;
  password: string;
  recaptchaResponse: string;
}
```

**Response:**
```typescript
interface SignupResponse {
  access_token: string;
  token_type: string;
  user_id: string;
}
```

### 3. Token Verification

**Endpoint:** `GET /api/verify-token`

**Response:**
```typescript
interface TokenVerification {
  user_id: string;
}
```

### 4. Logout

**Client-side only:** Clear cookies/localStorage

```typescript
// app/actions/auth.ts
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('access_token');
  cookieStore.delete('user_id');
  redirect('/login');
}
```

---

## Event Registration (Profile-First Flow)

### 1. Register for Event (Guest Checkout)

**Endpoint:** `POST /api/admin/events/{event_id}/register`

**Request:** (FormData)
```typescript
interface EventRegistrationRequest {
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  position?: string;
  organization?: string;
  participation_type: 'attendee' | 'jury' | 'speaker' | 'idea_holder';
  attendance_type: 'on_site' | 'remote' | 'hybrid';
  ticket_type?: string;
  wants_profile_visible: boolean;
  profile_visibility_types: string[];
  special_requirements?: string;
  create_account: boolean;
  new_password?: string;  // Only if create_account is true
}
```

**Response:**
```typescript
interface EventRegistrationResponse {
  id: string;
  event_id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  position?: string;
  organization?: string;
  participation_type: string;
  attendance_type: string;
  ticket_type?: string;
  wants_profile_visible: boolean;
  profile_visibility_types: string[];
  status: string;  // pending, confirmed, cancelled, waitlisted
  registration_date: string;
  checked_in_at?: string;
}
```

**Next.js Implementation:**
```typescript
// app/events/[eventId]/register/page.tsx
'use client';

import { useState } from 'react';

export default function EventRegisterPage({ params }: { params: { eventId: string } }) {
  const [formData, setFormData] = useState<EventRegistrationRequest>({
    event_id: params.eventId,
    first_name: '',
    last_name: '',
    email: '',
    participation_type: 'attendee',
    attendance_type: 'on_site',
    wants_profile_visible: true,
    profile_visibility_types: [],
    create_account: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const form = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'profile_visibility_types' && Array.isArray(value)) {
        value.forEach((type: string) => form.append('profile_visibility_types', `["${type}"]`));
      } else if (value) {
        form.append(key, String(value));
      }
    });

    const response = await fetch(`/api/admin/events/${params.eventId}/register`, {
      method: 'POST',
      body: form
    });

    const data = await response.json();

    if (response.ok) {
      // Registration successful
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        // Show success message
        alert('Registration successful! Check your email for confirmation.');
        window.location.href = '/dashboard';
      }
    } else {
      alert(data.detail || 'Registration failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="first_name"
        placeholder="First Name"
        required
        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
      />
      <input
        name="last_name"
        placeholder="Last Name"
        required
        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
      />
      <input
        type="email"
        name="email"
        placeholder="Email Address"
        required
        onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
      />
      <select
        name="participation_type"
        value={formData.participation_type}
        onChange={(e) => setFormData({ ...formData, participation_type: e.target.value as any })}
      >
        <option value="attendee">Attendee</option>
        <option value="jury">Jury / Judge</option>
        <option value="speaker">Speaker</option>
        <option value="idea_holder">Idea Holder</option>
      </select>
      <select
        name="attendance_type"
        value={formData.attendance_type}
        onChange={(e) => setFormData({ ...formData, attendance_type: e.target.value as any })}
      >
        <option value="on_site">On-site (In Person)</option>
        <option value="remote">Remote / Virtual</option>
        <option value="hybrid">Hybrid</option>
      </select>

      <label>
        <input
          type="checkbox"
          name="wants_profile_visible"
          checked={formData.wants_profile_visible}
          onChange={(e) => setFormData({ ...formData, wants_profile_visible: e.target.checked })}
        />
        Make my profile visible to other attendees
      </label>

      <fieldset>
        <legend>Show as:</legend>
        <label>
          <input
            type="checkbox"
            name="profile_visibility_types"
            value="attendee"
            onChange={(e) => {
              const types = formData.profile_visibility_types.includes('attendee')
                ? formData.profile_visibility_types.filter(t => t !== 'attendee')
                : [...formData.profile_visibility_types, 'attendee'];
              setFormData({ ...formData, profile_visibility_types: types });
            }}
          />
          Attendee
        </label>
        <label>
          <input
            type="checkbox"
            name="profile_visibility_types"
            value="jury"
          />
          Jury / Judge
        </label>
        <label>
          <input
            type="checkbox"
            name="profile_visibility_types"
            value="speaker"
          />
          Speaker
        </label>
        <label>
          <input
            type="checkbox"
            name="profile_visibility_types"
            value="idea_holder"
          />
          Idea Holder
        </label>
      </fieldset>

      <label>
        <input
          type="checkbox"
          name="create_account"
          checked={formData.create_account}
          onChange={(e) => setFormData({ ...formData, create_account: e.target.checked })}
        />
        Create an account to manage my profile later
      </label>

      {formData.create_account && (
        <input
          type="password"
          name="new_password"
          placeholder="Create a password (optional)"
          minLength={8}
        />
      )}

      <button type="submit">Complete Registration</button>
    </form>
  );
}
```

### 2. Get Event Registrations (Admin)

**Endpoint:** `GET /api/admin/events/{event_id}/registrations`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)
- `search`: Search term (searches name, email, organization)

**Response:**
```typescript
interface PaginatedRegistrations {
  items: EventRegistrationResponse[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
```

### 3. Update Registration Status

**Endpoint:** `PATCH /api/admin/events/registrations/{registration_id}/status`

**Request:** (FormData)
```typescript
{
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted'
}
```

**Response:**
```typescript
EventRegistrationResponse
```

### 4. Import Attendees from CSV (Admin)

**Endpoint:** `POST /api/admin/events/import-attendees`

**Request:** (FormData with file)

**CSV Format:**
```csv
first_name,last_name,email,position,organization,participation_type,attendance_type,wants_profile_visible,profile_visibility_types
John,Doe,john@example.com,Researcher,University of Nairobi,attendee,on_site,true,"["attendee"]"
Jane,Smith,jane@example.com,Entrepreneur,ACME Corp,idea_holder,remote,true,"["idea_holder"]"
```

**Response:**
```typescript
interface ImportResult {
  created: number;
  updated: number;
  existing: number;
  errors: number;
}
```

---

## Social Login (OAuth)

### 1. Get Available OAuth Providers

**Endpoint:** `GET /api/auth/providers`

**Response:**
```typescript
interface OAuthProvider {
  name: 'google' | 'linkedin';
  display_name: string;
  login_url: string;
  auth_url: string;
}

interface ProvidersResponse {
  providers: OAuthProvider[];
}
```

### 2. Google OAuth

**Step 1: Redirect to Google**

**Endpoint:** `GET /api/auth/google/login`

**Response:**
```typescript
interface GoogleAuthRedirect {
  auth_url: string;
  provider: string;
}
```

**Step 2: Handle OAuth Callback**

**Endpoint:** `GET /api/auth/google/callback`

**Query Parameters:**
- `code`: Authorization code from Google
- `state`: CSRF token (optional)

**Response:**
```typescript
interface OAuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  existing_user: boolean;
  profile_id?: string;
  message: string;
}
```

**Next.js Implementation:**
```typescript
// app/actions/oauth.ts
'use server';

export async function initiateGoogleOAuth() {
  const response = await fetch(`${API_BASE_URL}/auth/google/login`);
  const data = await response.json();
  redirect(data.auth_url);
}

// app/auth/google/callback/page.tsx
export default async function GoogleOAuthCallbackPage({
  searchParams
}: {
  searchParams: { code?: string; state?: string }
}) {
  const { code } = searchParams;

  if (!code) {
    redirect('/login?error=oauth_failed');
  }

  const response = await fetch(
    `${API_BASE_URL}/auth/google/callback?code=${code}`,
    { method: 'GET' }
  );

  const data: OAuthResponse = await response.json();

  if (response.ok) {
    // Store tokens
    const cookieStore = await cookies();
    cookieStore.set('access_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24
    });
    cookieStore.set('user_id', data.user_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24
    });

    // If new user created, prompt for password
    if (!data.existing_user && data.message.includes('set your password')) {
      redirect('/auth/set-password?user_id=' + data.user_id);
    } else {
      redirect('/dashboard');
    }
  } else {
    redirect('/login?error=oauth_failed');
  }
}
```

### 3. LinkedIn OAuth

**Endpoint:** `GET /api/auth/linkedin/login`

**Response:** Same as Google

**Callback:** `GET /api/auth/linkedin/callback`

### 4. Set Password for OAuth Users

**Endpoint:** `POST /api/auth/oauth/set-password`

**Request:**
```typescript
{
  password: string;  // Minimum 8 characters
}
```

**Response:**
```typescript
{
  message: string;
}
```

---

## Password Reset

### 1. Forgot Password

**Endpoint:** `POST /api/forgot-password`

**Request:**
```typescript
interface ForgotPasswordRequest {
  email: string;
  recaptchaResponse: string;
}
```

**Response:**
```typescript
interface PasswordResetResponse {
  message: string;
  email_sent: boolean;
}
```

**Next.js Implementation:**
```typescript
// app/forgot-password/page.tsx
'use client';

import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const response = await fetch(`${API_BASE_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        recaptchaResponse: window.grecaptcha?.getResponse()
      })
    });

    const data = await response.json();

    if (response.ok) {
      setMessage(data.message);
    } else {
      setMessage(data.detail || 'Failed to send reset email');
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Forgot Password</h1>
      <p>Enter your email address and we'll send you a link to reset your password.</p>
      <input
        type="email"
        placeholder="Email Address"
        required
        onChange={(e) => setEmail(e.target.value)}
      />
      <div id="recaptcha-container" className="g-recaptcha"></div>
      {message && <p>{message}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Reset Link'}
      </button>
      <Link href="/login">Back to Login</Link>
    </form>
  );
}
```

### 2. Reset Password

**Endpoint:** `POST /api/reset-password`

**Request:**
```typescript
interface ResetPasswordRequest {
  token: string;
  new_password: string;
  recaptchaResponse: string;
}
```

**Response:**
```typescript
{
  message: string;
}
```

**Next.js Implementation:**
```typescript
// app/reset-password/page.tsx
'use client';

import { useState, useEffect } from 'react';

export default function ResetPasswordPage({
  searchParams
}: {
  searchParams: { token?: string }
}) {
  const [token, setToken] = useState(searchParams.token || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validToken, setValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    // Validate token on page load
    validateToken();
  }, [token]);

  const validateToken = async () => {
    const response = await fetch(
      `${API_BASE_URL}/reset-password/validate?token=${token}`
    );
    const data = await response.json();
    setValidToken(data.valid);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const response = await fetch(`${API_BASE_URL}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        new_password: newPassword,
        recaptchaResponse: window.grecaptcha?.getResponse()
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert('Password reset successfully! You can now login.');
      window.location.href = '/login';
    } else {
      setError(data.detail || 'Failed to reset password');
    }

    setLoading(false);
  };

  if (validToken === null) return <div>Loading...</div>;
  if (!validToken) return <div>Invalid or expired reset link</div>;

  return (
    <form onSubmit={handleSubmit}>
      <h1>Reset Password</h1>
      <input
        type="password"
        placeholder="New Password"
        required
        minLength={8}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <input
        type="password"
        placeholder="Confirm Password"
        required
        minLength={8}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      <div id="recaptcha-container" className="g-recaptcha"></div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
      <Link href="/login">Back to Login</Link>
    </form>
  );
}
```

### 3. Validate Reset Token (Pre-validation)

**Endpoint:** `GET /api/reset-password/validate?token={token}`

**Response:**
```typescript
interface TokenValidation {
  valid: boolean;
  message: string;
  email?: string;
}
```

---

## Entities & Research

### 1. Get User History

**Endpoint:** `GET /api/history/{user_id}`

**Response:** (Streaming JSON array of user sessions and entities)

### 2. Create Query

**Endpoint:** `POST /api/query`

**Request:**
```typescript
interface QueryRequest {
  query: string;
  max_depth?: number;
  max_workers?: number;
  max_urls?: number;
  timeout_seconds?: number;
}
```

**Response:**
```typescript
interface QueryResponse {
  id: string;
  session_id: string;
  query_text: string;
  entities: EntityResponse[];
}
```

### 3. Get Entity

**Endpoint:** `GET /api/entities/{entity_id}`

**Response:**
```typescript
interface EntityResponse {
  id: string;
  university: string;
  url: string;
  research_abstract: string;
  location: Record<string, any>;
  point_of_contact: Record<string, any>;
  // ... more fields
}
```

---

## Profiles

### 1. Get User Profiles

**Endpoint:** `GET /api/profiles?user_id={user_id}`

**Response:**
```typescript
interface ProfileResponse {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  type: 'lab' | 'entrepreneur' | 'academic' | 'funder';
  title: string;
  organization: string;
  bio: string;
  profile_image: string;
  location: Record<string, any>;
  social_links: Record<string, any>;
  expertise: string[];
}
```

### 2. Update Profile

**Endpoint:** `PUT /api/profiles/{profile_id}`

**Request:** (FormData with optional fields)

---

## Messaging

### 1. Get Messages

**Endpoint:** `GET /api/messages?profile_id={profile_id}`

**Response:**
```typescript
interface MessageResponse {
  id: string;
  sender_profile_id: string;
  receiver_profile_id: string;
  content: string;
  created_at: string;
  // ... more fields
}
```

---

## Events

### 1. Get Upcoming Events (Public)

**Endpoint:** `GET /api/events/upcoming`

**Query Parameters:**
- `limit`: Items per page (default: 20, min: 1, max: 100)
- `page`: Page number (default: 1, min: 1)
- `featured`: Filter featured events (true/false)
- `location_type`: Filter by location type ('physical' | 'virtual' | 'hybrid')
- `category_ids`: Filter by category IDs (array)
- `from_date`: Filter events from this date onwards
- `sort_by`: Sort order ('date' | 'priority' | 'created')

**Response:**
```typescript
interface PaginatedEventResponse {
  items: EventResponse[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

interface EventResponse {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description: string;
  event_datetime: string;  // ISO 8601 with timezone
  timezone: string;
  location_type: 'physical' | 'virtual' | 'hybrid';
  physical_location: string | null;
  virtual_link: string | null;
  registration_url: string | null;
  featured_image_url: string | null;
  banner_image_url: string | null;
  is_published: boolean;
  is_featured: boolean;
  priority: number;
  categories: EventCategory[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface EventCategory {
  id: string;
  name: string;
  slug: string;
  color_code: string;
}
```

**Next.js Implementation:**
```typescript
// app/events/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { EventResponse, PaginatedEventResponse } from '@/types/api';

export default function EventsPage() {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, [page]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/events/upcoming?page=${page}&limit=20`
      );
      const data: PaginatedEventResponse = await response.json();
      setEvents(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading events...</div>;

  return (
    <div>
      <h1>Upcoming Events</h1>
      {events.length === 0 ? (
        <p>No upcoming events found</p>
      ) : (
        <div className="events-grid">
          {events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="pagination">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * 20 >= total}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

### 2. Get Event by Slug (Public)

**Endpoint:** `GET /api/events/{event_slug}`

**Response:**
```typescript
EventResponse
```

**Next.js Implementation:**
```typescript
// app/events/[slug]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { EventResponse } from '@/types/api';

export default function EventDetailPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvent();
  }, [params.slug]);

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/events/${params.slug}`
      );
      if (response.ok) {
        const data: EventResponse = await response.json();
        setEvent(data);
      }
    } catch (error) {
      console.error('Failed to fetch event:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading event...</div>;
  if (!event) return <div>Event not found</div>;

  return (
    <div>
      <h1>{event.title}</h1>
      <p>{event.short_description}</p>
      <div className="event-details">
        <div>
          <strong>Date:</strong> {new Date(event.event_datetime).toLocaleString()}
        </div>
        <div>
          <strong>Location:</strong> {event.location_type === 'physical'
            ? event.physical_location
            : event.virtual_link}
        </div>
        {event.categories.length > 0 && (
          <div className="categories">
            <strong>Categories:</strong>
            {event.categories.map(cat => (
              <span key={cat.id} style={{ backgroundColor: cat.color_code }}>
                {cat.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <p>{event.description}</p>

      {event.featured_image_url && (
        <img src={event.featured_image_url} alt={event.title} />
      )}

      <Link href={`/events/${event.slug}/register`}>
        <button>Register Now</button>
      </Link>
    </div>
  );
}
```

### 3. Get Banner Events

**Endpoint:** `GET /api/events/banner/events`

**Response:**
```typescript
interface EventBanner {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  event_datetime: string;
  banner_image_url: string | null;
  is_featured: boolean;
  priority: number;
}
```

### 4. Get Event Categories

**Endpoint:** `GET /api/event-categories`

**Response:**
```typescript
EventCategory[]
```

### 5. Create Event (Admin - Protected)

**Endpoint:** `POST /api/admin/events`

**Request:**
```typescript
interface EventCreate {
  title: string;
  description: string;
  short_description: string;
  event_datetime: string;  // ISO 8601 with timezone
  timezone: string;  // IANA timezone (e.g., 'UTC', 'America/New_York')
  location_type: 'physical' | 'virtual' | 'hybrid';
  physical_location?: string;
  virtual_link?: string;
  registration_url?: string;
  categories?: string[];  // Category IDs
  featured_image_url?: string;
  banner_image_url?: string;
}
```

**Response:**
```typescript
EventResponse
```

### 6. Update Event (Admin - Protected)

**Endpoint:** `PATCH /api/admin/events/{event_id}`

**Request:** (Partial EventCreate)

**Response:**
```typescript
EventResponse
```

### 7. Publish Event (Admin - Protected)

**Endpoint:** `POST /api/admin/events/{event_id}/publish`

**Response:**
```typescript
{
  message: string;
}
```

### 8. Unpublish Event (Admin - Protected)

**Endpoint:** `POST /api/admin/events/{event_id}/unpublish`

**Response:**
```typescript
{
  message: string;
}
```

### 9. Delete Event (Admin - Protected)

**Endpoint:** `DELETE /api/admin/events/{event_id}`

**Note:** This is a soft delete (sets is_published = false)

**Response:**
```typescript
{
  message: string;
}
```

### 10. Get Event Registrations (Admin - Protected)

**Endpoint:** `GET /api/admin/events/{event_id}/registrations`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)
- `search`: Search term (searches name, email, organization)

**Response:**
```typescript
interface PaginatedRegistrations {
  items: EventRegistration[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

interface EventRegistration {
  id: string;
  event_id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  position: string | null;
  organization: string | null;
  participation_type: 'attendee' | 'jury' | 'speaker' | 'idea_holder';
  attendance_type: 'on_site' | 'remote' | 'hybrid';
  ticket_type: string | null;
  wants_profile_visible: boolean;
  profile_visibility_types: string[];
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted';
  registration_date: string;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
}
```

### 11. Update Registration Status (Admin - Protected)

**Endpoint:** `PATCH /api/admin/events/registrations/{registration_id}/status`

**Request:**
```typescript
{
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted'
}
```

**Response:**
```typescript
EventRegistration
```

### 12. Import Attendees from CSV (Admin - Protected)

**Endpoint:** `POST /api/admin/events/import-attendees`

**Request:** (FormData with file upload)

**CSV Format:**
```csv
first_name,last_name,email,position,organization,participation_type,attendance_type,wants_profile_visible,profile_visibility_types
John,Doe,john@example.com,Researcher,University of Nairobi,attendee,on_site,true,"[""attendee""]"
Jane,Smith,jane@example.com,Entrepreneur,ACME Corp,idea_holder,remote,true,"[""idea_holder""]"
```

**Response:**
```typescript
interface ImportResult {
  created: number;
  updated: number;
  existing: number;
  errors: number;
}
```

### 13. Upload Event Image (Admin - Protected)

**Endpoint:** `POST /api/admin/events/{event_id}/images/{image_type}`

**Path Parameters:**
- `image_type`: 'featured' or 'banner'

**Request:** (FormData with file)

**Response:**
```typescript
{
  message: string;
  image_url: string;
}
```

### 14. Delete Event Image (Admin - Protected)

**Endpoint:** `DELETE /api/admin/events/{event_id}/images/{image_type}`

**Path Parameters:**
- `image_type`: 'featured' or 'banner'

**Response:**
```typescript
{
  message: string;
}
```

---

## WebSockets

### WebSocket Connection

**Endpoint:** `ws://localhost:8000/ws/{session_id}`

**Messages:**

**1. Status Update**
```typescript
interface WSStatusMessage {
  type: 'status';
  status: 'started' | 'progress' | 'completed' | 'error';
  message?: string;
  progress?: number;
}
```

**2. Entity Found**
```typescript
interface WSEntityMessage {
  type: 'entity_found';
  entity: EntityResponse;
}
```

**3. Query Complete**
```typescript
interface WSQueryCompleteMessage {
  type: 'query_complete';
  session_id: string;
  total_entities: number;
}
```

**Next.js Implementation:**
```typescript
// app/hooks/useWebSocket.ts
import { useEffect, useRef } from 'react';

export function useWebSocket(sessionId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<WSMessage[]>([]);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${sessionId}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const message: WSMessage = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);

      // Handle different message types
      switch (message.type) {
        case 'status':
          console.log('Status:', message.status);
          break;
        case 'entity_found':
          console.log('Entity found:', message.entity);
          break;
        case 'query_complete':
          console.log('Query complete:', message.total_entities);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    wsRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [sessionId]);

  return { messages, ws: wsRef.current };
}
```

---

## Environment Variables

Add to `.env.local` or Vercel/Netlify environment:

```bash
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_API_URL=https://production-api.com/api

# reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key

# OAuth (if implementing OAuth redirect handling)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_LINKEDIN_CLIENT_ID=your-linkedin-client-id

# Application
NEXT_PUBLIC_APP_NAME=Unlokinno Intelligence
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## TypeScript Interfaces

Create `types/api.ts`:

```typescript
// types/api.ts
export interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  profile_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  type: 'lab' | 'entrepreneur' | 'academic' | 'funder';
  title: string;
  organization: string;
  bio: string;
  profile_image: string | null;
  location: Record<string, any>;
  social_links: Record<string, any>;
  expertise: string[];
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description: string;
  event_datetime: string;
  timezone: string;
  location_type: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID';
  physical_location: string | null;
  virtual_link: string | null;
  featured_image_url: string | null;
  banner_image_url: string | null;
  is_published: boolean;
  is_featured: boolean;
  categories: EventCategory[];
  created_at: string;
  updated_at: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  position: string | null;
  organization: string | null;
  participation_type: 'attendee' | 'jury' | 'speaker' | 'idea_holder';
  attendance_type: 'on_site' | 'remote' | 'hybrid';
  ticket_type: string | null;
  wants_profile_visible: boolean;
  profile_visibility_types: string[];
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted';
  registration_date: string;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: number;
  university: string;
  url: string;
  research_abstract: string;
  location: Record<string, any>;
  point_of_contact: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  username?: string;
  email?: string;
  password: string;
  recaptchaResponse: string;
}

export interface SignupCredentials {
  username: string;
  email: string;
  password: string;
  recaptchaResponse: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
}

export interface OAuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  existing_user: boolean;
  profile_id?: string;
  message: string;
}

export interface ForgotPasswordResponse {
  message: string;
  email_sent: boolean;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
  recaptchaResponse: string;
}

export interface PasswordResetValidation {
  valid: boolean;
  message: string;
  email?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface EventCategory {
  id: string;
  name: string;
  slug: string;
  color_code: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## Error Handling

### API Error Responses

```typescript
interface APIError {
  detail: string;
}

// Example error responses:
{
  "detail": "User not found"
}
{
  "detail": "Invalid or expired reset token"
}
{
  "detail": "Email already exists"
}
```

### Next.js Error Handling

```typescript
// lib/api.ts
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

    if (!response.ok) {
      const error: APIError = await response.json();

      // Handle specific error codes
      switch (response.status) {
        case 401:
          throw new Error('Unauthorized - Please login again');
        case 403:
          throw new Error('Forbidden - You do not have permission');
        case 404:
          throw new Error('Not found - The requested resource was not found');
        case 429:
          throw new Error('Too many requests - Please try again later');
        default:
          throw new Error(error.detail || 'An error occurred');
      }
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error - Please check your connection');
  }
}

// Usage:
const user = await apiRequest<LoginResponse>('/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(credentials)
});
```

---

## Best Practices

### 1. Token Management

```typescript
// lib/auth.ts
import { cookies } from 'next/headers';

export async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value;
}

export async function setAuthToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 // 24 hours
  });
}

export async function clearAuthToken() {
  const cookieStore = await cookies();
  cookieStore.delete('access_token');
}
```

### 2. API Request Wrapper

```typescript
// lib/api.ts (continued)
export async function authenticatedRequest<T>(
  endpoint: string,
  options: Omit<RequestInit, 'headers'> = {}
): Promise<T> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
}

// Usage:
const profiles = await authenticatedRequest<ProfileResponse[]>('/profiles?user_id=' + userId);
```

### 3. Loading States

```typescript
// Example: Event Registration Form
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleRegistration = async () => {
  setLoading(true);
  setError(null);

  try {
    await apiRequest('/events/123/register', {
      method: 'POST',
      body: formData
    });
    // Success
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

return (
  <form onSubmit={handleRegistration}>
    {error && <div className="error">{error}</div>}
    <button type="submit" disabled={loading}>
      {loading ? 'Registering...' : 'Complete Registration'}
    </button>
  </form>
);
```

### 4. reCAPTCHA Integration

```typescript
// app/components/Recaptcha.tsx
'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    grecaptcha: {
      render: (container: string, params: any) => void;
      execute: () => string;
      getResponse: () => string;
      reset: () => void;
    };
  }
}

export function Recaptcha() {
  useEffect(() => {
    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=explicit`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.grecaptcha) {
        window.grecaptcha.render('recaptcha-container', {
          sitekey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
          callback: (token: string) => {
            console.log('reCAPTCHA verified:', token);
          }
        });
      }
    };
  }, []);

  return <div id="recaptcha-container"></div>;
}
```

### 5. Pagination

```typescript
// app/hooks/usePagination.ts
export function usePagination<T>(fetchFn: (page: number, limit: number) => Promise<{ items: T[]; total: number }>) {
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadPage = async (newPage: number) => {
    const result = await fetchFn(newPage, limit);
    setData(result.items);
    setTotal(result.total);
    setPage(newPage);
  };

  const nextPage = () => {
    if (page * limit < total) {
      loadPage(page + 1);
    }
  };

  const prevPage = () => {
    if (page > 1) {
      loadPage(page - 1);
    }
  };

  return { data, page, total, limit, loadPage, nextPage, prevPage, pages: Math.ceil(total / limit) };
}
```

---

## Quick Start Checklist

### For Backend Developers

1. **Install Dependencies (if not already installed)**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run Database Migrations**
   ```bash
   cd "C:\Users\Daniel\Documents\UaiAgent\latest_UI"
   python -m alembic upgrade head
   ```

3. **Configure Environment Variables**
   - Check `.env` has all required variables
   - Add OAuth credentials for Google/LinkedIn (optional)
   - Verify SMTP configuration for password reset emails

4. **Test API Endpoints**
   ```bash
   # Start server
   python main.py

   # Test endpoints
   # - Login: POST /api/login
   # - Event registration: POST /api/admin/events/{id}/register
   # - Forgot password: POST /api/forgot-password
   # - Events list: GET /api/events/upcoming
   ```

### For Frontend Developers (Next.js)

1. **Install Next.js 14+ with App Router**
   ```bash
   npx create-next-app@latest my-app --typescript
   cd my-app
   npm install
   ```

2. **Set up environment variables** (`/.env.local`)
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:8000/api
   NEXT_PUBLIC_API_URL=https://production-api.com/api
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
   NEXT_PUBLIC_LINKEDIN_CLIENT_ID=your-linkedin-client-id
   ```

3. **Follow `NEXTJS_INTEGRATION_GUIDE.md`**
   - [x] Read complete integration guide
   - [x] Create API request wrapper (`lib/api.ts`)
   - [x] Create TypeScript interfaces (`types/api.ts`)
   - [ ] Implement authentication (login/signup/logout)
   - [ ] Implement event registration (guest checkout)
   - [ ] Implement forgot password flow
   - [ ] Set up token management (cookies)
   - [ ] Configure reCAPTCHA
   - [ ] Implement social login buttons
   - [ ] Set up WebSocket connections
   - [ ] Create responsive layouts

4. **Test All Flows**
   - [ ] Login with email/password
   - [ ] Login with OAuth (Google/LinkedIn)
   - [ ] Event registration (guest checkout)
   - [ ] Event registration with account creation
   - [ ] Forgot password request
   - [ ] Password reset with token
   - [ ] Profile management
   - [ ] WebSocket real-time updates
   - [ ] Events list display
   - [ ] Event detail page
   - [ ] Event registration form

---

## Database Migration

**Required before frontend integration:**

Run the migration to create `event_registrations` and `password_resets` tables:

```bash
cd "C:\Users\Daniel\Documents\UaiAgent\latest_UI"
python -m alembic upgrade head
```

---

## Testing

### Manual Testing

```bash
# Test login
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","recaptchaResponse":"test"}'

# Test event registration
curl -X POST http://localhost:8000/api/admin/events/123/register \
  -F "first_name=John" \
  -F "last_name=Doe" \
  -F "email=john@example.com" \
  -F "participation_type=attendee" \
  -F "attendance_type=on_site"

# Test forgot password
curl -X POST http://localhost:8000/api/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","recaptchaResponse":"test"}'

# Test events list
curl -X GET http://localhost:8000/api/events/upcoming

# Test event by slug
curl -X GET http://localhost:8000/api/events/sample-event-slug

# Test OAuth providers
curl -X GET http://localhost:8000/api/auth/providers
```

---

## Frontend Implementation Checklist

### Phase 1: Setup & Configuration
- [ ] Create Next.js 14+ project with TypeScript
- [ ] Install dependencies: `axios`, `date-fns`, `react-hook-form`, `zod`
- [ ] Set up environment variables
- [ ] Create folder structure:
  ```
  app/
    ├── actions/
    │   ├── auth.ts
    │   ├── events.ts
    │   └── oauth.ts
    ├── components/
    │   ├── ui/
    │   ├── forms/
    │   ├── events/
    │   └── auth/
    ├── hooks/
    ├── lib/
    │   ├── api.ts
    │   ├── auth.ts
    │   └── utils.ts
    └── types/
        └── api.ts
  ```

### Phase 2: Core Infrastructure
- [ ] Create API request wrapper (`lib/api.ts`)
- [ ] Create TypeScript interfaces (`types/api.ts`)
- [ ] Create auth utilities (`lib/auth.ts`)
- [ ] Create custom hooks:
  - `useAuth()` - for authentication state
  - `useEvents()` - for events fetching
  - `usePagination()` - for paginated data
  - `useWebSocket()` - for real-time updates
- [ ] Create reusable UI components:
  - Button
  - Input
  - Form
  - Modal
  - Card
  - LoadingSpinner

### Phase 3: Authentication Pages
- [ ] Login page (`/login`)
  - Email/password form
  - Google OAuth button
  - LinkedIn OAuth button
  - "Forgot password" link
  - "Sign up" link
- [ ] Signup page (`/signup`)
  - Username, email, password form
  - Terms and conditions
  - reCAPTCHA integration
- [ ] Forgot password page (`/forgot-password`)
  - Email input
  - reCAPTCHA integration
  - Success message
- [ ] Reset password page (`/reset-password`)
  - Token validation
  - New password form
  - Confirm password
  - reCAPTCHA integration
- [ ] OAuth callback pages:
  - `/auth/google/callback`
  - `/auth/linkedin/callback`
- [ ] Set password page (`/auth/set-password`)
  - For OAuth users who want to set password
- [ ] Logout functionality

### Phase 4: Events Pages (Public)
- [ ] Events list page (`/events`)
  - Filter by category
  - Filter by location type
  - Filter by featured
  - Search by date
  - Pagination
  - Event cards with:
    - Image
    - Title
    - Date
    - Location
    - Category badges
- [ ] Event detail page (`/events/[slug]`)
  - Event information
  - Registration form or button
  - Categories display
  - Location information
  - Event description
- [ ] Event registration page (`/events/[eventId]/register`)
  - Guest registration form
  - Optional account creation
  - Profile visibility options
  - Success message
- [ ] Events banner on homepage
  - Display featured/upcoming events
  - Carousel or grid layout

### Phase 5: Admin Dashboard (Protected)
- [ ] Dashboard home (`/admin/dashboard`)
  - Event statistics
  - Recent registrations
  - Quick actions
- [ ] Events management (`/admin/events`)
  - List all events
  - Create event button
  - Filter by status (published/unpublished)
  - Pagination
- [ ] Create/Edit event form (`/admin/events/new`, `/admin/events/[id]/edit`)
  - Event details form
  - Date/time picker with timezone
  - Location type selector
  - Category selection
  - Image upload (featured and banner)
  - Preview mode
- [ ] Event detail page (`/admin/events/[id]`)
  - View event details
  - Publish/Unpublish buttons
  - Edit button
  - Delete button
- [ ] Event registrations (`/admin/events/[id]/registrations`)
  - List registrations
  - Search by name/email
  - Update status (confirmed/cancelled/waitlisted)
  - Check-in functionality
  - Export to CSV
- [ ] Import attendees page (`/admin/events/[id]/import`)
  - CSV file upload
  - Preview import data
  - Confirm import
  - Show import results

### Phase 6: Profile Pages (Protected)
- [ ] Profile list (`/profiles`)
  - List user's profiles
  - Create new profile button
- [ ] Profile detail page (`/profiles/[id]`)
  - Profile information
  - Edit profile button
- [ ] Create/Edit profile form
  - Personal information
  - Role-specific fields
  - Skills/expertise
  - Social links
  - Profile image upload

### Phase 7: Additional Features
- [ ] Notifications
  - Real-time notifications via WebSocket
  - Notification bell in header
  - Notification list modal
  - Mark as read functionality
- [ ] Search functionality
  - Global search bar
  - Search events
  - Search profiles
  - Search entities
- [ ] Dark mode toggle
- [ ] Responsive design for mobile
- [ ] Accessibility improvements

### Phase 8: Error Handling & Loading States
- [ ] Global error boundary
- [ ] Loading skeletons
- [ ] Error pages (404, 500)
- [ ] Form validation feedback
- [ ] Toast notifications for actions

### Phase 9: Testing
- [ ] Unit tests for hooks
- [ ] Component tests
- [ ] Integration tests
- [ ] E2E tests for critical flows:
  - Login/signup
  - Event registration
  - Profile management
- [ ] Manual testing checklist

---

## Support

For issues or questions:
- Check backend logs: `python main.py` (look for console output)
- Test API endpoints directly using curl/Postman
- Review browser console for frontend errors
- Check network tab for failed requests

---

**Last Updated:** January 18, 2026
**Backend Version:** FastAPI + AsyncIO
**Frontend Version:** Next.js 14+ (App Router)

## Recent Updates (January 18, 2026)

- Fixed events API timezone issue - now correctly returns upcoming events
- Added comprehensive Events API documentation
- Added detailed frontend implementation checklist
- Updated TypeScript interfaces for all event-related endpoints
