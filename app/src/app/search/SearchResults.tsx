"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AIPanel from "@/components/AIPanel";
import AIToggle from "@/components/AIToggle";
import ClusterTabs from "@/components/ClusterTabs";
import Infobox from "@/components/Infobox";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import ResultsList from "@/components/ResultsList";
import type { SearchPayload } from "@/lib/types";

interface Props {
  query: string;
  /** Explicit ?ai= URL override; undefined falls back to the saved preference. */
  aiOverride?: boolean;
  debug: boolean;
}

const AI_PREF_KEY = "ai-mode";

export default function SearchResults({ query, aiOverride, debug }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<SearchPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCluster, setActiveCluster] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(aiOverride ?? false);

  useEffect(() => {
    if (aiOverride !== undefined) {
      setAiEnabled(aiOverride);
      return;
    }
    try {
      setAiEnabled(localStorage.getItem(AI_PREF_KEY) === "1");
    } catch {
      /* localStorage unavailable — leave default */
    }
  }, [aiOverride]);

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
    setAiEnabled(next);
    try {
      localStorage.setItem(AI_PREF_KEY, next ? "1" : "0");
    } catch {
      /* localStorage unavailable — still works for this page */
    }
    const sp = new URLSearchParams(params);
    if (next) sp.set("ai", "1");
    else sp.delete("ai");
    router.replace(`/search?${sp.toString()}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!activeCluster) return data.results;
    return data.results.filter((r) => r.cluster === activeCluster);
  }, [data, activeCluster]);

  if (error) {
    return (
      <div>
        <div className="flex items-center justify-end mb-4 pb-2 border-b border-ink-200 dark:border-ink-800">
          <AIToggle enabled={aiEnabled} onChange={setAI} />
        </div>
        <p className="font-serif text-red-700 dark:text-red-400 italic py-8">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return <LoadingSkeleton />;
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

        {/* The right rail is hidden on phones — surface its key content inline. */}
        <div className="md:hidden">
          {data.answers.length > 0 && <DirectAnswer text={data.answers[0]} />}
          {data.infoboxes && data.infoboxes.length > 0 && (
            <Infobox infobox={data.infoboxes[0]} />
          )}
        </div>

        <ClusterTabs
          clusters={data.clusters}
          active={activeCluster}
          onChange={setActiveCluster}
        />

        {aiEnabled && data.results.length > 0 && (
          <AIPanel query={query} results={data.results.slice(0, 8)} />
        )}

        <ResultsList
          results={filtered}
          showDebug={debug}
          showDetect={data.detectorEnabled}
          unresponsiveEngines={data.unresponsiveEngines}
          enginesUsedCount={data.enginesUsed.length}
        />

        {data.suggestions.length > 0 && (
          <div className="md:hidden mt-8">
            <RelatedSuggestions suggestions={data.suggestions} />
          </div>
        )}
      </div>

      <aside className="hidden md:block">
        {data.infoboxes && data.infoboxes.length > 0 && (
          <Infobox infobox={data.infoboxes[0]} />
        )}
        {data.answers.length > 0 && <DirectAnswer text={data.answers[0]} />}
        {data.suggestions.length > 0 && (
          <RelatedSuggestions suggestions={data.suggestions} />
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

function DirectAnswer({ text }: { text: string }) {
  return (
    <div className="border border-ink-300 dark:border-ink-700 p-5 mb-6 bg-white/40 dark:bg-ink-800/30">
      <h3 className="font-serif text-sm uppercase tracking-widest text-ink-600 dark:text-ink-300 mb-2">
        Direct answer
      </h3>
      <p className="font-serif text-sm leading-relaxed text-ink-900 dark:text-ink-100">
        {text}
      </p>
    </div>
  );
}

function RelatedSuggestions({ suggestions }: { suggestions: string[] }) {
  return (
    <div className="mb-6">
      <h3 className="font-serif text-xs uppercase tracking-widest text-ink-600 dark:text-ink-300 mb-2">
        Related
      </h3>
      <ul className="text-sm space-y-1">
        {suggestions.slice(0, 6).map((s) => (
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
  );
}
