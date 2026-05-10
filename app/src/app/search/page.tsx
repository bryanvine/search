import Link from "next/link";
import { Suspense } from "react";
import SearchBox from "@/components/SearchBox";
import { getBrand } from "@/lib/brand";
import SearchResults from "./SearchResults";

interface PageProps {
  searchParams: Promise<{ q?: string; ai?: string; debug?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  return {
    title: q ? q : "Search",
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const ai = sp.ai === "1";
  const debug = sp.debug === "1";
  const brand = await getBrand();

  return (
    <main className="min-h-[100svh] flex flex-col">
      <header className="border-b border-ink-200 dark:border-ink-800 px-4 sm:px-6 py-3 sticky top-0 bg-ink-50/90 dark:bg-ink-900/90 backdrop-blur z-10" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
          <Link
            href="/"
            className="font-serif text-lg sm:text-xl tracking-tight whitespace-nowrap shrink-0 text-ink-900 dark:text-ink-100 leading-none"
          >
            {brand.prefix} <span className="italic text-accent">{brand.italic}</span>
          </Link>
          <div className="flex-1 max-w-2xl">
            <SearchBox initialQuery={q} />
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 sm:px-6 py-5 sm:py-6">
        <div className="max-w-6xl mx-auto">
          {q ? (
            <Suspense fallback={<LoadingSkeleton />}>
              <SearchResults query={q} aiEnabled={ai} debug={debug} />
            </Suspense>
          ) : (
            <p className="font-serif italic text-ink-500 dark:text-ink-400 py-12 text-center">
              Type a query to begin.
            </p>
          )}
        </div>
      </div>

      {brand.credit && (
        <footer
          className="px-4 sm:px-6 py-3 border-t border-ink-200 dark:border-ink-800 text-center font-mono text-[10px] uppercase tracking-widest text-ink-500 dark:text-ink-400"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          Created by{" "}
          <a
            href={brand.credit.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline underline-offset-4"
          >
            {brand.credit.name}
          </a>
        </footer>
      )}
    </main>
  );
}

function LoadingSkeleton() {
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
