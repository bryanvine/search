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
   │  └── UI (search, results, AI toggle, PWA)     │
   └─────┬───────────────┬───────────────┬─────────┘
         │               │               │
   ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼──────────┐
   │  SearXNG  │   │   Redis   │   │ your local     │
   │  :20080   │   │   :20379  │   │ vLLM instance  │
   └───────────┘   └───────────┘   │ (OpenAI-compat │
                                   │  /v1 endpoint) │
                                   └────────────────┘
```

## Port allocation

| Port  | Service          |
|-------|------------------|
| 20000 | Next.js app      |
| 20080 | SearXNG          |
| 20379 | Redis            |

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
any LLM call.

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
