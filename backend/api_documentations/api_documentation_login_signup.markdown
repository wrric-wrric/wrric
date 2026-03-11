# Unlokinno Intelligence API Documentation (Login & Signup)

This documentation provides detailed information for frontend developers integrating with the Unlokinno Intelligence API’s authentication endpoints: `/api/login`, `/api/signup`, and `/api/verify-token`. These endpoints handle user login, account creation, and token validation for accessing climate technology research data in Sub-Saharan Africa. All requests use JSON payloads and require reCAPTCHA validation for security. The documentation includes request/response schemas, headers, status codes, error handling, and frontend integration tips based on the provided `login.html` and `signup.html` code.

---

## Base URL
- **HTTP**: `http://<host>:<port>` (e.g., `http://localhost:8000`)
- Use `https://` in production for secure communication.

## Authentication Overview
- **Login**: Users provide a username or email, password, and reCAPTCHA response to obtain a Bearer token and user ID.
- **Signup**: Users create an account with a username, email, password, and reCAPTCHA response, receiving a token and user ID.
- **Token Verification**: Validates the stored token to check authentication status.
- **Storage**: The frontend stores `token` and `user_id` in `localStorage` for subsequent requests.
- **Redirects**: On successful login/signup or valid token, redirect to `/dashboard`. On failure, clear `localStorage` and stay on the login/signup page.

**Header Format** (for `/api/verify-token`):
```http
Authorization: Bearer <token>
```

---

## REST Endpoints

### 1. Login
Authenticates a user and returns a Bearer token and user ID.

**Endpoint**: `POST /api/login`

**Purpose**: Allows users to log in using a username or email, password, and reCAPTCHA response.

**Request**:
- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Body** (one of the following):
  - For email login:
    ```json
    {
      "email": "string",
      "password": "string",
      "recaptchaResponse": "string"
    }
    ```
  - For username login:
    ```json
    {
      "username": "string",
      "password": "string",
      "recaptchaResponse": "string"
    }
    ```
  - **Fields**:
    - `email` or `username`: User’s email (e.g., `user@example.com`) or username (e.g., `john_doe`).
    - `password`: User’s password (minimum 8 characters, per frontend validation).
    - `recaptchaResponse`: reCAPTCHA token from `grecaptcha.getResponse()`.

**Responses**:
- **200 OK**:
  - **Description**: Login successful, returns token and user ID.
  - **Body**:
    ```json
    {
      "access_token": "string",
      "user_id": "string"
    }
    ```
- **401 Unauthorized**:
  - **Description**: Invalid credentials or reCAPTCHA.
  - **Body**:
    ```json
    { "detail": "Invalid username/email or password" }
    ```
- **422 Unprocessable Entity**:
  - **Description**: Missing or invalid fields (e.g., no `recaptchaResponse`).
  - **Body**:
    ```json
    {
      "detail": [
        {
          "loc": ["body", "email"],
          "msg": "field required",
          "type": "value_error.missing"
        }
      ]
    }
    ```
- **429 Too Many Requests**:
  - **Description**: Rate limit exceeded (e.g., too many login attempts).
  - **Body**:
    ```json
    { "detail": "Too many requests. Please try again later." }
    ```

**Usage in Frontend**:
- Triggered by clicking the “Sign In” button (`loginButton`) or pressing Enter in `usernameOrEmail` or `password` inputs.
- Validates inputs (non-empty, email format if email).
- Shows reCAPTCHA on input focus (`showRecaptcha`).
- Stores `access_token` and `user_id` in `localStorage` and redirects to `/dashboard` on success.
- Displays errors in `#errorMessage` and resets reCAPTCHA on failure.

**Example**:
```javascript
const payload = {
    email: "user@example.com",
    password: "password123",
    recaptchaResponse: grecaptcha.getResponse()
};
const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
});
if (response.ok) {
    const data = await response.json();
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user_id', data.user_id);
    window.location.href = '/dashboard';
} else {
    const errorData = await response.json();
    document.getElementById('errorMessage').textContent = errorData.detail || 'Invalid username/email or password.';
}
```

---

### 2. Signup
Creates a new user account and returns a Bearer token and user ID.

**Endpoint**: `POST /api/signup`

**Purpose**: Registers a new user with a username, email, password, and reCAPTCHA response.

**Request**:
- **Headers**:
  ```http
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string",
    "recaptchaResponse": "string"
  }
  ```
  - **Fields**:
    - `username`: Unique username (e.g., `john_doe`).
    - `email`: Valid email address (e.g., `user@example.com`).
    - `password`: Password (minimum 8 characters, per frontend validation).
    - `recaptchaResponse`: reCAPTCHA token from `grecaptcha.getResponse()`.

**Responses**:
- **200 OK**:
  - **Description**: Account created successfully, returns token and user ID.
  - **Body**:
    ```json
    {
      "access_token": "string",
      "user_id": "string"
    }
    ```
- **400 Bad Request**:
  - **Description**: Username or email already exists.
  - **Body**:
    ```json
    { "detail": "Username or email already exists" }
    ```
- **422 Unprocessable Entity**:
  - **Description**: Invalid or missing fields (e.g., invalid email, missing `recaptchaResponse`).
  - **Body**:
    ```json
    {
      "detail": [
        {
          "loc": ["body", "email"],
          "msg": "value is not a valid email address",
          "type": "value_error.email"
        }
      ]
    }
    ```
- **429 Too Many Requests**:
  - **Description**: Rate limit exceeded.
  - **Body**:
    ```json
    { "detail": "Too many requests. Please try again later." }
    ```

**Usage in Frontend**:
- Triggered by clicking the “Create Account” button (`signupButton`) or pressing Enter in input fields.
- Validates inputs (non-empty, valid email, password ≥ 8 characters, matching passwords).
- Shows reCAPTCHA on input focus (`showRecaptcha`).
- Stores `access_token` and `user_id` in `localStorage` and redirects to `/dashboard` on success.
- Displays errors in `#errorMessage` and resets reCAPTCHA on failure.

**Example**:
```javascript
const payload = {
    username: "john_doe",
    email: "user@example.com",
    password: "password123",
    recaptchaResponse: grecaptcha.getResponse()
};
const response = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
});
if (response.ok) {
    const data = await response.json();
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user_id', data.user_id);
    window.location.href = '/dashboard';
} else {
    const errorData = await response.json();
    document.getElementById('errorMessage').textContent = errorData.detail || 'Sign up failed. Username or email may already exist.';
}
```

---

### 3. Verify Token
Validates the user’s authentication token.

**Endpoint**: `GET /api/verify-token`

**Purpose**: Checks if the stored Bearer token is valid, ensuring the user is authenticated.

**Request**:
- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```

**Responses**:
- **200 OK**:
  - **Description**: Token is valid.
  - **Body**: Empty or user metadata (not specified in frontend).
    ```json
    {}
    ```
- **401 Unauthorized**:
  - **Description**: Invalid or expired token.
  - **Body**:
    ```json
    { "detail": "Invalid token" }
    ```

**Usage in Frontend**:
- Called on page load to check if the user is already authenticated (via `localStorage.token` and `user_id`).
- If `200`, redirects to `/dashboard`.
- If `401`, clears `localStorage` (`token`, `user_id`) and keeps the user on the login/signup page.

**Example**:
```javascript
const token = localStorage.getItem('token');
const response = await fetch('/api/verify-token', {
    headers: { 'Authorization': `Bearer ${token}` }
});
if (response.ok) {
    window.location.href = '/dashboard';
} else {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
}
```

---

## Error Handling
- **401 Unauthorized**: Invalid credentials or token. Display error (e.g., “Invalid username/email or password”) and clear `localStorage` for `/api/verify-token`.
- **400 Bad Request**: Username/email already exists (signup). Show specific error from `detail`.
- **422 Unprocessable Entity**: Validation errors (e.g., missing fields, invalid email). Parse `detail` array for specific messages.
- **429 Too Many Requests**: Rate limit hit. Suggest waiting before retrying.
- **Network Errors**: Handle `Failed to fetch` errors by showing “Network error. Please check your connection.”
- **Unexpected Responses**: Check for missing `access_token` or `user_id` and display “Invalid response from server.”

**Frontend Example**:
```javascript
try {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Request failed');
    }
} catch (e) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = e.message.includes('Failed to fetch') ?
        'Network error. Please check your connection.' :
        e.message;
    errorMessage.style.display = 'block';
}
```

---

## reCAPTCHA Integration
- **Library**: Include Google reCAPTCHA v2 script in HTML:
  ```html
  <script src="https://www.google.com/recaptcha/api.js" async defer></script>
  ```
- **Site Key**: Replace `{{ recaptcha_site_key }}` in `<div class="g-recaptcha" data-sitekey="{{ recaptcha_site_key }}"></div>` with your reCAPTCHA site key.
- **Behavior**:
  - Hidden by default (`hidden` class).
  - Shown on input focus (`showRecaptcha`).
  - Resets after 110 seconds (`RECAPTCHA_TIMEOUT_MS`) with an error message.
  - Cleared on successful login/signup or error (`hideRecaptcha`).
- **Validation**:
  - Get token with `grecaptcha.getResponse()`.
  - Send in `recaptchaResponse` field.
  - If empty, show “Please complete the reCAPTCHA.”

**Example**:
```javascript
if (!grecaptcha.getResponse()) {
    document.getElementById('errorMessage').textContent = 'Please complete the reCAPTCHA.';
    document.getElementById('errorMessage').style.display = 'block';
    return;
}
```

---

## Frontend Integration Tips
1. **Authentication Check**:
   - On page load, verify token with `/api/verify-token` to avoid showing login/signup for authenticated users.
   - Use `isRedirecting` flag to prevent multiple redirects.

2. **Input Validation**:
   - Login: Check `usernameOrEmail` and `password` are non-empty; validate email format if email.
   - Signup: Ensure all fields are filled, email is valid, password is ≥ 8 characters, and passwords match.

3. **UI Feedback**:
   - Disable buttons during requests (`loginButton.disabled = true`, `signupButton.disabled = true`).
   - Show loading state (`classList.add('loading')`).
   - Display errors in `#errorMessage` and clear on input change.

4. **reCAPTCHA**:
   - Show on first input focus to prompt verification.
   - Reset timer on interaction (`resetRecaptchaTimeout`).
   - Hide and reset on success or failure (`hideRecaptcha`).

5. **Theme Toggle**:
   - Persist theme (`dark` or `light`) in `localStorage.theme`.
   - Update `modeToggle` icon (`fa-moon` or `fa-sun`) based on theme.

6. **Enter Key Handling**:
   - Trigger `loginButton.click()` or `signupButton.click()` on Enter key in inputs.
   - Handle guest access separately for `guestButton`.

**Example UI Update**:
```javascript
loginButton.disabled = true;
loginButton.classList.add('loading');
errorMessage.style.display = 'none';
try {
    const response = await fetch('/api/login', { /* ... */ });
    if (response.ok) {
        window.location.href = '/dashboard';
    } else {
        errorMessage.textContent = 'Login failed.';
        errorMessage.style.display = 'block';
    }
} finally {
    loginButton.disabled = false;
    loginButton.classList.remove('loading');
}
```

---

## Testing
Use `curl` to test endpoints:

**Login**:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","recaptchaResponse":"test_token"}' \
  http://localhost:8000/api/login
```

**Signup**:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"john_doe","email":"user@example.com","password":"password123","recaptchaResponse":"test_token"}' \
  http://localhost:8000/api/signup
```

**Verify Token**:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/verify-token
```

**Expected Responses**:
- **200**: `{ "access_token": "...", "user_id": "..." }` or `{}` for verify.
- **401**: `{ "detail": "Invalid username/email or password" }`
- **422**: `{ "detail": [{ "loc": ["body", "email"], "msg": "...", "type": "..." }] }`

---

## Debugging Tips
1. **Network Issues**:
   - Check DevTools > Network for request status (e.g., `401`, `422`).
   - Handle `Failed to fetch` with a network error message.

2. **reCAPTCHA**:
   - Ensure the site key is correct and the reCAPTCHA script is loaded.
   - Test reCAPTCHA timeout (110s) by waiting and checking `#errorMessage`.

3. **Console Logs**:
   - Log payloads (`console.log('Sending login payload:', payload)`).
   - Log errors (`console.error('Login error:', e)`).

4. **Invalid Inputs**:
   - Test empty fields, invalid emails, or mismatched passwords to verify `422` responses.
   - Test missing `recaptchaResponse` to confirm error handling.

5. **Authentication**:
   - Simulate invalid token in `/api/verify-token` to test redirect logic.
   - Ensure `localStorage` is cleared on `401`.

---

## Example Workflow
1. **Page Load**:
   - Check `localStorage.token` and `user_id`.
   - Call `/api/verify-token`; redirect to `/dashboard` if valid, else clear `localStorage`.

2. **Login**:
   - User enters `user@example.com` and `password123`, completes reCAPTCHA.
   - Send `/api/login` with payload.
   - On `200`, store `access_token` and `user_id`, redirect to `/dashboard`.
   - On error, show message (e.g., “Invalid username/email or password”).

3. **Signup**:
   - User enters `john_doe`, `user@example.com`, `password123`, confirms password, completes reCAPTCHA.
   - Send `/api/signup` with payload.
   - On `200`, store `access_token` and `user_id`, redirect to `/dashboard`.
   - On error, show message (e.g., “Username or email already exists”).

4. **Guest Access**:
   - Click “Continue as Guest” to redirect to `/` (no authentication).

---

## Best Practices
1. **Security**:
   - Use HTTPS in production to secure token transmission.
   - Validate reCAPTCHA server-side to prevent bots.
   - Store tokens securely in `localStorage` and clear on logout or `401`.

2. **User Experience**:
   - Show loading states during requests to prevent double-clicks.
   - Clear error messages on input change for a clean UI.
   - Auto-focus the first input field on page load.

3. **Error Handling**:
   - Parse `detail` arrays in `422` responses for specific error messages.
   - Handle network errors gracefully with user-friendly messages.

4. **reCAPTCHA**:
   - Test with Google’s test keys for development (`site_key: 6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`).
   - Ensure the reCAPTCHA widget is accessible (e.g., not blocked by CSS).

5. **Redirects**:
   - Use `isRedirecting` to prevent infinite redirect loops.
   - Verify `/dashboard` is accessible before redirecting.

---

## Notes
- **WebSocket**: Not referenced in these files but documented previously for `/ws`. If needed, refer to the WebSocket documentation (artifact version `5f7a45be-0929-46d3-876e-41745e1a2836`).
- **Additional Endpoints**: If other endpoints (e.g., `/api/user_entities` from `view_labs.html`) are needed, provide details to extend the documentation.
- **Issues**: If integration fails (e.g., `401`, network errors), share console logs or DevTools screenshots for troubleshooting.