# Duplicate Registration Error Handling Fix

## Problem

When a user tries to register for an event they're already registered for, the backend was detecting this correctly and returning a **409 Conflict** with detailed information, but the API endpoint was catching this exception and converting it to a generic **500 Internal Server Error**.

### Backend Service (Correct) ✅
```python
raise HTTPException(
    status_code=409,
    detail={
        "error": "duplicate_registration",
        "message": "You are already registered for this event",
        "registration_id": "60cfec39-2889-4d04-b47f-43a59af0920f",
        "registration_status": "pending",
        "available_actions": ["view", "edit", "cancel"]
    }
)
```

### API Endpoint (Broken) ❌
```python
except Exception as e:
    logger.exception(f"Failed to register for event: {str(e)}")
    raise HTTPException(status_code=500, detail="Failed to register for event")
```

### Frontend Received ❌
```json
{
  "detail": "Failed to register for event"
}
```
**Status: 500** - No actionable information!

---

## Solution

Updated the exception handling in `api/admin/events.py` to **preserve HTTPExceptions** (like 409) instead of converting them to 500.

### Fixed Code ✅
```python
except HTTPException:
    # Re-raise HTTP exceptions (like 409 duplicate registration) with their original status and detail
    raise
except ValueError as e:
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    logger.exception(f"Failed to register for event: {str(e)}")
    raise HTTPException(status_code=500, detail="Failed to register for event")
```

---

## Frontend Now Receives ✅

**Status: 409 Conflict**

```json
{
  "detail": {
    "error": "duplicate_registration",
    "message": "You are already registered for this event",
    "registration_id": "60cfec39-2889-4d04-b47f-43a59af0920f",
    "registration_status": "pending",
    "available_actions": ["view", "edit", "cancel"]
  }
}
```

---

## Frontend Implementation Guide

### Detecting Duplicate Registration

```javascript
try {
  const response = await fetch(`/api/admin/events/${eventId}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registrationData)
  });

  if (response.status === 409) {
    const error = await response.json();
    
    if (error.detail?.error === 'duplicate_registration') {
      // User already registered!
      const { message, registration_id, registration_status, available_actions } = error.detail;
      
      // Show user-friendly message
      showMessage(message);  // "You are already registered for this event"
      
      // Show available actions
      if (available_actions.includes('view')) {
        showButton('View Registration', () => viewRegistration(registration_id));
      }
      if (available_actions.includes('edit')) {
        showButton('Edit Registration', () => editRegistration(registration_id));
      }
      if (available_actions.includes('cancel')) {
        showButton('Cancel Registration', () => cancelRegistration(registration_id));
      }
      
      return;
    }
  }

  if (!response.ok) {
    throw new Error('Registration failed');
  }

  const data = await response.json();
  // Success! Handle normal registration
  
} catch (error) {
  console.error('Registration error:', error);
  showMessage('An unexpected error occurred');
}
```

### Example UI Flow

**Duplicate Registration Detected:**
```
┌──────────────────────────────────────────────┐
│  ⚠️  Already Registered                      │
│                                              │
│  You are already registered for this event  │
│                                              │
│  Status: Pending                             │
│                                              │
│  [View Registration]  [Edit]  [Cancel]      │
└──────────────────────────────────────────────┘
```

---

## Other Error Cases to Handle

The service may also raise other specific errors. Always check the status code:

- **400 Bad Request**: Invalid input (missing fields, bad format)
- **404 Not Found**: Event doesn't exist
- **409 Conflict**: Duplicate registration (now properly handled!)
- **500 Internal Server Error**: Unexpected server error

---

## Files Modified

- **`api/admin/events.py`** (lines 750-754)
  - Added HTTPException re-raise to preserve 409 status
  - Now properly returns duplicate registration information to frontend

---

## Testing Checklist

- [x] Register for an event successfully
- [x] Try to register again with same email → Should get 409 with detailed info
- [x] Frontend can parse the error and show meaningful message
- [x] Frontend can offer actions (view, edit, cancel)
- [x] Other errors (400, 500) still work as expected

---

## Benefits

✅ **Frontend gets actionable information**  
✅ **Users see clear, helpful error messages**  
✅ **Can offer next steps** (view/edit/cancel registration)  
✅ **Better UX** - no more "Failed to register" dead ends  
✅ **Proper HTTP status codes** for correct error handling  

---

## Note

This fix applies to the event registration endpoint. Other endpoints may have similar error handling patterns that could benefit from the same fix (re-raising HTTPExceptions instead of converting to 500).
