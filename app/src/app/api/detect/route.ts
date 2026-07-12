import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import { composeDetectText, MIN_DETECT_CHARS } from "@/lib/detect";
import { DetectorRateLimited, detectText, detectorEnabled, type DetectVerdict } from "@/lib/detector";
import { clientIp, createRateLimiter, isCrossOrigin } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Snippet-sized inputs only — this endpoint is not a general document
// analyzer, and the caps keep it from being used as one.
const MAX_TITLE_CHARS = 300;
const MAX_CONTENT_CHARS = 1200;

// Verdicts are stable for a given snippet, so cache hard. Repeat checks of
// the same result (any user) skip the ~10s ensemble entirely.
const DETECT_CACHE_TTL_SEC = 7 * 24 * 3600;

// Per-user clicks (cache hits included) and a global ceiling on how fast this
// proxy will hit the detector at all. The detector enforces its own 10/min
// per forwarded IP — these just shed abuse before it leaves the container.
const userLimited = createRateLimiter(30);
const upstreamLimited = createRateLimiter(30);

interface DetectBody {
  title: string;
  content: string;
}

export async function POST(req: NextRequest) {
  if (!detectorEnabled) {
    return NextResponse.json({ error: "detector not configured" }, { status: 501 });
  }
  if (isCrossOrigin(req)) return new Response("forbidden", { status: 403 });

  const ip = clientIp(req);
  if (userLimited(ip)) return new Response("rate limited", { status: 429 });

  let body: DetectBody;
  try {
    body = (await req.json()) as DetectBody;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const title = String(body.title ?? "").slice(0, MAX_TITLE_CHARS);
  const content = String(body.content ?? "").slice(0, MAX_CONTENT_CHARS);
  const text = composeDetectText(title, content);
  if (text.length < MIN_DETECT_CHARS) {
    return NextResponse.json({ error: "snippet too short for a verdict" }, { status: 422 });
  }

  const cacheKey = `detect:v1:${createHash("sha256").update(text).digest("hex")}`;
  const cached = await cacheGet<DetectVerdict>(cacheKey);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  if (upstreamLimited("global")) {
    return new Response("detector busy — try again in a minute", { status: 429 });
  }

  try {
    const verdict = await detectText(text, ip, req.signal);
    void cacheSet(cacheKey, verdict, DETECT_CACHE_TTL_SEC);
    return NextResponse.json({ ...verdict, cached: false });
  } catch (err) {
    if (err instanceof DetectorRateLimited) {
      return new Response("detector rate limit — try again in a minute", { status: 429 });
    }
    console.error("[detect] failed:", (err as Error).message);
    return NextResponse.json({ error: "detector unavailable" }, { status: 502 });
  }
}
