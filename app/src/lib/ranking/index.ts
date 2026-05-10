import type { Cluster, Intent, RankedResult, SearxngResponse, SearxngResult } from "../types";
import { buildIndex, score as bm25Score } from "./bm25";
import { clusterResults } from "./cluster";
import { diversify } from "./diversify";
import { extractDomain, trustScore } from "./domain";
import { ageDays as ageDaysOf, inferDate, recencyScore } from "./recency";

interface IntentWeights {
  bm25: number;
  consensus: number;
  trust: number;
  recency: number;
  recencyHalfLifeDays: number;
}

const WEIGHTS: Record<Intent, IntentWeights> = {
  general: { bm25: 0.45, consensus: 0.30, trust: 0.15, recency: 0.10, recencyHalfLifeDays: 365 },
  news:    { bm25: 0.30, consensus: 0.20, trust: 0.15, recency: 0.35, recencyHalfLifeDays: 14 },
  code:    { bm25: 0.50, consensus: 0.25, trust: 0.20, recency: 0.05, recencyHalfLifeDays: 730 },
  academic:{ bm25: 0.55, consensus: 0.20, trust: 0.20, recency: 0.05, recencyHalfLifeDays: 1825 },
  qa:      { bm25: 0.50, consensus: 0.25, trust: 0.20, recency: 0.05, recencyHalfLifeDays: 730 },
};

function normalize(values: number[]): number[] {
  if (!values.length) return values;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0);
  return values.map((v) => (v - min) / (max - min));
}

interface RankOpts {
  query: string;
  intent: Intent;
  withDebug?: boolean;
}

export interface RankResult {
  results: RankedResult[];
  clusters: Cluster[];
}

export function rank(searxResp: SearxngResponse, opts: RankOpts): RankResult {
  const { query, intent, withDebug } = opts;
  const w = WEIGHTS[intent];

  const raw: SearxngResult[] = searxResp.results ?? [];
  if (!raw.length) return { results: [], clusters: [] };

  // 1. Build BM25 index over the corpus
  const index = buildIndex(
    raw.map((r) => ({ id: r.url, text: `${r.title}\n${r.title}\n${r.content ?? ""}` }))
  );

  // 2. Compute raw component scores
  const bm25Raw = raw.map((r) => bm25Score(index, r.url, query));

  const consensusRaw = raw.map((r) => {
    const engines = r.engines && r.engines.length ? r.engines : r.engine ? [r.engine] : [];
    const positions = r.positions && r.positions.length ? r.positions : [];
    const meanPos = positions.length
      ? positions.reduce((a, b) => a + b, 0) / positions.length
      : 10;
    return engines.length * 1.0 - Math.min(meanPos, 30) * 0.05;
  });

  const ages: Array<number | null> = raw.map((r) => {
    const d = inferDate(r.content ?? "", r.publishedDate ?? null);
    return ageDaysOf(d);
  });
  const recencyRaw = ages.map((a) => recencyScore(a, w.recencyHalfLifeDays));

  // 3. Normalize
  const bm25N = normalize(bm25Raw);
  const consensusN = normalize(consensusRaw);

  // 4. Combine + decorate
  const decorated = raw.map((r, i) => {
    const domain = extractDomain(r.url);
    const trust = trustScore(domain);
    const finalScore =
      w.bm25 * bm25N[i] +
      w.consensus * consensusN[i] +
      w.trust * (trust + 0.2) + // shift trust to non-negative range so neutral is 0.2*w
      w.recency * recencyRaw[i];

    const ranked: RankedResult = {
      ...r,
      domain,
      ageDays: ages[i],
      cluster: null,
    };

    if (withDebug) {
      ranked.debug = {
        bm25: bm25N[i],
        consensus: consensusN[i],
        trust,
        recency: recencyRaw[i],
        mmrPenalty: 0,
        final: finalScore,
        domain,
        enginesCount: (r.engines && r.engines.length) || (r.engine ? 1 : 0),
        ageDays: ages[i],
      };
    }

    return Object.assign(ranked, { _relevance: finalScore });
  });

  // 5. Sort by relevance, then MMR-diversify with per-domain budget
  decorated.sort((a, b) => b._relevance - a._relevance);
  const diversified = diversify(decorated);

  // 6. Cluster the top results
  const top = diversified.slice(0, 30);
  const { clusters, enriched } = clusterResults(top);

  // Replace the top slice with cluster-enriched, keep the tail as-is
  const finalResults: RankedResult[] = [...enriched, ...diversified.slice(30)];

  return { results: finalResults, clusters };
}
