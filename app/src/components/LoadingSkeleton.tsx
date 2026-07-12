export default function LoadingSkeleton() {
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
