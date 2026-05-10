"use client";

import { useEffect, useRef, useState } from "react";
import type { RankedResult } from "@/lib/types";

interface Props {
  query: string;
  results: RankedResult[];
}

interface Citation {
  num: number;
  url: string;
  title: string;
  domain: string;
}

function renderWithCitations(text: string, citations: Citation[]): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match [1], [2], [3][4], etc.
  const regex = /\[(\d+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const n = parseInt(m[1], 10);
    const cite = citations.find((c) => c.num === n);
    if (cite) {
      parts.push(
        <a
          key={`c-${key++}`}
          href={cite.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${cite.title} — ${cite.domain}`}
          className="inline-flex items-center justify-center mx-0.5 px-1 text-[11px] font-mono text-accent border border-accent/30 hover:bg-accent hover:text-white transition-colors align-baseline"
          style={{ lineHeight: 1.2 }}
        >
          {n}
        </a>
      );
    } else {
      parts.push(m[0]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function AIPanel({ query, results }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const top = results.slice(0, 8);
  const citations: Citation[] = top.map((r, i) => ({
    num: i + 1,
    url: r.url,
    title: r.title,
    domain: r.domain,
  }));

  useEffect(() => {
    if (!query || !top.length) return;
    setText("");
    setError(null);
    setDone(false);
    const ac = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ac;

    (async () => {
      try {
        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            results: top.map((r) => ({
              url: r.url,
              title: r.title,
              content: r.content,
              domain: r.domain,
            })),
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          setError(`AI request failed (${res.status})`);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buf = "";
        while (true) {
          const { done: rd, value } = await reader.read();
          if (rd) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n\n")) >= 0) {
            const event = buf.slice(0, nl);
            buf = buf.slice(nl + 2);
            const line = event.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const data = line.slice(5).trim();
            try {
              const obj = JSON.parse(data) as { delta?: string; done?: boolean; error?: string };
              if (obj.error) {
                setError(obj.error);
                return;
              }
              if (obj.delta) setText((t) => t + obj.delta);
              if (obj.done) setDone(true);
            } catch {
              /* ignore non-json keepalive */
            }
          }
        }
        setDone(true);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setError((err as Error).message);
      }
    })();

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, results.map((r) => r.url).join(",")]);

  return (
    <section className="mb-8 border border-accent/30 bg-accent/[0.03] dark:bg-accent/[0.06]">
      <header className="flex items-center justify-between px-4 py-2 border-b border-accent/20">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 bg-accent" />
          <h3 className="text-xs uppercase tracking-widest text-accent font-sans">
            AI synthesis
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-ink-500 font-sans">
            self-hosted · gpt-oss-120b
          </span>
        </div>
        {!done && !error && (
          <span className="text-[10px] uppercase tracking-wider text-ink-500 font-sans">
            streaming…
          </span>
        )}
      </header>
      <div className="px-5 py-4 font-serif text-[15px] leading-relaxed text-ink-900 dark:text-ink-100">
        {error ? (
          <p className="text-red-700 dark:text-red-400 text-sm">
            Couldn't reach the AI backend: {error}
          </p>
        ) : !text ? (
          <p className="text-ink-500 italic">Reading {top.length} sources…</p>
        ) : (
          <div className={done ? "" : "streaming-cursor"}>
            {renderWithCitations(text, citations)}
          </div>
        )}
      </div>
      {top.length > 0 && (
        <footer className="px-5 pb-3 pt-1 border-t border-accent/20 text-[11px] font-mono text-ink-500 leading-relaxed">
          {top.map((r, i) => (
            <span key={r.url} className="mr-2">
              <span className="text-accent">[{i + 1}]</span>{" "}
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent transition-colors"
              >
                {r.domain}
              </a>
            </span>
          ))}
        </footer>
      )}
    </section>
  );
}
