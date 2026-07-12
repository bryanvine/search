/**
 * Client for the self-hosted ai-detector service
 * (https://github.com/bryanvine/ai-detector) — estimates the probability a
 * piece of text was AI-generated via an ensemble of perplexity, token-rank,
 * stylometry, and LLM-judge signals.
 *
 * Optional: leave DETECTOR_URL unset and the feature stays hidden.
 */

// DETECTOR_PUBLIC_URL is the browser-facing base of the same service, used to
// link each verdict to its shareable evidence page (/r/{id}).
const DETECTOR_URL = (process.env.DETECTOR_URL ?? "").replace(/\/$/, "");
const DETECTOR_PUBLIC_URL = (process.env.DETECTOR_PUBLIC_URL ?? "").replace(/\/$/, "");

// The full ensemble takes ~10s on typical snippets; leave headroom for a
// busy LLM backend without letting a hung one pin the request open.
const DETECT_TIMEOUT_MS = 60_000;

export const detectorEnabled = DETECTOR_URL.length > 0;

export interface DetectVerdict {
  /** P(AI-generated) 0–100, or null when the ensemble is inconclusive. */
  percent: number | null;
  confidence: string;
  /** Shareable per-signal evidence page, when DETECTOR_PUBLIC_URL is set. */
  reportUrl?: string;
}

export class DetectorRateLimited extends Error {
  constructor() {
    super("detector rate limit exceeded");
  }
}

interface DetectorResponse {
  id?: string;
  percent?: number | null;
  confidence?: string;
}

/**
 * Forward `userIp` so the detector's per-IP rate limit applies to the end
 * user, not to this container — the same way it treats its own public
 * traffic behind Cloudflare.
 */
export async function detectText(
  text: string,
  userIp: string,
  signal?: AbortSignal
): Promise<DetectVerdict> {
  const signals = [AbortSignal.timeout(DETECT_TIMEOUT_MS)];
  if (signal) signals.push(signal);

  const res = await fetch(`${DETECTOR_URL}/api/analyze/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": userIp,
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.any(signals),
    cache: "no-store",
  });

  if (res.status === 429) throw new DetectorRateLimited();
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`detector ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as DetectorResponse;
  return {
    percent: typeof data.percent === "number" ? data.percent : null,
    confidence: data.confidence ?? "none",
    reportUrl:
      DETECTOR_PUBLIC_URL && data.id ? `${DETECTOR_PUBLIC_URL}/r/${data.id}` : undefined,
  };
}
