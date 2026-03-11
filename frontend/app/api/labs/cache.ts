type Lab = Record<string, any>; // Replace with actual Lab interface if available

let labsCache: Lab[] = [];
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

/**
 * Fetch labs data from the backend.
 */
async function fetchLabsFromServer(authHeader?: string): Promise<Lab[]> {
  const response = await fetch(`${base}/api/labs`, {
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch labs: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get labs, using cache if still valid.
 */
export async function getLabs(authHeader?: string): Promise<Lab[]> {
  const now = Date.now();

  // If cache is empty or expired, refetch
  if (labsCache.length === 0 || now - lastFetch > CACHE_DURATION) {
    try {
      const data = await fetchLabsFromServer(authHeader);
      labsCache = data;
      lastFetch = now;
      console.log("✅ Labs cache refreshed");
    } catch (err) {
      console.error("⚠️ Failed to refresh labs cache:", err);
      // Return stale data if available
      if (labsCache.length > 0) {
        console.log("Using stale cache data");
        return labsCache;
      }
      throw err; // No cache fallback
    }
  }

  return labsCache;
}

/**
 * Forcefully update the cache manually (optional external use)
 */
export function setLabsCache(data: Lab[]) {
  labsCache = data;
  lastFetch = Date.now();
}
