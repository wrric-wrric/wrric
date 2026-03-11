# Event Registration Status Guide

## Overview

The `registration-status` endpoint returns information about a user's registration for a specific event. The `status` field indicates the current state of the registration in the event workflow.

**Endpoint:** `GET /api/events/{event_id}/registration-status`

---

## Response Structure

### When User is Registered

```json
{
  "registered": true,
  "has_account": true,
  "registration_id": "60cfec39-2889-4d04-b47f-43a59af0920f",
  "status": "pending",
  "available_actions": ["edit", "cancel"],
  "message": "You are already registered for this event",
  "event_passed": false
}
```

### When User is NOT Registered

```json
{
  "registered": false,
  "has_account": true,
  "available_actions": ["register"],
  "message": "You can register for this event"
}
```

---

## Status Values

The `status` field can have the following values:

### 🟡 **"pending"** (Default)
**Meaning:** Registration has been submitted but not yet confirmed by event organizers.

**What this means for the user:**
- ✅ Registration is recorded in the system
- ✅ User will receive confirmation email
- ⏳ Waiting for admin approval (if event requires it)
- ⏳ May be waiting for payment confirmation (if paid event)
- 🔓 User can still **edit** or **cancel** registration

**Typical flow:**
1. User submits registration → Status: `pending`
2. Admin reviews → Status changes to `confirmed` or `cancelled`

**UI Display:**
```
⏳ Registration Pending
Your registration is awaiting confirmation.
[Edit Registration] [Cancel Registration]
```

---

### ✅ **"confirmed"**
**Meaning:** Registration has been approved and confirmed by event organizers.

**What this means for the user:**
- ✅ Registration is approved
- ✅ User is guaranteed a spot at the event
- ✅ Will appear in attendee list (unless anonymous)
- 🎫 May receive additional event materials (tickets, QR codes, etc.)
- 🔓 User can still **edit** or **cancel** (before event starts)

**When it happens:**
- Admin manually confirms registration
- Auto-confirmed for events with open registration
- Payment processed successfully (for paid events)

**UI Display:**
```
✅ Confirmed
Your registration has been confirmed!
[View Details] [Edit] [Cancel]
```

---

### ❌ **"cancelled"**
**Meaning:** Registration has been cancelled (by user or admin).

**What this means for the user:**
- ❌ No longer registered for the event
- ❌ Will not appear in attendee list
- ❌ Will not receive event updates
- 🔓 User can **register again** (if event allows)

**When it happens:**
- User cancels their own registration
- Admin cancels the registration
- User rejected password setup link (profile-first registration)

**UI Display:**
```
❌ Cancelled
Your registration has been cancelled.
[Register Again]
```

---

### 📋 **"waitlisted"**
**Meaning:** Event is full, user is on the waiting list.

**What this means for the user:**
- ⏳ Registration recorded but not confirmed
- ⏳ Waiting for a spot to open up
- 📧 Will be notified if a spot becomes available
- 🔓 User can **cancel** waitlist position

**When it happens:**
- Event reaches maximum capacity
- User registers after capacity is full
- Admin manually places user on waitlist

**UI Display:**
```
📋 Waitlisted
You're on the waiting list for this event.
You'll be notified if a spot becomes available.
[Leave Waitlist]
```

---

### ✓ **"checked_in"** (Admin Only)
**Meaning:** User has physically checked in at the event.

**What this means for the user:**
- ✅ User attended the event
- ✅ Attendance recorded
- 📊 May affect event statistics/certificates
- 🔒 Cannot edit or cancel (event already started/happened)

**When it happens:**
- Admin scans user's QR code at event entrance
- Admin manually checks in user
- User checks in via self-service kiosk

**UI Display:**
```
✓ Checked In
You checked in on Jan 24, 2026 at 2:30 PM
```

---

## Available Actions Based on Status

| Status | Edit | Cancel | Register | Check-In (Admin) |
|--------|------|--------|----------|------------------|
| **pending** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **confirmed** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **cancelled** | ❌ No | ❌ No | ✅ Yes | ❌ No |
| **waitlisted** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **checked_in** | ❌ No | ❌ No | ❌ No | ❌ No |

**Note:** If `event_passed: true`, all edit/cancel actions are disabled regardless of status.

---

## Frontend Implementation Examples

### Display Status with Icon

```javascript
function getStatusDisplay(status) {
  const statusConfig = {
    pending: {
      icon: '⏳',
      label: 'Pending',
      color: 'warning',
      description: 'Your registration is awaiting confirmation'
    },
    confirmed: {
      icon: '✅',
      label: 'Confirmed',
      color: 'success',
      description: 'Your registration has been confirmed'
    },
    cancelled: {
      icon: '❌',
      label: 'Cancelled',
      color: 'danger',
      description: 'Your registration has been cancelled'
    },
    waitlisted: {
      icon: '📋',
      label: 'Waitlisted',
      color: 'info',
      description: "You're on the waiting list"
    },
    checked_in: {
      icon: '✓',
      label: 'Checked In',
      color: 'success',
      description: 'You attended this event'
    }
  };

  return statusConfig[status] || statusConfig.pending;
}

// Usage
const status = getStatusDisplay(registrationData.status);
console.log(`${status.icon} ${status.label}: ${status.description}`);
```

### Conditional Action Buttons

```javascript
function renderRegistrationActions(registrationStatus) {
  const { status, event_passed, available_actions } = registrationStatus;
  
  // Event already happened - no actions
  if (event_passed) {
    return '<p class="text-muted">Event has ended</p>';
  }
  
  // Show actions based on status
  let actions = [];
  
  if (available_actions.includes('edit')) {
    actions.push(`
      <button onclick="editRegistration('${registrationStatus.registration_id}')" 
              class="btn btn-primary">
        Edit Registration
      </button>
    `);
  }
  
  if (available_actions.includes('cancel')) {
    actions.push(`
      <button onclick="cancelRegistration('${registrationStatus.registration_id}')" 
              class="btn btn-danger">
        Cancel Registration
      </button>
    `);
  }
  
  if (available_actions.includes('register')) {
    actions.push(`
      <button onclick="registerForEvent()" 
              class="btn btn-success">
        Register for Event
      </button>
    `);
  }
  
  return actions.join('');
}
```

### Status-Specific Messages

```javascript
function getStatusMessage(status) {
  switch(status) {
    case 'pending':
      return {
        title: 'Registration Pending',
        message: 'Your registration has been submitted and is awaiting confirmation. You will receive an email once it is approved.',
        canModify: true
      };
      
    case 'confirmed':
      return {
        title: 'Registration Confirmed',
        message: 'Your registration is confirmed! We look forward to seeing you at the event.',
        canModify: true
      };
      
    case 'waitlisted':
      return {
        title: 'You\'re on the Waitlist',
        message: 'This event is currently full, but you\'re on the waiting list. We\'ll notify you if a spot opens up.',
        canModify: true
      };
      
    case 'cancelled':
      return {
        title: 'Registration Cancelled',
        message: 'Your registration has been cancelled. You can register again if you change your mind.',
        canModify: false
      };
      
    case 'checked_in':
      return {
        title: 'Checked In',
        message: 'You attended this event. Thank you for participating!',
        canModify: false
      };
      
    default:
      return {
        title: 'Registration Status',
        message: 'Your registration status is being processed.',
        canModify: false
      };
  }
}
```

---

## Typical User Journey

### Simple Registration (Open Event)

```
User Registers
    ↓
Status: "pending"
    ↓
Auto-confirm (or admin approves)
    ↓
Status: "confirmed"
    ↓
User attends event
    ↓
Admin checks in user
    ↓
Status: "checked_in"
```

### Registration with Approval Required

```
User Registers
    ↓
Status: "pending"
    ↓
Admin reviews registration
    ↓
    ├─→ Approved → Status: "confirmed"
    │
    └─→ Rejected → Status: "cancelled"
```

### Waitlist Journey

```
User tries to register (event full)
    ↓
Status: "waitlisted"
    ↓
Spot opens up
    ↓
Status: "confirmed"
    ↓
Event happens
    ↓
Status: "checked_in"
```

### User Cancels

```
Status: "pending" or "confirmed"
    ↓
User clicks "Cancel Registration"
    ↓
DELETE /api/events/{event_id}/my-registration
    ↓
Status: "cancelled"
    ↓
User can register again
```

---

## Database Schema

```python
# models/db_models.py, line 553
status = Column(String(50), default="pending", nullable=False)
# Possible values: pending, confirmed, cancelled, waitlisted, checked_in
```

**Default:** All new registrations start with `status = "pending"`

---

## Admin Operations

Admins can change registration status via:

**Endpoint:** `PUT /api/admin/events/registrations/{registration_id}/status`

**Payload:**
```json
{
  "status": "confirmed"
}
```

**Common admin actions:**
- Approve pending registrations → `pending` → `confirmed`
- Cancel problematic registrations → `*` → `cancelled`
- Check in attendees → `confirmed` → `checked_in`
- Move to waitlist → `*` → `waitlisted`

---

## Best Practices

### 1. Always Check `event_passed` First

```javascript
if (data.event_passed) {
  // Show read-only view
  showEventHistory(data);
} else if (data.status === 'pending') {
  // Show editable pending state
  showPendingRegistration(data);
}
```

### 2. Use Status Icons Consistently

- ⏳ Pending (yellow/warning)
- ✅ Confirmed (green/success)
- ❌ Cancelled (red/danger)
- 📋 Waitlisted (blue/info)
- ✓ Checked In (green/success)

### 3. Provide Context with Status

Don't just show "Pending" - explain what it means:
```
⏳ Pending Approval
Your registration is being reviewed by event organizers.
You'll receive an email once approved.
```

### 4. Handle Status Transitions

```javascript
// When status changes from pending → confirmed
if (previousStatus === 'pending' && newStatus === 'confirmed') {
  showSuccessToast('Your registration has been confirmed! 🎉');
  sendConfirmationEmail();
}
```

---

## Summary

**Status Field:** Indicates current registration state  
**Default Value:** `"pending"`  
**Possible Values:** `pending`, `confirmed`, `cancelled`, `waitlisted`, `checked_in`  
**Most Common:** `pending` (just registered) and `confirmed` (approved)  

**For "pending" specifically:**
- Registration submitted ✅
- Waiting for confirmation ⏳
- Can edit/cancel 🔓
- Will receive email when confirmed 📧

The status helps users understand where they are in the registration process and what actions they can take next!
