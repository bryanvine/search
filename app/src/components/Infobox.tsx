import type { SearxngResponse } from "@/lib/types";

type InfoboxItem = NonNullable<SearxngResponse["infoboxes"]>[number];

interface Props {
  infobox: InfoboxItem;
}

export default function Infobox({ infobox }: Props) {
  if (!infobox.infobox && !infobox.content) return null;

  return (
    <aside className="border border-ink-300 dark:border-ink-700 p-5 mb-6 bg-white/40 dark:bg-ink-800/30">
      {infobox.infobox && (
        <h3 className="font-serif text-lg text-ink-900 dark:text-ink-50 mb-2">
          {infobox.infobox}
        </h3>
      )}
      {infobox.content && (
        <p className="font-serif text-sm leading-relaxed text-ink-700 dark:text-ink-200 mb-3 line-clamp-6">
          {infobox.content}
        </p>
      )}
      {infobox.urls && infobox.urls.length > 0 && (
        <ul className="text-xs space-y-1">
          {infobox.urls.slice(0, 6).map((u) => (
            <li key={u.url}>
              <a
                href={u.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-ink-600 dark:text-ink-300 hover:text-accent transition-colors"
              >
                ↗ {u.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
