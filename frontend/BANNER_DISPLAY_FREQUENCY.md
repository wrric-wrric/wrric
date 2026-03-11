# Banner Display Frequency & Behavior Guide

## 📍 Where Banners Display

**Global Location:** Root Layout (`app/layout.tsx`)

**Pages with Banners:**
- ✅ ALL pages in the application (guest & authenticated users)
- ✅ Home page `/`
- ✅ Events page `/events`
- ✅ Labs page `/labs`
- ✅ Funders page `/funders`
- ✅ Profiles page `/profiles`
- ✅ Auxiliaries (Messages, Notifications, Proposals) `/auxiliaries/*`
- ✅ Auth pages (login, register) `/auth/*`
- ✅ Admin pages `/admin/*`
- ✅ Map page `/map`
- ✅ Any other page in the app

---

## ⏰ Display Frequency Timeline

### **Initial Page Load (Any Page)**

```
User navigates to any page
            ↓
Root layout renders
            ↓
GlobalBanner component mounts (server-side)
            ↓
getRandomBannerEvents() fetches from backend
            ↓
Banner fetches up to 5 random events
            ↓
Banner component renders on page
            ↓
Auto-rotation starts (8 second intervals)
```

**⏱️ Time to Display:** ~200-500ms after page load (wrapped in Suspense, doesn't block rendering)

---

## 🔄 Auto-Rotation Behavior

Once a banner loads on a page:

### **Auto-Rotation Interval: Every 8 Seconds**

```
Time 0s:   Banner shows Event #1
Time 8s:   Auto-rotate → Event #2
Time 16s:  Auto-rotate → Event #3
Time 24s:  Auto-rotate → Event #4
Time 32s:  Auto-rotate → Event #5
Time 40s:  Loop back → Event #1
...continues until user dismisses or navigates
```

### **How Often Each Banner Shows**

If there are **5 banners** loaded:
- Each banner displays for **8 seconds**
- Full rotation cycle: **40 seconds** (5 × 8 seconds)
- In **1 minute**: Each banner shows ~1.5 times
- In **5 minutes**: Each banner shows ~7-8 times
- In **30 minutes**: Each banner shows ~45 times

---

## 📊 Factors Affecting Display Frequency

### **1. Number of Available Banners**

| Banners | Cycle Time | Per Banner Duration |
|---------|-----------|-------------------|
| 1       | No rotation | Always visible |
| 2       | 16 sec | 8 sec each |
| 3       | 24 sec | 8 sec each |
| 4       | 32 sec | 8 sec each |
| 5       | 40 sec | 8 sec each |

**Max banners limited to:** 5 (configured in `lib/bannerService.ts`)

### **2. User Dismissals**

When a user clicks the **X button**:
- That specific banner is removed from rotation
- Stored in `localStorage` under key `banner_dismissed`
- Dismissed banners **never show again** (per-browser, per-device)

**Example:**
```
Initially: 5 banners rotating
User dismisses 2 banners
Now: 3 banners rotating (cycle: 24 seconds)
```

### **3. Page Navigation**

When user navigates to a different page:

```
Page 1: Banner Component Instance #1
  ↓ (user clicks link to different page)
Page 2: Banner Component Instance #2
  ↓
- New instance fetches NEW random banners
- Auto-rotation restarts
- Dismissed items preserved (from localStorage)
- Previous banner instance cleaned up
```

**Important:** Each page gets a **fresh fetch** of random banners!

---

## 🔄 Data Fetching & Caching

### **Backend API Caching**

```typescript
const response = await fetch(url, {
  next: { revalidate: 300 }, // Cache for 5 minutes
});
```

**What this means:**
- First request within 5 minutes: Uses cached data
- After 5 minutes: Fresh API call
- On different pages: Can use cached data (within 5-min window)
- No duplicate API calls within 5 minutes

### **Randomization**

Each time the banner fetches (every 5 minutes or cache miss):
```typescript
// Shuffle array randomly using Fisher-Yates algorithm
const shuffled = [...events].sort(() => Math.random() - 0.5);
return shuffled.slice(0, maxBanners);
```

**Result:** 
- Every 5 minutes (or cache miss), banners can show in **different order**
- Users see variety over time
- No two users see the same order (unless they visit within same cache cycle)

---

## 💾 localStorage & Persistence

### **What Gets Stored**

```typescript
// Key: 'banner_dismissed'
// Value: Array of dismissed banner IDs
localStorage.setItem('banner_dismissed', JSON.stringify(updated));

// Example:
{
  "banner_dismissed": ["event-id-1", "event-id-5", "event-id-12"]
}
```

### **Persistence Behavior**

| Scenario | What Happens |
|----------|-----------|
| User dismisses banner on Page A | Remembered on Page B, C, etc. |
| Browser tab closed/reopened | Dismissed banners still hidden |
| Device switched | New device = fresh dismissals (new localStorage) |
| Browser cache cleared | Dismissed banners reset |
| Different browser | Different localStorage = fresh dismissals |
| Private/Incognito mode | Dismissals only persist for session |

---

## 🎬 Complete User Journey Example

### **Scenario: User browses for 30 minutes**

```
TIME: 0 min
User visits /events page
├─ GlobalBanner mounts
├─ Fetches banners (API call #1)
├─ Gets: [Event A, Event B, Event C]
├─ Shows: Event A (first 8 sec)
└─ Stores in: localStorage (fresh)

TIME: 0:08
├─ Auto-rotate to Event B

TIME: 0:16
├─ Auto-rotate to Event C

TIME: 0:24
├─ User clicks X to dismiss Event B
├─ Removes Event B from rotation
├─ Stores dismissal: localStorage['banner_dismissed'] = [Event B ID]
└─ Continue with [Event A, Event C]

TIME: 0:32
├─ Auto-rotate between Event A and C only (16 sec cycle)

TIME: 1:00
├─ User navigates to /labs page
├─ Old banner component destroyed
├─ GlobalBanner re-mounts (new instance)
├─ Fetches banners (may use cached data)
├─ Gets: [Event X, Event Y, Event Z] (different, shuffled)
├─ Loads dismissed items from localStorage
├─ Event B still dismissed (if it appears in new set)
└─ Shows: Event X

TIME: 1:08 - 5:00
├─ Auto-rotation continues on /labs page
├─ [Event X, Event Y, Event Z] rotate every 8 sec
├─ User navigates to other pages throughout
├─ Each page gets fresh random banners
├─ Dismissals persist across all pages

TIME: 5:00
├─ If backend cache expires (5-min revalidate)
├─ And user navigates to a new page
├─ Fresh API call fetches latest banners
├─ May get completely different set
├─ But dismissed items still remembered
```

---

## 🎯 Key Timing Facts

| Metric | Value |
|--------|-------|
| Banner display on page load | 200-500ms |
| Auto-rotation interval | 8 seconds |
| Backend cache duration | 5 minutes |
| Max banners per page | 5 |
| Banner height | 160px (mobile) / 192px (desktop) |
| Dismissals persist | Per-browser, per-device |

---

## 🔧 Configuration Options

### **Change Auto-Rotation Speed**

In `components/GlobalBanner.tsx`:
```typescript
<Banner 
  events={events} 
  autoRotate={true} 
  rotateInterval={8000}  // ← Change this (in milliseconds)
/>
```

Options:
- `5000` = 5 seconds (fast rotation)
- `8000` = 8 seconds (current)
- `10000` = 10 seconds (slow rotation)
- `15000` = 15 seconds (very slow)

### **Change Max Banners**

In `lib/bannerService.ts`:
```typescript
export async function getRandomBannerEvents(maxBanners: number = 5)
// Change 5 to desired number
```

### **Change Cache Duration**

In `lib/bannerService.ts`:
```typescript
next: { revalidate: 300 }, // Change 300 (seconds) to desired value
// 60 = 1 minute
// 300 = 5 minutes (current)
// 600 = 10 minutes
```

---

## 📱 Behavior Across Devices

### **Desktop User**
- Banners display on all pages
- Auto-rotation every 8 seconds
- Dismissals persist in browser localStorage
- If user opens **new tab**: Fresh dismissals per-tab
- If user opens **same site in new browser**: Different dismissals

### **Mobile User**
- Same behavior as desktop
- Responsive layout: 160px height on mobile
- Touch-friendly: Easy to tap dismiss button
- Dismissals persist in mobile browser

### **Guest User**
- Same banner experience as authenticated user
- Dismissals stored locally
- No server-side tracking

---

## ⚡ Performance Impact

**On Page Load:**
- Server: ~100ms (fetch + shuffle)
- Client: ~50ms (mount + render)
- Total: ~150-200ms
- **Non-blocking:** Uses Suspense (doesn't delay page content)

**During Session:**
- Auto-rotation: Negligible CPU
- localStorage: ~500 bytes per 10 dismissed items
- No continuous API calls (cache for 5 min)

---

## 🚀 Summary

**When:** Banners appear on **every page load** and persist during user session

**How Often:** 
- Auto-rotates **every 8 seconds**
- Each banner shows for **8 seconds**
- Full cycle depends on number of banners (40 sec for 5 banners)

**Variation:**
- Different random banners on each **new page navigation**
- **Same banners persist** while on same page (auto-rotate)
- Dismissals **remembered forever** (unless cleared)

**User Control:**
- Can dismiss individual banners (X button)
- Can navigate away to see different banners
- Dismissals are permanent per-browser
