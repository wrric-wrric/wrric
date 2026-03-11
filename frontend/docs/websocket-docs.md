# Unlokinno Intelligence WebSocket API Documentation

This guide is designed for frontend developers new to WebSockets, focusing on how to use the WebSocket endpoint in the Unlokinno Intelligence API to handle real-time query processing for climate technology research data. The WebSocket allows the frontend to send queries and receive updates (e.g., query status, results) instantly, unlike traditional HTTP requests. We’ll break down the concepts, show how the provided `index.html` code uses WebSockets, and provide step-by-step instructions for integration, with emphasis on clarity for beginners.

---

## What is a WebSocket?

A **WebSocket** is a technology that creates a persistent, two-way connection between the browser (frontend) and the server. Unlike HTTP requests, which are one-off (request-response), WebSockets allow the server to push data to the browser in real-time without the browser needing to ask repeatedly. In Unlokinno Intelligence, the WebSocket is used to:

- Send search queries (e.g., “solar energy labs at University of Ghana”).
- Receive real-time updates like query status (`queued`, `processing`, `complete`) and results (`UserEntity` objects).
- Handle actions like canceling a query.

Think of it like a phone call: once connected, both sides can talk anytime, and the connection stays open until closed.

---

## WebSocket Endpoint

**Endpoint**: `ws://<host>:<port>/ws` (or `wss://` for HTTPS)

- **Protocol**: Use `ws://` for development (e.g., `ws://localhost:8000/ws`) and `wss://` for production (secure).
- **Purpose**: Establishes a real-time connection for sending queries and receiving results.

**Key Features**:
- Requires authentication with a Bearer token, user ID, and optional session ID/title.
- Supports multiple message types (e.g., query submission, results, status updates).
- Handles reconnection if the connection drops.

---

## WebSocket Workflow in Unlokinno Intelligence

The frontend code in `index.html` uses a WebSocket to:
1. **Connect**: Establish a connection and authenticate with the server.
2. **Send Queries**: Send user queries (e.g., search for labs) with metadata like session ID and query type.
3. **Receive Updates**: Get real-time messages about query status and results.
4. **Cancel Queries**: Send a cancel action to stop an ongoing search.
5. **Handle Errors**: Manage connection issues, timeouts, and server errors.

Here’s how it’s implemented in the JavaScript code:

```javascript
const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
ws.onopen = () => {
    ws.send(JSON.stringify({
        sessionId: sessionId || null,
        userId,
        token: localStorage.getItem('token'),
        title: currentTitle || null
    }));
};
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    // Handle messages (e.g., status, result, error)
};
ws.onclose = () => {
    // Attempt reconnection
};
ws.onerror = (err) => {
    // Display error
};
```

---

## Step-by-Step Guide to Working with WebSockets

### 1. Establishing a Connection
To start, create a WebSocket connection using the `WebSocket` constructor.

**Code** (from `connectWebSocket`):
```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws`;
ws = new WebSocket(wsUrl);
```

**Explanation**:
- **URL**: Uses `ws://` for HTTP or `wss://` for HTTPS, based on `window.location.protocol`.
- **Variable**: Stores the WebSocket instance in `ws` (global variable for reuse).
- **Why**: This opens a connection to the server, like dialing a phone number.

**For Beginners**:
- Ensure the backend is running (e.g., `ws://localhost:8000/ws` for local development).
- Check `window.location.host` to confirm the correct host/port (e.g., `localhost:8000`).
- If the connection fails, the `onerror` or `onclose` events will trigger (see below).

### 2. Authenticating on Connection
Once connected (`onopen`), send an authentication message with `userId`, `token`, `sessionId`, and `title`.

**Code** (from `connectWebSocket`):
```javascript
ws.onopen = () => {
    reconnectAttempts = 0;
    console.log('Successfully connected to Unlokinno Intelligence');
    const token = localStorage.getItem('token');
    if (token && userId) {
        ws.send(JSON.stringify({
            sessionId: sessionId || null,
            userId,
            token,
            title: currentTitle || null
        }));
    }
};
```

**Message Format**:
```json
{
  "sessionId": "session_123",
  "userId": "user_456",
  "token": "<bearer_token>",
  "title": "solar energy labs at University of Ghana"
}
```

**Explanation**:
- **Fields**:
  - `sessionId`: Tracks the current session (stored in `localStorage.sessionId`).
  - `userId`: Identifies the user (from `localStorage.user_id`).
  - `token`: Authenticates the user (from `localStorage.token`).
  - `title`: Describes the session (e.g., query text for new sessions).
- **Why**: The server needs to know who you are and which session you’re working with.
- **Behavior**: The server responds with a `connected` or `authenticated` message (see below).

**For Beginners**:
- Ensure `localStorage` has `token` and `user_id` before connecting (set during login).
- Use `JSON.stringify` to convert the JavaScript object to a string for `ws.send`.
- If `userId` or `token` is missing, redirect to `/login` (handled in `checkAuthStatus`).

### 3. Sending Queries
When the user submits a query (e.g., via the search bar), send a query message.

**Code** (from `sendQuery`):
```javascript
ws.send(JSON.stringify({
    sessionId,
    userId,
    query: q,
    type: selectedType,
    title: isFirstQuery || !sessionId ? q : currentTitle
}));
```

**Message Format**:
```json
{
  "sessionId": "session_123",
  "userId": "user_456",
  "query": "solar energy labs at University of Ghana",
  "type": "general",
  "title": "solar energy labs at University of Ghana"
}
```

**Explanation**:
- **Fields**:
  - `query`: The user’s search input (e.g., “solar energy labs”).
  - `type`: Query type (`general`, `publications`, `websites`), set via UI buttons.
  - `title`: Session title, set to query text for new sessions.
- **Why**: This tells the server to start processing the query.
- **Behavior**: The server responds with `queued`, `processing`, `result`, or `complete` messages.

**For Beginners**:
- Check `ws.readyState === WebSocket.OPEN` before sending (`1` means connected).
- Validate the query (`q.trim()`) to avoid sending empty queries.
- Update the UI to show the query is processing (e.g., `appendOutput` with `info` type).

### 4. Receiving Messages
Handle incoming messages in the `onmessage` event.

**Code** (from `connectWebSocket`):
```javascript
ws.onmessage = (event) => {
    try {
        const msg = JSON.parse(event.data);
        if (msg.status === 'connected' || msg.status === 'authenticated') {
            sessionId = msg.sessionId;
            localStorage.setItem('sessionId', sessionId);
            if (msg.title) currentTitle = msg.title;
        } else if (msg.status === 'queued') {
            appendOutput(`Query "${msg.message.split('"')[1]}" (type: ${selectedType}) queued`, 'info');
        } else if (msg.status === 'entity') {
            appendOutput('', 'info', msg.data);
        } else if (msg.status === 'complete') {
            appendOutput('Research search completed successfully.', 'success');
        }
    } catch (e) {
        appendOutput('Error processing research data.', 'error');
    }
};
```

**Message Types**:
- **Connected/Authenticated**:
  ```json
  {
    "status": "connected" | "authenticated",
    "sessionId": "session_123",
    "title": "solar energy labs at University of Ghana"
  }
  ```
  - Updates `sessionId` and `currentTitle`, stored in `localStorage`.
- **Queued**:
  ```json
  {
    "status": "queued",
    "message": "Query \"solar energy labs\" queued for processing"
  }
  ```
  - Shows the query is in line to be processed.
- **Processing**:
  ```json
  {
    "status": "processing",
    "url": "https://enyim-notifications.onrender.com/health"
  }
  ```
  - Indicates the server is fetching data from a URL.
- **Result**:
  ```json
  {
    "status": "result",
    "data": {
      "id": 1,
      "url": "https://enyim-notifications.onrender.com/health",
      "university": "University of Ghana",
      "location": { "city": "Accra", "country": "Ghana" },
      "scopes": ["Solar Energy", "Renewable Energy"],
      "timestamp": "2025-07-06T13:00:10Z"
    }
  }
  ```
  - Contains a `UserEntity` object to render in the UI.
- **Complete**:
  ```json
  {
    "status": "complete"
  }
  ```
  - Signals the query is done, updates UI with success or “no results” message.
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
    "url": "https://example.com",
    "message": "Failed to retrieve data"
  }
  ```
  - Shows an error, often with a problematic URL.

**Explanation**:
- **Parsing**: Use `JSON.parse(event.data)` to convert the message to an object.
- **Status Handling**: Check `msg.status` to decide how to update the UI.
- **UI Updates**: Use `appendOutput` to show messages or results (via `createResultCard`).

**For Beginners**:
- Always wrap `JSON.parse` in a `try-catch` to handle malformed messages.
- Log messages (`console.log('WebSocket message:', msg)`) for debugging.
- Use a `switch` or `if-else` to handle different `status` values systematically.
- Update UI state (e.g., `isRunning`, `resultCount`) to reflect the query’s progress.

### 5. Canceling Queries
Send a cancel message to stop an ongoing query.

**Code** (from `cancelQuery`):
```javascript
ws.send(JSON.stringify({ sessionId, action: 'cancel' }));
```

**Message Format**:
```json
{
  "sessionId": "session_123",
  "action": "cancel"
}
```

**Explanation**:
- **Why**: Stops a long-running query (e.g., if the user clicks the “stop” button).
- **Behavior**: The server responds with a `stopped` message, and the frontend updates the UI.

**For Beginners**:
- Check `isRunning` and `ws.readyState` before sending to avoid errors.
- Update the UI to show “Search stopped” (`appendOutput` with `info` type).
- Clear any timeouts (e.g., `clearQueryTimeout`) to reset state.

### 6. Handling Connection Issues
Manage connection drops and errors using `onclose` and `onerror`.

**Code** (from `connectWebSocket`):
```javascript
ws.onclose = () => {
    isRunning = false;
    clearQueryTimeout();
    updateProcessingMessages();
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        appendOutput(`Connection lost. Reconnecting (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`, 'error');
        setTimeout(connectWebSocket, 1000 * reconnectAttempts);
    } else {
        appendOutput('Unable to connect after multiple attempts.', 'error');
    }
};
ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    appendOutput('Connection error. Attempting to reconnect...', 'error');
};
```

**Explanation**:
- **Reconnection**: Attempts to reconnect up to `maxReconnectAttempts` (5) times with a delay (e.g., 1s, 2s, 3s).
- **State Reset**: Clears `isRunning`, timeouts, and processing messages.
- **UI Feedback**: Shows error messages to the user.

**For Beginners**:
- **States**: Check `ws.readyState`:
  - `0` (CONNECTING): Still connecting.
  - `1` (OPEN): Ready to send/receive.
  - `2` (CLOSING): Closing.
  - `3` (CLOSED): Disconnected.
- **Reconnection Logic**: Use `setTimeout` for exponential backoff (e.g., `1000 * reconnectAttempts`).
- **Debugging**: Log errors (`console.error`) and show user-friendly messages in the UI.

### 7. Managing Timeouts
Implement a timeout to handle long-running queries.

**Code** (from `resetQueryTimeout` and `clearQueryTimeout`):
```javascript
function resetQueryTimeout() {
    clearQueryTimeout();
    queryTimeout = setTimeout(() => {
        isRunning = false;
        updateProcessingMessages();
        appendOutput('Search took too long. Try a more specific query.', 'error');
    }, 120000);
}
function clearQueryTimeout() {
    if (queryTimeout) {
        clearTimeout(queryTimeout);
        queryTimeout = null;
    }
}
```

**Explanation**:
- **Timeout**: 120 seconds (`QUERY_TIMEOUT_MS`) to prevent hanging queries.
- **Behavior**: If no `complete` or `error` message arrives, shows an error and resets state.
- **Why**: Ensures the UI doesn’t freeze if the server is slow.

**For Beginners**:
- Use `setTimeout` to set a timer when a query starts (`sendQuery`).
- Clear the timer (`clearTimeout`) when the query completes or is canceled.
- Update UI state (`isRunning = false`) to allow new queries.

---

## Integration with the UI

The WebSocket integrates with the UI via:
- **Search Bar (`queryInput`)**: Triggers `sendQuery` on Enter or button click.
- **Action Button (`actionButton`)**: Toggles between search (`fa-search`) and stop (`fa-stop`) based on `isRunning`.
- **Output Area (`output`)**: Displays status messages and results using `appendOutput`.
- **History List (`historyList`)**: Updates when new results arrive (`fetchUserHistory` after `complete`).
- **Progress Animation**: Shows a loading bar for `processing` messages (`startProgressAnimation`).

**Key Functions**:
- `appendOutput(msg, type, data)`: Adds messages or results to the UI.
- `createResultCard(data)`: Renders `UserEntity` data as a card.
- `updateButtonStates()`: Enables/disables buttons based on state.
- `adjustTextareaHeight()`: Resizes the query input dynamically.

**Example UI Update**:
```javascript
if (msg.status === 'result') {
    resultCount++;
    appendOutput('', 'info', msg.data); // Adds a result card
} else if (msg.status === 'complete') {
    isRunning = false;
    updateProcessingMessages(); // Updates processing messages to "complete"
    appendOutput('Research search completed successfully.', 'success');
}
```

**For Beginners**:
- Always update the UI after processing a message (e.g., show results, errors).
- Use `output.scrollTop = output.scrollHeight` to auto-scroll to new content.
- Disable the search button when `isRunning` is `true` to prevent multiple queries.

---

## Debugging WebSockets

WebSockets can be tricky to debug because they’re real-time. Here’s how to troubleshoot:

1. **Check Connection**:
   - Open the browser’s DevTools (F12) > Network > WS tab.
   - Look for the WebSocket connection (e.g., `ws://localhost:8000/ws`).
   - Verify it’s in `101 Switching Protocols` status (connected).

2. **Log Messages**:
   - Add `console.log('WebSocket message:', msg)` in `onmessage` to see incoming data.
   - Log sent messages in `sendQuery` or `ws.send`.

3. **Test Reconnection**:
   - Stop the backend server to simulate a connection drop.
   - Check if `onclose` triggers and reconnection attempts occur.

4. **Simulate Messages**:
   - Use a WebSocket client like `wscat`:
     ```bash
     wscat -c ws://localhost:8000/ws
     > {"sessionId":"session_123","userId":"user_456","token":"your_token","title":"test"}
     ```
   - Send test messages to verify UI updates.

5. **Inspect Errors**:
   - Check `onerror` logs (`console.error('WebSocket error:', err)`).
   - Look for `401` errors in HTTP requests (e.g., `/api/verify-token`) that might cause WebSocket issues.

**Common Issues**:
- **Connection Refused**: Ensure the backend is running and the URL is correct.
- **Authentication Failure**: Verify `token` and `userId` in `localStorage`.
- **Malformed Messages**: Ensure `JSON.parse` is wrapped in `try-catch`.
- **Timeout**: Check if `queryTimeout` is clearing correctly.

---

## Best Practices for WebSocket Integration

1. **Single Connection**:
   - Store the WebSocket in a global variable (`ws`) to avoid multiple connections.
   - Check `ws.readyState` before sending messages.

2. **Authentication**:
   - Send the authentication message immediately in `onopen`.
   - Handle `401` by redirecting to `/login` (via `/api/verify-token`).

3. **State Management**:
   - Track `isRunning` to prevent multiple queries.
   - Store `sessionId`, `currentTitle`, and `resultCount` for session continuity.

4. **Reconnection**:
   - Implement exponential backoff (e.g., `1000 * reconnectAttempts`).
   - Limit retries (`maxReconnectAttempts = 5`) to avoid infinite loops.

5. **UI Feedback**:
   - Show loading animations for `processing` messages.
   - Update button states dynamically (`updateButtonStates`).
   - Clear the query input after sending (`queryInput.value = ''`).

6. **Error Handling**:
   - Display user-friendly errors for `error` messages or connection issues.
   - Handle JSON parsing errors gracefully.

---

## Example: Full WebSocket Flow

Here’s how a user interaction works:

1. **User Loads Page**:
   - `connectWebSocket` creates a WebSocket and sends:
     ```json
     {
       "sessionId": null,
       "userId": "user_456",
       "token": "<token>",
       "title": null
     }
     ```
   - Server responds:
     ```json
     {
       "status": "connected",
       "sessionId": "session_123",
       "title": null
     }
     ```

2. **User Submits Query**:
   - User types “solar energy labs” and clicks search.
   - `sendQuery` sends:
     ```json
     {
       "sessionId": "session_123",
       "userId": "user_456",
       "query": "solar energy labs",
       "type": "general",
       "title": "solar energy labs"
     }
     ```
   - UI shows: “Initiating search for: ‘solar energy labs’ (type: general)”.

3. **Server Processes Query**:
   - Server sends:
     ```json
     {
       "status": "queued",
       "message": "Query \"solar energy labs\" queued"
     }
     ```
     ```json
     {
       "status": "processing",
       "url": "https://example.com"
     }
     ```
     ```json
     {
       "status": "result",
       "data": { /* UserEntity */ }
     }
     ```
     ```json
     {
       "status": "complete"
     }
     ```
   - UI updates with each message (queued, processing, result card, complete).

4. **User Cancels Query**:
   - User clicks stop button, `cancelQuery` sends:
     ```json
     {
       "sessionId": "session_123",
       "action": "cancel"
     }
     ```
   - Server responds:
     ```json
     {
       "status": "stopped"
     }
     ```

5. **Connection Drops**:
   - `onclose` triggers, attempts reconnection up to 5 times.
   - UI shows: “Connection lost. Reconnecting (attempt 1/5)...”.

---

## Testing WebSockets

Use `wscat` to test the WebSocket server:

1. **Install wscat**:
   ```bash
   npm install -g wscat
   ```

2. **Connect**:
   ```bash
   wscat -c ws://localhost:8000/ws
   ```

3. **Send Authentication**:
   ```json
   {"sessionId":null,"userId":"user_456","token":"your_token","title":null}
   ```

4. **Send Query**:
   ```json
   {"sessionId":"session_123","userId":"user_456","query":"solar energy labs","type":"general","title":"solar energy labs"}
   ```

5. **Send Cancel**:
   ```json
   {"sessionId":"session_123","action":"cancel"}
   ```

**Expected Responses**:
- Monitor incoming messages in `wscat`.
- Verify UI updates in the browser by triggering messages manually.

---

## Debugging Tips for Beginners

1. **Check WebSocket Status**:
   - In DevTools > Network > WS, ensure the connection is active (green dot).
   - Log `ws.readyState` to verify state (`0`, `1`, `2`, `3`).

2. **Inspect Messages**:
   - Add `console.log('Sent:', message)` before `ws.send`.
   - Log all incoming messages in `onmessage`.

3. **Simulate Issues**:
   - Disconnect the backend to test `onclose` logic.
   - Send invalid JSON to test `try-catch` in `onmessage`.
   - Use an invalid `token` to test authentication failures.

4. **Use Browser Tools**:
   - Filter WebSocket messages in DevTools to see only `ws://` traffic.
   - Check Console for errors (`WebSocket error` or JSON parsing issues).

5. **Test UI Integration**:
   - Submit a query and verify the search bar clears and the output updates.
   - Click the stop button to ensure the query cancels.

---

## Common Pitfalls and Solutions

1. **Connection Fails**:
   - **Cause**: Wrong URL or backend not running.
   - **Solution**: Verify `wsUrl` and ensure the server is up.

2. **Messages Not Received**:
   - **Cause**: Server didn’t authenticate or message format is incorrect.
   - **Solution**: Check `token` and `userId`, log sent/received messages.

3. **UI Freezes**:
   - **Cause**: Timeout not cleared or `isRunning` not reset.
   - **Solution**: Ensure `clearQueryTimeout` and `isRunning = false` on `complete` or `stopped`.

4. **Multiple Connections**:
   - **Cause**: Creating new `WebSocket` instances without closing the old one.
   - **Solution**: Use a single `ws` variable and check `ws.readyState`.

5. **JSON Errors**:
   - **Cause**: Malformed server messages.
   - **Solution**: Wrap `JSON.parse` in `try-catch` and log errors.

---

## Additional Notes

- **Security**: Always use `wss://` in production to encrypt data.
- **Performance**: Avoid sending queries too quickly; use `isRunning` to throttle.
- **State Sync**: Keep `localStorage` (`sessionId`, `currentTitle`) in sync with server responses.
- **Testing Environment**: Set up a local backend (e.g., `ws://localhost:8000/ws`) for development.

If you encounter issues (e.g., connection errors, unexpected messages), share console logs or DevTools screenshots, and I can help troubleshoot. For further endpoints (e.g., `/api/user_entities` from `view_labs.html`), let me know to extend the documentation!