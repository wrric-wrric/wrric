# Banner System Analysis & Implementation Guide

## Current Banner System Overview

### Architecture
The banner system is designed to display rotating notifications/announcements across your platform. Currently, it's only implemented on the `/events` page.

### Components Involved

#### 1. **Banner Component** (`components/Banner/index.tsx`)
- Main container component that manages banner state and rotation
- Handles auto-rotation, dismissal, and localStorage persistence
- Supports two types of content:
  - **Events**: Pulled from backend API (`EventBanner` type)
  - **Announcements**: Custom announcements with warning/info/success styles

**Key Features:**
- Auto-rotate with configurable interval (default: 8 seconds)
- Dismiss individual banners or all at once
- Pause on hover
- Local storage tracking of dismissed items
- Priority-based sorting (warnings > events > info announcements)

**Props:**
```typescript
interface BannerProps {
  events?: EventBanner[];
  announcements?: Array<{
    id: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'success';
    dismissible?: boolean;
  }>;
  autoRotate?: boolean;
  rotateInterval?: number;
}
```

#### 2. **BannerItem Component** (`components/Banner/BannerItem.tsx`)
- Renders individual banner content
- Supports background images
- Different styling for event vs announcement types
- Includes event metadata (date, location type)
- Call-to-action buttons

#### 3. **BannerControls Component** (`components/Banner/BannerControls.tsx`)
- Navigation controls (previous/next buttons)
- Dot indicators showing current slide and total count
- Only appears when there's more than 1 banner

### API Endpoint

**Backend endpoint:** `/api/events/banner/events`
**Frontend proxy:** `app/api/events/banner/route.ts`

Returns array of `EventBanner` objects:
```typescript
interface EventBanner {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  event_datetime: string;
  location_type: 'physical' | 'virtual' | 'hybrid';
  banner_image_url?: string;
  registration_url?: string;
}
```

### Current Implementation

**Location:** `/app/events/page.tsx`

```tsx
async function BannerWrapper() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/events/banner/events`);
    if (!response.ok) return null;
    const bannerEvents = await response.json();
    return <Banner events={bannerEvents} />;
  } catch {
    return null;
  }
}
```

## How Banners Work (Current Flow)

1. **Fetch Phase**: Server-side component fetches banner events from backend
2. **Render Phase**: Passes fetched events to Banner component
3. **Display Phase**: Banner component combines events + announcements
4. **Filtering**: Removes dismissed items from localStorage
5. **Sorting**: Orders by priority (warnings → events → info)
6. **Auto-rotation**: Cycles through visible items every 8 seconds
7. **User Interactions**: 
   - Click dots to jump to specific banner
   - Click arrows to navigate
   - Hover to pause auto-rotation
   - Click X to dismiss individual banners
   - Progress bar shows rotation progress

## Implementation Plan: Global Banner Display

### Option 1: Root Layout Integration (Recommended)

**Advantages:**
- Banners appear on ALL pages
- Single data fetch
- Consistent across application
- Can randomize here centrally

**Steps:**

1. Create a reusable BannerWrapper component
2. Add to root layout or a wrapper component
3. Implement random selection logic

### Option 2: Shared Layout Component

Create a wrapper layout that includes banners and wrap all page layouts.

### Option 3: Middleware + Provider

Use React Context to provide banner data globally.

---

## Implementation: Random Banner Display on All Pages

### Step 1: Create a Global Banner Service

Create `lib/bannerService.ts`:

```typescript
// Fetch and shuffle banner events
export async function getRandomBannerEvents(): Promise<EventBanner[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${baseUrl}/api/events/banner/events`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    
    if (!response.ok) return [];
    
    const events: EventBanner[] = await response.json();
    
    // Shuffle array randomly
    return events.sort(() => Math.random() - 0.5);
  } catch (error) {
    console.error('Failed to fetch banner events:', error);
    return [];
  }
}
```

### Step 2: Create Global Banner Wrapper Component

Create `components/GlobalBanner.tsx`:

```typescript
"use client";

import { Suspense } from 'react';
import Banner from '@/components/Banner';
import { EventBanner } from '@/types/events';

async function BannerContent() {
  const events = await getRandomBannerEvents();
  return <Banner events={events} autoRotate={true} rotateInterval={8000} />;
}

export default function GlobalBanner() {
  return (
    <Suspense fallback={null}>
      <BannerContent />
    </Suspense>
  );
}
```

### Step 3: Update Root Layout

Modify `app/layout.tsx` to include the global banner:

```typescript
import GlobalBanner from '@/components/GlobalBanner';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body {...}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <SidebarProvider>
            <GlobalBanner />
            {children}
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Step 4: Remove Redundant Banners

Update `/app/events/page.tsx` to remove the BannerWrapper since it's now global:

```typescript
export default function EventsPage() {
  return (
    <Suspense fallback={<EventsLoading />}>
      <EventsList />
    </Suspense>
  );
}
```

---

## Advanced Configuration Options

### 1. Random Banner Selection
Select only a subset of banners randomly:

```typescript
export function selectRandomBanners(
  events: EventBanner[], 
  count: number = 3
): EventBanner[] {
  const shuffled = [...events].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
```

### 2. Context-Based Banners
Different banners for different page types:

```typescript
type PageContext = 'events' | 'labs' | 'funders' | 'profiles' | 'default';

export async function getBannersForContext(
  context: PageContext
): Promise<EventBanner[]> {
  const events = await getRandomBannerEvents();
  
  // Filter based on context if needed
  if (context === 'events') {
    return events.filter(e => e.location_type !== 'virtual');
  }
  
  return events;
}
```

### 3. Time-Based Rotation
Faster rotation during business hours:

```typescript
function getRotateInterval(): number {
  const hour = new Date().getHours();
  const isBusinessHours = hour >= 9 && hour <= 17;
  return isBusinessHours ? 5000 : 8000; // 5s or 8s
}
```

### 4. Priority-Based Display
Weight certain banners to appear more frequently:

```typescript
export function getWeightedRandomBanners(
  events: EventBanner[]
): EventBanner[] {
  const weighted: EventBanner[] = [];
  
  events.forEach(event => {
    // Featured events appear 3x more often
    const count = event.is_featured ? 3 : 1;
    for (let i = 0; i < count; i++) {
      weighted.push(event);
    }
  });
  
  return weighted.sort(() => Math.random() - 0.5).slice(0, 5);
}
```

---

## Adding Custom Announcements

If you want to add manual announcements alongside events:

```typescript
// In GlobalBanner component
const customAnnouncements = [
  {
    id: 'announcement-1',
    title: 'Platform Maintenance',
    content: 'We\'re performing scheduled maintenance tonight.',
    type: 'info' as const,
    dismissible: true,
  },
  {
    id: 'announcement-2',
    title: 'New Feature Alert!',
    content: 'Check out our new matching algorithm.',
    type: 'success' as const,
    dismissible: true,
  },
];

return (
  <Banner 
    events={events} 
    announcements={customAnnouncements}
    autoRotate={true} 
  />
);
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────┐
│  Root Layout (app/layout.tsx)       │
│  ├─ GlobalBanner Component          │
│  │  └─ Fetches events from API      │
│  │     └─ Shuffles randomly         │
│  │        └─ Renders Banner         │
│  └─ SidebarProvider                 │
│     └─ {children}                   │
└─────────────────────────────────────┘
           ↓
    All Page Routes
    (events, labs, profiles, etc.)
```

---

## Key Files Summary

| File | Purpose | Type |
|------|---------|------|
| `components/Banner/index.tsx` | Main banner container, state management | Component |
| `components/Banner/BannerItem.tsx` | Individual banner rendering | Component |
| `components/Banner/BannerControls.tsx` | Navigation controls | Component |
| `app/api/events/banner/route.ts` | API proxy to backend | API Route |
| `types/events.ts` | TypeScript interfaces | Types |

---

## Dismissal Behavior

Banners use localStorage to track dismissed items:
- Key: `banner_dismissed`
- Value: JSON array of dismissed banner IDs
- Persists across sessions

To clear dismissed banners:
```typescript
localStorage.removeItem('banner_dismissed');
```

---

## Performance Considerations

1. **Caching**: API responses cached for 5 minutes
2. **Lazy Loading**: Banner wrapped in Suspense (loads after page content)
3. **Image Optimization**: Uses Next.js Image component
4. **localStorage**: Only reads on component mount
5. **Auto-rotation**: Pauses on hover to save CPU

---

## Styling & Theming

- **Dark Mode Support**: All components use `isDark` from `useTheme()`
- **Color Scheme**: Uses green (#00FB75) as accent color
- **Responsive**: Adapts layout for mobile/tablet/desktop
- **Animations**: Smooth fade transitions between banners, progress bar animation

---

## Testing the Implementation

1. **Test on different pages**: Visit /events, /labs, /profiles, etc.
2. **Test randomization**: Refresh page multiple times
3. **Test dismissal**: Dismiss a banner, refresh, check if it stays dismissed
4. **Test dark mode**: Toggle theme and verify styling
5. **Test mobile**: Check responsive behavior

---

## Future Enhancements

- [ ] Admin panel to create/edit banners (custom announcements)
- [ ] Analytics: Track banner views and clicks
- [ ] A/B Testing: Show different banners to different users
- [ ] Scheduled Banners: Set specific date ranges for banners
- [ ] Targeting: Show specific banners to specific user types
- [ ] Rich Media: Support videos, GIFs, forms in banners
- [ ] Banner Templates: Pre-built templates for common use cases
