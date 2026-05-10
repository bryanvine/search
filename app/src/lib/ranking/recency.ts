/** Best-effort date extraction from SearXNG result fields. */

export function parsePublishedDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/** Try harder: also peek at the snippet for "X days/months/years ago" or YYYY-MM-DD. */
export function inferDate(snippet: string, explicit: string | null | undefined): Date | null {
  const explicitParsed = parsePublishedDate(explicit);
  if (explicitParsed) return explicitParsed;

  if (!snippet) return null;
  const isoMatch = snippet.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }

  const ago = snippet.match(/(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago/i);
  if (ago) {
    const n = parseInt(ago[1], 10);
    const unit = ago[2].toLowerCase();
    const ms =
      unit.startsWith("day") ? n * 86400e3 :
      unit.startsWith("week") ? n * 7 * 86400e3 :
      unit.startsWith("month") ? n * 30 * 86400e3 :
      n * 365 * 86400e3;
    return new Date(Date.now() - ms);
  }

  return null;
}

export function ageDays(date: Date | null): number | null {
  if (!date) return null;
  const ms = Date.now() - date.getTime();
  if (ms < 0) return 0;
  return ms / 86400e3;
}

/**
 * Recency score in [0, 1].
 *
 * Half-life parameter controls how fast freshness decays. For news intent we
 * use a 30-day half-life; for general queries we use a year.
 */
export function recencyScore(ageInDays: number | null, halfLifeDays: number): number {
  if (ageInDays === null) return 0;
  if (ageInDays <= 0) return 1;
  return Math.pow(0.5, ageInDays / Math.max(halfLifeDays, 1));
}
