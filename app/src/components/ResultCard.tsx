import DetectBadge from "./DetectBadge";
import type { RankedResult } from "@/lib/types";

interface Props {
  result: RankedResult;
  rank: number;
  showDebug?: boolean;
  showDetect?: boolean;
}

function formatAge(days: number | null): string | null {
  if (days === null) return null;
  if (days < 1) return "today";
  if (days < 2) return "1 day ago";
  if (days < 14) return `${Math.round(days)} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 730) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

export default function ResultCard({ result, rank, showDebug, showDetect }: Props) {
  const age = formatAge(result.ageDays);

  return (
    <article className="group py-5 border-b border-ink-200 dark:border-ink-800 last:border-b-0">
      <div className="flex items-baseline gap-3 mb-1.5">
        <span className="font-mono text-xs text-ink-500 dark:text-ink-400 tabular-nums w-6 shrink-0">
          {rank.toString().padStart(2, "0")}
        </span>
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-600 dark:text-ink-300 text-xs font-mono truncate hover:text-accent transition-colors"
        >
          {result.domain}
        </a>
        {age && (
          <span className="text-xs text-ink-500 dark:text-ink-400 font-sans tracking-wide">· {age}</span>
        )}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {result.cluster && (
            <span className="cluster-chip text-[10px] uppercase tracking-widest text-accent/90 border border-accent/40 px-1.5 py-0.5">
              {result.cluster}
            </span>
          )}
          {showDetect && (
            <DetectBadge title={result.title} content={result.content ?? ""} />
          )}
        </span>
      </div>
      <h2 className="font-serif text-xl leading-snug mb-1">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-900 dark:text-ink-50 hover:text-accent transition-colors decoration-ink-300 hover:decoration-accent underline-offset-4"
        >
          {result.title || result.url}
        </a>
      </h2>
      {result.content && (
        <p className="font-serif text-[15px] leading-relaxed text-ink-700 dark:text-ink-200 line-clamp-3">
          {result.content}
        </p>
      )}
      {showDebug && result.debug && (
        <pre className="mt-2 text-[10px] font-mono text-ink-500 dark:text-ink-400 leading-tight whitespace-pre-wrap">
{`final=${result.debug.final.toFixed(3)}  bm25=${result.debug.bm25.toFixed(2)}  consensus=${result.debug.consensus.toFixed(2)}  trust=${result.debug.trust.toFixed(2)}  recency=${result.debug.recency.toFixed(2)}  engines=${result.debug.enginesCount}  mmr_pen=${result.debug.mmrPenalty.toFixed(3)}`}
        </pre>
      )}
    </article>
  );
}
