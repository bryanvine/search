/**
 * Shared between the DetectBadge client component and the /api/detect route —
 * both need to know whether a result has enough text to be worth checking.
 */

/** Mirrors the detector service's MIN_TEXT_CHARS. */
export const MIN_DETECT_CHARS = 120;

export function composeDetectText(title: string, content: string): string {
  return `${title}\n\n${content}`.trim();
}
