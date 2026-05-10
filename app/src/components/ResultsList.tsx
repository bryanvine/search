import ResultCard from "./ResultCard";
import type { RankedResult } from "@/lib/types";

interface Props {
  results: RankedResult[];
  showDebug?: boolean;
}

export default function ResultsList({ results, showDebug }: Props) {
  if (!results.length) {
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
          <ResultCard result={r} rank={i + 1} showDebug={showDebug} />
        </li>
      ))}
    </ol>
  );
}
