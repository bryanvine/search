"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AIPanel from "@/components/AIPanel";
import AIToggle from "@/components/AIToggle";
import ClusterTabs from "@/components/ClusterTabs";
import Infobox from "@/components/Infobox";
import ResultsList from "@/components/ResultsList";
import type { SearchPayload } from "@/lib/types";

interface Props {
  query: string;
  aiEnabled: boolean;
  debug: boolean;
}

export default function SearchResults({ query, aiEnabled, debug }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<SearchPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCluster, setActiveCluster] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    setActiveCluster(null);
    const ac = new AbortController();
    const url = `/api/search?q=${encodeURIComponent(query)}${debug ? "&debug=1" : ""}`;
    fetch(url, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        return (await res.json()) as SearchPayload;
      })
      .then(setData)
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
      });
    return () => ac.abort();
  }, [query, debug]);

  function setAI(next: boolean) {
    const sp = new URLSearchParams(params);
    if (next) sp.set("ai", "1");
    else sp.delete("ai");
    router.replace(`/search?${sp.toString()}`);
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!activeCluster) return data.results;
    return data.results.filter((r) => r.cluster === activeCluster);
  }, [data, activeCluster]);

  if (error) {
    return (
      <p className="font-serif text-red-700 dark:text-red-400 italic py-8">
        {error}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="animate-pulse space-y-4 mt-8" aria-label="Searching">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-1/3 bg-ink-200 dark:bg-ink-800" />
            <div className="h-5 w-2/3 bg-ink-200 dark:bg-ink-800" />
            <div className="h-3 w-full bg-ink-200 dark:bg-ink-800" />
            <div className="h-3 w-5/6 bg-ink-200 dark:bg-ink-800" />
          </div>
        ))}
      </div>
    );
  }

  const enginesUsedDisplay = data.enginesUsed.slice(0, 8).join(" · ");

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6 md:gap-10">
      <div>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-ink-200 dark:border-ink-800">
          <p className="text-xs font-mono text-ink-600 dark:text-ink-300">
            <span className="text-ink-900 dark:text-ink-50">{data.results.length}</span>{" "}
            results · <span className="uppercase tracking-wider">{data.intent}</span>{" "}
            · <span>{data.tookMs}ms</span>
            {data.cached && <span className="text-accent"> · cached</span>}
          </p>
          <AIToggle enabled={aiEnabled} onChange={setAI} />
        </div>

        <ClusterTabs
          clusters={data.clusters}
          active={activeCluster}
          onChange={setActiveCluster}
        />

        {aiEnabled && data.results.length > 0 && (
          <AIPanel query={query} results={data.results.slice(0, 8)} />
        )}

        <ResultsList results={filtered} showDebug={debug} />
      </div>

      <aside className="hidden md:block">
        {data.infoboxes && data.infoboxes.length > 0 && (
          <Infobox infobox={data.infoboxes[0]} />
        )}
        {data.answers.length > 0 && (
          <div className="border border-ink-300 dark:border-ink-700 p-5 mb-6 bg-white/40 dark:bg-ink-800/30">
            <h3 className="font-serif text-sm uppercase tracking-widest text-ink-600 dark:text-ink-300 mb-2">
              Direct answer
            </h3>
            <p className="font-serif text-sm leading-relaxed text-ink-900 dark:text-ink-100">
              {data.answers[0]}
            </p>
          </div>
        )}
        {data.suggestions.length > 0 && (
          <div className="mb-6">
            <h3 className="font-serif text-xs uppercase tracking-widest text-ink-600 dark:text-ink-300 mb-2">
              Related
            </h3>
            <ul className="text-sm space-y-1">
              {data.suggestions.slice(0, 6).map((s) => (
                <li key={s}>
                  <a
                    href={`/search?q=${encodeURIComponent(s)}`}
                    className="font-serif italic text-ink-700 dark:text-ink-200 hover:text-accent transition-colors"
                  >
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="text-[10px] font-mono text-ink-600 dark:text-ink-300 leading-relaxed">
          <p className="mb-1 uppercase tracking-widest text-ink-500 dark:text-ink-400">engines</p>
          <p className="break-words">{enginesUsedDisplay || "—"}</p>
          {data.unresponsiveEngines.length > 0 && (
            <>
              <p className="mt-3 mb-1 uppercase tracking-widest text-red-700 dark:text-red-400">slow / down</p>
              <p className="break-words">{data.unresponsiveEngines.join(" · ")}</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
