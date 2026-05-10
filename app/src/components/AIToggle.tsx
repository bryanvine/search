"use client";

interface Props {
  enabled: boolean;
  onChange: (next: boolean) => void;
}

export default function AIToggle({ enabled, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Toggle AI mode"
      onClick={() => onChange(!enabled)}
      className="inline-flex items-center gap-2 select-none group min-h-[44px] -my-2 py-2 -mr-2 pr-2"
    >
      <span className="text-xs uppercase tracking-widest text-ink-600 dark:text-ink-300 group-hover:text-ink-900 dark:group-hover:text-ink-100 transition-colors">
        AI mode
      </span>
      <span
        aria-hidden
        className={`relative inline-flex h-6 w-11 items-center transition-colors flex-shrink-0 ${
          enabled ? "bg-accent" : "bg-ink-300 dark:bg-ink-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}
