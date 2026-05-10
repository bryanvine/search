import { tokenize, tokenizeQuery } from "./tokenize";

const K1 = 1.5;
const B = 0.75;

export interface Bm25Doc {
  id: string;
  text: string;
}

export interface Bm25Index {
  N: number;
  avgdl: number;
  idf: Map<string, number>;
  docs: Map<string, { tf: Map<string, number>; len: number }>;
}

export function buildIndex(docs: Bm25Doc[]): Bm25Index {
  const N = Math.max(docs.length, 1);
  const df = new Map<string, number>();
  const docMap = new Map<string, { tf: Map<string, number>; len: number }>();
  let totalLen = 0;

  for (const d of docs) {
    const toks = tokenize(d.text);
    totalLen += toks.length;
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    docMap.set(d.id, { tf, len: toks.length });
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }

  const avgdl = totalLen / N;

  // Robertson-Sparck Jones IDF (with +1 smoothing for non-negativity)
  const idf = new Map<string, number>();
  for (const [t, n] of df) {
    idf.set(t, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
  }

  return { N, avgdl, idf, docs: docMap };
}

export function score(index: Bm25Index, docId: string, query: string): number {
  const doc = index.docs.get(docId);
  if (!doc) return 0;
  const qTokens = tokenizeQuery(query);
  if (!qTokens.length) return 0;

  let s = 0;
  for (const qt of qTokens) {
    const idf = index.idf.get(qt);
    if (!idf) continue;
    const tf = doc.tf.get(qt) ?? 0;
    if (tf === 0) continue;
    const num = tf * (K1 + 1);
    const den = tf + K1 * (1 - B + B * (doc.len / Math.max(index.avgdl, 1)));
    s += idf * (num / den);
  }
  return s;
}
