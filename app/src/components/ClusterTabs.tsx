"use client";

import type { Cluster } from "@/lib/types";

interface Props {
  clusters: Cluster[];
  active: string | null;
  onChange: (label: string | null) => void;
}

export default function ClusterTabs({ clusters, active, onChange }: Props) {
  if (!clusters.length) return null;

  return (
    <nav aria-label="Topic clusters" className="mb-4">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`text-xs uppercase tracking-widest px-2 py-1 border transition-colors ${
            active === null
              ? "border-accent text-accent"
              : "border-ink-300 dark:border-ink-700 text-ink-500 hover:text-ink-900 dark:hover:text-ink-100"
          }`}
        >
          All
        </button>
        {clusters.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onChange(c.label)}
            className={`cluster-chip text-xs uppercase tracking-widest px-2 py-1 border transition-colors ${
              active === c.label
                ? "border-accent text-accent"
                : "border-ink-300 dark:border-ink-700 text-ink-500 hover:text-ink-900 dark:hover:text-ink-100"
            }`}
          >
            {c.label} <span className="text-ink-500 font-mono ml-1">{c.count}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
