/**
 * Extract and clean a raw JWT token from various sources.
 * Strips "Bearer " prefix (including double-prefix), rejects invalid values.
 */
export function cleanToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let t = raw.trim();
  // Strip any "Bearer " prefix layers (handles double-prefix from client)
  while (t.toLowerCase().startsWith("bearer ")) {
    t = t.slice(7).trim();
  }
  // Reject empty, literal "bearer", "null", "undefined"
  if (
    !t ||
    t.toLowerCase() === "bearer" ||
    t === "null" ||
    t === "undefined"
  ) {
    return null;
  }
  return t;
}
