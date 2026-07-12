"use client";

import { useState } from "react";
import { composeDetectText, MIN_DETECT_CHARS } from "@/lib/detect";

interface Props {
  title: string;
  content: string;
}

interface Verdict {
  percent: number | null;
  confidence: string;
  reportUrl?: string;
}

type Status = "idle" | "loading" | "done" | "error";

const CHIP =
  "text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 border transition-colors whitespace-nowrap";

function verdictClasses(percent: number | null): string {
  if (percent === null) return "text-ink-500 dark:text-ink-400 border-ink-300 dark:border-ink-700";
  if (percent >= 65) return "text-red-700 dark:text-red-400 border-red-700/40 dark:border-red-400/40";
  if (percent <= 35)
    return "text-emerald-700 dark:text-emerald-400 border-emerald-700/40 dark:border-emerald-400/40";
  return "text-ink-600 dark:text-ink-300 border-ink-300 dark:border-ink-700";
}

function verdictLabel(percent: number | null): string {
  if (percent === null) return "ai: n/a";
  return `ai ${Math.round(percent)}%`;
}

/**
 * Click-to-check "was this snippet AI-written?" chip. On demand because each
 * uncached verdict costs the detector ~10s of ensemble inference.
 */
export default function DetectBadge({ title, content }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [message, setMessage] = useState("");

  // Not enough text for the detector to say anything meaningful.
  if (composeDetectText(title, content).length < MIN_DETECT_CHARS) return null;

  async function check() {
    setStatus("loading");
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (res.status === 429) {
        setMessage("rate limited");
        setStatus("error");
        return;
      }
      if (!res.ok) {
        setMessage("check failed");
        setStatus("error");
        return;
      }
      setVerdict((await res.json()) as Verdict);
      setStatus("done");
    } catch {
      setMessage("check failed");
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <span className={`${CHIP} text-ink-500 dark:text-ink-400 border-ink-300 dark:border-ink-700 animate-pulse`}>
        ai …
      </span>
    );
  }

  if (status === "done" && verdict) {
    const cls = `${CHIP} ${verdictClasses(verdict.percent)}`;
    const hint = `${verdict.confidence} confidence — likelihood the snippet is AI-generated`;
    if (verdict.reportUrl) {
      return (
        <a
          href={verdict.reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`${hint} · click for full analysis`}
          className={`${cls} hover:opacity-70`}
        >
          {verdictLabel(verdict.percent)}
        </a>
      );
    }
    return (
      <span title={hint} className={cls}>
        {verdictLabel(verdict.percent)}
      </span>
    );
  }

  if (status === "error") {
    return (
      <button
        type="button"
        onClick={check}
        title="Click to retry"
        className={`${CHIP} text-red-700 dark:text-red-400 border-red-700/40 dark:border-red-400/40 hover:text-accent hover:border-accent/60`}
      >
        {message}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={check}
      title="Estimate whether this snippet is AI-generated (self-hosted detector)"
      className={`${CHIP} text-ink-500 dark:text-ink-400 border-ink-300 dark:border-ink-700 hover:text-accent hover:border-accent/60`}
    >
      ai?
    </button>
  );
}
