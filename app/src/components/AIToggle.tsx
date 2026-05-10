"use client";

interface Props {
  enabled: boolean;
  onChange: (next: boolean) => void;
}

export default function AIToggle({ enabled, onChange }: Props) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none group">
      <span className="text-xs uppercase tracking-widest text-ink-500 group-hover:text-ink-700 dark:group-hover:text-ink-300 transition-colors">
        AI mode
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-5 w-10 items-center transition-colors ${
          enabled ? "bg-accent" : "bg-ink-300 dark:bg-ink-700"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
