import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

const links = [
  { href: "/#today", label: "What works" },
  { href: "/#roadmap", label: "Roadmap" },
];

export function PublicHeader() {
  return (
    <header className="border-b border-line/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="rounded-md">
          <Wordmark />
          <span className="sr-only">Campus+ home</span>
        </Link>
        <nav aria-label="Public" className="flex items-center gap-2 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hidden rounded-full px-3 py-2 text-ink-soft sm:inline">
              {link.label}
            </Link>
          ))}
          <Link href="/login" className="px-3 py-2 text-sm text-ink">
            Sign in
          </Link>
          <Link href="/register" className="bg-ink px-4 py-2 text-sm text-[var(--canvas)]">
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFrame({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <PublicHeader />
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10">
        {title ? <h1 className="font-display text-4xl text-ink">{title}</h1> : null}
        {children}
      </main>
    </div>
  );
}
