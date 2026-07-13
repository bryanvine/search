# search

A self-hosted, privacy-respecting meta-search engine with a hand-rolled
ranking pipeline and an optional self-hosted AI synthesis layer.

Built on:

- **SearXNG** — meta-search across ~70 engines
- **Custom TypeScript ranking** — Okapi BM25, engine consensus, curated
  domain-trust signal, recency decay, MMR diversification, TF-IDF topic
  clustering
- **vLLM** (or any OpenAI-compatible local endpoint) — optional answer
  streaming, grounded in the top-N ranked results with inline citations
- **Next.js 15** — full-stack TypeScript on the App Router
- **Redis** — query and result cache

No third-party AI APIs. No telemetry. No ads. Installable as a PWA.

## Architecture

```
              ┌──────────────┐
              │   internet   │
              └──────┬───────┘
                     │  reverse proxy / tunnel
                     ▼
   ┌───────────────────────────────────────────────┐
   │ Next.js app  :20000                           │
   │  ├── /api/search → ranking → SearXNG          │
   │  ├── /api/answer → local vLLM (streaming SSE) │
   │  ├── /api/detect → ai-detector (optional)     │
   │  └── UI (search, results, AI toggle, PWA)     │
   └─────┬───────────────┬───────────────┬─────────┘
         │               │               │
   ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼──────────┐
   │  gateway  │   │   Redis   │   │ your local     │
   │  :20080   │   │ internal  │   │ vLLM instance  │
   └─────┬─────┘   └───────────┘   │ (OpenAI-compat │
         │  ▲                      │  /v1 endpoint) │
         │  └─ other apps sharing  └────────────────┘
   ┌─────▼─────┐   this SearXNG
   │  SearXNG  │   (cache + pacing, see below)
   │ internal  │
   └───────────┘
```

## Port allocation

| Port  | Service          |
|-------|------------------|
| 20000 | Next.js app      |
| 20080 | SearXNG gateway  |

SearXNG and Redis are reachable only on the compose network — no host
ports. Anything that wants SearXNG goes through the gateway on 20080.

## SearXNG gateway (cache + pacing)

Multiple apps sharing one SearXNG instance will eventually get its upstream
engines (DuckDuckGo, Brave, Startpage, …) to suspend it — "too many
requests", CAPTCHAs — which takes every consumer down at once. The
`gateway/` service sits on host port 20080, exactly where consumers already
pointed, so **no consumer needs any change**, and it:

- **caches** non-empty `/search?format=json` responses for 30 min (empty
  result sets are what suspension looks like, so they're never cached);
- **collapses** concurrent identical queries into one upstream fetch;
- **paces** what actually reaches the engines with a token bucket
  (`GATEWAY_RATE_PER_MIN`, default 10/min, burst `GATEWAY_BURST`=4),
  queueing excess up to `GATEWAY_MAX_WAIT_S` with round-robin fairness
  across client IPs so one chatty app can't starve the rest;
- **serves stale** (up to 24 h) when the upstream returns empty mid-outage —
  an old real answer beats a fresh empty one;
- exposes counters per client at `/gateway/stats` and health at
  `/gateway/health`.

Docker's userland proxy masquerades all published-port traffic to one
source IP, so consumers look identical by default. Apps that send an
`X-App-Id: <name>` header get their own fairness bucket and their own line
in `/gateway/stats` — a one-line change in each consumer, worth making but
not required.

The Next.js app routes through the gateway too — scrapers use this app's
`/api/search` (ranked results) just as much as raw SearXNG, so a direct
path would dodge the pacing. The app forwards each end client's IP as its
`X-App-Id`, so every API consumer gets its own fairness bucket and an
interactive search never queues behind a scraper's burst. The app's own
Redis payload cache (`SEARCH_CACHE_TTL_S`, default 1 h) sits in front of
all of it.

## Quickstart

```bash
cp .env.example .env
# Edit .env: point VLLM_BASE_URL at any OpenAI-compatible endpoint
# you control (vLLM, llama.cpp server, Ollama via /v1, etc.)
docker compose up -d --build
docker compose logs -f app
```

App: <http://localhost:20000> · SearXNG JSON: <http://localhost:20080/search?q=test&format=json>

## Custom ranking

`app/src/lib/ranking/` re-ranks SearXNG output through several stages:

1. **Okapi BM25** over `title + snippet` against the user's query, indexed
   over the result corpus.
2. **Engine consensus** — boost results returned by multiple engines, weighted
   by their position in each.
3. **Domain trust** — a small curated allowlist (Wikipedia, IETF, RFC editor,
   `.gov`, `.edu`, major newsrooms, …). Easy to audit, easy to extend.
4. **Recency** — freshness decay on a half-life tuned per detected intent
   (news, code, academic, QA, general).
5. **MMR diversification** — Maximal Marginal Relevance penalizes near-duplicate
   snippets, with a per-domain budget so one site can't stack the top-K.
6. **TF-IDF topic clustering** — group the top results by their dominant
   unigrams; surface clusters as filter chips above the result list.

The intent is a transparent, debuggable ranking layer — no learned model, no
black box. Append `?debug=1` to any search to see per-component scores
(`bm25`, `consensus`, `trust`, `recency`, `mmr_pen`, `final`) inline under
each result.

## AI mode

When the toggle is on, `/api/answer` streams an answer grounded in the top-N
ranked results, with inline `[1]`, `[2]` citations linked to the source URLs.

Powered entirely by **your own** vLLM instance — set `VLLM_BASE_URL` to any
OpenAI-compatible `/v1` endpoint. No requests leave your network.

The AI mode is **off by default**: standard search returns instantly without
any LLM call. The toggle is sticky — flip it once and it stays on across
searches (the `?ai=1`/`?ai=0` URL params remain explicit overrides for
shareable links).

## AI-content detection (optional)

Every result with enough snippet text gets an `ai?` chip. Click it and the
snippet is scored by a self-hosted
[ai-detector](https://github.com/bryanvine/ai-detector) instance — an
ensemble of perplexity, token-rank, stylometry, and LLM-judge signals — and
the chip becomes a color-coded `ai NN%` verdict linking to the full
per-signal evidence page.

Checks are on demand (each uncached verdict costs the detector ~10s of
inference), cached in Redis for a week by snippet hash, and rate-limited
per user — the end-user IP is forwarded so the detector applies its own
per-IP budget to people, not to this app's container.

Set `DETECTOR_URL` (and optionally `DETECTOR_PUBLIC_URL` for the evidence
links) in `.env` to enable; leave unset and the UI never shows the chips.

## Repo layout

```
.
├── docker-compose.yml          # app + searxng + redis
├── searxng/settings.yml        # SearXNG config (engines, formats)
├── app/                        # Next.js app
│   ├── Dockerfile              # multi-stage standalone build
│   ├── public/                 # icons, sw.js, manifest, offline.html
│   └── src/
│       ├── app/                # routes (page.tsx, /api/search, /api/answer)
│       ├── components/         # SearchBox, ResultCard, AIPanel, …
│       └── lib/
│           ├── ranking/        # bm25 / domain / recency / diversify / cluster
│           ├── searxng.ts      # JSON API client
│           ├── vllm.ts         # OpenAI-compatible streaming client
│           ├── cache.ts        # Redis wrapper (degrades gracefully)
│           └── brand.ts        # host-aware branding helper
```

## License

MIT. See [LICENSE](LICENSE) if present, otherwise treat as MIT.
