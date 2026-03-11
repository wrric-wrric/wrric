"use client";

import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { X, ChevronLeft, ChevronRight, AlertCircle, Calendar, ExternalLink } from 'lucide-react';
import { EventBanner } from '@/types/events';
import BannerItem from './BannerItem';
import BannerControls from './BannerControls';

interface DismissedItem {
  id: string;
  dismissedAt: number; // timestamp
}

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
  dismissalExpiryDays?: number; // Auto-expire dismissals after N days. Default: 0.167 (4 hours). Set to -1 to disable expiry.
}

export default function Banner({
  events = [],
  announcements = [],
  autoRotate = true,
  rotateInterval = 8000,
  dismissalExpiryDays = 0.167, // 4 hours (4/24 days)
}: BannerProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dismissedItems, setDismissedItems] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const isHoveringRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    // Load dismissed items from localStorage
    const saved = localStorage.getItem('banner_dismissed');
    if (saved) {
      try {
        const dismissedData: DismissedItem[] = JSON.parse(saved);
        const now = Date.now();
        const expiryMs = dismissalExpiryDays * 24 * 60 * 60 * 1000;

        // Filter out expired dismissals
        const validDismissals = dismissedData.filter(item => {
          const age = now - item.dismissedAt;
          const isExpired = age > expiryMs;
          if (isExpired) {
            console.log('[Banner] Dismissal expired:', item.id, `(${Math.round(age / (24 * 60 * 60 * 1000))} days old)`);
          }
          return !isExpired;
        });

        // Filter out dismissals for items not in current events
        const currentEventIds = events.map(e => e.id);
        const validAndRelevant = validDismissals.filter(item => currentEventIds.includes(item.id));

        const validIds = validAndRelevant.map(item => item.id);
        console.log('[Banner] Loaded dismissed items:', validIds.length, '| Expired:', dismissedData.length - validAndRelevant.length);
        setDismissedItems(validIds);

        // Clean up localStorage if dismissals were removed
        if (validAndRelevant.length < dismissedData.length) {
          localStorage.setItem('banner_dismissed', JSON.stringify(validAndRelevant));
          console.log('[Banner] Cleaned up stale dismissals from localStorage');
        }
      } catch (error) {
        console.error('[Banner] Error parsing dismissed items:', error);
        setDismissedItems([]);
      }
    }
  }, [events, dismissalExpiryDays]);

  // Combine all banner items
  const allItems = [
    ...events.map(event => ({
      id: event.id,
      type: 'event' as const,
      title: event.title,
      content: event.short_description,
      image_url: event.banner_image_url,
      link: `/events/${event.slug}`,
      cta_text: 'View Details', // Changed from 'Register Now'
      cta_link: `/events/${event.slug}`, // Changed from event.registration_url
      metadata: {
        datetime: event.event_datetime,
        location_type: event.location_type,
      },
      priority: 100, // Events get high priority
      dismissible: true,
    })),
    ...announcements.map(announcement => ({
      id: announcement.id,
      type: 'announcement' as const,
      title: announcement.title,
      content: announcement.content,
      style: announcement.type,
      priority: announcement.type === 'warning' ? 150 : 50,
      dismissible: announcement.dismissible ?? true,
    })),
  ];

  // Filter out dismissed items and sort by priority
  const visibleItems = allItems
    .filter(item => !dismissedItems.includes(item.id))
    .sort((a, b) => b.priority - a.priority);

  console.log('[Banner] allItems count:', allItems.length, 'dismissed:', dismissedItems.length, 'visible:', visibleItems.length);

  // Show banner after delay and hide automatically
  useEffect(() => {
    if (!mounted || visibleItems.length === 0) return;

    // Show banner after 1 second delay
    const showTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    // Hide banner after 8 seconds (unless hovering)
    const hideTimeout = setTimeout(() => {
      if (!isHoveringRef.current) {
        setIsVisible(false);
      }
    }, 9000);

    // Periodically show banner again every 60 seconds if not dismissed
    const periodicShow = setInterval(() => {
      setIsVisible(true);
    }, 60000);

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
      clearInterval(periodicShow);
    };
  }, [mounted, visibleItems.length]);

  // Auto-rotate effect
  useEffect(() => {
    if (!autoRotate || isPaused || visibleItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleItems.length);
    }, rotateInterval);

    return () => clearInterval(interval);
  }, [autoRotate, isPaused, visibleItems.length, rotateInterval]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % visibleItems.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + visibleItems.length) % visibleItems.length);
  };

  const dismissItem = (id: string) => {
    setIsVisible(false);
    setDismissedItems(prev => {
      const updated = [...prev, id];
      // Store with timestamp for expiry tracking
      const dismissalRecord: DismissedItem = {
        id,
        dismissedAt: Date.now(),
      };
      const saved = localStorage.getItem('banner_dismissed');
      const dismissedData: DismissedItem[] = saved ? JSON.parse(saved) : [];
      dismissedData.push(dismissalRecord);
      localStorage.setItem('banner_dismissed', JSON.stringify(dismissedData));
      console.log('[Banner] Dismissed item:', id);
      return updated;
    });
    
    // If we dismissed the current item, go to next
    if (visibleItems[currentIndex]?.id === id && visibleItems.length > 1) {
      setCurrentIndex((prev) => prev % (visibleItems.length - 1));
    }
  };

  const dismissAll = () => {
    setIsVisible(false);
    const allIds = visibleItems.map(item => item.id);
    setDismissedItems(prev => {
      const updated = [...prev, ...allIds];
      // Store with timestamps for expiry tracking
      const saved = localStorage.getItem('banner_dismissed');
      const dismissedData: DismissedItem[] = saved ? JSON.parse(saved) : [];
      const now = Date.now();
      allIds.forEach(id => {
        dismissedData.push({ id, dismissedAt: now });
      });
      localStorage.setItem('banner_dismissed', JSON.stringify(dismissedData));
      console.log('[Banner] Dismissed all items:', allIds.length);
      return updated;
    });
  };

  // Don't render while component is mounting (client-side hydration)
  if (!mounted) {
    return null;
  }

  // If no visible items, show a placeholder or nothing
  if (visibleItems.length === 0) {
    console.log('[Banner] No visible items to display');
    return null;
  }

  const currentItem = visibleItems[currentIndex];

  return (
    <div 
      className={`fixed top-4 left-4 right-4 z-50 overflow-hidden rounded-2xl border transition-all duration-500 ${
        isVisible 
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 -translate-y-10 scale-95 pointer-events-none'
      } ${
        isDark 
          ? 'bg-gray-900 border-gray-800 hover:border-[#00FB75]/50' 
          : 'bg-white border-gray-200 hover:border-[#00FB75]/50 shadow-xl'
      }`}
      onMouseEnter={() => {
        setIsPaused(true);
        isHoveringRef.current = true;
      }}
      onMouseLeave={() => {
        setIsPaused(false);
        isHoveringRef.current = false;
      }}
    >
      {/* Close button - always visible */}
      <button
        onClick={() => dismissItem(currentItem.id)}
        className={`absolute top-2 right-2 z-20 p-1.5 rounded-full transition-colors ${
          isDark 
            ? 'bg-gray-800 hover:bg-gray-700' 
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
        aria-label="Dismiss banner"
        title="Dismiss this banner"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Banner content */}
      <div className="relative h-20 md:h-24">
        {visibleItems.map((item, index) => (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <BannerItem item={item} isDark={isDark} />
          </div>
        ))}
      </div>

      {/* Controls */}
      {visibleItems.length > 1 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-10">
          <BannerControls
            count={visibleItems.length}
            currentIndex={currentIndex}
            onDotClick={goToSlide}
            onPrev={prevSlide}
            onNext={nextSlide}
            isDark={isDark}
          />
        </div>
      )}

      {/* Progress indicator for auto-rotate */}
      {autoRotate && visibleItems.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5">
          <div 
            className={`h-full bg-[#00FB75] transition-transform duration-300`}
            style={{
              transform: `translateX(-${100 - ((currentIndex + 1) / visibleItems.length) * 100}%)`,
            }}
          />
        </div>
      )}
    </div>
  );
}