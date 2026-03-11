# Unlokinno Intelligence API Documentation (Guest Mode)

This documentation is designed for frontend developers building the guest mode interface of the Unlokinno Intelligence platform, which allows users to explore climate technology research labs in Sub-Saharan Africa without authentication. Guest mode uses a WebSocket endpoint (`/ws`) for real-time query processing and requires reCAPTCHA validation for each query. The documentation covers the API’s WebSocket endpoint, message formats, reCAPTCHA integration, error handling, and detailed guidance for integrating with the frontend UI, including state management, UI updates, and debugging. It assumes familiarity with JavaScript and HTML but provides extra detail for developers new to WebSockets.

---

## Base URL

- **WebSocket**: `ws://<host>:<port>/ws` (e.g., `ws://localhost:8000/ws`, use `wss://` in production for HTTPS)
- **HTTP** (for token verification, if applicable): `http://<host>:<port>` (e.g., `http://localhost:8000`)

## Guest Mode Overview

- **Purpose**: Allows unauthenticated users to search for climate tech research labs, researchers, and publications in Sub-Saharan Africa.
- **Limitations**: No user history is saved (indicated by the guest popup). Users are prompted to log in or sign up to save queries.
- **Authentication**: No Bearer token or `user_id` is required. Queries include a `recaptchaResponse` for validation.
- **Key Features**:
  - Real-time query processing via WebSocket.
  - reCAPTCHA validation for each query.
  - UI feedback for query status, results, and errors.
  - Guest popup to encourage login/signup after `MAX_POPUP_QUERIES` (3) queries or every `POPUP_COOLDOWN_MS` (5 minutes).

---

## WebSocket Endpoint

### WebSocket Connection

Handles real-time query processing for guest users.

**Endpoint**: `ws://<host>:<port>/ws` (or `wss://` for HTTPS)

**Purpose**: Establishes a persistent connection to send queries and receive real-time updates on query status and results (e.g., `UserEntity` objects).

**Connection**:

- Connect using `new WebSocket(wsUrl)`.
- On open, send an initial message to establish the session (no authentication required for guest mode):
  ```json
  {
    "sessionId": null,
    "query": null,
    "type": "general",
    "recaptchaResponse": "string"
  }
  ```

**Message Types**:

- **Sent by Client**:

  - **Initial Connection**:
    ```json
    {
      "sessionId": null,
      "query": null,
      "type": "general",
      "recaptchaResponse": "string"
    }
    ```
    - Sent on `ws.onopen` to initialize the session.
    - `sessionId`: `null` for new guest sessions.
    - `recaptchaResponse`: Obtained from `grecaptcha.getResponse()`.
  - **Query**:
    ```json
    {
      "sessionId": "string | null",
      "query": "string",
      "type": "general | publications | websites",
      "recaptchaResponse": "string"
    }
    ```
    - Sent when the user submits a query (e.g., “solar energy labs at University of Ghana”).
    - `query`: The search term (required, non-empty).
    - `type`: Search type (`general`, `publications`, `websites`), set via UI buttons.
    - `recaptchaResponse`: reCAPTCHA token for validation.
  - **Cancel Query**:
    ```json
    {
      "sessionId": "string",
      "action": "cancel"
    }
    ```
    - Sent to stop an ongoing query.

- **Received by Client**:
  - **Connected**:
    ```json
    {
      "status": "connected",
      "sessionId": "string"
    }
    ```
    - Confirms connection and provides a `sessionId` for the guest session.
  - **Queued**:
    ```json
    {
      "status": "queued",
      "message": "Query \"<query>\" queued for processing"
    }
    ```
    - Indicates the query is queued.
  - **Processing**:
    ```json
    {
      "status": "processing",
      "url": "string"
    }
    ```
    - Shows the server is fetching data from a URL (e.g., `https://example.com`).
  - **Result**:
    ```json
    {
      "status": "result",
      "data": {
        /* UserEntity object */
      }
    }
    ```
    - Delivers a research lab result (see `UserEntity` schema below).
  - **Complete**:
    ```json
    {
      "status": "complete"
    }
    ```
    - Signals the query is finished.
  - **Stopped**:
    ```json
    {
      "status": "stopped"
    }
    ```
    - Indicates the query was canceled.
  - **Error**:
    ```json
    {
      "status": "error",
      "url": "string | null",
      "message": "string"
    }
    ```
    - Reports an error (e.g., invalid reCAPTCHA, failed data retrieval).

**Frontend Implementation** (from `connectWebSocket`):

```javascript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}/ws`;
ws = new WebSocket(wsUrl);
ws.onopen = () => {
  ws.send(
    JSON.stringify({
      sessionId: null,
      query: null,
      type: "general",
      recaptchaResponse: grecaptcha.getResponse(),
    })
  );
};
```

---

## HTTP Endpoint (Optional)

### Verify Token

Checks if a user is authenticated (used to redirect authenticated users from guest mode).

**Endpoint**: `GET /api/verify-token`

**Purpose**: Validates a Bearer token to prevent authenticated users from accessing guest mode.

**Request**:

- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```

**Responses**:

- **200 OK**:
  - **Description**: Token is valid.
  - **Body**: Empty or user metadata.
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

- Not explicitly called in guest mode but may be used to check `localStorage.token` and redirect to `/dashboard` if authenticated.
- If `401`, clears `localStorage` and keeps the user in guest mode.

**Example**:

```javascript
const token = localStorage.getItem("token");
if (token) {
  const response = await fetch("/api/verify-token", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.ok) {
    window.location.href = "/dashboard";
  } else {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
  }
}
```

---

## Data Schema

### UserEntity

Represents a research lab or entity returned in WebSocket `result` messages.

```json
{
  "id": "integer",
  "url": "string | null",
  "university": "string | null",
  "location": {
    "city": "string | null",
    "country": "string | null",
    "address": "string | null"
  },
  "website": "string | null",
  "edurank": {
    "url": "string | null",
    "score": "string | null"
  },
  "department": {
    "name": "string | null",
    "focus": "string | null"
  },
  "publications_meta" {
    "count": "integer",
    "list": [
      {
        "title": "string",
        "url": "string | null",
        "doi": "string | null"
      }
    ]
  },
  "research_abstract": "string | null",
  "point_of_contact": {
    "name": "string | null",
    "email": "string | null",
    "contact": "string | null"
  },
  "scopes": ["string"],
  "last_updated": "string | null",
  "timestamp": "string"
}
```

**Notes**:

- `research_publications` is referenced in `createResultCard` but not in the schema; it’s assumed to be synonymous with `research_abstract`.
- Fields like `url`, `university`, etc., are optional and may be `null`.

---

## reCAPTCHA Integration

- **Library**: Include Google reCAPTCHA v2 script:
  ```html
  <script src="https://www.google.com/recaptcha/api.js" async defer></script>
  ```
- **Site Key**: Replace `{{ recaptcha_site_key }}` in `<div class="g-recaptcha" data-sitekey="{{ recaptcha_site_key }}"></div>` with your reCAPTCHA site key.
- **Behavior**:
  - Hidden by default (`hidden` class).
  - Shown when the query input is focused or a query is submitted (`showRecaptcha`).
  - Resets after 110 seconds (`RECAPTCHA_TIMEOUT_MS`) with an error message.
  - Cleared on query completion, error, or cancellation (`hideRecaptcha`).
- **Validation**:
  - Get token with `grecaptcha.getResponse()`.
  - Send in `recaptchaResponse` field with each query.
  - If empty, show “Please complete the reCAPTCHA” error.

**Frontend Example**:

```javascript
if (!grecaptcha.getResponse()) {
  appendOutput("Error: Please complete the reCAPTCHA.", "error");
  return;
}
ws.send(
  JSON.stringify({
    sessionId: sessionId,
    query: q,
    type: selectedType,
    recaptchaResponse: grecaptcha.getResponse(),
  })
);
```

---

## WebSocket Workflow

### 1. Establishing Connection

- **Code** (from `connectWebSocket`):
  ```javascript
  ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws.onopen = () => {
    reconnectAttempts = 0;
    connectionErrorShown = false;
    ws.send(
      JSON.stringify({
        sessionId: null,
        query: null,
        type: "general",
        recaptchaResponse: grecaptcha.getResponse(),
      })
    );
  };
  ```
- **Steps**:
  1. Create a WebSocket connection on page load.
  2. On `onopen`, send an initial message with `sessionId: null` and `recaptchaResponse`.
  3. Server responds with `connected` and a `sessionId`.

### 2. Sending Queries

- **Code** (from `sendQuery`):
  ```javascript
  const q = queryInput.value.trim();
  if (
    !q ||
    !grecaptcha.getResponse() ||
    isRunning ||
    ws.readyState !== WebSocket.OPEN
  ) {
    return;
  }
  ws.send(
    JSON.stringify({
      sessionId: sessionId,
      query: q,
      type: selectedType,
      recaptchaResponse: grecaptcha.getResponse(),
    })
  );
  ```
- **Steps**:
  1. Validate query (non-empty) and reCAPTCHA.
  2. Check `isRunning` and `ws.readyState`.
  3. Send query message with `sessionId`, `query`, `type`, and `recaptchaResponse`.
  4. Clear input, show query card, start progress animation, and set timeout.

### 3. Receiving Messages

- **Code** (from `ws.onmessage`):
  ```javascript
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.status === "connected") {
      sessionId = msg.sessionId;
    } else if (msg.status === "queued") {
      appendOutput(
        `"${msg.message.split('"')[1]}" (type: ${selectedType}) queued`,
        "info"
      );
    } else if (msg.status === "result") {
      resultCount++;
      appendOutput("", "info", msg.data);
    } else if (msg.status === "complete") {
      appendOutput(
        resultCount > 0
          ? "Research search completed successfully."
          : "No relevant climate tech research found.",
        "success"
      );
    }
  };
  ```
- **Steps**:
  1. Parse incoming messages (`JSON.parse`).
  2. Update `sessionId` on `connected`.
  3. Display status messages (`queued`, `processing`) or results (`result`) in `#output`.
  4. On `complete` or `stopped`, reset state and show guest popup if needed.

### 4. Canceling Queries

- **Code** (from `cancelQuery`):
  ```javascript
  ws.send(JSON.stringify({ sessionId: sessionId, action: "cancel" }));
  ```
- **Steps**:
  1. Check `isRunning` and `ws.readyState`.
  2. Send cancel message.
  3. Server responds with `stopped`, triggering UI reset.

### 5. Handling Connection Issues

- **Code** (from `ws.onclose` and `ws.onerror`):
  ```javascript
  ws.onclose = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      setTimeout(connectWebSocket, 1000 * reconnectAttempts);
    } else {
      appendOutput("Unable to connect. Please refresh the page.", "error");
    }
  };
  ```
- **Steps**:
  1. Attempt reconnection up to 5 times (`maxReconnectAttempts`) with exponential backoff.
  2. Show error messages in `#output`.
  3. Reset `isRunning`, clear timeouts, and stop progress animation.

---

## Error Handling

- **WebSocket Errors**:
  - **Connection Failure**: `ws.onclose` or `ws.onerror` triggers reconnection. Show “Connection issue. Retrying...” in `#output`.
  - **Invalid reCAPTCHA**: Server sends `{ "status": "error", "message": "Invalid reCAPTCHA" }`. Display error and prompt reCAPTCHA again.
  - **Query Timeout**: After 120 seconds (`QUERY_TIMEOUT_MS`), show “Search timed out” and reset state.
  - **Malformed Messages**: Wrap `JSON.parse` in `try-catch` to handle invalid JSON.
- **Frontend Errors**:
  - Empty query: Show “Please enter a valid research topic or institution.”
  - Missing reCAPTCHA: Show “Please complete the reCAPTCHA.”
  - Active query: Prevent new queries with “A search is in progress.”
- **HTTP Errors** (if `/api/verify-token` is used):
  - **401 Unauthorized**: Clear `localStorage` and stay in guest mode.
  - **429 Too Many Requests**: Show “Too many requests. Try again later.”

**Example**:

```javascript
try {
  const msg = JSON.parse(event.data);
  if (msg.status === "error") {
    appendOutput(msg.message || "An error occurred.", "error");
  }
} catch (e) {
  appendOutput("Error processing research data.", "error");
}
```

---

## Frontend Integration Guide

### 1. UI Components

- **Sidebar (`#sidebar`)**:
  - Displays “Guest Mode” header and buttons (`newChatButton`, `modeToggle`, `loginButton`).
  - Collapsible via `sidebarCloseToggle` and `sidebarOpenToggle`.
- **Guest Popup (`#guestPopup`)**:
  - Shown on page load and after every 3 queries (`MAX_POPUP_QUERIES`) or 5 minutes (`POPUP_COOLDOWN_MS`).
  - Encourages login/signup with a link to `/login`.
- **Output Area (`#output`)**:
  - Shows welcome section initially, replaced by query cards and results.
  - Uses `appendOutput` for messages and `createResultCard` for `UserEntity` data.
- **Search Bar (`#queryInput`, `#actionButton`)**:
  - Textarea for query input, resizes dynamically (`adjustTextareaHeight`).
  - Button toggles between search (`fa-search`) and stop (`fa-stop`) based on `isRunning`.
- **Type Toggle (`.type-button`)**:
  - Buttons for `general`, `publications`, `websites` searches. Updates `selectedType`.
- **Progress Bar (`.progress-bar-container`)**:
  - Animates during `processing` messages (`startProgressAnimation`).
  - Completes on `result`, `complete`, `stopped`, or error (`completeProgressAnimation`).
- **reCAPTCHA (`.g-recaptcha`)**:
  - Shown on query input focus or submission.
  - Resets after 110 seconds or on completion/error.

### 2. State Management

- **Variables**:
  - `ws`: WebSocket instance.
  - `sessionId`: Set by server on `connected` message.
  - `isRunning`: Tracks active queries to prevent multiple submissions.
  - `reconnectAttempts`: Counts reconnection attempts (max 5).
  - `queryTimeout`: 120-second timeout for queries.
  - `recaptchaTimeout`: 110-second timeout for reCAPTCHA.
  - `selectedType`: Current search type (`general`, `publications`, `websites`).
  - `currentQuery`: Tracks the active query for UI display.
  - `isFirstQuery`: Resets `#output` on first query.
  - `queryCount`: Tracks queries for guest popup (stored in `sessionStorage`).
  - `lastPopupTime`: Manages popup cooldown (stored in `sessionStorage`).
- **Storage**:
  - Use `sessionStorage` for `queryCount` and `lastPopupTime` to persist across page reloads.
  - No `localStorage` for `token` or `user_id` in guest mode.

**Example**:

```javascript
sessionStorage.setItem("queryCount", queryCount + 1);
if (shouldShowPopup()) {
  showGuestPopup();
}
```

### 3. UI Updates

- **Welcome Section**: Shown on page load or after clicking `newChatButton` (`showWelcomeSection`).
- **Query Card**: Added on query submission (`createQueryCard`).
- **Result Card**: Rendered for each `result` message (`createResultCard`).
- **Status Messages**: Shown for `queued`, `processing`, `complete`, `stopped`, or `error` (`appendOutput`).
- **Button States**: Updated via `updateButtonStates` to enable/disable `actionButton` and `newChatButton`.
- **Progress Animation**: Started on `processing` and completed on `result`, `complete`, or `error`.

**Example**:

```javascript
if (msg.status === "result") {
  resultCount++;
  appendOutput("", "info", msg.data); // Adds result card
  completeProgressAnimation();
}
```

### 4. Event Listeners

- **Action Button (`#actionButton`)**: Triggers `sendQuery` or `cancelQuery` based on `isRunning`.
- **Query Input (`#queryInput`)**: Sends query on Enter, adjusts height, shows reCAPTCHA.
- **Type Buttons (`.type-button`)**: Updates `selectedType` and toggles `active` class.
- **Sidebar Toggles**: Collapse/expand sidebar and adjust `mainContent`.
- **Login Button (`#loginButton`)**: Redirects to `/login`.
- **New Chat Button (`#newChatButton`)**: Reloads page to reset session.
- **Mode Toggle (`#modeToggle`)**: Switches between `dark` and `light-frame` themes.

**Example**:

```javascript
actionButton.addEventListener("click", () => {
  if (isRunning) {
    cancelQuery();
  } else {
    showRecaptcha();
    sendQuery();
  }
});
```

### 5. reCAPTCHA Workflow

- Show on input focus or query submission (`showRecaptcha`).
- Reset after 110 seconds with error (`resetRecaptchaTimeout`).
- Clear on query completion or error (`hideRecaptcha`).
- Validate before sending queries (`grecaptcha.getResponse()`).

**Example**:

```javascript
function showRecaptcha() {
  document.querySelector(".g-recaptcha").classList.remove("hidden");
  resetRecaptchaTimeout();
}
```

---

## Testing

Use `wscat` to test the WebSocket endpoint:

1. **Install wscat**:

   ```bash
   npm install -g wscat
   ```

2. **Connect**:

   ```bash
   wscat -c ws://localhost:8000/ws
   ```

3. **Send Initial Message**:

   ```json
   {
     "sessionId": null,
     "query": null,
     "type": "general",
     "recaptchaResponse": "test_token"
   }
   ```

4. **Send Query**:

   ```json
   {
     "sessionId": "session_123",
     "query": "solar energy labs",
     "type": "general",
     "recaptchaResponse": "test_token"
   }
   ```

5. **Cancel Query**:
   ```json
   { "sessionId": "session_123", "action": "cancel" }
   ```

**Expected Responses**:

- **Connected**: `{ "status": "connected", "sessionId": "session_123" }`
- **Queued**: `{ "status": "queued", "message": "Query \"solar energy labs\" queued for processing" }`
- **Result**: `{ "status": "result", "data": { /* UserEntity */ } }`
- **Complete**: `{ "status": "complete" }`

**HTTP Testing** (if `/api/verify-token` is used):

```bash
curl -H "Authorization: Bearer <invalid_token>" http://localhost:8000/api/verify-token
```

---

## Debugging Tips

1. **WebSocket Connection**:

   - Check DevTools > Network > WS for `ws://localhost:8000/ws` (status `101 Switching Protocols`).
   - Log `ws.readyState` (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED).
   - Simulate server downtime to test reconnection (`ws.onclose`).

2. **Message Handling**:

   - Log all messages (`console.log('WebSocket message:', msg)`).
   - Test invalid JSON in `ws.onmessage` to verify `try-catch`.

3. **reCAPTCHA**:

   - Use Google’s test site key (`6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`) for development.
   - Test timeout (110s) by waiting and checking `#output` for “reCAPTCHA expired.”

4. **UI Issues**:

   - Verify `actionButton` toggles between `fa-search` and `fa-stop`.
   - Check `progress-bar` animation starts/stops correctly.
   - Ensure guest popup appears after 3 queries or 5 minutes.

5. **State Bugs**:
   - Confirm `isRunning` prevents multiple queries.
   - Test `sessionStorage.queryCount` increments correctly.
   - Verify `sessionId` updates on `connected` message.

**Example Log**:

```javascript
ws.onmessage = (event) => {
  console.log("Received:", event.data);
  try {
    const msg = JSON.parse(event.data);
    console.log("Parsed:", msg);
  } catch (e) {
    console.error("Parse error:", e);
  }
};
```

---

## Best Practices

1. **WebSocket Management**:

   - Use a single `ws` instance to avoid multiple connections.
   - Check `ws.readyState === WebSocket.OPEN` before sending messages.
   - Implement reconnection with exponential backoff (`1000 * reconnectAttempts`).

2. **reCAPTCHA**:

   - Validate `grecaptcha.getResponse()` before every query.
   - Reset reCAPTCHA on completion or error to avoid stale tokens.
   - Use production site keys in deployed environments.

3. **UI Feedback**:

   - Update `#output` with clear messages for all states (`queued`, `processing`, etc.).
   - Auto-scroll `#output` to new content (`output.scrollTop = output.scrollHeight`).
   - Disable `actionButton` when query is empty or running.

4. **State Management**:

   - Track `isRunning`, `resultCount`, and `currentQuery` to manage query lifecycle.
   - Use `sessionStorage` for `queryCount` and `lastPopupTime` to persist guest data.
   - Reset state on `newChatButton` click (`window.location.reload`).

5. **Error Handling**:

   - Show user-friendly errors in `#output` for all failure cases.
   - Handle network errors gracefully (e.g., “Connection issue. Retrying...”).
   - Clear timeouts (`queryTimeout`, `recaptchaTimeout`) on completion or error.

6. **Guest Mode**:
   - Prompt login/signup via `#guestPopup` strategically.
   - Disable history-related features (e.g., no `/api/history` calls).

---

## Example Workflow

1. **Page Load**:

   - Show guest popup (`showGuestPopup`).
   - Connect to WebSocket and send initial message with `sessionId: null`.
   - Server responds: `{ "status": "connected", "sessionId": "session_123" }`.

2. **User Submits Query**:

   - User enters “solar energy labs” in `#queryInput`, selects `general`, completes reCAPTCHA.
   - `sendQuery` sends:
     ```json
     {
       "sessionId": "session_123",
       "query": "solar energy labs",
       "type": "general",
       "recaptchaResponse": "<token>"
     }
     ```
   - UI shows query card, starts progress animation.

3. **Server Responses**:

   - `queued`: Show “solar energy labs (type: general) queued for processing.”
   - `processing`: Show “Exploring climate tech research at example.com.”
   - `result`: Render `UserEntity` as a card via `createResultCard`.
   - `complete`: Show “Research search completed successfully” or “No relevant climate tech research found.”

4. **User Cancels Query**:

   - Click `#actionButton` (showing `fa-stop`) to send `{ "sessionId": "session_123", "action": "cancel" }`.
   - Server responds: `{ "status": "stopped" }`.
   - UI shows “Search stopped.”

5. **Connection Drops**:

   - `ws.onclose` triggers, attempts reconnection up to 5 times.
   - UI shows “Connection issue. Retrying...”.

6. **Guest Popup**:
   - After 3 queries or 5 minutes, show popup encouraging login/signup.

---

## Integration with Other Endpoints

- **Login/Signup**: The `loginButton` redirects to `/login`, where `/api/login` or `/api/signup` can authenticate users (see previous documentation, artifact version `5d3010e8-f3a8-4f45-8bcd-d740bc51afd0`).
- **Authenticated Mode**: If a `token` exists in `localStorage`, check `/api/verify-token` and redirect to `/dashboard` to exit guest mode.
- **History**: Not available in guest mode. Authenticated users would use `/api/history/{user_id}` (see previous documentation).

**Example Check**:

```javascript
if (localStorage.getItem("token")) {
  fetch("/api/verify-token", {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  }).then((response) => {
    if (response.ok) window.location.href = "/dashboard";
  });
}
```

---

## Additional Notes

- **Security**: Use `wss://` in production to encrypt WebSocket communication.
- **Performance**: Throttle queries with `isRunning` to prevent overloading the server.
- **Testing**: Use a local backend (`ws://localhost:8000/ws`) for development and test reCAPTCHA with Google’s test keys.
- **Issues**: If WebSocket fails or reCAPTCHA errors occur, share DevTools logs (Network > WS) or console errors for troubleshooting.

This documentation should enable a frontend developer to fully implement the guest mode interface. If you need to include other endpoints (e.g., `/api/history`, `/api/share`) or merge with previous documentation, let me know. Share any specific issues or logs for further assistance!
