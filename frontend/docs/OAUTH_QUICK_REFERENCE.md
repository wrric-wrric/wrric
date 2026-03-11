# OAuth Implementation Quick Reference

## Authentication Flows

### 1. Regular Email/Password Login
- **Page:** `/auth/login`
- **Flow:**
  1. User enters email/password and completes reCAPTCHA
  2. Frontend calls `/api/auth/login`
  3. Backend validates and returns access token + user_id
  4. Frontend stores token in localStorage/sessionStorage
  5. User is redirected to `/map`

### 2. Regular Signup
- **Page:** `/auth/signup` (if exists)
- **Flow:**
  1. User enters registration details
  2. Frontend creates account on backend
  3. User is redirected to login or directly logged in

### 3. Google OAuth (Updated)
- **Initiation:** `/api/auth/google/login`
- **Backend Callback:** `/api/auth/google/callback` (backend redirects to frontend)
- **Frontend Callback:** `/auth/google/callback`

**Flow:**
  1. User clicks "Login with Google"
  2. Frontend gets auth_url from `/api/auth/google/login`
  3. User is redirected to Google and authorizes
  4. Google redirects to backend callback: `https://backend.com/api/auth/google/callback?code=...`
  5. Backend processes OAuth and redirects to frontend:
     ```
     https://frontend.com/auth/google/callback?access_token=...&user_id=...&existing_user=...&profile_id=...&message=...
     ```
  6. Frontend callback page extracts parameters from URL
  7. Stores token in localStorage
  8. Based on `existing_user`:
     - **true:** Redirects to `/map` (user already has account)
     - **false:** Redirects to `/auth/set-password?user_id=...` to set password

### 4. LinkedIn OAuth (Updated)
- Same flow as Google OAuth
- **Frontend Callback:** `/auth/linkedin/callback`

## Key Differences: Old vs New OAuth Implementation

### Old Implementation (JSON Response)
```
Frontend /api/auth/google/callback → Backend → Returns JSON → Frontend displays JSON on screen
```

### New Implementation (Redirect-Based)
```
Frontend /api/auth/google/login → Backend Google URL → Google Authorization → 
Backend /api/auth/google/callback → Redirects to Frontend Callback Page → 
Frontend /auth/google/callback (UI page) → Stores token & Redirects appropriately
```

## Query Parameters for OAuth Callbacks

### Required Parameters
- `access_token`: JWT access token from backend
- `user_id`: User's UUID
- `existing_user`: "true" or "false" (string)

### Optional Parameters
- `profile_id`: Profile UUID (for users who already have a profile)
- `message`: Message for user (e.g., "Account created successfully. Please set your password.")

### Error Parameter
- `error`: Error message (OAuth failed, missing parameters, etc.)

## Configuration Checklist

### Backend Configuration
- [ ] Configure Google OAuth 2.0 credentials
- [ ] Configure LinkedIn OAuth 2.0 credentials
- [ ] Set frontend callback URL in OAuth provider configs
- [ ] Implement redirect with query parameters (not JSON response)
- [ ] Handle new user creation
- [ ] Handle existing user login

### Frontend Configuration
- [ ] Update OAuth callback URLs in provider to point to backend
- [ ] Ensure frontend callback pages exist and handle parameters
- [ ] Test redirect flows for new and existing users
- [ ] Test error handling

### Environment Variables
```bash
# Backend URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# reCAPTCHA
NEXT_PUBLIC_SITE_KEY=your-recaptcha-site-key

# For production
NEXT_PUBLIC_APP_URL=https://your-frontend-domain.com
```

## Testing OAuth Locally

### Option 1: Backend Localhost + Frontend Localhost
```bash
# Terminal 1: Start backend
cd backend && python main.py

# Terminal 2: Start frontend
cd frontend && npm run dev

# Update OAuth providers with:
# Backend: http://localhost:8000/api/auth/google/callback
# Frontend: http://localhost:3000/auth/google/callback
```

### Option 2: ngrok Tunnel (Recommended)
```bash
# Tunnel backend through ngrok
ngrok http 8000

# Use ngrok URL in OAuth provider configs:
# https://xyz.ngrok.io/api/auth/google/callback
# Frontend callback: https://xyz.ngrok.io/auth/google/callback
```

### Option 3: Separate Domains (Production)
- Configure backend OAuth callback to: `https://api.yourdomain.com/auth/google/callback`
- Configure frontend to handle: `https://www.yourdomain.com/auth/google/callback`

## User Experience Flow

### New User via OAuth
```
Click OAuth → Authorize → Redirect to Frontend with parameters → 
Extract parameters → Store token → Redirect to set-password page → 
Set password → Redirect to login → Login → Dashboard
```

### Existing User via OAuth
```
Click OAuth → Authorize → Redirect to Frontend with parameters → 
Extract parameters → Store token → Show success → Redirect to Dashboard
```

## Error Handling

### OAuth Errors
- Redirect to `/auth/login?error=...`
- Show error message to user
- Allow user to try again

### Token Validation
- Check for `access_token` and `user_id` on callback
- If missing, redirect to login with error
- Display appropriate error messages

## Security Notes

1. **HTTPS Required:** OAuth providers require HTTPS in production
2. **Secure Cookies:** Use secure, httpOnly cookies in production
3. **State Parameter:** Implement CSRF protection with state parameter
4. **Token Storage:** Consider using httpOnly cookies instead of localStorage
5. **Token Expiry:** Implement token refresh logic if needed

## Debugging Tips

### Check OAuth Flow
```javascript
// In OAuth callback page console:
console.log("access_token:", access_token);
console.log("user_id:", user_id);
console.log("existing_user:", existing_user);

// Check localStorage
console.log("localStorage token:", localStorage.getItem("token"));
console.log("localStorage user_id:", localStorage.getItem("user_id"));
```

### Common Issues
1. **Stuck on JSON response:** Backend is not redirecting properly
2. **Missing parameters:** Backend not including all required query params
3. **Wrong URL:** OAuth provider pointing to wrong callback URL
4. **CORS issues:** Backend not configured to allow frontend origin

## File Locations

### OAuth Initiation
- `/app/api/auth/google/login/route.ts`
- `/app/api/auth/linkedin/login/route.ts`

### OAuth Callback Pages (Frontend UI)
- `/app/auth/google/callback/page.tsx`
- `/app/auth/linkedin/callback/page.tsx`

### Password Setup
- `/app/auth/set-password/page.tsx`

### Login/Signup
- `/app/auth/login/page.tsx`

## Support & Troubleshooting

For OAuth issues:
1. Check browser console for errors
2. Verify backend is running and accessible
3. Check OAuth provider console for callback configuration
4. Test backend OAuth endpoint directly: `curl http://localhost:8000/api/auth/google/callback?code=test`
5. Verify backend redirect format includes all parameters
