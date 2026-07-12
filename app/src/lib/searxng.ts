import type { SearxngResponse } from "./types";

const SEARXNG_URL = process.env.SEARXNG_URL ?? "http://searxng:8080";

// SearXNG aggregates many engines; a healthy response is a few seconds. Past
// this we're better off failing fast than holding the request open.
const SEARCH_TIMEOUT_MS = 15_000;

export interface SearxngQueryOpts {
  query: string;
  pageno?: number;
  categories?: string[];
  engines?: string[];
  language?: string;
  timeRange?: "" | "day" | "week" | "month" | "year";
  safesearch?: 0 | 1 | 2;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function searxngSearch(opts: SearxngQueryOpts): Promise<SearxngResponse> {
  const params = new URLSearchParams();
  params.set("q", opts.query);
  params.set("format", "json");
  params.set("pageno", String(opts.pageno ?? 1));
  params.set("language", opts.language ?? "en");
  params.set("safesearch", String(opts.safesearch ?? 0));
  if (opts.timeRange) params.set("time_range", opts.timeRange);
  if (opts.categories?.length) params.set("categories", opts.categories.join(","));
  if (opts.engines?.length) params.set("engines", opts.engines.join(","));

  const signals = [AbortSignal.timeout(opts.timeoutMs ?? SEARCH_TIMEOUT_MS)];
  if (opts.signal) signals.push(opts.signal);

  const url = `${SEARXNG_URL}/search?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "self-hosted-search/0.1",
      // SearXNG's bot detection wants these set when run behind a proxy
      "X-Forwarded-For": "127.0.0.1",
      "X-Real-IP": "127.0.0.1",
    },
    signal: AbortSignal.any(signals),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SearXNG ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as SearxngResponse;
}
