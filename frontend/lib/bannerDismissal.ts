/**
 * Banner Dismissal Utility
 * Manages banner dismissal timestamps and expiry
 */

interface DismissedItem {
    id: string;
    dismissedAt: number;
}

const STORAGE_KEY = 'banner_dismissed';

/**
 * Get all dismissed banner IDs (filtering expired ones)
 */
export function getDismissedBannerIds(expiryDays: number = 0.167): string[] {
    if (typeof window === 'undefined') return [];

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    try {
        const dismissedData: DismissedItem[] = JSON.parse(saved);
        const now = Date.now();
        const expiryMs = expiryDays * 24 * 60 * 60 * 1000;

        return dismissedData
            .filter(item => (now - item.dismissedAt) <= expiryMs)
            .map(item => item.id);
    } catch (error) {
        console.error('[BannerDismissal] Error parsing dismissed items:', error);
        return [];
    }
}

/**
 * Add a dismissed banner ID
 */
export function dismissBanner(bannerId: string): void {
    if (typeof window === 'undefined') return;

    const saved = localStorage.getItem(STORAGE_KEY);
    const dismissedData: DismissedItem[] = saved ? JSON.parse(saved) : [];

    // Add new dismissal
    dismissedData.push({
        id: bannerId,
        dismissedAt: Date.now(),
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissedData));
    console.log('[BannerDismissal] Dismissed banner:', bannerId);
}

/**
 * Clear all banner dismissals (call on logout)
 */
export function clearBannerDismissals(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(STORAGE_KEY);
    console.log('[BannerDismissal] Cleared all dismissals');
}

/**
 * Check if a specific banner is dismissed (and not expired)
 */
export function isBannerDismissed(bannerId: string, expiryDays: number = 0.167): boolean {
    return getDismissedBannerIds(expiryDays).includes(bannerId);
}

/**
 * Clean up expired dismissals from localStorage
 */
export function cleanupExpiredDismissals(expiryDays: number = 0.167): void {
    if (typeof window === 'undefined') return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
        const dismissedData: DismissedItem[] = JSON.parse(saved);
        const now = Date.now();
        const expiryMs = expiryDays * 24 * 60 * 60 * 1000;

        const validDismissals = dismissedData.filter(item => (now - item.dismissedAt) <= expiryMs);

        if (validDismissals.length < dismissedData.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(validDismissals));
            console.log('[BannerDismissal] Cleaned up', dismissedData.length - validDismissals.length, 'expired dismissals');
        }
    } catch (error) {
        console.error('[BannerDismissal] Error cleaning up dismissals:', error);
    }
}
