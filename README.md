# buffy-search

Self-hosted privacy-respecting search engine with a custom ranking pipeline,
optional self-hosted AI answers, and no third-party AI dependencies.

Powered by:

- **SearXNG** — meta-search aggregating 70+ engines
- **Custom ranking** — BM25 + domain trust + recency + MMR diversification + topic clusters
- **vLLM (`openai/gpt-oss-120b`)** — self-hosted answers, streamed via OpenAI-compatible API
- **Next.js 15** — full-stack TypeScript on the App Router
- **Redis** — query and result cache

Public URL: <https://search.buffy.bot>

## Architecture

```
┌──────────────────┐
│ search.buffy.bot │
└────────┬─────────┘
         │ cloudflared tunnel (host service)
         ▼
   ┌──────────────────────────────────────────┐
   │ Next.js app  :20000                      │
   │ ├── /api/search → ranking → SearXNG      │
   │ ├── /api/answer → vLLM (streaming)       │
   │ └── UI (search box, results, AI toggle)  │
   └─────┬───────────────┬────────────────────┘
         │               │
   ┌─────▼─────┐   ┌─────▼─────┐
   │ SearXNG   │   │ Redis     │
   │ :20080    │   │ :20379    │
   └───────────┘   └───────────┘
                   ┌──────────────────────┐
   /api/answer ───►│ mtkt-controller:8100 │
                   │ (vLLM, OpenAI API)   │
                   └──────────────────────┘
```

## Port allocation (block 20000–20999)

| Port  | Service          |
|-------|------------------|
| 20000 | Next.js app      |
| 20080 | SearXNG          |
| 20379 | Redis            |

## Quickstart

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f app
```

The app is at <http://localhost:20000>; SearXNG JSON is at <http://localhost:20080>.

## Custom ranking

`app/src/lib/ranking/` re-ranks SearXNG output:

1. **BM25** over `title + snippet` with the user's query.
2. **Engine consensus** — boost results returned by multiple engines.
3. **Domain trust** — small curated allowlist boost (Wikipedia, .gov, .edu, …).
4. **Recency** — freshness boost when a date is present.
5. **MMR diversification** — penalize near-duplicates and same-domain stacking.
6. **Topic clustering** — group results by the dominant unigrams of their snippets.

The intent is a transparent, debuggable ranking layer (no learned model, no
third-party black box). Each stage's score is exposed via the `?debug=1` query
flag for inspection.

## AI mode

When the toggle is on, `/api/answer` streams an answer grounded in the top-N
ranked results, with inline `[1]`, `[2]` citations linked to the source URLs.
Powered entirely by `openai/gpt-oss-120b` running on the host's vLLM
(`mtkt-controller:8100`).

The AI mode is **off by default**: standard search returns instantly without
any LLM call.

## Using this SearXNG from other apps

Other apps in `/apps/*` can point at the central SearXNG via:

```
SEARXNG_URL=http://host.docker.internal:20080
```

(Docker compose users may need `extra_hosts: ["host.docker.internal:host-gateway"]`.)
