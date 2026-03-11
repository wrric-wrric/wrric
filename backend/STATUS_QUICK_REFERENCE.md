# Quick Reference: Registration Status Values

## TL;DR

When you call `GET /api/events/{event_id}/registration-status`, you get a `status` field that tells you the state of the user's registration.

---

## What "pending" Means

🟡 **Status: "pending"**

**In plain English:**  
> "Your registration was submitted successfully and is waiting for confirmation."

**For the user:**
- ✅ Registration is saved in the database
- ✅ Confirmation email was sent
- ⏳ Waiting for admin to approve (or auto-approval)
- 🔓 User can still **edit** or **cancel** their registration

**What to show:**
```
⏳ Registration Pending
Your registration is awaiting confirmation.
[Edit Registration] [Cancel Registration]
```

---

## All Status Values (Quick Chart)

| Status | Meaning | User Can Edit? | User Can Cancel? |
|--------|---------|----------------|------------------|
| **pending** 🟡 | Just registered, awaiting approval | ✅ Yes | ✅ Yes |
| **confirmed** ✅ | Approved, has a spot | ✅ Yes | ✅ Yes |
| **waitlisted** 📋 | On waiting list (event full) | ✅ Yes | ✅ Yes |
| **cancelled** ❌ | Registration cancelled | ❌ No | ❌ No |
| **checked_in** ✓ | Attended the event | ❌ No | ❌ No |

**Exception:** If event has passed (`event_passed: true`), NO editing/canceling regardless of status!

---

## Response Examples

### Pending Registration
```json
{
  "registered": true,
  "has_account": true,
  "registration_id": "abc-123",
  "status": "pending",
  "available_actions": ["edit", "cancel"],
  "message": "You are already registered for this event",
  "event_passed": false
}
```

**Show to user:**
- "⏳ Pending - Awaiting confirmation"
- Buttons: [Edit] [Cancel]

---

### Confirmed Registration
```json
{
  "registered": true,
  "status": "confirmed",
  "available_actions": ["edit", "cancel"],
  "event_passed": false
}
```

**Show to user:**
- "✅ Confirmed - See you at the event!"
- Buttons: [View Details] [Edit] [Cancel]

---

### Cancelled Registration
```json
{
  "registered": true,
  "status": "cancelled",
  "available_actions": [],
  "event_passed": false
}
```

**Show to user:**
- "❌ Cancelled"
- Button: [Register Again]

---

### Event Already Happened
```json
{
  "registered": true,
  "status": "checked_in",
  "available_actions": [],
  "event_passed": true
}
```

**Show to user:**
- "✓ You attended this event"
- No action buttons

---

## Simple Frontend Code

```javascript
function displayRegistrationStatus(data) {
  const statusText = {
    pending: '⏳ Pending Approval',
    confirmed: '✅ Confirmed',
    waitlisted: '📋 Waitlisted',
    cancelled: '❌ Cancelled',
    checked_in: '✓ Checked In'
  };

  const statusColor = {
    pending: 'warning',
    confirmed: 'success',
    waitlisted: 'info',
    cancelled: 'danger',
    checked_in: 'success'
  };

  return `
    <div class="alert alert-${statusColor[data.status]}">
      <strong>${statusText[data.status]}</strong>
      
      ${data.status === 'pending' ? 
        '<p>Your registration is awaiting confirmation.</p>' : ''}
      
      ${data.status === 'confirmed' ? 
        '<p>You\'re all set! See you at the event.</p>' : ''}
      
      ${data.available_actions.includes('edit') ? 
        '<button onclick="editRegistration()">Edit</button>' : ''}
      
      ${data.available_actions.includes('cancel') ? 
        '<button onclick="cancelRegistration()">Cancel</button>' : ''}
    </div>
  `;
}
```

---

## When Does Status Change?

```
Registration submitted
    ↓
Status: "pending" ← YOU ARE HERE
    ↓
Admin approves / Auto-confirm
    ↓
Status: "confirmed"
    ↓
User attends event
    ↓
Status: "checked_in"
```

---

## Key Points

1. **"pending"** = Successfully registered, waiting for approval
2. User can always **edit/cancel** unless event has passed
3. Check `available_actions` array to know what buttons to show
4. Check `event_passed` to disable all editing for past events

---

## Full Documentation

For complete details, examples, and edge cases:  
📄 **REGISTRATION_STATUS_GUIDE.md** (11KB)

For implementation examples:  
📄 **FRONTEND_ERROR_HANDLING_GUIDE.md**
