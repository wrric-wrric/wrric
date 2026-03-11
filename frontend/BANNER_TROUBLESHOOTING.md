# Banner Display Troubleshooting Guide

## 🔧 What Was Fixed

The banner wasn't showing on initial page load because:

1. **Wrong API Endpoint**: The `bannerService` was calling `NEXT_PUBLIC_BACKEND_URL/api/events/banner/events` directly, which may not be accessible during server-side rendering
2. **Silent Failures**: When the fetch failed, it returned empty array with minimal logging
3. **No Loading Indicator**: Suspense fallback was `null`, so users saw nothing while loading

## ✅ Solutions Applied

### 1. **Use Frontend API Route**
**Before:**
```typescript
const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const response = await fetch(`${baseUrl}/api/events/banner/events`, ...);
```

**After:**
```typescript
const response = await fetch('/api/events/banner', ...);
```

**Why:** The frontend API route (`/api/events/banner`) is a proper Next.js route that handles backend communication securely and reliably during SSR.

### 2. **Added Loading Skeleton**
**Before:**
```tsx
<Suspense fallback={null}>
```

**After:**
```tsx
<Suspense fallback={<BannerSkeleton />}>
```

**Why:** Shows a loading placeholder (animated skeleton) while the banner data is being fetched. This indicates to users that content is loading.

### 3. **Improved Error Logging**
**Added:**
- Log when banners successfully load (`Banner loaded with X events`)
- Log when no banners are available (`No banner events available`)
- Better status code logging on failures

## 🔍 How to Debug Banner Issues

### **Check 1: Open Browser Console**

Look for these messages:

✅ **Success:**
```
Banner loaded with 5 events
```

⚠️ **No Banners:**
```
No banner events available to display
```

❌ **Error:**
```
Error in BannerContent: Error message here
```

### **Check 2: Network Tab**

1. Open Developer Tools → Network tab
2. Reload page
3. Look for requests to `/api/events/banner`

**Expected:**
- Status: `200 OK`
- Response: Array of events
- Size: ~2-5KB

**Problem Indicators:**
- Status: `500` or `404` → API route issue
- Status: `0` or `CORS error` → Network issue
- Empty response: `[]` → No banners in backend

### **Check 3: API Endpoint Verification**

Test the frontend API route directly:

```bash
# In terminal or browser console
curl http://localhost:3000/api/events/banner

# Should return JSON array like:
# [
#   {
#     "id": "event-1",
#     "title": "Event Name",
#     ...
#   }
# ]
```

### **Check 4: Backend Connection**

If the frontend API returns empty:

```bash
# Test backend directly
curl http://localhost:8000/api/events/banner/events

# Check if:
# 1. Backend is running
# 2. Endpoint exists and works
# 3. Backend has banner events data
```

## 🚨 Common Issues & Solutions

### **Issue 1: Skeleton Shows But Banner Never Appears**

**Cause:** API fetch is timing out or failing silently

**Solution:**
```typescript
// Check console for errors
// Verify /api/events/banner endpoint works
// Check backend URL in .env.local
```

### **Issue 2: "Failed to fetch banner events: 404"**

**Cause:** Frontend API route not found

**Solution:**
- Verify `/app/api/events/banner/route.ts` exists
- Check file has correct export
- Run `npm run build` to ensure route is registered

### **Issue 3: Banners show but data is stale**

**Cause:** Cache is serving old data

**Solution:**
```typescript
// Force fresh fetch (in bannerService.ts)
next: { revalidate: 0 }  // No caching
// Or
next: { revalidate: 60 } // Cache for 1 minute instead of 5
```

### **Issue 4: Different banners each page load**

**Cause:** This is expected! Each page load gets new random banners

**Solution:** This is intentional behavior. If you want same banners:
```typescript
// In lib/bannerService.ts, remove the shuffle
// const shuffled = [...events].sort(() => Math.random() - 0.5);
// return events; // Return in original order
```

## 🧪 Testing Banner Functionality

### **Test 1: Banner Loads**
1. Reload any page
2. Check if skeleton appears briefly
3. Check if banner content appears after ~1-2 seconds
4. Check console for "Banner loaded with X events"

### **Test 2: Auto-Rotation Works**
1. Wait 8 seconds
2. Banner should change to next event
3. Check if only 1 banner visible at a time

### **Test 3: Dismiss Works**
1. Click X button on banner
2. Banner should disappear
3. Check if localStorage has `banner_dismissed` key
4. Reload page - dismissed banner should still be hidden

### **Test 4: Persist Across Pages**
1. Dismiss a banner on page A
2. Navigate to page B
3. Check if same banner is still dismissed
4. Dismissal should persist globally

### **Test 5: Different Banners Per Page**
1. Note which banners show on Page A
2. Navigate to Page B
3. Banners should be different (randomized)
4. Navigate back to Page A
5. Banners may be different again (new random set)

## 📊 Expected Behavior After Fix

| Action | Expected Result |
|--------|-----------------|
| Page load | Skeleton appears for 1-2 sec, then banner appears |
| Wait 8 sec | Banner auto-rotates to next event |
| Click X | Banner disappears, stored in localStorage |
| Navigate pages | New random banners fetch, dismissals respected |
| Browser console | "Banner loaded with X events" message |
| Network tab | `/api/events/banner` returns 200 with JSON array |

## 🔐 Environment Variables to Check

Verify in `.env.local`:

```
# Backend URL must be set
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# Or for production
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
```

## 📝 Logging Statements

The following logs now help debug:

```typescript
// Success
console.log(`Banner loaded with ${events.length} events`);

// Warning
console.warn('No banner events available to display');

// Error (fetch failed)
console.error('Failed to fetch banner events:', response.status, response.statusText);

// Error (exception)
console.error('Error in BannerContent:', error);
```

Monitor these in browser console when testing.

## 🚀 Quick Reset if Still Not Working

If banners still don't appear:

1. **Clear all caches:**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   
   # Clear node_modules (optional)
   rm -rf node_modules
   npm install
   ```

2. **Restart dev server:**
   ```bash
   npm run dev
   ```

3. **Clear browser cache:**
   - DevTools → Application → Clear site data
   - Or use Ctrl+Shift+Delete → Clear all time

4. **Test endpoint directly:**
   ```bash
   # In browser console
   fetch('/api/events/banner').then(r => r.json()).then(console.log)
   ```

## 📚 Related Files

- `lib/bannerService.ts` - Fetches and shuffles banners
- `components/GlobalBanner.tsx` - Server component that loads data
- `components/Banner/index.tsx` - Client component with interactivity
- `app/api/events/banner/route.ts` - Frontend API route
- `app/layout.tsx` - Root layout where GlobalBanner is used

## ✨ Summary

The banner should now:
✅ Show loading skeleton immediately on page load
✅ Fetch banner data from `/api/events/banner`
✅ Display banner content after fetch completes
✅ Auto-rotate every 8 seconds
✅ Allow users to dismiss
✅ Remember dismissals in localStorage
✅ Log useful debugging info to console
