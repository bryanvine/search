import type { RankedResult } from "../types";
import { jaccard, tokenize } from "./tokenize";

const DOMAIN_BUDGET = 3; // max results per domain in top-K

export interface DiversifyOpts {
  lambda?: number; // 1.0 = pure relevance, 0.0 = pure diversity
  topK?: number;
}

/**
 * MMR diversification with a per-domain budget.
 *
 * Maximal Marginal Relevance:
 *   MMR(d) = lambda * relevance(d) - (1 - lambda) * max_sim(d, selected)
 *
 * We use Jaccard over (title + content) tokens for similarity.
 */
export function diversify(
  scored: Array<RankedResult & { _relevance: number }>,
  opts: DiversifyOpts = {}
): RankedResult[] {
  const lambda = opts.lambda ?? 0.7;
  const topK = opts.topK ?? scored.length;

  const tokenSets = new Map<string, Set<string>>();
  for (const r of scored) {
    tokenSets.set(r.url, new Set(tokenize(`${r.title} ${r.content}`)));
  }

  const remaining = [...scored];
  const selected: RankedResult[] = [];
  const domainCounts = new Map<string, number>();

  while (selected.length < topK && remaining.length) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      const dCount = domainCounts.get(cand.domain) ?? 0;
      if (dCount >= DOMAIN_BUDGET) continue;

      let maxSim = 0;
      const candTokens = tokenSets.get(cand.url) ?? new Set();
      for (const sel of selected) {
        const selTokens = tokenSets.get(sel.url) ?? new Set();
        const sim = jaccard(candTokens, selTokens);
        if (sim > maxSim) maxSim = sim;
      }

      const mmr = lambda * cand._relevance - (1 - lambda) * maxSim;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) break;
    const pick = remaining.splice(bestIdx, 1)[0];
    if (pick.debug) {
      pick.debug.mmrPenalty = pick._relevance - bestScore;
    }
    domainCounts.set(pick.domain, (domainCounts.get(pick.domain) ?? 0) + 1);
    delete (pick as Partial<typeof pick>)._relevance;
    selected.push(pick);
  }

  // Append any remaining (over-budget) at the end so we don't lose them
  for (const r of remaining) {
    delete (r as Partial<typeof r>)._relevance;
    selected.push(r);
  }

  return selected;
}
