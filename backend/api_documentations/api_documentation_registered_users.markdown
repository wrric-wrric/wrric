# Unlokinno Intelligence API Documentation (Registered Users)

This documentation is designed for frontend developers building the authenticated user interface of the Unlokinno Intelligence platform, which allows registered users to explore climate technology research labs in Sub-Saharan Africa, manage query history, share/export sessions, submit inquiries, and manage their own labs or startups. It covers API endpoints for WebSocket query processing, user history, session sharing/exporting, inquiries, and lab management, with detailed guidance on request/response formats, authentication, error handling, and frontend integration. The documentation assumes familiarity with JavaScript, HTML, and REST/WebSocket APIs but provides extra detail for developers new to WebSockets or authenticated workflows.

---

## Base URL

- **WebSocket**: `wss://<host>:<port>/ws` (e.g., `wss://localhost:8000/ws` in production, `ws://` for local development)
- **HTTP**: `http://<host>:<port>` (e.g., `http://localhost:8000`, use `https://` in production)

## Registered User Mode Overview

- **Purpose**: Enables authenticated users to search for climate tech research labs, researchers, and publications, save query history, share/export sessions, submit inquiries, and manage their own labs or startups.
- **Authentication**: Requires a Bearer token (`localStorage.token`) and `user_id` (`localStorage.user_id`) for all API requests.
- **Key Features**:
  - Real-time query processing via WebSocket with persistent session history.
  - Session management (view, share, export, delete).
  - Inquiry submission for research entities.
  - CRUD operations for user-managed labs or startups.
  - UI feedback for query status, results, history, and errors.
- **Differences from Guest Mode**:
  - Persistent session history stored via `/api/history/{user_id}`.
  - Ability to share sessions (`/api/share/{session_id}`) and export as CSV/Excel (`/api/export/{session_id}/{format}`).
  - Inquiry submission (`/api/inquiry`) and lab management (`/api/user_entities/`).
  - No reCAPTCHA required (authentication via token).

---

## Authentication

All endpoints require a Bearer token in the `Authorization` header:

```http
Authorization: Bearer <token>
```

- **Obtaining Token**: Via `/api/login` or `/api/signup` (not covered here, assumed to be handled on `/login` page).
- **Validation**: Checked via `/api/verify-token` on page load (`checkAuthStatus`).
- **Storage**: Stored in `localStorage.token` with `user_id` in `localStorage.user_id`.
- **401 Handling**: On `401 Unauthorized`, clear `localStorage` (`token`, `user_id`, `sessionId`, `currentTitle`) and redirect to `/login`.

---

## Endpoints

### 1. Verify Token

Validates the user’s authentication token.

**Endpoint**: `GET /api/verify-token`

**Purpose**: Confirms the token is valid, ensuring the user remains in authenticated mode.

**Request**:

- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```

**Responses**:

- **200 OK**:
  - **Description**: Token is valid.
  - **Body**:
    ```json
    {}
    ```
- **401 Unauthorized**:
  - **Description**: Invalid or expired token.
  - **Body**:
    ```json
    { "detail": "Invalid token" }
    ```

**Frontend Implementation** (from `checkAuthStatus`):

```javascript
const token = localStorage.getItem("token");
if (token) {
  const response = await fetch("/api/verify-token", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("sessionId");
    localStorage.removeItem("currentTitle");
    window.location.href = "/login";
  } else {
    fetchUserHistory();
  }
}
```

---

### 2. WebSocket Connection

Handles real-time query processing for authenticated users.

**Endpoint**: `wss://<host>:<port>/ws`

**Purpose**: Establishes a persistent connection to send queries, receive results (`UserEntity` objects), and manage session state.

**Connection**:

- Connect using `new WebSocket(wsUrl)`.
- On open, send an initial message with `sessionId`, `userId`, `token`, and `title`:
  ```json
  {
    "sessionId": "string | null",
    "userId": "string",
    "token": "string",
    "title": "string | null"
  }
  ```

**Message Types**:

- **Sent by Client**:

  - **Initial Connection**:
    ```json
    {
      "sessionId": "string | null",
      "userId": "string",
      "token": "string",
      "title": "string | null"
    }
    ```
    - Sent on `ws.onopen` to authenticate and initialize the session.
    - `sessionId`: `null` for new sessions, otherwise from `localStorage.sessionId`.
    - `userId`: From `localStorage.user_id`.
    - `token`: From `localStorage.token`.
    - `title`: From `localStorage.currentTitle` or query text for new sessions.
  - **Query**:
    ```json
    {
      "sessionId": "string",
      "userId": "string",
      "query": "string",
      "type": "general | publications | websites",
      "title": "string"
    }
    ```
    - Sent when submitting a query (e.g., “solar energy labs at University of Ghana”).
    - `query`: Search term (required, non-empty).
    - `type`: Search type (`general`, `publications`, `websites`).
    - `title`: Session title (query text for new sessions, otherwise `currentTitle`).
  - **Cancel Query**:
    ```json
    {
      "sessionId": "string",
      "action": "cancel"
    }
    ```
    - Sent to stop an ongoing query.

- **Received by Client**:
  - **Connected/Authenticated**:
    ```json
    {
      "status": "connected | authenticated",
      "sessionId": "string",
      "title": "string | null"
    }
    ```
    - Confirms connection and provides `sessionId` and `title`.
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
    - Shows data fetching from a URL.
  - **Result**:
    ```json
    {
      "status": "result",
      "data": {
        /* UserEntity object */
      }
    }
    ```
    - Delivers a research lab result (see `UserEntity` schema).
  - **Complete**:
    ```json
    {
      "status": "complete"
    }
    ```
    - Signals query completion.
  - **Stopped**:
    ```json
    {
      "status": "stopped"
    }
    ```
    - Indicates query cancellation.
  - **Error**:
    ```json
    {
      "status": "error",
      "url": "string | null",
      "message": "string"
    }
    ```
    - Reports errors (e.g., invalid token, data retrieval failure).

**Frontend Implementation** (from `connectWebSocket`):

```javascript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}/ws`;
ws = new WebSocket(wsUrl);
ws.onopen = () => {
  reconnectAttempts = 0;
  ws.send(
    JSON.stringify({
      sessionId: sessionId || null,
      userId,
      token: localStorage.getItem("token"),
      title: currentTitle || null,
    })
  );
};
```

---

### 3. Fetch User History

Retrieves the user’s query history.

**Endpoint**: `GET /api/history/{user_id}`

**Purpose**: Fetches all sessions (queries and results) for the authenticated user.

**Request**:

- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```
- **Path Parameters**:
  - `user_id`: User ID from `localStorage.user_id`.

**Response**:

- **200 OK**:
  - **Description**: Returns an array of session objects.
  - **Body**:
    ```json
    [
      {
        "id": "string",
        "title": "string",
        "start_time": "string",
        "queries": [
          {
            "query_text": "string",
            "timestamp": "string"
          }
        ],
        "entities": [
          {
            /* UserEntity object */
          }
        ]
      }
    ]
    ```
- **401 Unauthorized**:
  - **Description**: Invalid or expired token.
  - **Body**:
    ```json
    { "detail": "Invalid token" }
    ```

**Frontend Implementation** (from `fetchUserHistory`):

```javascript
const response = await fetch(`/api/history/${userId}`, {
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});
if (response.status === 401) {
  localStorage.clear();
  window.location.href = "/login";
} else {
  const history = await response.json();
  localStorage.setItem("history", JSON.stringify(history));
  // Render history in #historyList
}
```

---

### 4. Share Session

Generates a shareable link for a session.

**Endpoint**: `POST /api/share/{session_id}`

**Purpose**: Creates a public URL for sharing a session’s queries and results.

**Request**:

- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```
- **Path Parameters**:
  - `session_id`: Session ID from WebSocket or history.
- **Body**: Empty.

**Response**:

- **200 OK**:
  - **Description**: Returns the shareable URL.
  - **Body**:
    ```json
    { "share_url": "/share/session/<session_id>" }
    ```
- **401 Unauthorized**:
  - **Body**:
    ```json
    { "detail": "Invalid token" }
    ```
- **404 Not Found**:
  - **Body**:
    ```json
    { "detail": "Session not found" }
    ```

**Frontend Implementation** (from `shareSession`):

```javascript
const response = await fetch(`/api/share/${sessionId}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});
if (response.ok) {
  const { share_url } = await response.json();
  navigator.clipboard.writeText(`${window.location.origin}${share_url}`);
  appendOutput(`Share link copied to clipboard: ${fullUrl}`, "success");
}
```

---

### 5. Export Session

Exports a session’s data as CSV or Excel.

**Endpoint**: `GET /api/export/{session_id}/{format}`

**Purpose**: Downloads session data in the specified format (`csv` or `excel`).

**Request**:

- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```
- **Path Parameters**:
  - `session_id`: Session ID.
  - `format`: `csv` or `excel`.

**Response**:

- **200 OK**:
  - **Description**: Returns a file stream.
  - **Headers**:
    ```http
    Content-Disposition: attachment; filename="session_<session_id>.xlsx|csv"
    ```
  - **Body**: Binary file (CSV or Excel).
- **401 Unauthorized**:
  - **Body**:
    ```json
    { "detail": "Invalid token" }
    ```
- **404 Not Found**:
  - **Body**:
    ```json
    { "detail": "Session not found" }
    ```

**Frontend Implementation** (from `downloadSession`):

```javascript
const format = confirm("Download as Excel? (Click Cancel for CSV)")
  ? "excel"
  : "csv";
const response = await fetch(`/api/export/${sessionId}/${format}`, {
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = `session_${sessionId}.${format === "excel" ? "xlsx" : "csv"}`;
a.click();
```

---

### 6. Delete Session

Deletes a specific session.

**Endpoint**: `DELETE /api/history/{user_id}/{session_id}`

**Purpose**: Removes a session from the user’s history.

**Request**:

- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```
- **Path Parameters**:
  - `user_id`: User ID.
  - `session_id`: Session ID.

**Response**:

- **204 No Content**:
  - **Description**: Session deleted successfully.
- **401 Unauthorized**:
  - **Body**:
    ```json
    { "detail": "Invalid token" }
    ```
- **404 Not Found**:
  - **Body**:
    ```json
    { "detail": "Session not found" }
    ```

**Frontend Implementation** (from `deleteSession`):

```javascript
const response = await fetch(`/api/history/${userId}/${sessionId}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});
if (response.ok) {
  appendOutput(`Session deleted successfully.`, "success");
  fetchUserHistory();
}
```

---

### 7. Submit Inquiry

Submits an inquiry about a research entity.

**Endpoint**: `POST /api/inquiry`

**Purpose**: Allows users to send inquiries about a specific lab or entity.

**Request**:

- **Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer <token>
  ```
- **Body**:
  ```json
  {
    "user_id": "string",
    "entity_id": "integer | null",
    "entity_url": "string | null",
    "inquiry": "string"
  }
  ```
  - `user_id`: From `localStorage.user_id`.
  - `entity_id`: Entity ID from result card (optional).
  - `entity_url`: Entity URL (optional).
  - `inquiry`: Inquiry message (required, non-empty).

**Response**:

- **200 OK**:
  - **Description**: Inquiry submitted successfully.
  - **Body**:
    ```json
    { "message": "Inquiry submitted successfully" }
    ```
- **401 Unauthorized**:
  - **Body**:
    ```json
    { "detail": "Invalid token" }
    ```
- **422 Unprocessable Entity**:
  - **Description**: Validation errors (e.g., missing `inquiry`).
  - **Body**:
    ```json
    {
      "detail": [
        {
          "loc": ["body", "inquiry"],
          "msg": "field required",
          "type": "value_error.missing"
        }
      ]
    }
    ```

**Frontend Implementation** (from `sendInquiry`):

```javascript
const response = await fetch("/api/inquiry", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
  body: JSON.stringify({
    user_id: userId,
    entity_id: inquiryForm.dataset.entityId
      ? parseInt(inquiryForm.dataset.entityId)
      : null,
    entity_url: inquiryForm.dataset.entityUrl || null,
    inquiry: inquiryTextarea.value.trim(),
  }),
});
if (response.ok) {
  appendOutput("Inquiry submitted successfully", "success");
  bootstrap.Modal.getInstance(document.getElementById("inquiryModal")).hide();
}
```

---

### 8. Create Lab

Adds a new lab or startup to the user’s entities.

**Endpoint**: `POST /api/user_entities/`

**Purpose**: Allows users to submit a new lab or startup.

**Request**:

- **Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer <token>
  ```
- **Body** (see `UserEntity` schema):
  ```json
  {
    "url": "string | null",
    "university": "string",
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
      "titles": ["string"],
      "url": "string | null"
    },
    "related": "string | null",
    "point_of_contact": {
      "name": "string | null",
      "email": "string | null",
      "contact": "string | null"
    },
    "scopes": ["string"],
    "research_abstract": "string",
    "lab_equipment": {
      "overview": "string | null",
      "list": ["string"]
    }
  }
  ```
  - Required: `university`, `research_abstract`.
  - Optional fields can be `null` or omitted.

**Response**:

- **201 Created**:
  - **Description**: Lab created successfully.
  - **Body**:
    ```json
    { "id": "integer" /* Rest of UserEntity */ }
    ```
- **401 Unauthorized**:
  - **Body**:
    ```json
    { "detail": "Invalid token" }
    ```
- **422 Unprocessable Entity**:
  - **Body**:
    ```json
    {
      "detail": [
        {
          "loc": ["body", "university"],
          "msg": "field required",
          "type": "value_error.missing"
        }
      ]
    }
    ```

**Frontend Implementation** (from `submitForm` in `add_lab.html`):

```javascript
const formData = {
  university: document.getElementById("university").value,
  research_abstract: document.getElementById("research_abstract").value,
  // Construct other fields dynamically
};
const response = await fetch("http://localhost:8000/api/user_entities/", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
  body: JSON.stringify(formData),
});
if (response.ok) {
  alert("Lab successfully added!");
  window.location.href = "/dashboard";
}
```

---

### 9. Fetch User Labs

Retrieves all labs or startups for the user.

**Endpoint**: `GET /api/user_entities/`

**Purpose**: Fetches the user’s managed labs or startups.

**Request**:

- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```

**Response**:

- **200 OK**:
  - **Description**: Returns an array of `UserEntity` objects.
  - **Body**:
    ```json
    [
      {
        /* UserEntity object */
      }
    ]
    ```
- **401 Unauthorized**:
  - **Body**:
    ```json
    { "detail": "Invalid token" }
    ```

**Frontend Implementation** (from `fetchLabs` in `view_labs.html`):

```javascript
const response = await fetch("http://localhost:8000/api/user_entities/", {
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});
if (response.ok) {
  const labs = await response.json();
  const labsList = document.getElementById("labsList");
  labs.forEach((lab) => {
    const labCard = document.createElement("div");
    labCard.className = "lab-card";
    labCard.dataset.labId = lab.id;
    labCard.dataset.lab = JSON.stringify(lab);
    // Render lab details
  });
}
```

---

### 10. Update Lab

Updates an existing lab or startup.

**Endpoint**: `PUT /api/user_entities/{entity_id}`

**Purpose**: Modifies an existing lab’s details.

**Request**:

- **Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer <token>
  ```
- **Path Parameters**:
  - `entity_id`: ID of the lab to update.
- **Body**: Same as `POST /api/user_entities/` (partial updates allowed).

**Response**:

- **200 OK**:
  - **Description**: Lab updated successfully.
  - **Body**:
    ```json
    { "id": "integer" /* Rest of UserEntity */ }
    ```
- **401 Unauthorized**:
  - **Body**:
    ```json
    { "detail": "Invalid token" }
    ```
- **404 Not Found**:
  - **Body**:
    ```json
    { "detail": "Entity not found" }
    ```

**Frontend Implementation** (from `submitUpdateForm` in `view_labs.html`):

```javascript
const formData = {
  university: document.getElementById("updateUniversity").value || null,
  research_abstract:
    document.getElementById("updateResearchAbstract").value || null,
  // Construct other fields
};
const response = await fetch(
  `http://localhost:8000/api/user_entities/${currentEntityId}`,
  {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify(formData),
  }
);
if (response.ok) {
  alert("Lab successfully updated!");
  fetchLabs();
}
```

---

### 11. Delete Lab

Deletes a user’s lab or startup.

**Endpoint**: `DELETE /api/user_entities/{entity_id}`

**Purpose**: Removes a lab from the user’s entities.

**Request**:

- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```
- **Path Parameters**:
  - `entity_id`: ID of the lab to delete.

**Response**:

- **204 No Content**:
  - **Description**: Lab deleted successfully.
- **401 Unauthorized**:
  - **Body**:
    ```json
    { "detail": "Invalid token" }
    ```
- **404 Not Found**:
  - **Body**:
    ```json
    { "detail": "Entity not found" }
    ```

**Frontend Implementation** (from `deleteLab` in `view_labs.html`):

```javascript
const response = await fetch(
  `http://localhost:8000/api/user_entities/${entityId}`,
  {
    method: "DELETE",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  }
);
if (response.ok) {
  alert("Lab successfully deleted!");
  fetchLabs();
}
```

---

## Data Schema

### UserEntity

Used for query results and lab management.

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
    ],
    "titles": ["string"],
    "url": "string | null"
  },
  "related": "string | null",
  "point_of_contact": {
    "name": "string | null",
    "email": "string | null",
    "contact": "string | null"
  },
  "scopes": ["string"],
  "research_abstract": "string | null",
  "lab_equipment": {
    "overview": "string | null",
    "list": ["string"]
  },
  "last_updated": "string | null",
  "timestamp": "string"
}
```

**Notes**:

- `publications.titles` and `publications.url` are used in `add_lab.html` and `view_labs.html`, while `publications.count` and `publications.list` are used in `createResultCard`.
- Required for `POST /api/user_entities/`: `university`, `research_abstract`.

---

## WebSocket Workflow

### 1. Establishing Connection

- **Code** (from `connectWebSocket`):
  ```javascript
  ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        sessionId: sessionId || null,
        userId,
        token: localStorage.getItem("token"),
        title: currentTitle || null,
      })
    );
  };
  ```
- **Steps**:
  1. Connect to WebSocket on page load.
  2. Send initial message with authentication details.
  3. Server responds with `connected` or `authenticated`, providing `sessionId` and `title`.

### 2. Sending Queries

- **Code** (from `sendQuery`):
  ```javascript
  ws.send(
    JSON.stringify({
      sessionId,
      userId,
      query: q,
      type: selectedType,
      title: isFirstQuery || !sessionId ? q : currentTitle,
    })
  );
  ```
- **Steps**:
  1. Validate query, `userId`, and WebSocket state.
  2. Send query with `title` (query text for new sessions).
  3. Update UI with query card, start progress animation, set timeout.

### 3. Receiving Messages

- **Code** (from `ws.onmessage`):
  ```javascript
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.status === "result") {
      resultCount++;
      appendOutput("", "info", msg.data);
    } else if (msg.status === "complete") {
      appendOutput(
        resultCount > 0
          ? "Research search completed successfully."
          : "No relevant climate tech research found.",
        "success"
      );
      fetchUserHistory();
    }
  };
  ```
- **Steps**:
  1. Parse messages and update `sessionId`, `currentTitle`.
  2. Display status messages or results in `#output`.
  3. On `complete`, refresh history and reset state.

### 4. Canceling Queries

- **Code** (from `cancelQuery`):
  ```javascript
  ws.send(JSON.stringify({ sessionId, action: "cancel" }));
  ```
- **Steps**:
  1. Send cancel message if `isRunning` and WebSocket is open.
  2. Server responds with `stopped`, resetting UI.

### 5. Handling Connection Issues

- **Code** (from `ws.onclose`):
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
  1. Attempt reconnection up to 5 times with exponential backoff.
  2. Show error messages and reset state.

---

## Error Handling

- **WebSocket Errors**:
  - **Connection Failure**: Reconnect up to 5 times, show “Connection lost. Reconnecting...” in `#output`.
  - **Invalid Token**: Server sends `{ "status": "error", "message": "Invalid token" }`. Clear `localStorage` and redirect to `/login`.
  - **Query Timeout**: After 120 seconds (`QUERY_TIMEOUT_MS`), show “Search took too long” and reset.
- **HTTP Errors**:
  - **401 Unauthorized**: Clear `localStorage` and redirect to `/login`.
  - **404 Not Found**: Show “Session/Entity not found” in `#output` or `#updateErrorMessage`.
  - **422 Unprocessable Entity**: Display validation errors (e.g., “university: field required”).
  - **429 Too Many Requests**: Show “Too many requests. Try again later.”
- **Frontend Errors**:
  - Empty query: Show “Please enter a valid research topic or institution.”
  - Active query: Show “A search is in progress.”
  - Invalid JSON: Wrap `JSON.parse` in `try-catch` to handle malformed messages.

**Example**:

```javascript
try {
  const msg = JSON.parse(event.data);
  if (msg.status === "error") {
    appendOutput(msg.message, "error");
    if (msg.message.includes("token")) {
      localStorage.clear();
      window.location.href = "/login";
    }
  }
} catch (e) {
  appendOutput("Error processing data.", "error");
}
```

---

## Frontend Integration Guide

### 1. UI Components

- **Sidebar (`#sidebar`)**:
  - Displays “Query History” with `#historyList`, `newSessionButton`, `modeToggle`, `logoutButton`, `addEntityButton`, `viewLabsButton`.
  - Collapsible via `sidebarCloseToggle` and `sidebarOpenToggle`.
- **Output Area (`#output`)**:
  - Shows welcome section or session results (`createResultCard` for `UserEntity`).
  - Uses `appendOutput` for status messages.
- **Search Bar (`#queryInput`, `#actionButton`)**:
  - Textarea for queries, resizes dynamically (`adjustTextareaHeight`).
  - Button toggles between search (`fa-search`) and stop (`fa-stop`).
- **Type Toggle (`.type-button`)**:
  - Buttons for `general`, `publications`, `websites` searches.
- **Inquiry Modal (`#inquiryModal`)**:
  - Triggered by `.inquiry-icon` in result cards.
  - Submits inquiries via `#inquiryForm`.
- **Lab Management**:
  - **Add Lab (`add_lab.html`)**: Form to create new labs (`/api/user_entities/`).
  - **View Labs (`view_labs.html`)**: Lists labs with update/delete options.

### 2. State Management

- **Variables**:
  - `ws`: WebSocket instance.
  - `sessionId`, `userId`, `currentTitle`: Stored in `localStorage`.
  - `isRunning`: Prevents multiple queries.
  - `reconnectAttempts`: Tracks reconnection attempts.
  - `queryTimeout`: 120-second query timeout.
  - `selectedType`: Current search type.
  - `resultCount`, `currentQuery`, `isFirstQuery`: Manage query lifecycle.
  - `processingMessages`: Tracks active progress animations.
- **Storage**:
  - `localStorage`: Stores `token`, `user_id`, `sessionId`, `currentTitle`, `history`.
  - Clear on `401` or logout.

**Example**:

```javascript
localStorage.setItem("sessionId", sessionId);
localStorage.setItem("currentTitle", currentTitle);
```

### 3. UI Updates

- **Welcome Section**: Shown on new session or page load (`showWelcomeSection`).
- **Query Card**: Added on query submission (`appendOutput`).
- **Result Card**: Rendered for `result` messages (`createResultCard`).
- **History List**: Populated via `fetchUserHistory`, with share/delete/download actions.
- **Progress Animation**: Started on `processing`, completed on `result`, `complete`, or `error`.
- **Lab Forms**: Dynamically populate fields for updates (`showUpdateForm`).

**Example**:

```javascript
if (msg.status === "result") {
  appendOutput("", "info", msg.data);
  output.scrollTop = output.scrollHeight;
}
```

### 4. Event Listeners

- **Action Button**: Triggers `sendQuery` or `cancelQuery`.
- **Query Input**: Sends query on Enter, adjusts height.
- **Type Buttons**: Update `selectedType`.
- **Sidebar Toggles**: Collapse/expand sidebar.
- **Logout Button**: Clears `localStorage` and redirects to `/login`.
- **Add/View Labs Buttons**: Navigate to `/static/add_lab.html` or `/static/view_labs.html`.
- **Inquiry Form**: Submits inquiries and updates button state.
- **Lab Actions**: Trigger `showUpdateForm`, `deleteLab`.

**Example**:

```javascript
document.getElementById("addEntityButton").addEventListener("click", () => {
  window.location.href = "/static/add_lab.html";
});
```

---

## Testing

Use `wscat` for WebSocket and `curl` for HTTP:

1. **WebSocket**:

   ```bash
   wscat -c ws://localhost:8000/ws
   ```

   - Initial: `{"sessionId":null,"userId":"123","token":"your_token","title":null}`
   - Query: `{"sessionId":"session_123","userId":"123","query":"solar labs","type":"general","title":"solar labs"}`
   - Cancel: `{"sessionId":"session_123","action":"cancel"}`

2. **HTTP**:
   - History: `curl -H "Authorization: Bearer <token>" http://localhost:8000/api/history/123`
   - Share: `curl -X POST -H "Authorization: Bearer <token>" http://localhost:8000/api/share/session_123`
   - Export: `curl -H "Authorization: Bearer <token>" http://localhost:8000/api/export/session_123/csv`
   - Inquiry: `curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"user_id":"123","inquiry":"Details about lab"}' http://localhost:8000/api/inquiry`
   - Create Lab: `curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"university":"Test Uni","research_abstract":"Test"}' http://localhost:8000/api/user_entities/`

---

## Debugging Tips

1. **WebSocket**:

   - Check DevTools > Network > WS for `101 Switching Protocols`.
   - Log `ws.readyState` and messages (`console.log('WebSocket message:', msg)`).
   - Test reconnection logic by simulating server downtime.

2. **HTTP**:

   - Log response status and body for all requests.
   - Handle `401` by clearing `localStorage` and redirecting.
   - Check `422` errors for validation details.

3. **UI**:

   - Verify `actionButton` toggles correctly.
   - Ensure `#historyList` updates after `fetchUserHistory`.
   - Test modal behavior (`#inquiryModal`, `#updateFormContainer`).
   - Check form field population in `showUpdateForm`.

4. **State**:
   - Confirm `sessionId`, `currentTitle` persist in `localStorage`.
   - Test `isRunning` prevents multiple queries.
   - Verify `resultCount` resets on new session.

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

1. **Authentication**:
   - Validate token on page load (`checkAuthStatus`).
   - Clear `localStorage` on `401` errors.
2. **WebSocket**:
   - Use a single `ws` instance.
   - Check `ws.readyState` before sending messages.
   - Implement reconnection with backoff.
3. **UI Feedback**:
   - Show clear status messages for all API responses.
   - Auto-scroll `#output` to new content.
   - Disable buttons during active queries or submissions.
4. **State Management**:
   - Persist `sessionId`, `currentTitle` in `localStorage`.
   - Reset state on new session (`resetState`).
5. **Error Handling**:
   - Display user-friendly errors in `#output` or `#errorMessage`.
   - Handle validation errors (`422`) with detailed messages.
6. **Lab Management**:
   - Validate required fields (`university`, `research_abstract`).
   - Pre-populate update forms with existing data.

---

## Example Workflow

1. **Login**:

   - User logs in, storing `token` and `user_id` in `localStorage`.
   - `checkAuthStatus` validates token via `/api/verify-token`.

2. **Query**:

   - Connect to WebSocket, authenticate with `userId`, `token`.
   - Submit query: `{"sessionId":"session_123","userId":"123","query":"solar labs","type":"general","title":"solar labs"}`.
   - UI shows query card, progress animation.
   - Receive `result` messages, render `UserEntity` cards.

3. **History**:

   - Fetch `/api/history/{user_id}` to populate `#historyList`.
   - Click a session to load results (`loadSessionResults`).

4. **Share/Export**:

   - Share: `POST /api/share/{session_id}` to copy link.
   - Export: `GET /api/export/{session_id}/csv` to download file.

5. **Inquiry**:

   - Click `.inquiry-icon`, open `#inquiryModal`, submit via `/api/inquiry`.

6. **Lab Management**:
   - Add lab via `/static/add_lab.html` (`POST /api/user_entities/`).
   - View/update/delete labs via `/static/view_labs.html`.

---

## Integration with Guest Mode

- **Switching**: If no `token` or `user_id`, redirect to `/login` (not guest mode).
- **Differences**:
  - Registered users have persistent history, no reCAPTCHA.
  - Additional endpoints for sharing, exporting, inquiries, and lab management.
- **Fallback**: On `401`, clear `localStorage` and redirect to `/login`.

---

## Additional Notes

- **Security**: Use `wss://` and `https://` in production.
- **Performance**: Throttle queries with `isRunning`. Cache history in `localStorage`.
- **Testing**: Use local server (`http://localhost:8000`) for development.
- **Issues**: Share DevTools logs (Network > WS/HTTP) or console errors for troubleshooting.

This documentation covers all registered user APIs. If you need further details or integration with other endpoints, let me know!
