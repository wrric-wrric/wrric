import { EventBanner } from '@/types/events';

/**
 * Fetch banner events from the backend and shuffle them randomly
 * Limits to max 5 banners to avoid excessive content
 */
export async function getRandomBannerEvents(maxBanners: number = 5): Promise<EventBanner[]> {
    try {
        // Determine API URL depending on execution environment
        const isServer = typeof window === 'undefined';
        let apiUrl = '/api/events/banner';

        if (isServer) {
            // Use NEXT_PUBLIC_SITE_URL if available, otherwise construct from backend
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
            if (siteUrl) {
                apiUrl = `${siteUrl}/api/events/banner`;
            } else {
                // If no site URL, try to use backend URL directly instead of proxy
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
                apiUrl = `${backendUrl}/api/events/banner/events`;
            }
            console.log('[BannerService] Server-side fetch using URL:', apiUrl);
        }

        console.log('[BannerService] Fetching banners from:', apiUrl);

        const response = await fetch(apiUrl, {
            headers: {
                'Content-Type': 'application/json',
            },
            next: { revalidate: 300 },
        });

        if (!response.ok) {
            console.error('[BannerService] Banner fetch failed:', response.status, response.statusText, 'URL:', apiUrl);
            return [];
        }

        const events: EventBanner[] = await response.json();
        console.log('[BannerService] Successfully fetched', events.length, 'banner events');

        if (!Array.isArray(events) || events.length === 0) {
            console.log('[BannerService] No banner events returned');
            return [];
        }

        // Shuffle array randomly
        const shuffled = [...events].sort(() => Math.random() - 0.5);
        const result = shuffled.slice(0, maxBanners);
        console.log('[BannerService] Returning', result.length, 'banners after shuffling');
        return result;
    } catch (error) {
        console.error('[BannerService] Error fetching banners:', error instanceof Error ? error.message : error);
        return [];
    }
}

/**
 * Get weighted random banners - featured events appear more frequently
 */
export async function getWeightedRandomBanners(limit: number = 5): Promise<EventBanner[]> {
    const events = await getRandomBannerEvents(limit * 2);
    const weighted: EventBanner[] = [];

    events.forEach(event => {
        weighted.push(event);
    });

    return weighted.sort(() => Math.random() - 0.5).slice(0, limit);
}

/**
 * Get banners filtered by context (optional future use)
 */
export async function getBannersForContext(
    context: 'events' | 'labs' | 'funders' | 'profiles' | 'default' = 'default',
    limit: number = 5
): Promise<EventBanner[]> {
    const events = await getRandomBannerEvents(limit);
    return events;
}
