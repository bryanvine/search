"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

interface Props {
  initialQuery?: string;
  autoFocus?: boolean;
  size?: "lg" | "md";
}

export default function SearchBox({ initialQuery = "", autoFocus = false, size = "md" }: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  const isLg = size === "lg";

  return (
    <form
      onSubmit={submit}
      className={`group relative flex items-stretch w-full ${
        isLg ? "max-w-2xl" : "max-w-3xl"
      } border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 transition-shadow focus-within:shadow-md`}
    >
      <input
        ref={ref}
        type="text"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={isLg ? "Ask anything." : "Search…"}
        autoComplete="off"
        spellCheck={false}
        className={`flex-1 bg-transparent outline-none placeholder:text-ink-500 ${
          isLg ? "px-6 py-5 text-2xl font-serif" : "px-4 py-3 text-base font-serif"
        }`}
      />
      <button
        type="submit"
        aria-label="Search"
        className={`flex items-center justify-center px-5 text-ink-700 dark:text-ink-100 hover:text-accent transition-colors ${
          isLg ? "text-xl" : ""
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isLg ? "w-6 h-6" : "w-5 h-5"}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}
