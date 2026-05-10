export interface SearxngResult {
  url: string;
  title: string;
  content: string;
  engine: string;
  engines?: string[];
  positions?: number[];
  score?: number;
  category?: string;
  publishedDate?: string | null;
  thumbnail?: string | null;
}

/**
 * SearXNG answers come in two shapes:
 *  - Plain strings (some plugins)
 *  - Objects of shape `{url, engine, parsed_url, template, answer}` where the
 *    user-readable text lives in `.answer` (most plugins, e.g. currency, calc)
 */
export type SearxngRawAnswer =
  | string
  | {
      answer?: string;
      url?: string;
      engine?: string;
      parsed_url?: unknown;
      template?: string;
    };

export interface SearxngResponse {
  query: string;
  number_of_results: number;
  results: SearxngResult[];
  answers?: SearxngRawAnswer[];
  corrections?: string[];
  infoboxes?: Array<{
    infobox?: string;
    id?: string;
    content?: string;
    img_src?: string;
    urls?: Array<{ title: string; url: string }>;
  }>;
  suggestions?: string[];
  unresponsive_engines?: Array<[string, string]>;
}

export type Intent = "general" | "news" | "code" | "academic" | "qa";

export interface RankingDebug {
  bm25: number;
  consensus: number;
  trust: number;
  recency: number;
  mmrPenalty: number;
  final: number;
  domain: string;
  enginesCount: number;
  ageDays: number | null;
}

export interface RankedResult extends SearxngResult {
  domain: string;
  ageDays: number | null;
  cluster: string | null;
  debug?: RankingDebug;
}

export interface Cluster {
  label: string;
  count: number;
  resultUrls: string[];
}

export interface SearchPayload {
  query: string;
  intent: Intent;
  results: RankedResult[];
  clusters: Cluster[];
  infoboxes: SearxngResponse["infoboxes"];
  answers: string[];
  suggestions: string[];
  tookMs: number;
  enginesUsed: string[];
  unresponsiveEngines: string[];
  cached: boolean;
}
