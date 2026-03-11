# Invitation Setup Page - Frontend Implementation Guide

## Overview

After bulk import, users receive an email with an invitation link to set up their password and activate their account. This guide shows how to implement the invitation setup page on the frontend.

---

## The Flow

```
1. Admin imports users via CSV
   ↓
2. Backend creates users with temporary passwords
   ↓
3. Backend sends email with invitation link:
   http://localhost:3000/invitation-setup?token=xxx
   ↓
4. User clicks link → Opens FRONTEND page
   ↓
5. Frontend displays password setup form
   ↓
6. User enters password → Frontend sends to backend
   ↓
7. Backend validates token and sets password
   ↓
8. User redirected to login or dashboard
```

---

## Backend Endpoints (Already Implemented ✅)

### 1. Validate Token (Before Showing Form)

**Endpoint:** `GET /api/complete-registration/validate?token={token}`

**Purpose:** Check if token is valid before showing password form

**Response:**
```json
{
  "valid": true,
  "email": "user@example.com",
  "full_name": "John Doe",
  "expired": false
}
```

### 2. Complete Registration (Submit Password)

**Endpoint:** `POST /api/complete-registration`

**Request:**
```json
{
  "token": "token-from-url",
  "new_password": "user-password"
}
```

**Response:**
```json
{
  "message": "Password set successfully. You can now log in.",
  "redirect_url": "/login"
}
```

---

## Frontend Implementation

### React/TypeScript Component

```tsx
// pages/invitation-setup.tsx

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function InvitationSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Validate token on page load
  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setValidating(false);
      return;
    }

    validateToken(token);
  }, [token]);

  const validateToken = async (token: string) => {
    try {
      const response = await fetch(
        `/api/complete-registration/validate?token=${token}`
      );

      const data = await response.json();

      if (data.valid && !data.expired) {
        setTokenValid(true);
        setUserInfo(data);
      } else if (data.expired) {
        setError('This invitation link has expired. Please contact the administrator.');
      } else {
        setError('Invalid invitation link.');
      }
    } catch (err) {
      setError('Failed to validate invitation. Please try again.');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          new_password: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Success! Show message and redirect
        alert('✅ ' + data.message);
        router.push(data.redirect_url || '/login');
      } else {
        setError(data.detail || 'Failed to set password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="container">
        <div className="card">
          <div className="loading-spinner"></div>
          <p>Validating invitation...</p>
        </div>
      </div>
    );
  }

  // Error state (invalid/expired token)
  if (!tokenValid) {
    return (
      <div className="container">
        <div className="card error">
          <h2>❌ Invalid Invitation</h2>
          <p>{error}</p>
          <a href="/login" className="btn">Go to Login</a>
        </div>
      </div>
    );
  }

  // Password setup form
  return (
    <div className="container">
      <div className="card">
        <h2>🎉 Welcome to Unlokinno!</h2>
        
        {userInfo && (
          <div className="user-info">
            <p>Hi <strong>{userInfo.full_name || userInfo.email}</strong>,</p>
            <p>You've been invited to join the Unlokinno community. Please set up your password to activate your account.</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={8}
            />
            <small>Minimum 8 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Setting up...' : 'Activate Account'}
          </button>
        </form>

        <div className="footer">
          <p>Already have an account? <a href="/login">Log in</a></p>
        </div>
      </div>
    </div>
  );
}
```

### CSS Styles

```css
/* styles/invitation-setup.css */

.container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.card.error {
  border-left: 4px solid #ef4444;
}

.card h2 {
  margin: 0 0 24px 0;
  color: #1f2937;
  text-align: center;
}

.user-info {
  background: #f0fdf4;
  border-left: 4px solid #22c55e;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.user-info p {
  margin: 8px 0;
  color: #374151;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #374151;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group small {
  display: block;
  margin-top: 4px;
  color: #6b7280;
  font-size: 14px;
}

.alert {
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 20px;
}

.alert-error {
  background: #fef2f2;
  border-left: 4px solid #ef4444;
  color: #991b1b;
}

.btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
  display: inline-block;
  text-decoration: none;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.footer {
  margin-top: 24px;
  text-align: center;
  color: #6b7280;
}

.footer a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
}

.footer a:hover {
  text-decoration: underline;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## Vue 3 Implementation

```vue
<!-- pages/invitation-setup.vue -->

<template>
  <div class="container">
    <div class="card" v-if="validating">
      <div class="loading-spinner"></div>
      <p>Validating invitation...</p>
    </div>

    <div class="card error" v-else-if="!tokenValid">
      <h2>❌ Invalid Invitation</h2>
      <p>{{ error }}</p>
      <router-link to="/login" class="btn">Go to Login</router-link>
    </div>

    <div class="card" v-else>
      <h2>🎉 Welcome to Unlokinno!</h2>

      <div class="user-info" v-if="userInfo">
        <p>Hi <strong>{{ userInfo.full_name || userInfo.email }}</strong>,</p>
        <p>You've been invited to join the Unlokinno community. Please set up your password to activate your account.</p>
      </div>

      <form @submit.prevent="handleSubmit">
        <div v-if="error" class="alert alert-error">
          {{ error }}
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            v-model="password"
            placeholder="Enter your password"
            required
            minlength="8"
          />
          <small>Minimum 8 characters</small>
        </div>

        <div class="form-group">
          <label for="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            v-model="confirmPassword"
            placeholder="Confirm your password"
            required
          />
        </div>

        <button
          type="submit"
          class="btn btn-primary"
          :disabled="loading"
        >
          {{ loading ? 'Setting up...' : 'Activate Account' }}
        </button>
      </form>

      <div class="footer">
        <p>Already have an account? <router-link to="/login">Log in</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const token = route.query.token as string;
const validating = ref(true);
const tokenValid = ref(false);
const userInfo = ref(null);
const password = ref('');
const confirmPassword = ref('');
const error = ref('');
const loading = ref(false);

onMounted(() => {
  if (!token) {
    error.value = 'No invitation token provided';
    validating.value = false;
    return;
  }

  validateToken(token);
});

const validateToken = async (token: string) => {
  try {
    const response = await fetch(
      `/api/complete-registration/validate?token=${token}`
    );

    const data = await response.json();

    if (data.valid && !data.expired) {
      tokenValid.value = true;
      userInfo.value = data;
    } else if (data.expired) {
      error.value = 'This invitation link has expired. Please contact the administrator.';
    } else {
      error.value = 'Invalid invitation link.';
    }
  } catch (err) {
    error.value = 'Failed to validate invitation. Please try again.';
  } finally {
    validating.value = false;
  }
};

const handleSubmit = async () => {
  error.value = '';

  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters';
    return;
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match';
    return;
  }

  loading.value = true;

  try {
    const response = await fetch('/api/complete-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token,
        new_password: password.value
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert('✅ ' + data.message);
      router.push(data.redirect_url || '/login');
    } else {
      error.value = data.detail || 'Failed to set password';
    }
  } catch (err) {
    error.value = 'An error occurred. Please try again.';
  } finally {
    loading.value = false;
  }
};
</script>
```

---

## Environment Configuration

### Backend (.env)

```bash
# Frontend URL for invitation links
FRONTEND_URL=http://localhost:3000

# For production
FRONTEND_URL=https://your-frontend-domain.com
```

### Frontend (.env.local)

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# For production
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api
```

---

## Testing the Complete Flow

### Step 1: Ensure Environment Variables

**Backend:**
```bash
FRONTEND_URL=http://localhost:3000
```

**Frontend:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Step 2: Import User

Admin uploads CSV with user: `test@example.com`

### Step 3: Check Email

User receives email with link:
```
http://localhost:3000/invitation-setup?token=abc123...
```

### Step 4: Click Link

Opens frontend page at `/invitation-setup?token=abc123...`

### Step 5: Set Password

User sees form, enters password, clicks "Activate Account"

### Step 6: Backend Validates

Backend receives:
```json
{
  "token": "abc123...",
  "new_password": "user-password"
}
```

Backend validates token, sets password, returns:
```json
{
  "message": "Password set successfully. You can now log in.",
  "redirect_url": "/login"
}
```

### Step 7: Redirect to Login

User is redirected to `/login` and can now log in!

---

## Error Handling

### Invalid Token
```
❌ Invalid Invitation
Invalid invitation link.
[Go to Login]
```

### Expired Token (>24 hours)
```
❌ Invalid Invitation
This invitation link has expired. Please contact the administrator.
[Go to Login]
```

### Password Mismatch
```
⚠️ Passwords do not match
```

### Short Password
```
⚠️ Password must be at least 8 characters
```

---

## Implementation Checklist

### Backend
- [x] Fix invitation link to use FRONTEND_URL ✅
- [x] Complete registration endpoint exists ✅
- [x] Token validation endpoint exists ✅
- [x] Token expiration (24 hours) ✅

### Frontend
- [ ] Create `/invitation-setup` page
- [ ] Add token validation on page load
- [ ] Add password setup form
- [ ] Add password validation
- [ ] Handle success/error states
- [ ] Redirect to login after success
- [ ] Add loading states
- [ ] Style the page

### Testing
- [ ] Test valid token flow
- [ ] Test expired token
- [ ] Test invalid token
- [ ] Test password mismatch
- [ ] Test short password
- [ ] Test successful setup → login

---

## Summary

**Backend (Fixed ✅):**
- Invitation link now points to frontend: `{FRONTEND_URL}/invitation-setup?token=xxx`
- Endpoints ready: `/api/complete-registration` and `/api/complete-registration/validate`

**Frontend (To Implement):**
- Create `/invitation-setup` page component
- Validate token on load
- Show password setup form
- Submit to backend API
- Redirect to login on success

**Flow:**
```
Email → Frontend Page → Password Form → Backend API → Login
```

---

**Status:** ✅ Backend Ready | ⏳ Frontend To Implement  
**Last Updated:** January 24, 2026
