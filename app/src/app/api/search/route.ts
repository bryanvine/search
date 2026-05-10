import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet, searchCacheKey } from "@/lib/cache";
import { rank } from "@/lib/ranking";
import { detectIntent } from "@/lib/ranking/intent";
import { searxngSearch } from "@/lib/searxng";
import type { Intent, SearchPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY_LEN = 500;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LEN);
  const debug = url.searchParams.get("debug") === "1";
  const noCache = url.searchParams.get("nocache") === "1";

  if (!q) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  const intent: Intent = detectIntent(q);
  const cacheKey = searchCacheKey(q, intent + (debug ? ":debug" : ""));
  const start = Date.now();

  if (!noCache) {
    const cached = await cacheGet<SearchPayload>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true, tookMs: Date.now() - start });
    }
  }

  let searxResp;
  try {
    searxResp = await searxngSearch({
      query: q,
      pageno: 1,
      language: "en",
      timeRange: intent === "news" ? "month" : "",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "search backend unavailable", detail: (err as Error).message },
      { status: 502 }
    );
  }

  const { results, clusters } = rank(searxResp, { query: q, intent, withDebug: debug });

  const enginesUsed = Array.from(
    new Set(
      searxResp.results.flatMap((r) => (r.engines && r.engines.length ? r.engines : r.engine ? [r.engine] : []))
    )
  ).sort();

  // Normalize SearXNG answers (which may be objects) to plain strings.
  const answersNormalized = (searxResp.answers ?? [])
    .map((a) => (typeof a === "string" ? a : a?.answer ?? ""))
    .filter((s): s is string => typeof s === "string" && s.length > 0);

  const payload: SearchPayload = {
    query: q,
    intent,
    results,
    clusters,
    infoboxes: searxResp.infoboxes ?? [],
    answers: answersNormalized,
    suggestions: searxResp.suggestions ?? [],
    enginesUsed,
    unresponsiveEngines: (searxResp.unresponsive_engines ?? []).map((e) => (Array.isArray(e) ? e[0] : String(e))),
    tookMs: Date.now() - start,
    cached: false,
  };

  // Cache without the (large) debug field to keep memory down
  if (!debug && !noCache) {
    void cacheSet(cacheKey, payload);
  }

  return NextResponse.json(payload);
}
