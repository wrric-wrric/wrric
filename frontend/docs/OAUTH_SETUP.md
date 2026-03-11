# OAuth Configuration Guide

## Overview
This application supports OAuth authentication via Google and LinkedIn. The OAuth flow uses backend-side redirects to a single frontend callback page with query parameters.

## OAuth Flow

### Google OAuth
1. **Initiate OAuth:** User clicks "Login with Google"
   - Frontend: `/api/auth/google/login`
   - Backend: `/api/auth/google/login`
   - Returns: `auth_url` (Google OAuth URL)

2. **User Authorization:** User is redirected to Google and authorizes the application

3. **OAuth Callback:** Google redirects to backend, which redirects to frontend
   - Backend callback URL: `https://your-backend-url.com/api/auth/google/callback`
   - Frontend callback URL: `https://your-frontend-url.com/auth/callback`
   - Backend redirects with query parameters: `?access_token=...&user_id=...&existing_user=...&profile_id=...&message=...`

4. **Redirection to UI:** Frontend callback page reads parameters and redirects appropriately

### LinkedIn OAuth
Same flow as Google, with LinkedIn-specific URLs:
- Initiate: `/api/auth/linkedin/login`
- Backend callback: `https://your-backend-url.com/api/auth/linkedin/callback`
- Frontend callback: `https://your-frontend-url.com/auth/callback`

## Required Configuration

### Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your OAuth 2.0 client ID
3. In "Authorized redirect URIs", add:
   ```
   https://your-backend-url.com/api/auth/google/callback
   ```
4. **Important:** Configure backend callback URL, NOT frontend

### LinkedIn Application
1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Select your application
3. In "Authorized Redirect URLs", add:
   ```
   https://your-backend-url.com/api/auth/linkedin/callback
   ```
4. **Important:** Configure backend callback URL, NOT frontend

## Environment Variables

Ensure these are set in your `.env.local`:

```bash
# Backend API URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# reCAPTCHA (for password setup)
NEXT_PUBLIC_SITE_KEY=your-recaptcha-site-key
```

## Local Development

For local development, you'll need to use a local tunnel or configure OAuth providers to accept localhost:

### Using ngrok (recommended)
1. Install ngrok: `npm install -g ngrok`
2. Run ngrok: `ngrok http 8000`
3. Use ngrok URL in OAuth provider configs:
   ```
   https://random-id.ngrok.io/api/auth/google/callback
   ```

### Localhost (if provider supports it)
```
http://localhost:8000/api/auth/google/callback
```

## Cookie Management

OAuth tokens are stored in localStorage for client-side access:
- `access_token`: User's JWT access token
- `user_id`: User's ID
- `profile_id`: User's profile ID (if exists)

## User Flow After OAuth

### New User (`existing_user=false`)
1. User is redirected to `/auth/set-password?user_id=...`
2. User sets their password
3. User is redirected to login or directly to their profile

### Existing User (`existing_user=true`)
1. User is automatically logged in
2. Redirected to `/map` (main dashboard)

## Backend Callback Response Format

The backend should redirect with these query parameters:
```
/auth/google/callback?access_token={jwt_token}&user_id={user_uuid}&existing_user={true/false}&profile_id={profile_uuid}&message={encoded_message}
```

## Troubleshooting

### "OAuth callback missing user information"
- Check that OAuth provider's redirect URI points to backend callback
- Verify backend is redirecting to frontend with all parameters
- Check browser console for errors

### "OAuth Error: ..."
- Check error message for specific issues
- Common errors:
  - OAuth provider specific errors (check backend logs)
  - Missing access_token or user_id parameters

### Stuck on blank page with JSON
- This indicates frontend callback is being bypassed
- Verify backend redirects to frontend callback URL
- Check that frontend callback page exists

## Backend Configuration (For Backend Developers)

The backend should:
1. Handle OAuth provider callback
2. Process user creation/login
3. Generate access token
4. Use `RedirectResponse` to redirect to frontend with parameters:

```python
from fastapi import RedirectResponse

# Example backend OAuth callback
@router.get("/api/auth/google/callback")
async def google_callback(code: str):
    # Process OAuth, get user info, create token
    user = process_oauth_user(code)
    
    # Redirect to frontend with all required parameters
    frontend_url = "http://localhost:3000"
    redirect_url = f"{frontend_url}/auth/google/callback"
    
    params = {
        "access_token": user.access_token,
        "user_id": str(user.id),
        "existing_user": str(user.existing).lower(),
    }
    
    if user.profile_id:
        params["profile_id"] = str(user.profile_id)
    
    if user.is_new:
        params["message"] = "Account created successfully. Please set your password to complete registration."
    
    return RedirectResponse(url=redirect_url, params=params)
```

## Security Considerations

1. **State Parameter:** OAuth flows should include a `state` parameter for CSRF protection
2. **Token Storage:** Using localStorage for client-side access (for SPA)
3. **Token Validation:** Validate tokens on protected routes

## Testing OAuth Locally

### Manual Testing
```bash
# 1. Start backend
# backend python main.py

# 2. Start frontend development server
npm run dev

# 3. Start a tunnel for backend (optional but recommended)
ngrok http 8000

# 4. Update OAuth provider redirect URIs with backend ngrok URL

# 5. Test OAuth flow
# - Click "Login with Google" or "Login with LinkedIn"
# - Authorize application
# - Verify redirection to set-password page (new users)
# - Verify redirection to map (existing users)
```

## Files Modified/Created

### Created
- `/app/auth/callback/page.tsx` - Generic OAuth callback page (handles both Google and LinkedIn)
- `/docs/OAUTH_SETUP.md` - This documentation
- `/docs/OAUTH_QUICK_REFERENCE.md` - Quick reference for developers

### Still Available (Optional)
- `/app/auth/google/callback/page.tsx` - Provider-specific Google callback (can be used if backend redirects here)
- `/app/auth/linkedin/callback/page.tsx` - Provider-specific LinkedIn callback (can be used if backend redirects here)

### Removed
- `/app/api/auth/google/callback/route.ts` - No longer needed (backend redirects directly)
- `/app/api/auth/linkedin/callback/route.ts` - No longer needed (backend redirects directly)

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify OAuth provider configuration (backend callback URLs)
3. Check network tab for failed requests
4. Review backend logs for OAuth processing errors
