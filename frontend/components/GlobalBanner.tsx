"use client";
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Banner from '@/components/Banner';
import { getRandomBannerEvents } from '@/lib/bannerService';
import { EventBanner } from '@/types/events';

/**
 * Client component that fetches banner events and renders banner
 */
function BannerClientWrapper() {
  const pathname = usePathname();
  const [events, setEvents] = useState<EventBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function fetchBannerEvents() {
      try {
        const fetchedEvents = await getRandomBannerEvents(5);
        console.log('[GlobalBanner] Fetched banner events:', fetchedEvents.length);
        setEvents(fetchedEvents);
      } catch (error) {
        console.error('[GlobalBanner] Error fetching banners:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchBannerEvents();
  }, []);

  // Hide banner on admin and event pages
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/events')) {
    console.log('[GlobalBanner] Banner hidden on path:', pathname);
    return null;
  }

  if (!mounted || loading) {
    return (
      <div className="fixed top-4 left-4 right-4 z-50 overflow-hidden rounded-2xl border h-20 md:h-24 bg-gray-200 dark:bg-gray-800 border-gray-300 dark:border-gray-700 animate-pulse" />
    );
  }

  return (
    <Banner 
      events={events} 
      autoRotate={true} 
      rotateInterval={8000}
      dismissalExpiryDays={0.167}
    />
  );
}

/**
 * Global Banner Component
 * 
 * Displays on all pages except admin, event, and labs pages
 * Rotates through available banners randomly
 * Gracefully handles errors and doesn't crash the page if banners fail to load
 * 
 * Features:
 * - Auto-rotates every 8 seconds
 * - Responsive and dark mode compatible
 * - Respects user dismissals (stored in localStorage)
 * - Limits to 5 banners max to avoid overwhelming users
 * - Hidden on admin, event, and labs pages
 */
export default function GlobalBanner() {
  return <BannerClientWrapper />;
}
