/** Curated trust signals. Small, conservative, and easy to audit. */

const TRUST_BOOST_DOMAINS = new Set([
  "wikipedia.org",
  "wikimedia.org",
  "wikidata.org",
  "arxiv.org",
  "github.com",
  "stackoverflow.com",
  "stackexchange.com",
  "developer.mozilla.org",
  "ietf.org",
  "rfc-editor.org",
  "w3.org",
  "python.org",
  "rust-lang.org",
  "kernel.org",
  "openai.com",
  "nature.com",
  "science.org",
  "pubmed.ncbi.nlm.nih.gov",
  "nih.gov",
  "cdc.gov",
  "nasa.gov",
  "nytimes.com",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "ft.com",
  "economist.com",
  "ap.org",
  "npr.org",
  "washingtonpost.com",
]);

const TRUST_BOOST_SUFFIXES = [".gov", ".edu", ".gov.uk", ".ac.uk"];

const TRUST_PENALTY_DOMAINS = new Set<string>([
  // SEO content farms / known low-quality sources go here.
  // Kept tiny on purpose — easier to extend than to walk back over-aggression.
]);

export function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "";
  }
}

export function trustScore(domain: string): number {
  if (!domain) return 0;
  if (TRUST_BOOST_DOMAINS.has(domain)) return 0.15;
  for (const suf of TRUST_BOOST_SUFFIXES) {
    if (domain.endsWith(suf)) return 0.15;
  }
  // also boost subdomains of trusted domains (e.g. en.wikipedia.org)
  for (const trusted of TRUST_BOOST_DOMAINS) {
    if (domain.endsWith("." + trusted)) return 0.12;
  }
  if (TRUST_PENALTY_DOMAINS.has(domain)) return -0.2;
  return 0;
}
