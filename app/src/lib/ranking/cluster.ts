import type { Cluster, RankedResult } from "../types";
import { tokenize } from "./tokenize";

/**
 * Simple TF-IDF clustering: pick the top informative unigram from each result's
 * snippet and group results that share their dominant term.
 *
 * This is intentionally lightweight — no k-means, no embeddings. Fast and
 * good-enough for surfacing topical splits in a results page.
 */
export function clusterResults(results: RankedResult[]): {
  clusters: Cluster[];
  enriched: RankedResult[];
} {
  if (results.length < 4) {
    return { clusters: [], enriched: results };
  }

  // Build IDF over the result corpus
  const docTokens = results.map((r) => new Set(tokenize(`${r.title} ${r.content}`)));
  const df = new Map<string, number>();
  for (const ts of docTokens) {
    for (const t of ts) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = results.length;
  const idf = (t: string) => Math.log((N + 1) / ((df.get(t) ?? 0) + 1));

  // Pick the highest TF-IDF token per result (skip super common / super rare)
  const dominant: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const tokens = tokenize(`${r.title} ${r.title} ${r.content}`); // weight title 2x
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let best = "";
    let bestScore = 0;
    for (const [t, c] of tf) {
      const dfT = df.get(t) ?? 0;
      if (dfT < 2 || dfT > N * 0.7) continue; // need at least 2 occurrences, not too generic
      const score = c * idf(t);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    dominant.push(best);
  }

  const counts = new Map<string, string[]>();
  for (let i = 0; i < results.length; i++) {
    const tag = dominant[i];
    if (!tag) continue;
    if (!counts.has(tag)) counts.set(tag, []);
    counts.get(tag)!.push(results[i].url);
  }

  const clusters: Cluster[] = [];
  for (const [label, urls] of counts) {
    if (urls.length < 2) continue;
    clusters.push({ label, count: urls.length, resultUrls: urls });
  }
  clusters.sort((a, b) => b.count - a.count);

  const top = new Set(clusters.slice(0, 8).map((c) => c.label));
  const enriched = results.map((r, i) => ({
    ...r,
    cluster: top.has(dominant[i]) ? dominant[i] : null,
  }));

  return { clusters: clusters.slice(0, 8), enriched };
}
