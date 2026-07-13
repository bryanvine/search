import Redis from "ioredis";

let client: Redis | null = null;
let connectFailed = false;

function getClient(): Redis | null {
  if (connectFailed) return null;
  if (client) return client;
  const url = process.env.REDIS_URL ?? "redis://redis:6379";
  try {
    client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
    client.on("error", (err) => {
      // Quiet — Redis being down should never break search
      console.warn("[cache] redis error:", err.message);
    });
  } catch (err) {
    connectFailed = true;
    console.warn("[cache] redis init failed:", err);
    return null;
  }
  return client;
}

// Bot consumers of /api/search repeat identical queries every cycle; each
// cache hit here is one less query the engines ever see.
const SEARCH_TTL_SECONDS = Number(process.env.SEARCH_CACHE_TTL_S ?? 3600);

export async function cacheGet<T>(key: string): Promise<T | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const raw = await c.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSec = SEARCH_TTL_SECONDS): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {
    /* ignore */
  }
}

export function searchCacheKey(query: string, intent: string): string {
  // v2: payload gained detectorEnabled
  return `search:v2:${intent}:${query.toLowerCase().trim()}`;
}
