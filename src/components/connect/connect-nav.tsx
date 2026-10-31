import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { signOutAction } from "@/server/identity/actions";

const links = [
  { href: "/workspace", label: "Home" },
  { href: "/workspace/learn", label: "Learn" },
  { href: "/workspace/connect", label: "Connect" },
  { href: "/workspace/communities", label: "Communities" },
  { href: "/workspace/events", label: "Campus Life" },
  { href: "/workspace/profile", label: "Profile" },
  { href: "/workspace/settings", label: "Settings" },
];

export function ConnectNav() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-black/10 px-4 py-6 md:flex dark:border-white/10">
      <Link href="/workspace" className="px-2">
        <Wordmark />
      </Link>
      <nav aria-label="Campus" className="mt-8 grid gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={link.href === "/workspace/connect" ? "page" : undefined}
            className={
              link.href === "/workspace/connect"
                ? "rounded-xl bg-[var(--bubble-me)] px-3 py-2 text-sm font-medium text-[var(--bubble-me-ink)]"
                : "rounded-xl px-3 py-2 text-sm text-[var(--screen-ink)] hover:bg-black/5"
            }
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <form action={signOutAction} className="mt-4">
        <button type="submit" className="rounded-full px-3 py-2 text-sm text-[var(--screen-soft)]">
          Sign out
        </button>
      </form>
    </aside>
  );
}
