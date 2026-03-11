# Banner Dismissal System - Best Practices Implementation

## Summary

The global banner system now implements **industry-standard dismissal practices** with:
- **4-hour expiry** (instead of permanent dismissal)
- **Automatic cleanup** on logout
- **Utility helpers** for managing dismissals

---

## Dismissal Expiry

### Why 4 Hours?

For event platforms, 4 hours is the ideal balance:
- **Short enough** that banners reappear regularly (users see updates)
- **Long enough** that users aren't annoyed by immediate re-display
- **Standard industry practice** for time-sensitive content

| Platform Type | Standard Duration |
|---|---|
| Event platforms | **4-12 hours** ✅ |
| E-commerce | 24-48 hours |
| News/announcements | 24 hours |
| Critical alerts | Session only |

### How It Works

```typescript
// Server-side storage of dismissals with timestamps
{
  id: "banner-123",
  dismissedAt: 1705000000000  // milliseconds since epoch
}

// On page load, expired dismissals are automatically filtered out
// Dismissed > 4 hours ago? It shows again automatically
```

---

## Logout Behavior

When a user logs out, **all banner dismissals are cleared**:

**Files Updated:**
- `components/app-sidebar.tsx` - Main logout handler
- `app/admin/layout.tsx` - Admin logout handler
- `app/labs/page.tsx` - Labs page logout handler

**Result:** User logs back in → sees all banners fresh (perfect for new sessions)

---

## Configuration

### Change Expiry Duration

In `components/GlobalBanner.tsx`, pass different expiry:

```tsx
// 1 hour
<Banner dismissalExpiryDays={1/24} />

// 12 hours
<Banner dismissalExpiryDays={0.5} />

// 24 hours
<Banner dismissalExpiryDays={1} />

// Disable expiry (never re-show dismissed)
<Banner dismissalExpiryDays={-1} />
```

---

## Utility Functions

### New Helper File: `lib/bannerDismissal.ts`

```typescript
// Get all valid (non-expired) dismissed banner IDs
getDismissedBannerIds(expiryDays)

// Dismiss a specific banner
dismissBanner(bannerId)

// Clear ALL dismissals (call on logout)
clearBannerDismissals()

// Check if a banner is dismissed
isBannerDismissed(bannerId, expiryDays)

// Manual cleanup of expired data
cleanupExpiredDismissals(expiryDays)
```

### Usage Example

```typescript
import { getDismissedBannerIds, dismissBanner, clearBannerDismissals } from '@/lib/bannerDismissal';

// In a custom banner component
const dismissedIds = getDismissedBannerIds();

// Dismiss a banner
dismissBanner('event-123');

// On logout
clearBannerDismissals();
```

---

## Storage Format

### Before (Simple, but broken)
```json
["banner-1", "banner-2", "banner-3"]
```
❌ No expiry tracking
❌ Permanent dismissal
❌ No cleanup mechanism

### After (Smart, with expiry)
```json
[
  { "id": "banner-1", "dismissedAt": 1705000000000 },
  { "id": "banner-2", "dismissedAt": 1704990000000 },
  { "id": "banner-3", "dismissedAt": 1704980000000 }
]
```
✅ Timestamp-based expiry
✅ Auto-cleanup on page load
✅ Cleared on logout

---

## Timeline Example

**User Journey:**

```
10:00 AM - User sees banner, dismisses it (4-hour timer starts)
          localStorage: [{ id: "banner-1", dismissedAt: 10:00 }]

10:05 AM - User refreshes page → banner still hidden (expired in 4h)

01:59 PM - User refreshes page → banner still hidden (59 minutes left)

02:00 PM - User refreshes page → BANNER SHOWS AGAIN! ✅
          (4 hours expired, banner reappears)

02:30 PM - User logs out → localStorage cleared

02:35 PM - User logs back in → sees all banners fresh
```

---

## Testing Checklist

- [ ] Dismiss a banner
- [ ] Refresh page → banner should still be hidden
- [ ] Wait 4 hours → banner should reappear *(or manually check localStorage)*
- [ ] Log out → all dismissals cleared
- [ ] Log back in → see all banners again
- [ ] Check console for `[Banner]` and `[BannerDismissal]` logs

---

## Future Enhancements

1. **Per-banner expiry settings** - Different duration for different banner types
2. **User preferences** - Let users choose dismissal duration
3. **Analytics** - Track which banners get dismissed most
4. **Dismissal reasons** - Ask why user dismissed (feedback system)
5. **Server-side tracking** - Store dismissals in DB instead of localStorage
