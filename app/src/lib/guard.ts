import { NextRequest } from "next/server";

/** Best-effort end-user IP; cloudflared sets cf-connecting-ip authoritatively. */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

/**
 * Reject browser requests from other origins. Non-browser clients (curl etc.)
 * send neither header and pass through — rate limits cover those.
 */
export function isCrossOrigin(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    try {
      if (new URL(origin).host !== host) return true;
    } catch {
      return true;
    }
  }
  return false;
}

/**
 * Fixed-window rate limiter. In-memory is enough: this app runs as a single
 * container. Each call site gets its own instance (and thus its own buckets).
 */
export function createRateLimiter(limit: number, windowMs = 60_000) {
  const hits = new Map<string, { count: number; windowStart: number }>();
  return function rateLimited(key: string): boolean {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      if (hits.size > 1000) {
        for (const [k, v] of hits) {
          if (now - v.windowStart >= windowMs) hits.delete(k);
        }
      }
      hits.set(key, { count: 1, windowStart: now });
      return false;
    }
    entry.count++;
    return entry.count > limit;
  };
}
