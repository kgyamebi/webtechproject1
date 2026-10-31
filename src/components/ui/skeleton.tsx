export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-line/80 ${className}`} />;
}

export function FormSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
      <Skeleton className="h-11 w-40" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  );
}
