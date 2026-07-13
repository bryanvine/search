/**
 * searxng-gateway — caching + pacing proxy in front of the shared SearXNG
 * instance.
 *
 * Several apps on this host share one SearXNG. Unpaced, their combined
 * traffic gets the upstream engines (DuckDuckGo, Brave, ...) to suspend the
 * instance for minutes at a time, which takes every consumer down at once.
 * This gateway sits on the host port the consumers already use, so they need
 * no changes, and:
 *
 *  - caches non-empty /search?format=json responses (empty result sets are
 *    what engine suspension looks like — caching them would poison the cache)
 *  - collapses concurrent identical queries into one upstream fetch
 *  - paces upstream fetches with a token bucket (sustained rate + small
 *    burst), queueing excess with round-robin fairness across client IPs so
 *    one chatty app can't starve the others
 *  - serves a stale cached copy when the upstream comes back empty mid-outage
 *  - exposes per-client counters at /gateway/stats
 *
 * Zero dependencies on purpose — one file, plain node:http + fetch.
 */

const http = require("node:http");

const PORT = Number(process.env.PORT ?? 20080);
const UPSTREAM = (process.env.SEARXNG_UPSTREAM ?? "http://searxng:8080").replace(/\/$/, "");

// Sustained upstream searches per minute, and how many may go out back-to-back.
const RATE_PER_MIN = Number(process.env.GATEWAY_RATE_PER_MIN ?? 10);
const BURST = Number(process.env.GATEWAY_BURST ?? 4);

// How long a request may wait in the pacing queue before it gets a 429.
// Keep below the consumers' own HTTP client timeouts where possible.
const MAX_WAIT_MS = Number(process.env.GATEWAY_MAX_WAIT_S ?? 20) * 1000;
const MAX_QUEUED = Number(process.env.GATEWAY_MAX_QUEUED ?? 100);

const CACHE_TTL_MS = Number(process.env.GATEWAY_CACHE_TTL_S ?? 1800) * 1000;
// Stale entries stay usable this long as a fallback during engine outages.
const STALE_TTL_MS = Number(process.env.GATEWAY_STALE_TTL_S ?? 24 * 3600) * 1000;
const CACHE_MAX_ENTRIES = Number(process.env.GATEWAY_CACHE_MAX ?? 500);

const UPSTREAM_TIMEOUT_MS = 25_000;

// ---------------------------------------------------------------- stats
const stats = {
  startedAt: new Date().toISOString(),
  requests: 0,
  cacheHits: 0,
  staleServed: 0,
  joined: 0,
  upstreamFetches: 0,
  upstreamEmpty: 0,
  upstreamErrors: 0,
  rejected: 0,
  perClient: new Map(), // ip -> {requests, fetches, cacheHits, rejected}
};

function clientStats(ip) {
  let s = stats.perClient.get(ip);
  if (!s) {
    s = { requests: 0, fetches: 0, cacheHits: 0, rejected: 0 };
    stats.perClient.set(ip, s);
  }
  return s;
}

// ---------------------------------------------------------------- cache
// key -> {body, contentType, status, freshUntil, staleUntil}
const cache = new Map();

function cacheGet(key, allowStale = false) {
  const e = cache.get(key);
  if (!e) return null;
  const now = Date.now();
  if (now > e.staleUntil) {
    cache.delete(key);
    return null;
  }
  if (now > e.freshUntil && !allowStale) return null;
  // LRU: refresh insertion order
  cache.delete(key);
  cache.set(key, e);
  return e;
}

function cachePut(key, body, contentType) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  const now = Date.now();
  cache.set(key, {
    body,
    contentType,
    status: 200,
    freshUntil: now + CACHE_TTL_MS,
    staleUntil: now + STALE_TTL_MS,
  });
}

// ---------------------------------------------------------------- pacing
let tokens = BURST;
let lastRefill = Date.now();

// clientIp -> FIFO of waiters {resolve, reject, deadline, gone}
const queues = new Map();
const clientOrder = []; // round-robin ring of client ips with waiters
let queuedCount = 0;

function refill() {
  const now = Date.now();
  tokens = Math.min(BURST, tokens + ((now - lastRefill) / 60_000) * RATE_PER_MIN);
  lastRefill = now;
}

/** Resolve one waiter per available token, round-robin across clients. */
function pump() {
  refill();
  while (tokens >= 1 && queuedCount > 0) {
    let dispatched = false;
    for (let i = 0; i < clientOrder.length; i++) {
      const ip = clientOrder.shift();
      const q = queues.get(ip);
      if (!q || q.length === 0) {
        queues.delete(ip);
        continue;
      }
      clientOrder.push(ip); // stays in the ring, moves to the back
      const w = q.shift();
      queuedCount--;
      if (w.gone || Date.now() > w.deadline) {
        w.reject(new Error("expired"));
        i--; // this token is still unspent; try the next client
        continue;
      }
      tokens--;
      w.resolve();
      dispatched = true;
      break;
    }
    if (!dispatched) break;
  }
}

setInterval(pump, 500).unref();
// Drop expired waiters even when no tokens free up.
setInterval(() => {
  const now = Date.now();
  for (const [ip, q] of queues) {
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].gone || now > q[i].deadline) {
        q[i].reject(new Error("expired"));
        q.splice(i, 1);
        queuedCount--;
      }
    }
    if (q.length === 0) queues.delete(ip);
  }
}, 1000).unref();

/** Wait for an upstream slot. Rejects on timeout / disconnect / overflow. */
function acquireToken(ip, req) {
  refill();
  if (tokens >= 1 && queuedCount === 0) {
    tokens--;
    return Promise.resolve();
  }
  if (queuedCount >= MAX_QUEUED) return Promise.reject(new Error("queue full"));
  return new Promise((resolve, reject) => {
    const w = { resolve, reject, deadline: Date.now() + MAX_WAIT_MS, gone: false };
    req.on("close", () => {
      w.gone = true; // freed lazily; no token is wasted on a dead client
    });
    if (!queues.has(ip)) {
      queues.set(ip, []);
      clientOrder.push(ip);
    }
    queues.get(ip).push(w);
    queuedCount++;
    pump();
  });
}

// ---------------------------------------------------------------- upstream
const inflight = new Map(); // cache key -> Promise<{status, contentType, body}>

async function fetchUpstream(method, pathWithQuery, headers, body) {
  stats.upstreamFetches++;
  const res = await fetch(`${UPSTREAM}${pathWithQuery}`, {
    method,
    headers,
    body: body && body.length ? body : undefined,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
    body: buf,
  };
}

function upstreamHeaders(req) {
  const h = {
    Accept: req.headers["accept"] ?? "*/*",
    "User-Agent": req.headers["user-agent"] ?? "searxng-gateway/1.0",
    // SearXNG's bot detection wants these when proxied
    "X-Forwarded-For": req.headers["x-forwarded-for"] ?? "127.0.0.1",
    "X-Real-IP": req.headers["x-real-ip"] ?? "127.0.0.1",
  };
  if (req.headers["content-type"]) h["Content-Type"] = req.headers["content-type"];
  return h;
}

/** Number of results in a SearXNG JSON payload, or -1 if unparseable. */
function resultCount(buf) {
  try {
    const parsed = JSON.parse(buf.toString("utf8"));
    return Array.isArray(parsed.results) ? parsed.results.length : -1;
  } catch {
    return -1;
  }
}

function canonicalKey(url) {
  const params = [...url.searchParams.entries()]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .sort()
    .join("&");
  return `${url.pathname}?${params}`;
}

// ---------------------------------------------------------------- server
function send(res, status, body, contentType, extra = {}) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { "Content-Type": contentType, ...extra });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handleSearch(req, res, url, ip) {
  const started = Date.now();
  const cacheable = req.method === "GET" && url.searchParams.get("format") === "json";
  const key = cacheable ? canonicalKey(url) : null;

  if (key) {
    const hit = cacheGet(key);
    if (hit) {
      stats.cacheHits++;
      clientStats(ip).cacheHits++;
      send(res, hit.status, hit.body, hit.contentType, { "X-Cache": "HIT" });
      return;
    }
    const joined = inflight.get(key);
    if (joined) {
      stats.joined++;
      try {
        const r = await joined;
        send(res, r.status, r.body, r.contentType, { "X-Cache": "JOIN" });
      } catch {
        send(res, 502, JSON.stringify({ error: "upstream failed" }), "application/json");
      }
      return;
    }
  }

  const body = req.method === "POST" ? await readBody(req) : null;

  let queuedMs = 0;
  try {
    await acquireToken(ip, req);
    queuedMs = Date.now() - started;
  } catch (err) {
    stats.rejected++;
    clientStats(ip).rejected++;
    const reason = err.message === "queue full" ? "gateway queue full" : "queue wait exceeded";
    send(res, 429, JSON.stringify({ error: `${reason} — retry later` }), "application/json", {
      "Retry-After": "30",
    });
    return;
  }

  const task = (async () => {
    const r = await fetchUpstream(req.method, url.pathname + url.search, upstreamHeaders(req), body);
    if (key && r.status === 200) {
      const n = resultCount(r.body);
      if (n > 0) {
        cachePut(key, r.body, r.contentType);
      } else {
        stats.upstreamEmpty++;
        // Engine suspension mid-outage: a stale non-empty copy beats a fresh
        // empty one for every consumer.
        const stale = cacheGet(key, true);
        if (stale) {
          stats.staleServed++;
          return { status: stale.status, body: stale.body, contentType: stale.contentType, stale: true };
        }
      }
    }
    return r;
  })();

  if (key) {
    inflight.set(key, task);
    task.finally(() => inflight.delete(key)).catch(() => {});
  }

  try {
    const r = await task;
    clientStats(ip).fetches++;
    const totalMs = Date.now() - started;
    console.log(
      `[gateway] ${req.method} client=${ip} queued=${queuedMs}ms total=${totalMs}ms status=${r.status}${r.stale ? " (stale)" : ""} q=${url.searchParams.get("q") ?? ""}`
    );
    send(res, r.status, r.body, r.contentType, {
      "X-Cache": r.stale ? "STALE" : "MISS",
      "X-Gateway-Queued-Ms": String(queuedMs),
    });
  } catch (err) {
    stats.upstreamErrors++;
    console.error(`[gateway] upstream error client=${ip}:`, err.message);
    send(res, 502, JSON.stringify({ error: "searxng upstream failed" }), "application/json");
  }
}

const server = http.createServer(async (req, res) => {
  // docker-proxy masquerades published-port traffic to one bridge IP, so
  // source IP alone can't tell consumers apart. Apps that set X-App-Id get
  // their own fairness bucket and stats line; the rest share the IP bucket.
  const ip = String(req.headers["x-app-id"] ?? req.socket.remoteAddress ?? "unknown").slice(0, 64);
  const url = new URL(req.url, "http://gateway");
  stats.requests++;
  clientStats(ip).requests++;

  try {
    if (url.pathname === "/gateway/health") {
      send(res, 200, JSON.stringify({ ok: true, service: "searxng-gateway" }), "application/json");
      return;
    }
    if (url.pathname === "/gateway/stats") {
      refill();
      send(
        res,
        200,
        JSON.stringify(
          {
            ...stats,
            perClient: Object.fromEntries(stats.perClient),
            cacheEntries: cache.size,
            queued: queuedCount,
            tokens: Math.floor(tokens * 100) / 100,
          },
          null,
          2
        ),
        "application/json"
      );
      return;
    }
    if (url.pathname === "/search") {
      await handleSearch(req, res, url, ip);
      return;
    }
    // Everything else (autocomplete, config, ...) passes through unpaced.
    const body = req.method === "POST" ? await readBody(req) : null;
    const r = await fetchUpstream(req.method, url.pathname + url.search, upstreamHeaders(req), body);
    send(res, r.status, r.body, r.contentType);
  } catch (err) {
    console.error("[gateway] error:", err.message);
    send(res, 500, JSON.stringify({ error: "gateway error" }), "application/json");
  }
});

server.listen(PORT, () => {
  console.log(
    `[gateway] listening on :${PORT} → ${UPSTREAM} | rate=${RATE_PER_MIN}/min burst=${BURST} cacheTTL=${CACHE_TTL_MS / 1000}s`
  );
});
