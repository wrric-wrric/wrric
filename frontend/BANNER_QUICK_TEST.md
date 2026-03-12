# Quick Banner Diagnostics - Step by Step

## What We Fixed

The banner implementation had been corrupted during editing. I've cleaned it up and restored the files:
- `app/api/events/banner/route.ts` - API route (recreated)
- `lib/bannerService.ts` - Banner service (cleaned up)
- `components/GlobalBanner.tsx` - Global banner component (already correct)

## Test the Banner Now

### Step 1: Check if Dev Server is Running

Open terminal and verify:
```bash
npm run dev
```

You should see output like:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
```

### Step 2: Open Browser and Navigate to Any Page

Go to: `http://localhost:3000/events` (or any other page)

### Step 3: Check Three Things

**A. Look for Loading Skeleton:**
- You should see a **gray/dark animated rectangle** at the top of the page (below navbar)
- This is the loading placeholder while banner data fetches

**B. Open Browser Console (F12 → Console tab):**
- Look for these messages (they appear in terminal, not browser console, but let's check anyway):
  - `Banner loaded with X events`
  - Or errors if something failed

**C. Check Network Tab (F12 → Network):**
- Reload the page
- Look for a request to `/api/events/banner`
- Should see **Status: 200** and response is JSON array

### Step 4: If Banner Still Doesn't Show

**Check Terminal Output:**

You should see logs like:
```
Banner API fetch error:...
```

or check if the backend is accessible:

```bash
# In another terminal, test the backend directly
curl http://localhost:8000/api/events/banner/events

# Should return JSON array like:
# [{"id":"...", "title":"...", ...}, ...]
```

### Step 5: Check Environment Variable

Make sure `.env.local` has:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Or whatever your backend URL is.

## Files That Are Now Fixed

1. ✅ `app/api/events/banner/route.ts` - Frontend API route
2. ✅ `lib/bannerService.ts` - Fetch and shuffle service
3. ✅ `components/GlobalBanner.tsx` - Global banner component
4. ✅ `app/layout.tsx` - Root layout with banner import

## Expected Behavior

When you reload any page:

1. **Skeleton appears** → shows loading state
2. **API calls `/api/events/banner`** → fetches data
3. **Banner renders** → displays event with image, title, description
4. **Auto-rotates** → every 8 seconds shows next banner
5. **X button** → dismiss individual banners

## Still Not Working?

Try these in order:

### 1. Hard Refresh Browser
```
Ctrl+Shift+R (or Cmd+Shift+R on Mac)
```

### 2. Clear Next.js Cache
```bash
rm -rf .next
npm run dev
```

### 3. Check Backend is Running
```bash
curl http://localhost:8000/api/events/banner/events
```

Must return a JSON array of events.

### 4. Verify the API Route Exists
```bash
# In browser console
fetch('/api/events/banner').then(r => r.json()).then(console.log)
```

Should output an array like:
```javascript
[{id: "...", title: "...", ...}, ...]
```

### 5. Check File Exists
```bash
ls -la /home/airlectric/wrric-frontend/app/api/events/banner/route.ts
```

Should exist and be ~500 bytes.

## Debug Steps in Order

1. ✅ Dev server running? (`npm run dev`)
2. ✅ `.env.local` has backend URL?
3. ✅ Backend is accessible? (`curl http://localhost:8000/...`)
4. ✅ Page has loading skeleton?
5. ✅ Network tab shows `/api/events/banner` request?
6. ✅ Response has data (not empty array)?
7. ✅ Banner HTML renders on page?

If all 7 pass, banner should be working!

## Ask in Terminal After Confirming

After you've tested, run this to collect debug info:

```bash
# See recent errors
tail -100 ~/.npm-debug.log

# Check current backend URL
grep NEXT_PUBLIC_BACKEND_URL .env.local

# Test API route
curl -i http://localhost:3000/api/events/banner

# Test backend
curl -i http://localhost:8000/api/events/banner/events
```

Let me know what you see!
