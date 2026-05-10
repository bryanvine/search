import type { Intent } from "../types";

/**
 * Heuristic intent detection.
 *
 * Patterns use word boundaries (\b) so short markers like "cli" don't match
 * inside longer words ("climate"). Order matters: news → code → academic → qa
 * → general (most specific first).
 */

const NEWS_PATTERNS: RegExp[] = [
  /\b(today|yesterday|this week|latest|breaking|live|update|updates)\b/i,
  /\b(news|currently)\b/i,
];

const CODE_PATTERNS: RegExp[] = [
  /\b(stack\s?overflow|github|npm|pip|cargo|gem|composer|maven|gradle)\b/i,
  /\b(syntax|type|value|key|index|reference|attribute|name|module)?error\b/i,
  /\b(traceback|stack\s?trace|exception|undefined\s+is\s+not)\b/i,
  /\bhow\s+(to|do\s+i|can\s+i|do\s+you|does)\b/i,
  /\b(snippet|cli|command\s+line|terminal|bash|zsh|sh)\b/i,
];

const ACADEMIC_PATTERNS: RegExp[] = [
  /\b(arxiv|preprint|abstract|peer[- ]review)\b/i,
  /\b(paper|study|research|doi|citation)\b/i,
];

const QA_PATTERNS: RegExp[] = [
  /^(what|who|where|when|why|how)\b/i,
  /\b(definition|meaning)\s+of\b/i,
];

function anyMatch(query: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(query));
}

export function detectIntent(query: string): Intent {
  if (!query) return "general";
  const q = query.trim();
  if (anyMatch(q, NEWS_PATTERNS)) return "news";
  if (anyMatch(q, CODE_PATTERNS)) return "code";
  if (anyMatch(q, ACADEMIC_PATTERNS)) return "academic";
  if (anyMatch(q, QA_PATTERNS)) return "qa";
  return "general";
}
