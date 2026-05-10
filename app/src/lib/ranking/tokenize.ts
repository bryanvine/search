const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
  "he", "in", "is", "it", "its", "of", "on", "or", "that", "the", "this", "to",
  "was", "were", "will", "with", "you", "your", "yours", "i", "we", "our", "they",
  "them", "their", "what", "which", "who", "whom", "whose", "where", "when", "why",
  "how", "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "can", "just", "don", "now", "about", "after", "again", "against", "before",
  "between", "during", "into", "through", "under", "while", "above", "below",
]);

export function tokenize(text: string): string[] {
  if (!text) return [];
  const lowered = text.toLowerCase();
  // Split on non-word characters but keep digits and underscores
  const raw = lowered.split(/[^\p{L}\p{N}_]+/u);
  const out: string[] = [];
  for (const tok of raw) {
    if (!tok || tok.length < 2) continue;
    if (STOPWORDS.has(tok)) continue;
    out.push(tok);
  }
  return out;
}

/** Tokens to keep for query intent (no stopword filter — short queries matter). */
export function tokenizeQuery(query: string): string[] {
  if (!query) return [];
  const raw = query.toLowerCase().split(/[^\p{L}\p{N}_]+/u);
  return raw.filter((t) => t.length >= 1);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersect = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) intersect++;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}
