# Timezone Comparison Fix: Event Registration Status

## Problem

When checking event registration status, the endpoint was crashing with:
```
TypeError: can't compare offset-naive and offset-aware datetimes
```

**Error Location:** `api/user_events.py`, line 377

```python
event_passed = event and event.event_datetime < datetime.utcnow()
```

---

## Root Cause

### Database Column Definition
```python
event_datetime = Column(DateTime(timezone=True), nullable=False)
```

The `event_datetime` column stores **timezone-aware** datetimes (includes timezone info).

### Comparison Issue
```python
event.event_datetime < datetime.utcnow()
#  ↑ timezone-aware    ↑ timezone-naive
#  (has timezone)      (no timezone)
```

**Can't compare!** Python raises `TypeError` because comparing aware and naive datetimes is ambiguous.

---

## Solution

Replace all `datetime.utcnow()` calls with `datetime.now(timezone.utc)`:

### Before (Broken) ❌
```python
from datetime import datetime

event_datetime < datetime.utcnow()  # timezone-naive
```

### After (Fixed) ✅
```python
from datetime import datetime, timezone

event_datetime < datetime.now(timezone.utc)  # timezone-aware
```

---

## Changes Made

### 1. Updated Imports
**File:** `api/user_events.py` (line 4)

```python
from datetime import datetime, timezone
```

### 2. Fixed All Comparisons

**Line 133:** Edit registration validation
```python
if event and event.event_datetime < datetime.now(timezone.utc):
    raise HTTPException(
        status_code=400,
        detail="Cannot update registration for past events"
    )
```

**Line 206:** Cancel registration validation
```python
if event and event.event_datetime < datetime.now(timezone.utc):
    raise HTTPException(
        status_code=400,
        detail="Cannot cancel registration for past events"
    )
```

**Line 377:** Registration status check
```python
event_passed = event and event.event_datetime < datetime.now(timezone.utc)
```

### 3. Fixed Timestamp Assignment

**Line 145:** Updated timestamp update
```python
registration.updated_at = datetime.now(timezone.utc)
```

---

## Why This Matters

### Timezone-Aware vs Timezone-Naive

**Timezone-Naive:**
```python
datetime.utcnow()
# Returns: 2026-01-24 19:33:15.093000
# No timezone information!
```

**Timezone-Aware:**
```python
datetime.now(timezone.utc)
# Returns: 2026-01-24 19:33:15.093000+00:00
# Has UTC timezone (+00:00)
```

### Database Storage

PostgreSQL `TIMESTAMP WITH TIME ZONE` always stores timezone-aware datetimes. When you retrieve them via SQLAlchemy, they come back as timezone-aware Python datetime objects.

### Comparison Safety

```python
# ✅ Both aware - works!
datetime.now(timezone.utc) < datetime.now(timezone.utc)

# ✅ Both naive - works!
datetime.utcnow() < datetime.utcnow()

# ❌ Mixed - crashes!
datetime.now(timezone.utc) < datetime.utcnow()
```

---

## Testing

### Test Case 1: Check Registration Status
```bash
GET /api/events/{event_id}/registration-status
```

**Before:** 500 Internal Server Error  
**After:** 200 OK with registration status

### Test Case 2: Edit Registration
```bash
PUT /api/events/{event_id}/my-registration
```

**Before:** Might crash if checking event datetime  
**After:** Works correctly, prevents editing past events

### Test Case 3: Cancel Registration
```bash
DELETE /api/events/{event_id}/my-registration
```

**Before:** Might crash if checking event datetime  
**After:** Works correctly, prevents canceling past events

---

## Other Files Checked

✅ **`services/event_service.py`** - Already uses `datetime.now(timezone.utc)`  
✅ **`api/admin/events.py`** - No direct event_datetime comparisons found

---

## Best Practice Going Forward

### Always Use Timezone-Aware Datetimes

**Do:**
```python
from datetime import datetime, timezone

# Get current time
now = datetime.now(timezone.utc)

# Compare with DB datetime
if event.event_datetime < now:
    pass
```

**Don't:**
```python
from datetime import datetime

# Timezone-naive - avoid!
now = datetime.utcnow()
```

### Why `datetime.now(timezone.utc)` is Better

1. **Explicit timezone** - no ambiguity
2. **Compatible with DB** - works with `DateTime(timezone=True)`
3. **Safer comparisons** - Python enforces timezone consistency
4. **Future-proof** - handles daylight saving time correctly

---

## Files Modified

✅ **`api/user_events.py`**
- Line 4: Added `timezone` import
- Line 133: Fixed event datetime comparison (edit)
- Line 145: Fixed updated_at timestamp
- Line 206: Fixed event datetime comparison (cancel)
- Line 377: Fixed event datetime comparison (status check)

---

## Summary

**Problem:** Comparing timezone-aware database datetimes with timezone-naive Python datetimes  
**Solution:** Use `datetime.now(timezone.utc)` instead of `datetime.utcnow()`  
**Result:** All event registration status checks now work correctly  

This fix prevents crashes when:
- Checking if user is registered for an event
- Editing event registrations
- Canceling event registrations
- Determining if an event has passed

All timezone comparisons are now safe and consistent! ✅
