import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import { getBrand } from "@/lib/brand";

export default async function HomePage() {
  const brand = await getBrand();

  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-2xl">
          <header className="mb-10 text-center">
            <Link href="/" className="inline-block group">
              <h1 className="font-serif text-5xl tracking-tight text-ink-900 dark:text-ink-100 mb-2">
                {brand.prefix} <span className="italic text-accent">{brand.italic}</span>
              </h1>
            </Link>
            <p className="font-serif italic text-ink-700 dark:text-ink-200 text-lg leading-relaxed">
              A small, self-hosted search engine.
              <br />
              <span className="text-ink-500 dark:text-ink-400 not-italic text-sm tracking-wide">
                custom ranking · optional self-hosted AI · no third parties
              </span>
            </p>
          </header>

          <div className="flex justify-center mb-8">
            <SearchBox autoFocus size="lg" />
          </div>

          <ul className="text-xs font-mono text-ink-500 dark:text-ink-400 flex flex-wrap gap-x-4 gap-y-1 justify-center">
            <li>
              <span className="text-accent">·</span> bm25 + engine consensus + trust + recency
            </li>
            <li>
              <span className="text-accent">·</span> mmr diversification
            </li>
            <li>
              <span className="text-accent">·</span> tf-idf topic clusters
            </li>
            <li>
              <span className="text-accent">·</span> self-hosted ai
            </li>
          </ul>
        </div>
      </div>

      <footer className="px-6 py-4 border-t border-ink-200 dark:border-ink-800 text-center font-mono text-[10px] uppercase tracking-widest text-ink-500 dark:text-ink-400 space-y-1">
        {brand.credit && (
          <p>
            Created by{" "}
            <a
              href={brand.credit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline underline-offset-4"
            >
              {brand.credit.name}
            </a>
          </p>
        )}
        <p>searxng → custom rank → optional self-hosted ai · no telemetry · no ads</p>
      </footer>
    </main>
  );
}
