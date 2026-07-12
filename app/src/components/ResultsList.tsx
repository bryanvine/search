import ResultCard from "./ResultCard";
import type { RankedResult } from "@/lib/types";

interface Props {
  results: RankedResult[];
  showDebug?: boolean;
  showDetect?: boolean;
  unresponsiveEngines?: string[];
  enginesUsedCount?: number;
}

export default function ResultsList({
  results,
  showDebug,
  showDetect,
  unresponsiveEngines = [],
  enginesUsedCount = 0,
}: Props) {
  if (!results.length) {
    // Distinguish "everything rate-limited" from "genuinely no matches"
    if (unresponsiveEngines.length > 0 && enginesUsedCount === 0) {
      return (
        <div className="font-serif text-ink-700 dark:text-ink-200 py-8 space-y-2">
          <p className="italic">
            All upstream engines are temporarily rate-limited by their providers.
          </p>
          <p className="text-sm text-ink-600 dark:text-ink-300">
            This is an upstream throttle, not a bug — wait ~60s and try again. Affected:{" "}
            <span className="font-mono text-xs">
              {unresponsiveEngines.join(", ")}
            </span>
          </p>
        </div>
      );
    }
    return (
      <p className="font-serif italic text-ink-500 dark:text-ink-400 py-8">
        No results — try a different query.
      </p>
    );
  }

  return (
    <ol className="list-none p-0 m-0">
      {results.map((r, i) => (
        <li key={r.url}>
          <ResultCard result={r} rank={i + 1} showDebug={showDebug} showDetect={showDetect} />
        </li>
      ))}
    </ol>
  );
}
