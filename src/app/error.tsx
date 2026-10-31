"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16" role="alert">
      <h1 className="font-display text-4xl">Something went wrong</h1>
      <p className="mt-3 text-sm leading-6 text-ink-soft">
        The page could not be loaded. Your data has not been changed by this error. You can try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-11 items-center rounded-full bg-pine px-4 text-sm font-medium text-[var(--on-accent)]"
      >
        Try again
      </button>
    </main>
  );
}
